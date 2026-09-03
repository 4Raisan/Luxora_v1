import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from './config/env.js';
import authRoutes from './routes/auth.js';
import serviceRoutes from './routes/services.js';
import bookingRoutes from './routes/bookings.js';
import reviewRoutes from './routes/reviews.js';
import complaintRoutes from './routes/complaints.js';
import adminRoutes from './routes/admin.js';
import customerRoutes from './routes/customer.js';
import providerRoutes from './routes/provider.js';
import promotionRoutes from './routes/promotions.js';
import notificationRoutes from './routes/notifications.js';
import docsRoutes from './routes/docs.js';
import integrationRoutes from './routes/integrations.js';
import profileRoutes from './routes/profile.js';
import uploadRoutes from './routes/uploads.js';
import supportRoutes from './routes/support.js';
import chatRoutes from './routes/chat.js';
import { prisma } from './config/prisma.js';
import { assertStorageConfigured } from './services/storage.js';
import { assertBankingKeyConfigured } from './services/bankingCrypto.js';
import { startMonthlyPayoutScheduler } from './services/payouts.js';
import { renewDueDemoSubscriptions } from './routes/services.js';
import { startBookingTimeoutScheduler } from './services/bookingTimeouts.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './middleware/auth.js';
import { registerRealtimeClient } from './services/realtime.js';

// Enforce durable storage & banking key in production on startup
assertStorageConfigured();
assertBankingKeyConfigured();

const app = express();
app.disable('x-powered-by');

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
app.use('/api/auth', authRoutes);
app.use('/api', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
// uploadRoutes owns /api/provider/kyc-documents, which pending-KYC providers
// must reach; mount it before the KYC-gated provider router so the gate cannot
// shadow the document-upload path.
app.use('/api', uploadRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', integrationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/support', supportRoutes);
app.use('/api', chatRoutes);
app.use('/api', docsRoutes);

// Real-time Server-Sent Events (SSE) Stream
app.get('/api/realtime', (req, res) => {
  const token = req.query.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
  if (!token) return res.status(401).json({ error: 'Access token required for real-time connection' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    registerRealtimeClient(user.id, user.role, res);
  });
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
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
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

// Seed a welcome promotion on first run (idempotent)
prisma.promotion.count().then((c) => {
  if (c === 0) {
    return prisma.promotion.create({
      data: {
        title: 'Welcome to Luxora',
        description: '15% off your first subscription — a gift for joining the concierge network.',
        code: 'LUXORA15',
        discountPct: 15,
      },
    });
  }
}).catch((err) => console.error('[startup] welcome promotion seed failed:', err.message));

const server = app.listen(PORT, () => {
  console.log(`Luxora Backend API server running on http://localhost:${PORT}`);
  console.log(`API docs: http://localhost:${PORT}/api/docs`);
});
startMonthlyPayoutScheduler();
startBookingTimeoutScheduler();
setInterval(() => renewDueDemoSubscriptions().catch((error) => console.error('[demo-renewal] failed:', error.message)), 60 * 60 * 1000).unref();

// Graceful shutdown (Docker / orchestrator friendly)
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  });
  // Force-exit if connections refuse to drain
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
