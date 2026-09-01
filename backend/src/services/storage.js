// Uploaded-file storage. When S3-compatible object-storage env vars are set,
// files are stored in the bucket (durable across redeploys and shared by every
// backend instance). Otherwise files fall back to the private-uploads folder on
// local disk — development only, because container filesystems are ephemeral
// and files are silently lost on redeploy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const localRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../private-uploads');

function safeKey(value) {
  const key = String(value || '');
  if (!key || key !== path.basename(key) || key.includes('\0')) throw new Error('Invalid storage key');
  return key;
}

function s3Config() {
  if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) return null;
  return {
    bucket: process.env.S3_BUCKET,
    prefix: process.env.S3_PREFIX || 'uploads/',
    client: null, // lazily created below to avoid importing the SDK when unused
  };
}

let s3ClientPromise = null;
async function s3Client() {
  if (!s3ClientPromise) {
    s3ClientPromise = import('@aws-sdk/client-s3').then(({ S3Client }) => new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        ...(process.env.S3_SESSION_TOKEN ? { sessionToken: process.env.S3_SESSION_TOKEN } : {}),
      },
    }));
  }
  return s3ClientPromise;
}

const activeConfig = s3Config();
export const objectStorageEnabled = Boolean(activeConfig);

export function assertStorageConfigured() {
  if (process.env.NODE_ENV === 'production' && !objectStorageEnabled) {
    throw new Error('[storage] FATAL: S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY must be configured in production. Ephemeral local disk storage is disallowed in production to prevent silent file loss on redeploy.');
  }
}

if (!objectStorageEnabled) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[storage] FATAL: S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY must be configured in production.');
  } else {
    fs.mkdirSync(localRoot, { recursive: true });
  }
}

export async function putObject(key, buffer, contentType) {
  const objectKey = safeKey(key);
  if (activeConfig) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await s3Client();
    await client.send(new PutObjectCommand({ Bucket: activeConfig.bucket, Key: activeConfig.prefix + objectKey, Body: buffer, ContentType: contentType }));
    return;
  }
  fs.writeFileSync(path.resolve(localRoot, objectKey), buffer);
}

// Returns the file buffer, or null when the object no longer exists (for
// example a database row whose local file died with a container redeploy).
export async function getObject(key) {
  const objectKey = safeKey(key);
  if (activeConfig) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await s3Client();
    const response = await client.send(new GetObjectCommand({ Bucket: activeConfig.bucket, Key: activeConfig.prefix + objectKey }));
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
  try {
    return fs.readFileSync(path.resolve(localRoot, objectKey));
  } catch {
    return null;
  }
}

export async function removeObject(key) {
  const objectKey = safeKey(key);
  if (activeConfig) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await s3Client();
    await client.send(new DeleteObjectCommand({ Bucket: activeConfig.bucket, Key: activeConfig.prefix + objectKey }));
    return;
  }
  await fs.promises.unlink(path.resolve(localRoot, objectKey)).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}
