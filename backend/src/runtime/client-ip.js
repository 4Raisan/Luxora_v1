import { isIP } from 'node:net';

// Distributed domain services are private: only the IAM-authorized gateway can
// invoke them. Platform proxy hops can append to XFF, so use the gateway's
// overwritten, validated client address for shared IP quotas and audit records.
export function gatewayClientIp(req, _res, next) {
  const value = req.headers['x-luxora-client-ip'];
  if (process.env.LUXORA_RUNTIME === 'serverless' && typeof value === 'string' && isIP(value)) {
    Object.defineProperty(req, 'ip', { value, configurable: true });
  }
  next();
}
