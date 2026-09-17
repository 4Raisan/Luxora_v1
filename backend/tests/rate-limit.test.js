// Run directly with node --test backend/tests/rate-limit.test.js (no DB setup).
// Redis cases require TEST_REDIS_URL from the runner environment; never load .env.
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { rateLimit, setRedisClient, closeRedisClient } from '../src/middleware/rateLimit.js';

const redisUrl = process.env.TEST_REDIS_URL;
const secret = randomBytes(32);
// Documentation-only, non-loopback addresses supplied through the trusted fixture.
const ips = ['203.0.113.11', '198.51.100.22', '192.0.2.33'];
const windowMs = 10000;
let savedRedisUrl;
let clients;
let servers;
let limiters;
let prefixes;

function prefix() {
  const value = `test-${randomUUID()}`;
  prefixes.add(value);
  return value;
}

async function connectRedis() {
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: 1500,
    commandTimeout: 1500,
    retryStrategy: () => null,
  });
  clients.push(client);
  client.on('error', () => {}); // Suppress driver logging, not test failures.
  try {
    await client.connect();
    assert.equal(await client.ping(), 'PONG');
  } catch {
    throw new Error('Configured TEST_REDIS_URL is unreachable or not usable');
  }
  return client;
}

async function fixture(options = {}, { trustProxy = 'loopback', client = null } = {}) {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.use((req, res, next) => {
    const authorization = req.get('authorization');
    if (authorization) {
      try {
        req.user = jwt.verify(authorization.replace(/^Bearer /, ''), secret, { algorithms: ['HS512'] });
      } catch {
        return res.status(401).json({ error: 'Invalid fixture token' });
      }
    }
    res.setHeader('X-Fixture-IP', req.ip);
    next();
  });
  const limiter = rateLimit({ max: 2, windowMs, keyPrefix: prefix(), ...options });
  limiters.push(limiter);
  // Each app selects its own injected client before entering the actual middleware.
  app.use('/limited', (req, res, next) => {
    setRedisClient(client);
    return limiter(req, res, next);
  });
  app.get('/limited', (req, res) => res.json({ ok: true, ip: req.ip }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    limiter,
    async request({ ip = ips[0], user, path = '/limited', token } = {}) {
      const headers = { 'X-Forwarded-For': ip };
      if (user !== undefined) token = jwt.sign({ id: user }, secret, { algorithm: 'HS512', expiresIn: '1m' });
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(10000) });
      return { status: response.status, headers: response.headers, body: await response.json() };
    },
  };
}

function unavailable(response) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '5');
  assert.match(response.body.error, /temporarily unavailable/i);
}

