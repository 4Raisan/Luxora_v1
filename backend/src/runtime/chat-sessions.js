import crypto from 'node:crypto';
import { getRedisClient } from '../middleware/rateLimit.js';

const releaseLock = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
const saveSession = "if redis.call('get', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('set', KEYS[2], ARGV[2], 'EX', 3600) return 1";

// A wizard must survive requests landing on different service instances.
// Serialize updates to a session; namespace signed-in users separately.
export async function withChatSession({ sessionId, userId, create, work, redis = getRedisClient() }) {
  const id = String(sessionId || crypto.randomUUID()).slice(0, 128);
  const key = `luxora:chat:{${crypto.createHash('sha256').update(`${userId || 'guest'}:${id}`).digest('hex')}}`;
  if (!redis) {
    const session = create(key);
    session.id = id;
    return work(session);
  }
  const lock = `${key}:lock`;
  const owner = crypto.randomUUID();
  if (await redis.set(lock, owner, 'EX', 120, 'NX') !== 'OK') throw Object.assign(new Error('A chat message is already being processed. Retry shortly.'), { statusCode: 409 });
  try {
    const stored = await redis.get(key);
    const session = stored ? JSON.parse(stored) : { id, activeWizard: null, specialAskDraft: null, sizingDraft: null, history: [] };
    const result = await work(session);
    if (await redis.eval(saveSession, 2, lock, key, owner, JSON.stringify(session)) !== 1) {
      throw Object.assign(new Error('Chat session lease expired. Please retry your message.'), { statusCode: 409 });
    }
    return result;
  } finally {
    await redis.eval(releaseLock, 1, lock, owner);
  }
}
