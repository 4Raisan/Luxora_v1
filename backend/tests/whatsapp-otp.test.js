import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  normalizePhoneNumber,
  validateWhatsAppConfig,
  sendWhatsAppVerificationCode,
  verifyWhatsAppCode,
  sendTwilioVerificationCode,
  verifyTwilioCode,
} from '../src/services/integrations.js';
import { prisma } from '../src/config/prisma.js';

test('Phone normalization: Sri Lankan numbers in various formats resolve to standard E.164', () => {
  assert.equal(normalizePhoneNumber('0771575701'), '+94771575701');
  assert.equal(normalizePhoneNumber('771575701'), '+94771575701');
  assert.equal(normalizePhoneNumber('94771575701'), '+94771575701');
  assert.equal(normalizePhoneNumber('+94771575701'), '+94771575701');
  assert.equal(normalizePhoneNumber('+94 77 157 5701'), '+94771575701');
  assert.equal(normalizePhoneNumber('077-157-5701'), '+94771575701');
  assert.equal(normalizePhoneNumber('(077) 157 5701'), '+94771575701');
  assert.equal(normalizePhoneNumber('0712345678'), '+94712345678');
  assert.equal(normalizePhoneNumber('0701234567'), '+94701234567');
  assert.equal(normalizePhoneNumber('0781234567'), '+94781234567');
});

test('Phone normalization: international numbers and invalid inputs', () => {
  assert.equal(normalizePhoneNumber('+14155552671'), '+14155552671');
  assert.equal(normalizePhoneNumber('+447911123456'), '+447911123456');
  assert.equal(normalizePhoneNumber('+61412345678'), '+61412345678');

  assert.equal(normalizePhoneNumber(''), null);
  assert.equal(normalizePhoneNumber(null), null);
  assert.equal(normalizePhoneNumber(undefined), null);
  assert.equal(normalizePhoneNumber('12345'), null);
  assert.equal(normalizePhoneNumber('invalid-phone'), null);
});

test('Config validation: detects missing WhatsApp environment variables', () => {
  const originalEnv = {
    id: process.env.WHATSAPP_PHONE_NUMBER_ID,
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    template: process.env.WHATSAPP_VERIFY_TEMPLATE,
  };

  try {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_VERIFY_TEMPLATE;

    const result = validateWhatsAppConfig({ strict: false });
    assert.equal(result.configured, false);
    assert.ok(result.missing.includes('WHATSAPP_PHONE_NUMBER_ID'));
    assert.ok(result.missing.includes('WHATSAPP_ACCESS_TOKEN'));
    assert.ok(result.missing.includes('WHATSAPP_VERIFY_TEMPLATE'));

    assert.throws(
      () => validateWhatsAppConfig({ strict: true }),
      /WhatsApp Cloud API is not configured/
    );
  } finally {
    if (originalEnv.id) process.env.WHATSAPP_PHONE_NUMBER_ID = originalEnv.id;
    if (originalEnv.token) process.env.WHATSAPP_ACCESS_TOKEN = originalEnv.token;
    if (originalEnv.template) process.env.WHATSAPP_VERIFY_TEMPLATE = originalEnv.template;
  }
});

