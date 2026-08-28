import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';

const missing = (...names) => names.filter((name) => !process.env[name]);

/**
 * Dispatches an email via Resend REST API.
 */
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
 * PayHere Sandbox integration helpers.
 */
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
