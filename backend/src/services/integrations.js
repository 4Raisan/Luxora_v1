import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

const missing = (...names) => names.filter((name) => !process.env[name]);

export async function sendEmail({ to, subject, html, text = '' }) {
  if (!to || !process.env.RESEND_API_KEY) return { configured: false };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'no-reply@luxora.bond', to: [to], subject, html, text }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `Resend request failed (${response.status})`);
  return { configured: true, id: body.id };
}

const DEMO_WHATSAPP_CODE = '123456';

/**
 * Normalizes phone numbers to standard E.164 international format.
 * Correctly handles Sri Lankan formats (07X, 7X, 947X, +947X) and general international numbers.
 */
export function normalizePhoneNumber(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Remove spaces, hyphens, parentheses, and dots
  const cleaned = raw.replace(/[\s\-().]/g, '');

  // Sri Lankan local 10-digit mobile (07X XXXXXXX -> +947XXXXXXXX)
  if (/^07\d{8}$/.test(cleaned)) {
    return `+94${cleaned.slice(1)}`;
  }

  // Sri Lankan 9-digit mobile without leading 0 (7X XXXXXXX -> +947XXXXXXXX)
  if (/^7\d{8}$/.test(cleaned)) {
    return `+94${cleaned}`;
  }

  // Sri Lankan 11-digit mobile without + (947X XXXXXXX -> +947XXXXXXXX)
  if (/^947\d{8}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // Sri Lankan 12-char E.164 (+947X XXXXXXX)
  if (/^\+947\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  // General international E.164 format (+ followed by 7-15 digits)
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Validates whether the required Meta WhatsApp Cloud API environment variables are present.
 */
export function validateWhatsAppConfig({ strict = false } = {}) {
  const missingVars = [];
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) missingVars.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!process.env.WHATSAPP_ACCESS_TOKEN) missingVars.push('WHATSAPP_ACCESS_TOKEN');
  if (!process.env.WHATSAPP_VERIFY_TEMPLATE) missingVars.push('WHATSAPP_VERIFY_TEMPLATE');

  const configured = missingVars.length === 0;
  if (!configured && strict) {
    throw new Error(`WhatsApp Cloud API is not configured on the server. Missing environment variable(s): ${missingVars.join(', ')}`);
  }
  return { configured, missing: missingVars };
}

export const whatsAppConfigured = () => validateWhatsAppConfig({ strict: false }).configured;

/**
 * Sends a 6-digit OTP verification code via Meta WhatsApp Cloud API.
 *
 * Demo mode (fixed code) is only permitted outside production or when
 * ALLOW_DEMO_OTP=true; an unconfigured production server must fail loudly
 * instead of silently issuing the well-known demo code.
 */
export async function sendWhatsAppVerificationCode(phone) {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    throw new Error('Please enter a valid phone number in international format or Sri Lankan mobile number (e.g. +94771575701 or 0771575701).');
  }

  const { configured, missing } = validateWhatsAppConfig({ strict: false });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  if (!configured) {
    const demoPermitted = process.env.ALLOW_DEMO_OTP === 'true' || process.env.NODE_ENV !== 'production';
    if (!demoPermitted) {
      throw new Error(`WhatsApp Cloud API is not configured on the server. Missing environment variable(s): ${missing.join(', ')}`);
    }
    // Demo mode: persist the fixed dev code only when demo delivery is
    // actually permitted, so an unconfigured production server never leaves
    // a guessable challenge in the database.
    const codeHash = await bcrypt.hash(DEMO_WHATSAPP_CODE, 10);
    await prisma.phoneOtpChallenge.upsert({
      where: { phone: normalizedPhone },
      update: { codeHash, expiresAt },
      create: { phone: normalizedPhone, codeHash, expiresAt },
    });
    return { configured: false, demo: true, channel: 'whatsapp', status: 'pending', phone: normalizedPhone };
  }

  // Generate a cryptographically secure 6-digit OTP code
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = await bcrypt.hash(code, 10);

  await prisma.phoneOtpChallenge.upsert({
    where: { phone: normalizedPhone },
    update: { codeHash, expiresAt },
    create: { phone: normalizedPhone, codeHash, expiresAt },
  });

  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v22.0';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_VERIFY_TEMPLATE;
  const templateLang = process.env.WHATSAPP_VERIFY_TEMPLATE_LANGUAGE || 'en_US';
  const recipient = normalizedPhone.replace(/^\+/, '');

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const headers = {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  const buildPayload = (includeButton = false) => {
    if (templateName === 'hello_world') {
      return {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: templateLang },
        },
      };
    }

    const components = [
      {
        type: 'body',
        parameters: [{ type: 'text', text: code }],
      },
    ];

    if (includeButton) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: code }],
      });
    }

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components,
      },
    };
  };

  let response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildPayload(false)),
  });

  let result = await response.json().catch(() => ({}));

  // If Meta returns an error indicating button parameters are required (e.g. Authentication template with copy-code button), retry with button component
  if (!response.ok && templateName !== 'hello_world') {
    const errMsg = String(result?.error?.message || '');
    if (errMsg.includes('button') || errMsg.includes('components[1]') || errMsg.includes('Param template') || errMsg.includes('missing')) {
      const retryResponse = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildPayload(true)),
      });
      const retryResult = await retryResponse.json().catch(() => ({}));
      if (retryResponse.ok) {
        response = retryResponse;
        result = retryResult;
      }
    }
  }

  if (!response.ok) {
    const errorMsg = result?.error?.message || `WhatsApp Cloud API request failed (${response.status})`;
    console.warn('[whatsapp] Meta Cloud API error:', result?.error?.code ? `[Code ${result.error.code}] ${errorMsg}` : errorMsg);
    throw new Error(errorMsg);
  }

  return {
    configured: true,
    channel: 'whatsapp',
    status: 'pending',
    phone: normalizedPhone,
    messageId: result.messages?.[0]?.id,
  };
}