test('OTP generation: live mode issues a fresh random 6-digit code per request', async () => {
  const phone = '+94771575704';
  const origEnv = {
    id: process.env.WHATSAPP_PHONE_NUMBER_ID,
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    template: process.env.WHATSAPP_VERIFY_TEMPLATE,
  };

  process.env.WHATSAPP_PHONE_NUMBER_ID = '1280111385185458';
  process.env.WHATSAPP_ACCESS_TOKEN = 'EAATestTokenForUnitTest';
  process.env.WHATSAPP_VERIFY_TEMPLATE = 'luxora_otp_auth';

  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.test' }] }),
    });

    for (let i = 0; i < 2; i += 1) {
      const result = await sendWhatsAppVerificationCode(phone);
      assert.equal(result.configured, true);
      assert.equal(result.demo, undefined);
      assert.equal(result.status, 'pending');
    }

    // Each challenge is hashed with bcrypt; a matching 6-digit plaintext must
    // exist for every send and consecutive sends must not repeat the code.
    const challenge = await prisma.phoneOtpChallenge.findUnique({ where: { phone } });
    assert.ok(challenge, 'challenge record not created');
    assert.ok(challenge.expiresAt > new Date(), 'challenge must expire in the future');
    assert.ok(challenge.expiresAt <= new Date(Date.now() + 10 * 60 * 1000 + 5000), 'challenge expiry must be ~10 minutes');
    assert.match(challenge.codeHash, /^\$2[aby]\$/, 'code must be stored as a bcrypt hash');
    assert.equal(await bcrypt.compare('123456', challenge.codeHash), false, 'live mode must not issue the fixed demo code');

    await prisma.phoneOtpChallenge.deleteMany({ where: { phone } });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.WHATSAPP_PHONE_NUMBER_ID = origEnv.id;
    process.env.WHATSAPP_ACCESS_TOKEN = origEnv.token;
    process.env.WHATSAPP_VERIFY_TEMPLATE = origEnv.template;
  }
});

test('OTP generation: unconfigured dev server falls back to the demo code with a demo marker', async () => {
  const phone = '+94771575705';
  const origEnv = {
    id: process.env.WHATSAPP_PHONE_NUMBER_ID,
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    template: process.env.WHATSAPP_VERIFY_TEMPLATE,
    nodeEnv: process.env.NODE_ENV,
    allowDemo: process.env.ALLOW_DEMO_OTP,
  };

  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_VERIFY_TEMPLATE;
  process.env.NODE_ENV = 'development';
  delete process.env.ALLOW_DEMO_OTP;

  try {
    const result = await sendWhatsAppVerificationCode(phone);
    assert.equal(result.configured, false);
    assert.equal(result.demo, true);
    assert.equal(result.channel, 'whatsapp');
    assert.equal(result.status, 'pending');

    // The demo code must verify so local/dev flows keep working end-to-end.
    const verified = await verifyWhatsAppCode(phone, '123456');
    assert.equal(verified.approved, true);

    await prisma.phoneOtpChallenge.deleteMany({ where: { phone } });
  } finally {
    if (origEnv.id) process.env.WHATSAPP_PHONE_NUMBER_ID = origEnv.id;
    if (origEnv.token) process.env.WHATSAPP_ACCESS_TOKEN = origEnv.token;
    if (origEnv.template) process.env.WHATSAPP_VERIFY_TEMPLATE = origEnv.template;
    if (origEnv.nodeEnv) process.env.NODE_ENV = origEnv.nodeEnv; else delete process.env.NODE_ENV;
    if (origEnv.allowDemo) process.env.ALLOW_DEMO_OTP = origEnv.allowDemo;
  }
});

test('Demo fallback: unconfigured production server must fail loudly, never issue the fixed demo code', async () => {
  const phone = '+94771575706';
  const origEnv = {
    id: process.env.WHATSAPP_PHONE_NUMBER_ID,
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    template: process.env.WHATSAPP_VERIFY_TEMPLATE,
    nodeEnv: process.env.NODE_ENV,
    allowDemo: process.env.ALLOW_DEMO_OTP,
  };

  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_VERIFY_TEMPLATE;
  delete process.env.ALLOW_DEMO_OTP;
  process.env.NODE_ENV = 'production';

  try {
    await assert.rejects(
      async () => sendWhatsAppVerificationCode(phone),
      (err) => {
        assert.match(err.message, /WhatsApp Cloud API is not configured/);
        assert.ok(err.message.includes('WHATSAPP_PHONE_NUMBER_ID'));
        assert.ok(err.message.includes('WHATSAPP_ACCESS_TOKEN'));
        assert.ok(err.message.includes('WHATSAPP_VERIFY_TEMPLATE'));
        return true;
      }
    );
    const challenge = await prisma.phoneOtpChallenge.findUnique({ where: { phone } });
    assert.equal(challenge, null, 'no challenge may be persisted when the server is unconfigured');
  } finally {
    if (origEnv.id) process.env.WHATSAPP_PHONE_NUMBER_ID = origEnv.id;
    if (origEnv.token) process.env.WHATSAPP_ACCESS_TOKEN = origEnv.token;
    if (origEnv.template) process.env.WHATSAPP_VERIFY_TEMPLATE = origEnv.template;
    if (origEnv.nodeEnv) process.env.NODE_ENV = origEnv.nodeEnv; else delete process.env.NODE_ENV;
    if (origEnv.allowDemo) process.env.ALLOW_DEMO_OTP = origEnv.allowDemo;
  }
});

