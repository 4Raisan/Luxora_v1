import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramAuth } from '../src/services/integrations.js';

test('Telegram Auth: validates authentic Telegram Login Widget signature', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const testBotToken = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ';
  process.env.TELEGRAM_BOT_TOKEN = testBotToken;

  try {
    const authData = {
      id: '987654321',
      first_name: 'Luxora',
      last_name: 'Tester',
      username: 'luxoratest',
      photo_url: 'https://t.me/i/userpic/320/luxoratest.jpg',
      auth_date: String(Math.floor(Date.now() / 1000)),
    };

    // Calculate valid Telegram HMAC-SHA256 signature
    const dataCheckString = Object.keys(authData)
      .sort()
      .map((key) => `${key}=${authData[key]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(testBotToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const payload = { ...authData, hash };

    const result = verifyTelegramAuth(payload);
    assert.equal(result.valid, true);
    assert.equal(result.profile.telegramId, '987654321');
    assert.equal(result.profile.firstName, 'Luxora');
    assert.equal(result.profile.username, 'luxoratest');
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
});

test('Telegram Auth: rejects tampered authentication data or invalid hash', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const testBotToken = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ';
  process.env.TELEGRAM_BOT_TOKEN = testBotToken;

  try {
    const authData = {
      id: '987654321',
      first_name: 'Luxora',
      username: 'luxoratest',
      auth_date: String(Math.floor(Date.now() / 1000)),
      hash: 'deadbeef0000000000000000000000000000000000000000000000000000dead',
    };

    const result = verifyTelegramAuth(authData);
    assert.equal(result.valid, false);
    assert.match(result.error, /Invalid Telegram authentication signature/);
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
});

test('Telegram Auth: rejects expired auth tokens older than 24 hours (replay protection)', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const testBotToken = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ';
  process.env.TELEGRAM_BOT_TOKEN = testBotToken;

  try {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 86400;
    const authData = {
      id: '987654321',
      first_name: 'Luxora',
      auth_date: String(twoDaysAgo),
    };

    const dataCheckString = Object.keys(authData)
      .sort()
      .map((key) => `${key}=${authData[key]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(testBotToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const result = verifyTelegramAuth({ ...authData, hash });
    assert.equal(result.valid, false);
    assert.match(result.error, /expired/);
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
});
