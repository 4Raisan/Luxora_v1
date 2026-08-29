const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error('Tests require DATABASE_URL');

const parsed = new URL(rawUrl);
const schema = parsed.searchParams.get('schema');
if (schema !== 'luxora_test') {
  throw new Error(`Refusing to run database-mutating tests outside the isolated luxora_test schema (received ${schema || 'no schema'}). Use npm test from the repository root.`);
}
