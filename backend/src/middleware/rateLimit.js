// Minimal dependency-free rate limiter (per-IP, in-memory).
// Intended for auth endpoints to slow brute-force attempts.

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message = 'Too many attempts, try again later', keyGenerator } = {}) {
  const hits = new Map();

  // Periodic cleanup so the map does not grow forever.
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, entry] of hits) {
      if (entry.resetAt < cutoff) hits.delete(key);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = keyGenerator ? String(keyGenerator(req) || ip) : ip;
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      res.set('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }
    next();
  };
}
