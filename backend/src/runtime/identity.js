const tokens = new Map();

// Cloud Run uses this platform token separately from the customer's JWT.
export async function serviceIdentity(audience) {
  if (process.env.CLOUD_RUN_IDENTITY !== 'true') return null;
  const cached = tokens.get(audience);
  if (cached && cached.expires > Date.now()) return cached.token;
  const url = new URL('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity');
  url.searchParams.set('audience', audience);
  url.searchParams.set('format', 'full');
  const response = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Service identity unavailable');
  const token = await response.text();
  tokens.set(audience, { token, expires: Date.now() + 50 * 60000 });
  return token;
}
