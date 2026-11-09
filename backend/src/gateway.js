import express from 'express';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { serviceForPath, SERVICES } from './runtime/service-map.js';
import { serviceIdentity } from './runtime/identity.js';

const hopHeaders = new Set(['connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer', 'upgrade', 'proxy-authorization', 'proxy-authenticate']);
function headersWithoutHop(headers) {
  const blocked = new Set([...hopHeaders, ...String(headers.connection || '').toLowerCase().split(',').map(s => s.trim())]);
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !blocked.has(key.toLowerCase())));
}

export function createGateway({ targets = Object.fromEntries(SERVICES.map(name => [name, process.env[`${name.toUpperCase()}_SERVICE_URL`]])), identity = serviceIdentity } = {}) {
  const upstreams = Object.fromEntries(SERVICES.map(name => {
    const url = new URL(targets[name]);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(`Invalid ${name} origin`);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('Production upstreams require HTTPS');
    return [name, url];
  }));
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'gateway' }));
  app.use(async (req, res) => {
    const name = serviceForPath(req.originalUrl) || (/^\/api\/(health|docs)(\/|\?|$)/.test(req.originalUrl) ? 'bookings' : null);
    if (!name) return res.status(404).json({ error: 'Endpoint not found' });
    const target = upstreams[name];
    try {
      const token = await identity(target.origin);
      const headers = headersWithoutHop(req.headers);
      headers.host = target.host;
      headers['x-forwarded-for'] = req.ip;
      headers['x-luxora-client-ip'] = req.ip;
      headers['x-forwarded-proto'] = req.protocol;
      headers['x-request-id'] = crypto.randomUUID();
      delete headers['x-serverless-authorization'];
      if (token) headers['x-serverless-authorization'] = `Bearer ${token}`;
      const proxy = (target.protocol === 'https:' ? https : http).request({
        hostname: target.hostname, port: target.port || undefined, protocol: target.protocol,
        method: req.method, path: req.originalUrl, headers,
      }, upstream => {
        res.writeHead(upstream.statusCode, headersWithoutHop(upstream.headers));
        upstream.on('error', () => res.destroy());
        upstream.pipe(res);
      });
      proxy.setTimeout(65000, () => proxy.destroy(new Error('Upstream timeout')));
      proxy.on('error', () => {
        if (!res.headersSent) res.status(502).json({ error: 'Service temporarily unavailable' });
        else res.destroy();
      });
      req.on('aborted', () => proxy.destroy());
      res.on('close', () => { if (!res.writableFinished) proxy.destroy(); });
      req.pipe(proxy);
    } catch {
      res.status(503).json({ error: 'Service temporarily unavailable' });
    }
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createGateway().listen(process.env.PORT || 5000);
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
