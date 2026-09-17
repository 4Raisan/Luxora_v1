import Redis from 'ioredis';
import { createHash } from 'node:crypto';

const MAX_TRACKED_KEYS = 10000;
const OUTAGE_RETRY_SECONDS = 5;
let redisClient = null;
let redisState = '';

function logState(state) {
  if (state === redisState) return;
  redisState = state;
  if (state === 'ready') console.info('[rate-limit] Redis shared counters ready.');
  else if (state === 'local') console.info('[rate-limit] REDIS_URL absent: bounded instance-local limits only.');
  else console.warn('[rate-limit] Redis unavailable: limited endpoints fail closed with 503.');
}

export function getRedisClient() {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production') logState('local');
    return null;
  }
  try {
    const url = new URL(redisUrl);
    if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('Invalid Redis protocol');
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      connectTimeout: 1000,
      commandTimeout: 1000,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    redisClient.on('ready', () => logState('ready'));
    redisClient.on('error', () => logState('unavailable'));
    redisClient.on('close', () => logState('unavailable'));
    return redisClient;
  } catch {
    logState('unavailable');
    return null;
  }
}

export function setRedisClient(client) {
  redisClient = client;
  redisState = '';
}

export async function closeRedisClient() {
  const client = redisClient;
  redisClient = null;
  if (client) {
    try { await client.quit(); } catch { client.disconnect(); }
  }
  redisState = '';
}

// One script increments every dimension and establishes expiry atomically.
// Redis cluster hash tags keep a limiter's dimensions in the same slot.
const CONSUME = `
local result = {}
for i, key in ipairs(KEYS) do
  local count = tonumber(redis.call('GET', key) or '0')
  if count <= tonumber(ARGV[2]) then count = redis.call('INCR', key) end
  local ttl = redis.call('PTTL', key)
  if ttl < 0 then
    redis.call('PEXPIRE', key, ARGV[1])
    ttl = tonumber(ARGV[1])
  end
  result[#result + 1] = count
  result[#result + 1] = ttl
end
return result
`;

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function identityKeys(req, strategy) {
  // Express alone interprets forwarding headers according to TRUST_PROXY.
  let ip = String(req.ip || req.socket?.remoteAddress || 'unknown').trim();
  if (ip.startsWith('::ffff:') && /^\d+\.\d+\.\d+\.\d+$/.test(ip.slice(7))) ip = ip.slice(7);
  const keys = [`ip:${digest(ip)}`];
  if (strategy === 'hybrid' && Number.isSafeInteger(req.user?.id) && req.user.id > 0) {
    keys.push(`user:${digest(String(req.user.id))}`);
  }
  return keys;
}

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message = 'Too many attempts, try again later', keyPrefix = 'rl', strategy = 'ip', maxTrackedKeys = MAX_TRACKED_KEYS } = {}) {
  if (!Number.isSafeInteger(max) || max < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1 || !Number.isSafeInteger(maxTrackedKeys) || maxTrackedKeys < 1 || !['ip', 'hybrid'].includes(strategy) || !/^[a-zA-Z0-9_-]+$/.test(keyPrefix)) {
    throw new TypeError('Invalid rate limiter configuration');
  }
  const hits = new Map();
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  };
  const timer = setInterval(cleanup, Math.min(windowMs, 60000));
  timer.unref();

  const unavailable = (res) => {
    res.setHeader('Retry-After', String(OUTAGE_RETRY_SECONDS));
    return res.status(503).json({ error: 'Rate limiting temporarily unavailable, try again later' });
  };

  const middleware = async (req, res, next) => {
    const keys = identityKeys(req, strategy);
    const redis = getRedisClient();
    let entries;
    if (redis || process.env.REDIS_URL) {
      if (!redis || redis.status !== 'ready') return unavailable(res);
      try {
        const result = await redis.eval(CONSUME, keys.length, ...keys.map((key) => `luxora:rl:{${keyPrefix}}:${key}`), windowMs, max);
        if (!Array.isArray(result) || result.length !== keys.length * 2 || result.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Invalid counter response');
        entries = keys.map((_, index) => ({ count: result[index * 2], ttl: result[index * 2 + 1] }));
        logState('ready');
      } catch {
        logState('unavailable');
        return unavailable(res);
      }
    } else {
      const now = Date.now();
      const missing = keys.filter((key) => !hits.has(key) || hits.get(key).resetAt <= now);
      if (hits.size + missing.length > maxTrackedKeys) cleanup();
      const newKeys = keys.filter((key) => !hits.has(key));
      // Never evict live counters: identity churn must not reset an exhausted key.
      if (hits.size + newKeys.length > maxTrackedKeys) return unavailable(res);
      entries = keys.map((key) => {
        let entry = hits.get(key);
        if (!entry || entry.resetAt <= now) {
          entry = { count: 0, resetAt: now + windowMs };
          hits.set(key, entry);
        }
        entry.count = Math.min(entry.count + 1, max + 1);
        return { count: entry.count, ttl: entry.resetAt - now };
      });
    }
    const blocked = entries.filter((entry) => entry.count > max);
    const remaining = Math.max(0, Math.min(...entries.map((entry) => max - entry.count)));
    const governing = blocked.length ? blocked : entries.filter((entry) => max - entry.count === remaining);
    const resetSeconds = Math.max(1, Math.ceil(Math.max(...governing.map((entry) => entry.ttl)) / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));
    if (blocked.length) {
      res.setHeader('Retry-After', String(resetSeconds));
      return res.status(429).json({ error: message });
    }
    return next();
  };
  middleware.dispose = () => clearInterval(timer);
  return middleware;
}
