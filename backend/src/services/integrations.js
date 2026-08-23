import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';

const missing = (...names) => names.filter((name) => !process.env[name]);

// Resend's shared onboarding@resend.dev sender only delivers to the account
// owner's own inbox. That is fine for local development but means password
// reset (and every other transactional email) silently never reaches real
// users in production, so treat it as "not ready" outside development.
export function emailDeliveryReady() {
  if (!process.env.RESEND_API_KEY) return false;
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  return !(process.env.NODE_ENV === 'production' && from === 'onboarding@resend.dev');
}

export function payHereConfigured() {
  const merchantId = process.env.PAYHERE_MERCHANT_ID;
  const secret = process.env.PAYHERE_MERCHANT_SECRET;
  if (!merchantId || !secret) return false;
  // Placeholder-style values (e.g. "YOUR_PAYHERE_MERCHANT_ID" from .env.example)
  // are presence without configuration and must not reach the checkout form.
  const isPlaceholder = (value) => /^(your|change\s*me|placeholder|xxxx*)/i.test(String(value).trim());
  return !isPlaceholder(merchantId) && !isPlaceholder(secret);
}

export async function sendEmail({ to, subject, html, text = '' }) {
  if (!to || !process.env.RESEND_API_KEY) return { configured: false };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', to: [to], subject, html, text }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `Resend request failed (${response.status})`);
  return { configured: true, id: body.id };
}

export async function sendVerificationCode(phone) {
  const required = missing('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID');
  if (required.length) return { configured: false, missing: required };
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({ To: phone, Channel: 'sms' });
  const response = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.message || `Twilio request failed (${response.status})`);
  return { configured: true, sid: result.sid, status: result.status };
}

export async function verifyCode(phone, code) {
  const required = missing('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID');
  if (required.length) return { configured: false, missing: required };
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({ To: phone, Code: code });
  const response = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.message || `Twilio request failed (${response.status})`);
  return { configured: true, approved: result.status === 'approved', status: result.status };
}

export async function createPayPalOrder({ amount, currency = 'USD', description = 'Luxora service' }) {
  const required = missing('PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET');
  if (required.length) throw new Error(`Missing env: ${required.join(', ')}`);
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(tokenBody?.error_description || 'PayPal authentication failed');
  const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, { method: 'POST', headers: { Authorization: `Bearer ${tokenBody.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: currency, value: Number(amount).toFixed(2) }, description }], application_context: { brand_name: 'Luxora', user_action: 'PAY_NOW' } }) });
  const order = await orderResponse.json();
  if (!orderResponse.ok) throw new Error(order?.message || 'PayPal order creation failed');
  return { orderId: order.id, status: order.status, approvalUrl: order.links?.find((link) => link.rel === 'approve')?.href || null };
}

export async function capturePayPalOrder(orderId) {
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error('PayPal authentication failed');
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', headers: { Authorization: `Bearer ${tokenBody.access_token}`, 'Content-Type': 'application/json' } });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || 'PayPal capture failed');
  return body;
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
