import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'node:events';
import { verifySessionToken } from '../src/services/sessionAuth.js';
import { registerRealtimeClient, refreshRealtimeSessions, getActiveClientCount,
  broadcastToUser, unregisterRealtimeClient } from '../src/services/realtime.js';

const secret = crypto.randomBytes(32).toString('hex');
const current = { id: 5, active: true, role: 'CUSTOMER', tokenVersion: 2 };
const sign = (claims = {}, options = {}) => jwt.sign({ id: 5, tokenVersion: 2, role: 'ADMIN', ...claims }, secret, options);
const verify = (token, user = current) => verifySessionToken(token, {
  verifyJwt: value => jwt.verify(value, secret), findUser: async () => user,
});

test('session verification rejects invalid, expired, revoked and inactive identities', async () => {
  for (const [token, user, code] of [
    [null, current, 401], ['invalid', current, 403],
    [sign({}, { expiresIn: -1 }), current, 403],
    [sign({ tokenVersion: 1 }), current, 403],
    [sign(), { ...current, active: false }, 403],
    [sign(), null, 403], [sign({ id: '5' }), current, 403],
  ]) await assert.rejects(verify(token, user), error => error.statusCode === code);
  assert.equal((await verify(sign())).role, 'CUSTOMER');
  await assert.rejects(verifySessionToken(sign(), {
    verifyJwt: value => jwt.verify(value, secret), findUser: async () => { throw new Error('offline'); },
  }), error => error.statusCode === 503);
});

test('open SSE connections close on revocation and receive no further events', async () => {
  const res = new EventEmitter();
  const writes = [];
  res.writeHead = () => {};
  res.write = value => writes.push(value);
  res.end = () => { res.ended = true; res.emit('close'); };
  let user = { ...current };
  const token = sign();
  registerRealtimeClient(5, 'CUSTOMER', res, () => verify(token, user));
  try {
    await refreshRealtimeSessions();
    assert.equal(res.ended, undefined);
    user.tokenVersion++;
    await refreshRealtimeSessions();
    assert.equal(res.ended, true);
    const count = writes.length;
    broadcastToUser(5, 'private', { value: 'must not arrive' });
    assert.equal(writes.length, count);
    assert.equal(getActiveClientCount(), 0);
  } finally { unregisterRealtimeClient(res); }
});


test('REST and chat reject revoked credentials while anonymous chat stays available', async () => {
  // No real database is used: replace the only identity query before requests.
  process.env.JWT_SECRET = secret;
  process.env.DATABASE_URL = 'postgresql://local:local@127.0.0.1:1/test?schema=luxora_test';
  const { prisma } = await import('../src/config/prisma.js');
  const { authenticateToken } = await import('../src/middleware/auth.js');
  const { default: chatRouter } = await import('../src/routes/chat.js');
  const { default: express } = await import('express');
  const original = prisma.user.findUnique;
  prisma.user.findUnique = async () => ({ ...current });
  const app = express();
  app.use(express.json());
  app.get('/rest', authenticateToken, (req, res) => res.json({ role: req.user.role }));
  app.use('/api', chatRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ['/rest', '/api/chat', '/api/chatbot/special-ask']) {
      const response = await fetch(base + route, {
        method: route === '/rest' ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${sign({ tokenVersion: 1 })}`, 'Content-Type': 'application/json' },
        ...(route === '/rest' ? {} : { body: JSON.stringify({ message: 'hello' }) }),
      });
      assert.equal(response.status, 403, route);
      assert.match((await response.json()).error, /revoked/i);
    }
    const valid = await fetch(base + '/rest', { headers: { Authorization: `Bearer ${sign()}` } });
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).role, 'CUSTOMER');
    const guest = await fetch(base + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello', sessionId: 'auth-regression-guest' }),
    });
    assert.equal(guest.status, 200);
    await guest.json();
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    prisma.user.findUnique = original;
    await prisma.$disconnect();
  }
});
