export const SERVICES = ['accounts', 'bookings', 'payments', 'engagement'];

// The gateway preserves every public API contract, including mixed upload paths.
export function serviceForPath(path) {
  const pathname = path.split('?')[0];
  if (['/api/health', '/api/docs', '/api/docs/', '/api/openapi.json'].includes(pathname)) return 'bookings';
  if (/^\/api\/(auth|profile)(\/|$)/.test(pathname)) return 'accounts';
  if (/^\/api\/(payments|subscriptions|categories|services|promotions|email)(\/|$)/.test(pathname)) return 'payments';
  if (/^\/api\/(notifications|realtime|reviews|complaints|support|chat|chatbot)(\/|$)/.test(pathname)) return 'engagement';
  if (/^\/api\/(bookings|customer|provider|admin|uploads)(\/|$)/.test(pathname)) return 'bookings';
  return null;
}

export function validateDistributedConfig(service) {
  if (process.env.LUXORA_RUNTIME !== 'serverless') return;
  if (!SERVICES.includes(service)) throw new Error('Serverless runtime requires an explicit domain service');
  for (const key of ['DATABASE_URL', 'JWT_SECRET', 'BANK_ENCRYPTION_KEY', 'REDIS_URL']) {
    if (!process.env[key]) throw new Error(`Serverless runtime requires ${key}`);
  }
}
