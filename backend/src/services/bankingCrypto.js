import crypto from 'node:crypto';
import { JWT_SECRET } from '../config/env.js';

export function assertBankingKeyConfigured() {
  if (process.env.NODE_ENV === 'production' && !process.env.BANK_ENCRYPTION_KEY) {
    throw new Error('FATAL: BANK_ENCRYPTION_KEY must be configured in production.');
  }
}

export function getBankKey(keyString) {
  if (keyString) {
    return crypto.createHash('sha256').update(keyString).digest();
  }
  if (process.env.BANK_ENCRYPTION_KEY) {
    return crypto.createHash('sha256').update(process.env.BANK_ENCRYPTION_KEY).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: BANK_ENCRYPTION_KEY is required in production environment.');
  }
  const fallback = JWT_SECRET || 'luxora_default_insecure_dev_secret_key';
  return crypto.createHash('sha256').update(fallback).digest();
}

/**
 * Encrypt bank account number at rest with AES-256-GCM.
 * Output format: "enc:v1:<base64(iv + ciphertext + authTag)>"
 */
export function encryptAccountNumber(rawAccountNumber, keyString) {
  const plain = String(rawAccountNumber || '').trim().replace(/\s+/g, '');
  if (!plain) return '';
  const bankKey = getBankKey(keyString);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', bankKey, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, encrypted, tag]).toString('base64');
  return `enc:v1:${payload}`;
}

/**
 * Decrypt bank account number from AES-256-GCM ciphertext.
 */
export function decryptAccountNumber(encryptedString, keyString) {
  const value = String(encryptedString || '').trim();
  if (!value) return '';
  if (!value.startsWith('enc:v1:')) {
    // Unencrypted legacy fallback
    return value;
  }
  const bankKey = getBankKey(keyString);
  const data = Buffer.from(value.slice(7), 'base64');
  if (data.length < 28) throw new Error('Invalid encrypted account payload');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(12, data.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', bankKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Re-encrypt account number from old key to new key for key rotation.
 */
export function reencryptAccountNumber(encryptedString, oldKeySecret, newKeySecret) {
  const decrypted = decryptAccountNumber(encryptedString, oldKeySecret);
  return encryptAccountNumber(decrypted, newKeySecret);
}

/**
 * Mask account number for safe public/API exposure.
 * Always shows only the last 4 digits.
 */
export function maskAccountNumber(rawOrEncrypted, keyString) {
  if (!rawOrEncrypted) return '';
  let plain = String(rawOrEncrypted).trim();
  if (plain.startsWith('enc:v1:')) {
    try {
      plain = decryptAccountNumber(plain, keyString);
    } catch {
      return '••••••••••••';
    }
  }
  const digits = plain.replace(/\s+/g, '');
  if (digits.length <= 4) return digits;
  return `••••••••${digits.slice(-4)}`;
}

/**
 * HMAC-SHA256 hash of account number for blind deduplication/lookup.
 */
export function hashAccountNumber(rawAccountNumber, keyString) {
  const plain = String(rawAccountNumber || '').trim().replace(/\s+/g, '');
  if (!plain) return '';
  const bankKey = getBankKey(keyString);
  return crypto.createHmac('sha256', bankKey).update(plain).digest('hex');
}