/**
 * Verifies a 6-digit OTP code against the active challenge in database.
 */
export async function verifyWhatsAppCode(phone, code) {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return { configured: whatsAppConfigured(), channel: 'whatsapp', approved: false, status: 'pending', error: 'Invalid phone number' };
  }

  const cleanCode = String(code || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return { configured: whatsAppConfigured(), channel: 'whatsapp', approved: false, status: 'pending', error: 'Invalid code format' };
  }

  const challenge = await prisma.phoneOtpChallenge.findUnique({ where: { phone: normalizedPhone } });
  const isExpired = !challenge || challenge.expiresAt <= new Date();
  const matches = Boolean(challenge && !isExpired && await bcrypt.compare(cleanCode, challenge.codeHash));

  if (matches) {
    await prisma.phoneOtpChallenge.delete({ where: { phone: normalizedPhone } });
  }

  return {
    configured: true,
    demo: !whatsAppConfigured(),
    channel: 'whatsapp',
    approved: matches,
    status: matches ? 'approved' : 'pending',
    phone: normalizedPhone,
  };
}

/**
 * Disabled: Twilio OTP provider retained for fallback/reference.
 * To switch delivery provider to Twilio in the future, configure TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.
 */
export async function sendTwilioVerificationCode(_phone) {
  throw new Error('Twilio OTP delivery is currently disabled. Meta WhatsApp Cloud API is the active provider.');
}

export async function verifyTwilioCode(_phone, _code) {
  throw new Error('Twilio OTP delivery is currently disabled. Meta WhatsApp Cloud API is the active provider.');
}

export function createPayHereFields({ amount, currency = 'LKR', orderId, customer = {}, returnUrl, cancelUrl }) {
  const required = missing('PAYHERE_MERCHANT_ID', 'PAYHERE_MERCHANT_SECRET');
  if (required.length) throw new Error(`Missing env: ${required.join(', ')}`);
  const merchantId = process.env.PAYHERE_MERCHANT_ID;
  const md5 = (value) => crypto.createHash('md5').update(value).digest('hex').toUpperCase();
  // Amount may arrive as a Prisma.Decimal (exact money) — format it without a
  // round-trip through binary floating point.
  const value = Prisma.Decimal.isDecimal(amount) ? amount.toFixed(2) : Number(amount).toFixed(2);
  const hash = md5(merchantId + orderId + value + currency + md5(process.env.PAYHERE_MERCHANT_SECRET));
  return { merchant_id: merchantId, order_id: orderId, items: customer.items || 'Luxora service', amount: value, currency, first_name: customer.firstName || 'Luxora', last_name: customer.lastName || 'Customer', email: customer.email || '', phone: customer.phone || '', address: customer.address || '', city: customer.city || '', country: 'Sri Lanka', return_url: returnUrl, cancel_url: cancelUrl, hash };
}

export function verifyPayHereWebhook({ merchant_id, order_id, payhere_amount, status_code, payhere_currency, md5sig }) {
  if (!process.env.PAYHERE_MERCHANT_SECRET) return false;
  const md5 = (value) => crypto.createHash('md5').update(value).digest('hex').toUpperCase();
  const expected = md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + md5(process.env.PAYHERE_MERCHANT_SECRET));
  if (merchant_id !== process.env.PAYHERE_MERCHANT_ID || !md5sig) return false;
  const provided = Buffer.from(String(md5sig).toUpperCase(), 'utf8');
  const computed = Buffer.from(expected, 'utf8');
  return provided.length === computed.length && crypto.timingSafeEqual(provided, computed);
}

