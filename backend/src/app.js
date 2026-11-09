import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from './config/env.js';
import { prisma } from './config/prisma.js';
import { assertStorageConfigured } from './services/storage.js';
import { assertBankingKeyConfigured } from './services/bankingCrypto.js';
import { verifySession } from './middleware/auth.js';
import { registerRealtimeClient } from './services/realtime.js';
import { requestTasks } from './runtime/tasks.js';
import { validateDistributedConfig } from './runtime/service-map.js';
import { gatewayClientIp } from './runtime/client-ip.js';

// Enforce durable storage & banking key in production on startup
assertStorageConfigured();
assertBankingKeyConfigured();

export async function createApp({ service = 'all' } = {}) {
  validateDistributedConfig(service);
  if (!['all', 'accounts', 'bookings', 'payments', 'engagement'].includes(service)) throw new Error('Unknown service');
  const owns = (name) => service === 'all' || service === name;
  const app = express();
  app.disable('x-powered-by');
  app.use(requestTasks);
  app.use(gatewayClientIp);
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', service }));

  // Configure reverse proxy trust explicitly (do not auto-trust in production without explicit configuration)
  if (process.env.TRUST_PROXY) {
    const tp = process.env.TRUST_PROXY.trim();
    if (tp === 'true' || tp === '1') {
      app.set('trust proxy', 1);
    } else if (tp === 'false' || tp === '0') {
      app.set('trust proxy', false);
    } else if (!isNaN(Number(tp))) {
      app.set('trust proxy', Number(tp));
    } else {
      app.set('trust proxy', tp);
    }
  } else {
    app.set('trust proxy', false);
  }

  // Baseline HTTP Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    if (isHttps) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://accounts.google.com https://sandbox.payhere.lk https://www.payhere.lk",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https://accounts.google.com https://sandbox.payhere.lk https://www.payhere.lk",
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);

    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  // Routes
  if (owns('accounts')) app.use('/api/auth', (await import('./routes/auth.js')).default);
  if (owns('payments')) app.use('/api', (await import('./routes/services.js')).default);
  if (owns('bookings')) app.use('/api/bookings', (await import('./routes/bookings.js')).default);
  if (owns('engagement')) app.use('/api/reviews', (await import('./routes/reviews.js')).default);
  if (owns('engagement')) app.use('/api/complaints', (await import('./routes/complaints.js')).default);
  if (owns('bookings')) app.use('/api/admin', (await import('./routes/admin.js')).default);
  if (owns('bookings')) app.use('/api/customer', (await import('./routes/customer.js')).default);
  // uploadRoutes owns /api/provider/kyc-documents, which pending-KYC providers
  // must reach; mount it before the KYC-gated provider router so the gate cannot
  // shadow the document-upload path.
  if (owns('bookings')) app.use('/api', (await import('./routes/uploads.js')).default);
  if (owns('bookings')) app.use('/api/provider', (await import('./routes/provider.js')).default);
  if (owns('payments')) app.use('/api/promotions', (await import('./routes/promotions.js')).default);
  if (owns('engagement')) app.use('/api/notifications', (await import('./routes/notifications.js')).default);
  if (owns('payments')) app.use('/api', (await import('./routes/integrations.js')).default);
  if (owns('payments')) app.use('/api', (await import('./routes/demoPayments.js')).default);
  if (owns('payments')) app.use('/api', (await import('./routes/refunds.js')).default);
  if (owns('accounts')) app.use('/api/profile', (await import('./routes/profile.js')).default);
  if (owns('engagement')) app.use('/api/support', (await import('./routes/support.js')).default);
  if (owns('engagement')) app.use('/api', (await import('./routes/chat.js')).default);
  app.use('/api', (await import('./routes/docs.js')).default);

  // Real-time Server-Sent Events (SSE) Stream
  if (owns('engagement')) app.get('/api/realtime', async (req, res) => {
    const token = req.query.token || req.headers.authorization?.split(' ')[1];
    try {
      const user = await verifySession(token);
      registerRealtimeClient(user.id, user.role, res, () => verifySession(token));
    } catch (error) {
      res.status(error.statusCode || 503).json({ error: error.message });
    }
  });

  // Health check (used by docker-compose / load balancers)
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down', time: new Date().toISOString() });
    }
  });

  // JSON 404 for unknown API paths
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Serve the built frontend when it exists (Docker production image).
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (service === 'all' && fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
    // SPA fallback: any non-API GET goes to index.html
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(frontendDist, 'index.html'));
      }
      next();
    });
  }

  // Central error handler — maps Prisma errors to clean JSON responses
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large' });
    }
    if (err?.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Uploaded files must be 5 MB or smaller' });
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: 'Unexpected upload field or too many files' });
      return res.status(400).json({ error: 'Invalid file upload' });
    }
    switch (err?.code) {
      case 'P2002':
        return res.status(409).json({ error: 'A record with this value already exists' });
      case 'P2025':
        return res.status(404).json({ error: 'Record not found' });
      case 'P2003':
        return res.status(400).json({ error: 'Related record does not exist' });
      default:
        console.error('[unhandled]', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
  });


  return app;
}

export function getAllowedOrigins(isProduction = process.env.NODE_ENV === 'production') {
  const envOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction) {
    // In production, allow ONLY explicitly configured public origins. Never allow wildcard with credentials.
    return envOrigins.filter((origin) => origin !== '*');
  }

  const devDefaults = [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  return Array.from(new Set([...devDefaults, ...envOrigins]));
}

const isLocalhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isOriginAllowed(origin, isProduction = process.env.NODE_ENV === 'production') {
  if (!origin) return true;
  const allowed = getAllowedOrigins(isProduction);
  if (allowed.includes(origin)) return true;
  if (!isProduction) {
    if (isLocalhostRegex.test(origin)) return true;
  }
  return false;
}