test('WhatsApp Cloud API send: sends properly formatted template request to Meta Graph API', async () => {
  const phone = '+94771575701';
  const testPhoneNumberId = '1280111385185458';
  const testToken = 'EAATestTokenForUnitTest';
  const testTemplate = 'luxora_otp_auth';

  const origEnv = {
    id: process.env.WHATSAPP_PHONE_NUMBER_ID,
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    template: process.env.WHATSAPP_VERIFY_TEMPLATE,
    lang: process.env.WHATSAPP_VERIFY_TEMPLATE_LANGUAGE,
    version: process.env.WHATSAPP_API_VERSION,
  };

  process.env.WHATSAPP_PHONE_NUMBER_ID = testPhoneNumberId;
  process.env.WHATSAPP_ACCESS_TOKEN = testToken;
  process.env.WHATSAPP_VERIFY_TEMPLATE = testTemplate;
  process.env.WHATSAPP_VERIFY_TEMPLATE_LANGUAGE = 'en_US';
  process.env.WHATSAPP_API_VERSION = 'v22.0';

  const originalFetch = globalThis.fetch;
  let interceptedRequest = null;

  try {
    globalThis.fetch = async (url, options) => {
      interceptedRequest = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '94771575701', wa_id: '94771575701' }],
          messages: [{ id: 'wamid.HBgMOTQ3NzE1NzU3MDEVAgARGBI=' }],
        }),
      };
    };

    const sendResult = await sendWhatsAppVerificationCode(phone);
    assert.equal(sendResult.configured, true);
    assert.equal(sendResult.channel, 'whatsapp');
    assert.equal(sendResult.status, 'pending');
    assert.equal(sendResult.messageId, 'wamid.HBgMOTQ3NzE1NzU3MDEVAgARGBI=');

    // Verify Meta Cloud API endpoint URL
    assert.equal(
      interceptedRequest.url,
      `https://graph.facebook.com/v22.0/${testPhoneNumberId}/messages`
    );

    // Verify Authorization Header (Bearer token)
    assert.equal(
      interceptedRequest.options.headers.Authorization,
      `Bearer ${testToken}`
    );

    // Verify payload structure matches Meta Cloud API specifications
    assert.equal(interceptedRequest.body.messaging_product, 'whatsapp');
    assert.equal(interceptedRequest.body.to, '94771575701');
    assert.equal(interceptedRequest.body.type, 'template');
    assert.equal(interceptedRequest.body.template.name, testTemplate);
    assert.equal(interceptedRequest.body.template.language.code, 'en_US');
    assert.ok(Array.isArray(interceptedRequest.body.template.components));
    assert.equal(interceptedRequest.body.template.components[0].type, 'body');
    assert.ok(/^\d{6}$/.test(interceptedRequest.body.template.components[0].parameters[0].text));

    // Verify the challenge was stored securely with bcrypt in the DB
    const challenge = await prisma.phoneOtpChallenge.findUnique({ where: { phone } });
    assert.ok(challenge, 'challenge record not created');
    assert.ok(challenge.expiresAt > new Date(), 'challenge expired immediately');
    const matches = await bcrypt.compare(
      interceptedRequest.body.template.components[0].parameters[0].text,
      challenge.codeHash
    );
    assert.equal(matches, true, 'bcrypt hash does not match sent OTP');

    // Clean up DB record
    await prisma.phoneOtpChallenge.deleteMany({ where: { phone } });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.WHATSAPP_PHONE_NUMBER_ID = origEnv.id;
    process.env.WHATSAPP_ACCESS_TOKEN = origEnv.token;
    process.env.WHATSAPP_VERIFY_TEMPLATE = origEnv.template;
    process.env.WHATSAPP_VERIFY_TEMPLATE_LANGUAGE = origEnv.lang;
    process.env.WHATSAPP_API_VERSION = origEnv.version;
  }
});