/**
 * Validates whether NOWPayments environment variables are configured.
 */
export function validateNowPaymentsConfig({ strict = false } = {}) {
  const missingVars = [];
  if (!process.env.NOWPAYMENTS_API_KEY) missingVars.push('NOWPAYMENTS_API_KEY');
  if (!process.env.NOWPAYMENTS_IPN_SECRET) missingVars.push('NOWPAYMENTS_IPN_SECRET');

  const configured = missingVars.length === 0;
  if (!configured && strict) {
    throw new Error(`NOWPayments is not configured on the server. Missing environment variable(s): ${missingVars.join(', ')}`);
  }
  return { configured, missing: missingVars };
}

export const nowPaymentsConfigured = () => validateNowPaymentsConfig({ strict: false }).configured;

/**
 * Creates an invoice with NOWPayments API.
 */
export async function createNowPaymentsInvoice({
  amount,
  currency = 'USD',
  orderId,
  orderDescription = 'Luxora service package',
  ipnCallbackUrl,
  successUrl,
  cancelUrl,
}) {
  validateNowPaymentsConfig({ strict: true });

  const baseUrl = (process.env.NOWPAYMENTS_BASE_URL || 'https://api.nowpayments.io/v1').replace(/\/+$/, '');
  const numericAmount = Prisma.Decimal.isDecimal(amount) ? Number(amount.toFixed(2)) : Number(Number(amount).toFixed(2));

  const body = {
    price_amount: numericAmount,
    price_currency: String(currency).toLowerCase(),
    order_id: String(orderId),
    order_description: String(orderDescription).slice(0, 200),
  };

  if (ipnCallbackUrl) body.ipn_callback_url = ipnCallbackUrl;
  if (successUrl) body.success_url = successUrl;
  if (cancelUrl) body.cancel_url = cancelUrl;

  const response = await fetch(`${baseUrl}/invoice`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.NOWPAYMENTS_API_KEY.trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = result?.message || result?.error || `NOWPayments invoice creation failed (${response.status})`;
    console.warn('[nowpayments] invoice creation failed:', errorMsg);
    throw new Error(errorMsg);
  }

  return {
    id: result.id,
    orderId: result.order_id || orderId,
    invoiceUrl: result.invoice_url,
    priceAmount: result.price_amount,
    priceCurrency: result.price_currency,
  };
}

/**
 * Queries NOWPayments API for authoritative server-side payment status.
 */
