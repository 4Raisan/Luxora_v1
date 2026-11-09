import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { createGateway } from '../src/gateway.js';
import { SERVICES, serviceForPath, validateDistributedConfig } from '../src/runtime/service-map.js';
import { runTaskScope, trackTask, requestTasks } from '../src/runtime/tasks.js';
import { withChatSession } from '../src/runtime/chat-sessions.js';
import { gatewayClientIp } from '../src/runtime/client-ip.js';
import { runJob, monthlyPeriod } from '../src/jobs.js';
import { registerRealtimeClient, unregisterRealtimeClient, broadcastToUser, startRealtimeBus, stopRealtimeBus } from '../src/services/realtime.js';
import http from 'node:http';

async function listen(app, t) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('every documented API endpoint has exactly one gateway destination', () => {
  const graph = JSON.parse(readFileSync(new URL('../../Knowledge-Graph/knowledge-graph.json', import.meta.url)));
  const endpoints = graph.nodes.filter(node => node.type === 'ApiEndpoint');
  assert.ok(endpoints.length > 100);
  for (const endpoint of endpoints) assert.ok(SERVICES.includes(serviceForPath(endpoint.metadata.path)), endpoint.label);
  assert.equal(serviceForPath('/api/payments/nowpayments/webhook?test=1'), 'payments');
  assert.equal(serviceForPath('/api/provider/kyc-documents'), 'bookings');
  assert.equal(serviceForPath('/api/authentic'), null);
  assert.equal(serviceForPath('/outside'), null);
});

test('domain apps expose their own routes and preserve authentication gates', async t => {
  for (const [service, own, foreign] of [
    ['accounts', '/api/profile', '/api/bookings/my'],
    ['bookings', '/api/bookings/my', '/api/payments/my'],
    ['payments', '/api/payments/my', '/api/notifications'],
    ['engagement', '/api/notifications', '/api/profile'],
  ]) {
    const base = await listen(await createApp({ service }), t);
    assert.equal((await fetch(base + own)).status, 401, service);
    assert.equal((await fetch(base + foreign)).status, 404, service);
    assert.equal((await fetch(base + '/healthz')).status, 200);
  }
});

test('gateway streams unchanged bodies, preserves JWTs and replaces platform identity', async t => {
  const targets = {};
  for (const name of SERVICES) {
    targets[name] = await listen(http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ service: name, path: req.url, method: req.method, body: Buffer.concat(chunks).toString(), headers: req.headers }));
    }), t);
  }
  const base = await listen(createGateway({ targets, identity: async () => 'platform-token' }), t);
  for (const [path, name] of [['/api/auth/login', 'accounts'], ['/api/bookings/1/photos', 'bookings'], ['/api/payments/payhere/webhook', 'payments'], ['/api/chat', 'engagement']]) {
    const raw = 'status_code=2&order_id=abc%2B123';
    const response = await fetch(base + path + '?keep=yes', { method: 'POST', headers: { Authorization: 'Bearer customer-jwt', 'X-Serverless-Authorization': 'untrusted', 'X-Luxora-Client-IP': '198.51.100.1', 'Content-Type': 'application/x-www-form-urlencoded' }, body: raw });
    const body = await response.json();
    assert.equal(body.service, name);
    assert.equal(body.path, path + '?keep=yes');
    assert.equal(body.body, raw);
    assert.equal(body.headers.authorization, 'Bearer customer-jwt');
    assert.equal(body.headers['x-serverless-authorization'], 'Bearer platform-token');
    assert.ok(body.headers['x-luxora-client-ip'].includes('127.0.0.1'));
  }
  assert.equal((await fetch(base + '/api/unknown')).status, 404);
});

test('private services retain client IP across platform hops while legacy ignores custom headers', t => {
  const previous = process.env.LUXORA_RUNTIME;
  t.after(() => { if (previous === undefined) delete process.env.LUXORA_RUNTIME; else process.env.LUXORA_RUNTIME = previous; });
  for (const [runtime, header, expected] of [['serverless', '203.0.113.42', '203.0.113.42'], ['serverless', 'invalid', 'gateway-ip'], ['legacy', '203.0.113.42', 'gateway-ip']]) {
    process.env.LUXORA_RUNTIME = runtime;
    const request = { headers: { 'x-luxora-client-ip': header }, ip: 'gateway-ip' };
    gatewayClientIp(request, {}, () => {});
    assert.equal(request.ip, expected);
  }
});

test('request scope drains unawaited and nested work before completion', async () => {
  const order = [];
  await runTaskScope(async () => {
    trackTask(new Promise(resolve => setImmediate(() => {
      order.push('first');
      trackTask(new Promise(done => setImmediate(() => { order.push('nested'); done(); })));
      resolve();
    })));
  });
  assert.deepEqual(order, ['first', 'nested']);
});

