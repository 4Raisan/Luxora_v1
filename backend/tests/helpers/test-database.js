// Test setup deliberately ignores any inherited DIRECT_URL.
export function isolatedTestUrls(rawUrl) {
  const url = new URL(rawUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('Refusing test setup outside local PostgreSQL');
  }
  url.searchParams.set('schema', 'luxora_test');
  return { DATABASE_URL: url.toString(), DIRECT_URL: url.toString() };
}
