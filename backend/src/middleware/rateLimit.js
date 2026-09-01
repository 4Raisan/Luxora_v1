import Redis from 'ioredis';

// Distributed Redis store or bounded in-memory LRU store for multi-instance deployments.
const MAX_TRACKED_IPS = 10000;

let redisClient = null;
let redisLogged = false;

export function getRedisClient() {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
        retryStrategy(times) {
          return Math.min(times * 200, 2000);
        },
      });
      redisClient.on('connect', () => {
        if (!redisLogged) {
          console.info('[rate-limit] Connected to Redis distributed store.');
          redisLogged = true;
        }
      });
      redisClient.on('error', (err) => {
        if (!redisLogged) {
          console.warn('[rate-limit] Redis connection error, using local fallback:', err.message);
          redisLogged = true;
        }
      });
      return redisClient;
    } catch (err) {
      console.warn('[rate-limit] Failed to initialize Redis client:', err.message);
    }
  } else if (process.env.NODE_ENV === 'production' && !redisLogged) {
    console.info('[rate-limit] REDIS_URL not configured. Operating in single-instance bounded in-memory mode.');
    redisLogged = true;
  }
  return null;
}

export function setRedisClient(client) {
  redisClient = client;
  redisLogged = false;
}

export async function closeRedisClient() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
    redisLogged = false;
  }
}

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message = 'Too many attempts, try again later', keyPrefix = 'rl' } = {}) {
  const hits = new Map();
  const windowSec = Math.ceil(windowMs / 1000);

  // Periodic cleanup for local in-memory fallback
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.min(windowMs, 60000)).unref();

  return async (req, res, next) => {
    // Rely exclusively on req.ip which Express evaluates against the configured trust-proxy topology
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown').trim();
    const now = Date.now();
    const redis = getRedisClient();

    if (redis && redis.status === 'ready') {
      const redisKey = `${keyPrefix}:${ip}`;
      try {
        const pipeline = redis.pipeline();
        pipeline.incr(redisKey);
        pipeline.ttl(redisKey);
        const results = await pipeline.exec();
        const count = results[0]?.[1] || 1;
        let ttl = results[1]?.[1] || -1;

        if (ttl === -1) {
          await redis.expire(redisKey, windowSec);
          ttl = windowSec;
        }

        const remaining = Math.max(0, max - count);
        const resetSeconds = ttl > 0 ? ttl : windowSec;

        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Reset', String(resetSeconds));

        if (count > max) {
          res.setHeader('Retry-After', String(resetSeconds));
          return res.status(429).json({ error: message });
        }
        return next();
      } catch {
        // Fall back to in-memory handling on transient Redis error
      }
    }

    // In-memory bounded LRU fallback
    let entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      if (hits.size >= MAX_TRACKED_IPS) {
        const oldestKey = hits.keys().next().value;
        if (oldestKey) hits.delete(oldestKey);
      }
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(resetSeconds));
      return res.status(429).json({ error: message });
    }
    next();
  };
}