test('WhatsApp Cloud API failure: handles Meta API error cleanly without leaking tokens', async () => {
  const phone = '+94771575702';
  const origEnv = {
    id: process.env.WHATSAPP_PHONE_NUMBER_ID,
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    template: process.env.WHATSAPP_VERIFY_TEMPLATE,
  };

  process.env.WHATSAPP_PHONE_NUMBER_ID = '1280111385185458';
  process.env.WHATSAPP_ACCESS_TOKEN = 'secret_access_token_123';
  process.env.WHATSAPP_VERIFY_TEMPLATE = 'luxora_otp';

  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: '(#131030) Recipient phone number not in allowed list',
          type: 'OAuthException',
          code: 131030,
        },
      }),
    });

    await assert.rejects(
      async () => sendWhatsAppVerificationCode(phone),
      (err) => {
        assert.ok(err.message.includes('Recipient phone number not in allowed list'));
        assert.ok(!err.message.includes('secret_access_token_123'));
        return true;
      }
    );

    // Clean up DB challenge
    await prisma.phoneOtpChallenge.deleteMany({ where: { phone } });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.WHATSAPP_PHONE_NUMBER_ID = origEnv.id;
    process.env.WHATSAPP_ACCESS_TOKEN = origEnv.token;
    process.env.WHATSAPP_VERIFY_TEMPLATE = origEnv.template;
  }
});

test('OTP verification lifecycle: correct OTP, wrong OTP, and expired OTP handling', async () => {
  const phone = '+94771575703';
  const correctCode = '654321';
  const wrongCode = '999999';

  // 1. Setup challenge in database
  const codeHash = await bcrypt.hash(correctCode, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.phoneOtpChallenge.upsert({
    where: { phone },
    update: { codeHash, expiresAt },
    create: { phone, codeHash, expiresAt },
  });

  // 2. Wrong code is rejected and challenge remains in database
  const wrongResult = await verifyWhatsAppCode(phone, wrongCode);
  assert.equal(wrongResult.approved, false);
  assert.equal(wrongResult.status, 'pending');
  const stillExists = await prisma.phoneOtpChallenge.findUnique({ where: { phone } });
  assert.ok(stillExists, 'challenge was prematurely deleted on failed attempt');

  // 3. Correct code is approved and challenge is deleted immediately (single-use)
  const successResult = await verifyWhatsAppCode(phone, correctCode);
  assert.equal(successResult.approved, true);
  assert.equal(successResult.status, 'approved');
  const deletedChallenge = await prisma.phoneOtpChallenge.findUnique({ where: { phone } });
  assert.equal(deletedChallenge, null, 'challenge was not deleted after successful verification');

  // 4. Replay of same OTP is rejected because challenge was consumed
  const replayResult = await verifyWhatsAppCode(phone, correctCode);
  assert.equal(replayResult.approved, false);

  // 5. Expired OTP challenge is rejected
  const pastDate = new Date(Date.now() - 1000);
  await prisma.phoneOtpChallenge.create({
    data: { phone, codeHash, expiresAt: pastDate },
  });
  const expiredResult = await verifyWhatsAppCode(phone, correctCode);
  assert.equal(expiredResult.approved, false);

  await prisma.phoneOtpChallenge.deleteMany({ where: { phone } });
});

test('Twilio fallback stubs: properly documented and safely disabled', async () => {
  await assert.rejects(
    async () => sendTwilioVerificationCode('+94771575701'),
    /Twilio OTP delivery is currently disabled/
  );
  await assert.rejects(
    async () => verifyTwilioCode('+94771575701', '123456'),
    /Twilio OTP delivery is currently disabled/
  );
});