test('HTTP responses wait for request-scoped side effects', async t => {
  let persisted = false;
  const base = await listen(http.createServer((req, res) => requestTasks(req, res, () => {
    trackTask(new Promise(resolve => setTimeout(() => { persisted = true; resolve(); }, 20)));
    res.end('saved');
  })), t);
  assert.equal(await (await fetch(base)).text(), 'saved');
  assert.equal(persisted, true);
});

test('broker routes events from another instance only to the authorized audience', async t => {
  const broker = new EventEmitter();
  broker.subscribe = async () => {};
  broker.quit = async () => {};
  const published = [];
  await startRealtimeBus({ receive: true, redis: { ping: async () => {}, duplicate: () => broker, publish: async (_channel, raw) => published.push(JSON.parse(raw)) } });
  t.after(stopRealtimeBus);
  const clients = [1, 2].map(id => {
    const res = new EventEmitter();
    res.messages = [];
    res.writeHead = () => {};
    res.write = text => res.messages.push(text);
    registerRealtimeClient(id, 'CUSTOMER', res);
    t.after(() => unregisterRealtimeClient(res));
    return res;
  });
  broker.emit('message', 'luxora:realtime:v1', JSON.stringify({ origin: 'another-instance', target: 'user', id: 1, eventName: 'PAYMENT_UPDATED', data: { paymentId: 42 } }));
  assert.equal(clients[0].messages.length, 2);
  assert.equal(clients[1].messages.length, 1);
  await runTaskScope(() => broadcastToUser(2, 'BOOKING_CANCELLED', { bookingId: 8 }));
  assert.equal(published[0].id, 2);
});

test('chat wizard state survives instances, isolates identities and rejects overlap', async () => {
  const values = new Map();
  const redis = {
    get: async key => values.get(key),
    set: async (key, value, _ex, _ttl, nx) => {
      if (nx && values.has(key)) return null;
      values.set(key, value);
      return 'OK';
    },
    eval: async (_script, count, key, ...args) => {
      if (count === 2) {
        const [sessionKey, owner, value] = args;
        if (values.get(key) !== owner) return 0;
        values.set(sessionKey, value);
        return 1;
      }
      if (values.get(key) === args[0]) values.delete(key);
    },
  };
  const invoke = (userId, work) => withChatSession({ sessionId: 'stable-session', userId, work, redis });
  await invoke(1, async session => { session.activeWizard = 'SPECIAL_ASK'; });
  await invoke(1, async session => assert.equal(session.activeWizard, 'SPECIAL_ASK'));
  await invoke(2, async session => assert.equal(session.activeWizard, null));
  let release;
  const first = invoke(1, () => new Promise(resolve => { release = resolve; }));
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(invoke(1, async () => {}), error => error.statusCode === 409);
  release();
  await first;
  await assert.rejects(invoke(1, async session => {
    session.activeWizard = 'STALE';
    for (const key of values.keys()) if (key.endsWith(':lock')) values.delete(key);
  }), error => error.statusCode === 409);
  await invoke(1, async session => assert.equal(session.activeWizard, 'SPECIAL_ASK'));
});

test('scheduled jobs use leases, release failed runs and use Colombo month boundaries', async () => {
  let owner;
  let calls = 0;
  const redis = {
    set: async (_key, value) => { if (owner) return null; owner = value; return 'OK'; },
    eval: async () => { owner = null; },
  };
  const handlers = { job: async () => { calls++; if (calls === 1) throw new Error('outage'); return 'done'; } };
  await assert.rejects(runJob('job', { redis, handlers }), /outage/);
  assert.equal(await runJob('job', { redis, handlers }), 'done');
  owner = 'other-worker';
  assert.deepEqual(await runJob('job', { redis, handlers }), { skipped: true });
  assert.equal(monthlyPeriod(new Date('2026-02-28T17:30:00Z')), '2026-02');
  assert.equal(monthlyPeriod(new Date('2026-02-28T19:00:00Z')), null);
  assert.equal(monthlyPeriod(new Date('2026-04-30T17:30:00Z')), '2026-04');
  await assert.rejects(runJob('unknown', { redis, handlers }), /Unknown job/);
});

test('serverless startup rejects an accidental monolith or missing shared state', t => {
  const previous = process.env.LUXORA_RUNTIME;
  process.env.LUXORA_RUNTIME = 'serverless';
  t.after(() => { if (previous === undefined) delete process.env.LUXORA_RUNTIME; else process.env.LUXORA_RUNTIME = previous; });
  assert.throws(() => validateDistributedConfig('all'), /explicit domain/);
});
