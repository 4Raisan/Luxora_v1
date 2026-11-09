/**
 * Real-Time Event Dispatcher for Luxora (Server-Sent Events)
 *
 * Standards-based server push with an optional shared Redis transport.
 * Provides authenticated, role-scoped event streams with automatic keep-alive pings.
 */

import crypto from 'node:crypto';
import { getRedisClient } from '../middleware/rateLimit.js';
import { trackTask } from '../runtime/tasks.js';

const instanceId = crypto.randomUUID();
// Redis Pub/Sub ignores logical database numbers; include that number so
// staging/test databases on the same broker cannot exchange customer events.
const brokerDatabase = process.env.REDIS_URL ? new URL(process.env.REDIS_URL).pathname.slice(1) || '0' : '0';
const channel = `${process.env.LUXORA_NAMESPACE || 'luxora'}:realtime:v1:${brokerDatabase}`;
let publisher = null;
let subscriber = null;

async function waitForRedis(redis) {
  if (redis.status && redis.status !== 'ready') {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { redis.off('ready', ready); reject(new Error('Redis startup timed out')); }, 10000);
      const ready = () => { clearTimeout(timeout); resolve(); };
      redis.once('ready', ready);
    });
  }
}

export async function startRealtimeBus({ receive = false, redis = getRedisClient() } = {}) {
  if (!redis) return;
  await waitForRedis(redis);
  await redis.ping();
  publisher = redis;
  if (receive && !subscriber) {
    subscriber = redis.duplicate();
    subscriber.on('error', error => console.warn('[realtime] subscriber:', error.message));
    subscriber.on('message', (_channel, raw) => {
      try {
        const event = JSON.parse(raw);
        if (event.origin !== instanceId) deliverRealtimeEvent(event);
      } catch { /* Ignore malformed broker messages. */ }
    });
    await waitForRedis(subscriber);
    await subscriber.subscribe(channel);
  }
}

export async function stopRealtimeBus() {
  if (subscriber) await subscriber.quit();
  subscriber = null;
  publisher = null;
}

export function deliverRealtimeEvent({ target, id, eventName, data }) {
  if (!['user', 'role', 'all'].includes(target) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(eventName || '')) return;
  for (const client of activeClients.values()) {
    if (target === 'all' || (target === 'user' && client.userId === Number(id)) || (target === 'role' && client.role === String(id).toUpperCase())) sendEvent(client.res, eventName, data);
  }
}

function dispatch(target, id, eventName, data) {
  const event = { origin: instanceId, target, id, eventName, data };
  deliverRealtimeEvent(event);
  if (publisher) trackTask(publisher.publish(channel, JSON.stringify(event)).catch(error => console.warn('[realtime] publish:', error.message)));
}

// Only open HTTP connections are local. Events cross service instances.
// In-memory registry of active SSE connections
// Structure: Map<res, { userId: number, role: string, res: Response } >
const activeClients = new Map();

/**
 * Register a new SSE client connection
 */
export function registerRealtimeClient(userId, role, res, validateSession = null) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Initial connection handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`);

  const clientInfo = { userId: Number(userId), role: String(role).toUpperCase(), res, validateSession };
  activeClients.set(res, clientInfo);

  res.on('close', () => {
    activeClients.delete(res);
  });
}

/**
 * Unregister a client connection explicitly
 */
export function unregisterRealtimeClient(res) {
  activeClients.delete(res);
}

/**
 * Count active connected clients (optionally filtered by role)
 */
export function getActiveClientCount(role = null) {
  if (!role) return activeClients.size;
  let count = 0;
  const targetRole = String(role).toUpperCase();
  for (const client of activeClients.values()) {
    if (client.role === targetRole) count += 1;
  }
  return count;
}

/**
 * Send raw event string to a specific response stream
 */
function sendEvent(res, eventName, data) {
  try {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${eventName}\ndata: ${payload}\n\n`);
  } catch {
    activeClients.delete(res);
  }
}

/**
 * Broadcast event to a specific user ID
 */
export function broadcastToUser(userId, eventName, data) {
  dispatch('user', Number(userId), eventName, data);
}

/**
 * Broadcast event to all users with a specific role ('CUSTOMER', 'PROVIDER', 'ADMIN')
 */
export function broadcastToRole(role, eventName, data) {
  dispatch('role', String(role).toUpperCase(), eventName, data);
}

/**
 * Broadcast event to every connected client
 */
export function broadcastToAll(eventName, data) {
  dispatch('all', null, eventName, data);
}

/**
 * High-level booking event dispatcher with role/user-based delivery.
 *
 * Targets:
 * - The booking's customer (userId)
 * - The assigned provider (if providerId is present)
 * - All Admins
 * - For PENDING bookings or claims, all eligible providers
 */
export function broadcastBookingEvent(eventType, bookingData, metadata = {}) {
  const payload = {
    type: eventType,
    booking: bookingData,
    metadata,
    timestamp: new Date().toISOString(),
  };

  // 1. Notify the customer
  if (bookingData?.userId) {
    broadcastToUser(bookingData.userId, eventType, payload);
  }

  // 2. Notify the assigned provider (if assigned)
  if (bookingData?.providerUserId) {
    broadcastToUser(bookingData.providerUserId, eventType, payload);
  }

  // 3. Always notify all Admins
  broadcastToRole('ADMIN', eventType, payload);

  // 4. For PENDING bookings or claim notifications, broadcast to all providers
  if (
    (eventType === 'BOOKING_CREATED' && (!bookingData.providerId || bookingData.status === 'PENDING')) ||
    eventType === 'BOOKING_CLAIMED' ||
    eventType === 'BOOKING_PENDING_AVAILABLE'
  ) {
    broadcastToRole('PROVIDER', eventType, payload);
  }
}

// Recheck open sessions on the existing heartbeat. Revocation is bounded by
// one interval plus the database lookup; a failed lookup closes the stream.
let checkingSessions = false;
export async function refreshRealtimeSessions() {
  if (checkingSessions) return;
  checkingSessions = true;
  try {
    await Promise.all([...activeClients.values()].map(async (client) => {
      try {
        if (client.validateSession) {
          const current = await client.validateSession();
          client.role = String(current.role).toUpperCase();
        }
        if (activeClients.has(client.res)) client.res.write(': ping\n\n');
      } catch {
        activeClients.delete(client.res);
        client.res.end();
      }
    }));
  } finally { checkingSessions = false; }
}

setInterval(() => { void refreshRealtimeSessions(); }, 25000).unref();
