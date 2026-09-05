/**
 * Real-Time Event Dispatcher for Luxora (Server-Sent Events)
 *
 * Lightweight, standards-based server-push mechanism without external broker dependencies.
 * Provides authenticated, role-scoped event streams with automatic keep-alive pings.
 */

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
  const targetId = Number(userId);
  for (const client of activeClients.values()) {
    if (client.userId === targetId) {
      sendEvent(client.res, eventName, data);
    }
  }
}

/**
 * Broadcast event to all users with a specific role ('CUSTOMER', 'PROVIDER', 'ADMIN')
 */
export function broadcastToRole(role, eventName, data) {
  const targetRole = String(role).toUpperCase();
  for (const client of activeClients.values()) {
    if (client.role === targetRole) {
      sendEvent(client.res, eventName, data);
    }
  }
}

/**
 * Broadcast event to every connected client
 */
export function broadcastToAll(eventName, data) {
  for (const client of activeClients.values()) {
    sendEvent(client.res, eventName, data);
  }
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
