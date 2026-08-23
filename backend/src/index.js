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
import refundRoutes from './routes/refunds.js';
import { prisma } from './config/prisma.js';
import { payHereConfigured, emailDeliveryReady } from './services/integrations.js';

const app = express();
app.disable('x-powered-by');
// The API always runs behind a reverse proxy in production. Without this the
// per-IP rate limiter keys on the proxy's address, so every visitor would
// share a single bucket (global lockout) while attackers get no isolation.
app.set('trust proxy', 1);
const defaultOrigins = [
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const envOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));
const isLocalhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        isLocalhostRegex.test(origin)
      ) {
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
app.use('/api', refundRoutes);
app.use('/api', docsRoutes);

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
  // Routes that throw with an explicit statusCode (e.g. duplicate bookings
  // inside Serializable transactions) keep their intended client error
  // instead of collapsing into a generic 500.
  if (Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({ error: err.message });
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
  if (process.env.NODE_ENV === 'production' && String(process.env.PAYMENT_MODE || '').toLowerCase() === 'demo') {
    console.error('[config] WARNING: PAYMENT_MODE=demo in production lets any user activate paid plans without paying.');
  }
  if (process.env.NODE_ENV === 'production' && !payHereConfigured()) {
    console.error('[config] WARNING: PayHere credentials are not set — package checkout will return 503 until they are configured.');
  }
  if (process.env.NODE_ENV === 'production' && !emailDeliveryReady()) {
    console.error('[config] WARNING: RESEND_FROM_EMAIL is not a verified sender domain — password reset and transactional email will not be delivered. The reset endpoint answers 503 until this is fixed.');
  }
});

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
