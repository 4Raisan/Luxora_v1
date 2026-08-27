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
 */
export async function sendWhatsAppVerificationCode(phone, { demoAllowed = false } = {}) {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    throw new Error('Please enter a valid phone number in international format or Sri Lankan mobile number (e.g. +94771575701 or 0771575701).');
  }

  const { configured, missing } = validateWhatsAppConfig({ strict: false });

  // Generate a cryptographically secure 6-digit OTP code (or demo code if unconfigured in dev/test)
  const code = configured ? crypto.randomInt(100000, 1000000).toString() : DEMO_WHATSAPP_CODE;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const codeHash = await bcrypt.hash(code, 10);

  await prisma.phoneOtpChallenge.upsert({
    where: { phone: normalizedPhone },
    update: { codeHash, expiresAt },
    create: { phone: normalizedPhone, codeHash, expiresAt },
  });

  if (!configured) {
    if (demoAllowed || process.env.ALLOW_DEMO_OTP === 'true' || process.env.NODE_ENV !== 'production') {
      return { configured: false, demo: true, channel: 'whatsapp', status: 'pending', phone: normalizedPhone };
    }
    throw new Error(`WhatsApp Cloud API is not configured on the server. Missing environment variable(s): ${missing.join(', ')}`);
  }

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