export async function fetchNowPaymentsPaymentStatus(paymentId) {
  if (!process.env.NOWPAYMENTS_API_KEY || !paymentId) return null;
  const baseUrl = (process.env.NOWPAYMENTS_BASE_URL || 'https://api.nowpayments.io/v1').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/payment/${paymentId}`, {
    method: 'GET',
    headers: {
      'x-api-key': process.env.NOWPAYMENTS_API_KEY.trim(),
    },
  });
  if (!response.ok) {
    console.warn(`[nowpayments] status query failed for payment ${paymentId} (${response.status})`);
    return null;
  }
  return response.json().catch(() => null);
}

/**
 * Dispatches an SMS via TextBee Gateway REST API.
 */
export async function sendTextBeeSms(phone, message) {
  const apiKey = process.env.TEXTBEE_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TextBee SMS gateway is not configured on the server');
    }
    console.warn('[textbee] TEXTBEE_API_KEY is not configured in development mode');
    return { success: false, demo: true };
  }

  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    throw new Error('Invalid phone number for SMS dispatch');
  }

  const payload = {
    recipients: [normalizedPhone],
    message: String(message),
  };
  if (process.env.TEXTBEE_DEVICE_ID) {
    payload.device_id = process.env.TEXTBEE_DEVICE_ID.trim();
  }

  const response = await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey.trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errMsg = result?.message || result?.error || `TextBee SMS request failed (${response.status})`;
    console.warn('[textbee] SMS sending failed:', errMsg);
    throw new Error(errMsg);
  }

  return {
    success: true,
    batchId: result?.data?.smsBatchId || result?.data?.id,
    recipientCount: result?.data?.recipientCount || 1,
  };
}

/**
 * Generates and sends a secure 6-digit SMS OTP via TextBee.
 */
export async function sendSmsVerificationCode(phone) {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    throw new Error('Enter a valid Sri Lankan mobile (07X...) or international number');
  }

  // Rate limiting: 1 request per 60 seconds per phone
  const existing = await prisma.phoneOtpChallenge.findUnique({
    where: { phone: normalizedPhone },
  });

  if (existing && existing.lastSentAt) {
    const elapsedMs = Date.now() - new Date(existing.lastSentAt).getTime();
    if (elapsedMs < 60 * 1000) {
      const waitSec = Math.ceil((60 * 1000 - elapsedMs) / 1000);
      throw new Error(`Please wait ${waitSec} seconds before requesting another code`);
    }
  }

  const isProd = process.env.NODE_ENV === 'production';
  const hasTextBee = Boolean(process.env.TEXTBEE_API_KEY);

  if (isProd && !hasTextBee) {
    throw new Error('SMS verification service is not configured');
  }

  // Generate secure 6-digit OTP
  const code = (!hasTextBee && !isProd)
    ? '123456'
    : crypto.randomInt(100000, 1000000).toString();

  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

  await prisma.phoneOtpChallenge.upsert({
    where: { phone: normalizedPhone },
    update: {
      codeHash,
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    },
    create: {
      phone: normalizedPhone,
      codeHash,
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    },
  });

  if (hasTextBee) {
    const message = `Your Luxora verification code is ${code}. It expires in 5 minutes.`;
    await sendTextBeeSms(normalizedPhone, message);
    return { success: true, phone: normalizedPhone, channel: 'sms', ttlMinutes: 5 };
  }

  return { success: true, phone: normalizedPhone, channel: 'sms', demo: true, ttlMinutes: 5 };
}

/**
 * Verifies a 6-digit SMS OTP code against the stored challenge.
 */
export async function verifySmsCode(phone, code, userId = null) {
  const normalizedPhone = normalizePhoneNumber(phone);
  const trimmedCode = String(code || '').trim();

  if (!normalizedPhone || !/^\d{6}$/.test(trimmedCode)) {
    throw new Error('Valid phone number and 6-digit verification code are required');
  }

  const challenge = await prisma.phoneOtpChallenge.findUnique({
    where: { phone: normalizedPhone },
  });

  if (!challenge) {
    throw new Error('No pending verification found for this phone number. Please request a code.');
  }

  if (challenge.expiresAt < new Date()) {
    await prisma.phoneOtpChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
    throw new Error('Verification code has expired. Please request a new code.');
  }

  if (challenge.attempts >= 5) {
    await prisma.phoneOtpChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
    throw new Error('Too many failed verification attempts. Please request a new code.');
  }

  const isValid = await bcrypt.compare(trimmedCode, challenge.codeHash);
  if (!isValid) {
    await prisma.phoneOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    }).catch(() => {});
    throw new Error('Invalid verification code. Please check and try again.');
  }

  // Valid OTP — delete challenge to prevent reuse
  await prisma.phoneOtpChallenge.delete({ where: { id: challenge.id } }).catch(() => {});

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { phone: normalizedPhone, phoneVerified: true },
    });
  }

  return { verified: true, phone: normalizedPhone };
}

/**
 * Cryptographically verifies Telegram Login Widget authentication data.
 * Adheres to Telegram's official data-check-string and HMAC-SHA256 protocol.
 */
export function verifyTelegramAuth(data = {}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured on the server');
  }

  const { hash, ...authData } = data;
  if (!hash || !authData.id || !authData.auth_date) {
    return { valid: false, error: 'Incomplete Telegram authentication payload' };
  }

  // Prevent replay attacks: auth_date must be within 24 hours (86400 seconds)
  const authTimestamp = Number(authData.auth_date);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authTimestamp) || Math.abs(currentTimestamp - authTimestamp) > 86400) {
    return { valid: false, error: 'Telegram authentication token has expired' };
  }

  // Build the data-check-string: sorted alphabetically in format key=value\n
  const dataCheckString = Object.keys(authData)
    .sort()
    .map((key) => `${key}=${authData[key]}`)
    .join('\n');

  // Compute secret_key = SHA256(bot_token)
  const secretKey = crypto.createHash('sha256').update(botToken.trim()).digest();

  // Compute HMAC-SHA256(data_check_string, secret_key)
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Timing-safe comparison
  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');
    if (hashBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(hashBuffer, computedBuffer)) {
      return { valid: false, error: 'Invalid Telegram authentication signature' };
    }
  } catch {
    return { valid: false, error: 'Malformed signature' };
  }

  return {
    valid: true,
    profile: {
      telegramId: String(authData.id),
      firstName: String(authData.first_name || ''),
      lastName: String(authData.last_name || ''),
      username: authData.username ? String(authData.username) : null,
      photoUrl: authData.photo_url ? String(authData.photo_url) : null,
      authDate: new Date(authTimestamp * 1000),
    },
  };
}