// Serial execution is required because the production injection API is module-global.
describe('rate limiter over real Express HTTP', { concurrency: false, timeout: 90000 }, () => {
  beforeEach(() => {
    savedRedisUrl = process.env.REDIS_URL;
    delete process.env.REDIS_URL; // Local tests must run even with production env inherited.
    setRedisClient(null);
    clients = [];
    servers = [];
    limiters = [];
    prefixes = new Set();
  });

  afterEach(async () => {
    try {
      for (const limiter of limiters) limiter.dispose();
      await Promise.all(servers.map(server => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      })));
      const cleaner = clients.find(client => client.status === 'ready');
      if (cleaner) {
        // Track UUID namespaces, SCAN only those namespaces, and delete only matches.
        // Never clear the database or scan/delete another test's namespace.
        for (const value of prefixes) {
          const start = `luxora:rl:{${value}}:`;
          const keys = new Set();
          let cursor = '0';
          const deadline = Date.now() + 5000;
          do {
            assert.ok(Date.now() < deadline, 'Test-key cleanup scan exceeded deadline');
            const result = await cleaner.scan(cursor, 'MATCH', `${start}*`, 'COUNT', 200);
            cursor = result[0];
            for (const key of result[1]) {
              assert.ok(key.startsWith(start));
              keys.add(key);
            }
          } while (cursor !== '0');
          for (const key of keys) await cleaner.del(key);
        }
      }
    } finally {
      try {
        for (const client of clients) {
          setRedisClient(client);
          await closeRedisClient();
          client.disconnect();
        }
      } finally {
        setRedisClient(null);
        if (savedRedisUrl === undefined) delete process.env.REDIS_URL;
        else process.env.REDIS_URL = savedRedisUrl;
      }
    }
  });

  for (const mode of ['local', 'redis']) {
    describe(mode, { concurrency: false, skip: mode === 'redis' && !redisUrl ? 'TEST_REDIS_URL absent' : false }, () => {
      let client;
      beforeEach(async () => {
        client = mode === 'redis' ? await connectRedis() : null;
      });
      const app = (options, settings) => fixture(options, { client, ...settings });

      test('low-volume requests remain allowed with decreasing remaining quota', async () => {
        const f = await app({ max: 5 });
        for (let remaining = 4; remaining >= 2; remaining--) {
          const r = await f.request();
          assert.equal(r.status, 200);
          assert.equal(r.headers.get('ratelimit-limit'), '5');
          assert.equal(r.headers.get('ratelimit-remaining'), String(remaining));
          assert.equal(r.headers.get('retry-after'), null);
        }
      });

      test('429 reports limit, remaining, retry and relative reset', async () => {
        const f = await app({ max: 1, message: 'Fixture quota exceeded' });
        assert.equal((await f.request()).status, 200);
        const r = await f.request();
        assert.equal(r.status, 429);
        assert.deepEqual(r.body, { error: 'Fixture quota exceeded' });
        assert.equal(r.headers.get('ratelimit-limit'), '1');
        assert.equal(r.headers.get('ratelimit-remaining'), '0');
        const reset = Number(r.headers.get('ratelimit-reset'));
        assert.ok(Number.isInteger(reset) && reset >= 1 && reset <= windowMs / 1000);
        assert.equal(r.headers.get('retry-after'), String(reset));
      });

      test('20 concurrent requests admit exactly 5', async () => {
        const f = await app({ max: 5 });
        const responses = await Promise.all(Array.from({ length: 20 }, () => f.request()));
        assert.equal(responses.filter(r => r.status === 200).length, 5);
        assert.equal(responses.filter(r => r.status === 429).length, 15);
      });

      test('hybrid limits one verified user across many IPs', async () => {
        const f = await app({ strategy: 'hybrid' });
        assert.equal((await f.request({ user: 1, ip: ips[0] })).status, 200);
        assert.equal((await f.request({ user: 1, ip: ips[1] })).status, 200);
        assert.equal((await f.request({ user: 1, ip: ips[2] })).status, 429);
        assert.equal((await f.request({ user: 2, ip: ips[2] })).status, 200);
      });

      test('hybrid limits one IP across many verified users', async () => {
        const f = await app({ strategy: 'hybrid' });
        assert.equal((await f.request({ user: 1 })).status, 200);
        assert.equal((await f.request({ user: 2 })).status, 200);
        assert.equal((await f.request({ user: 3 })).status, 429);
        assert.equal((await f.request({ user: 4, ip: ips[1] })).status, 200);
      });

      test('hybrid anonymous fallback uses IP; invalid signatures never create req.user', async () => {
        const f = await app({ strategy: 'hybrid', max: 1 });
        const forged = jwt.sign({ id: 1 }, randomBytes(32), { algorithm: 'HS512' });
        assert.equal((await f.request({ token: forged })).status, 401);
        assert.equal((await f.request()).status, 200);
        assert.equal((await f.request()).status, 429);
        assert.equal((await f.request({ ip: ips[1] })).status, 200);
      });

      test('query strings and trailing slash share the same limiter', async () => {
        const f = await app();
        assert.equal((await f.request({ path: '/limited?a=1' })).status, 200);
        assert.equal((await f.request({ path: '/limited/?a=2' })).status, 200);
        assert.equal((await f.request({ path: '/limited?a=3' })).status, 429);
      });

      test('Express ignores untrusted XFF and respects only the trusted loopback fixture', async () => {
        const untrusted = await app({ max: 1 }, { trustProxy: false });
        const first = await untrusted.request({ ip: ips[0] });
        assert.equal(first.status, 200);
        assert.equal(first.body.ip.replace(/^::ffff:/, ''), '127.0.0.1');
        assert.equal((await untrusted.request({ ip: ips[1] })).status, 429);
        const trusted = await app({ max: 1 });
        for (const ip of ips) {
          const r = await trusted.request({ ip });
          assert.equal(r.status, 200);
          assert.equal(r.body.ip, ip);
        }
        assert.equal((await trusted.request({ ip: ips[0] })).status, 429);
      });
    });
  }

  test('local cap of two never evicts an existing exhausted identity', async () => {
    const f = await fixture({ max: 1, maxTrackedKeys: 2 });
    assert.equal((await f.request({ ip: ips[0] })).status, 200);
    assert.equal((await f.request({ ip: ips[0] })).status, 429);
    assert.equal((await f.request({ ip: ips[1] })).status, 200);
    for (let i = 0; i < 3; i++) {
      unavailable(await f.request({ ip: ips[2] }));
      assert.equal((await f.request({ ip: ips[0] })).status, 429);
    }
  });

  test('local expiry cleanup frees capacity and resets exhausted counters', async () => {
    const f = await fixture({ max: 1, maxTrackedKeys: 2, windowMs: 500 });
    assert.equal((await f.request({ ip: ips[0] })).status, 200);
    assert.equal((await f.request({ ip: ips[1] })).status, 200);
    unavailable(await f.request({ ip: ips[2] }));
    await delay(750);
    assert.equal((await f.request({ ip: ips[2] })).status, 200);
    assert.equal((await f.request({ ip: ips[0] })).status, 200);
    assert.equal((await f.request({ ip: ips[0] })).status, 429);
  });

  test('dispose clears its cleanup timer and is idempotent', async t => {
    const clear = t.mock.method(globalThis, 'clearInterval');
    const f = await fixture({ max: 1 });
    assert.equal((await f.request()).status, 200);
    f.limiter.dispose();
    f.limiter.dispose();
    assert.equal(clear.mock.callCount(), 2);
    assert.equal(clear.mock.calls[0].arguments[0], clear.mock.calls[1].arguments[0]);
    assert.equal((await f.request()).status, 429, 'dispose must not reset quota');
    clear.mock.restore();
  });

  test('Redis startup, not-ready, command errors and malformed replies fail closed without local fallback', async () => {
    // Deterministic fault injection only; success behavior is covered with real Redis above.
    let reply;
    let calls = 0;
    const client = {
      status: 'connecting',
      async eval() {
        calls++;
        if (reply instanceof Error) throw reply;
        return reply;
      },
    };
    const f = await fixture({ max: 1 }, { client });
    for (const status of ['connecting', 'connect', 'reconnecting', 'end']) {
      client.status = status;
      unavailable(await f.request());
    }
    assert.equal(calls, 0);
    client.status = 'ready';
    for (const result of [new Error('Injected command failure'), null, [], [NaN, 1000], [1, -1]]) {
      reply = result;
      unavailable(await f.request());
    }
    assert.equal(calls, 5);
    reply = [1, windowMs];
    assert.equal((await f.request()).status, 200);
    reply = [2, windowMs];
    assert.equal((await f.request()).status, 429);
  });

  test('two independent apps and ioredis clients share counters, but prefixes isolate them', {
    skip: !redisUrl ? 'TEST_REDIS_URL absent' : false,
  }, async () => {
    const firstClient = await connectRedis();
    const secondClient = await connectRedis();
    assert.notEqual(firstClient, secondClient);
    const shared = prefix();
    const first = await fixture({ max: 5, keyPrefix: shared }, { client: firstClient });
    const second = await fixture({ max: 5, keyPrefix: shared }, { client: secondClient });
    const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).request()));
    assert.equal(responses.filter(r => r.status === 200).length, 5);
    assert.equal(responses.filter(r => r.status === 429).length, 15);
    const isolated = await fixture({ max: 1 }, { client: secondClient });
    assert.equal((await isolated.request()).status, 200);
    assert.equal((await isolated.request()).status, 429);
    assert.equal((await first.request()).status, 429);
  });

  test('real Redis client disconnect fails closed and a new client recovers the persisted quota', {
    skip: !redisUrl ? 'TEST_REDIS_URL absent' : false,
  }, async () => {
    const client = await connectRedis();
    const shared = prefix();
    const f = await fixture({ max: 2, keyPrefix: shared }, { client });
    assert.equal((await f.request()).status, 200);
    setRedisClient(client);
    await closeRedisClient();
    unavailable(await f.request());
    unavailable(await f.request());
    const recovered = await fixture({ max: 2, keyPrefix: shared }, { client: await connectRedis() });
    assert.equal((await recovered.request()).status, 200);
    assert.equal((await recovered.request()).status, 429);
  });
});
