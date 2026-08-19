import crypto from 'node:crypto';

const missing = (...names) => names.filter((name) => !process.env[name]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_TIMEOUT_MS = 10000;
const TWILIO_TIMEOUT_MS = 10000;

function integrationError(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireConfig(names, label) {
  const required = missing(...names);
  if (required.length) throw integrationError(`${label} is not configured`, 503);
}

function upstreamError(label, response, body) {
  const statusCode = response.status === 429 ? 429 : 502;
  return integrationError(body?.message || `${label} request failed`, statusCode);
}

export function normalizeSriLankanPhone(value) {
  const raw = String(value || '').trim().replace(/[\s().-]/g, '');
  if (/^07\d{8}$/.test(raw)) return `+94${raw.slice(1)}`;
  if (/^947\d{8}$/.test(raw)) return `+${raw}`;
  if (/^\+947\d{8}$/.test(raw)) return raw;
  return null;
}

export async function sendEmail({ to, subject, html, text = '' }) {
  requireConfig(['RESEND_API_KEY', 'RESEND_FROM_EMAIL'], 'Email service');
  const recipient = String(to || '').trim().toLowerCase();
  if (!EMAIL_RE.test(recipient)) throw integrationError('A valid email recipient is required', 400);
  if (typeof subject !== 'string' || subject.trim().length < 1 || subject.length > 200) throw integrationError('Email subject is invalid', 400);
  if (typeof html !== 'string' || html.length < 1 || html.length > 100000) throw integrationError('Email body is invalid', 400);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [recipient], subject: subject.trim(), html, text }),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  }).catch(() => { throw integrationError('Email service is temporarily unavailable', 503); });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw upstreamError('Resend', response, body);
  return { configured: true, id: body.id };
}

export async function sendVerificationCode(phone) {
  requireConfig(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID'], 'Phone verification service');
  const normalizedPhone = normalizeSriLankanPhone(phone);
  if (!normalizedPhone) throw integrationError('Phone must be a valid Sri Lankan number such as 0771234567 or +94771234567', 400);
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({ To: normalizedPhone, Channel: 'sms' });
  const response = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    signal: AbortSignal.timeout(TWILIO_TIMEOUT_MS),
  }).catch(() => { throw integrationError('Phone verification service is temporarily unavailable', 503); });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw upstreamError('Twilio Verify', response, result);
  return { configured: true, status: result.status, phone: normalizedPhone };
}

export async function verifyCode(phone, code) {
  requireConfig(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID'], 'Phone verification service');
  const normalizedPhone = normalizeSriLankanPhone(phone);
  if (!normalizedPhone) throw integrationError('Phone must be a valid Sri Lankan number such as 0771234567 or +94771234567', 400);
  const normalizedCode = String(code || '').trim();
  if (!/^\d{4,10}$/.test(normalizedCode)) throw integrationError('A valid OTP code is required', 400);
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({ To: normalizedPhone, Code: normalizedCode });
  const response = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    signal: AbortSignal.timeout(TWILIO_TIMEOUT_MS),
  }).catch(() => { throw integrationError('Phone verification service is temporarily unavailable', 503); });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw upstreamError('Twilio Verify', response, result);
  return { configured: true, approved: result.status === 'approved', status: result.status, phone: normalizedPhone };
}

export async function createPayPalOrder({ amount, currency = 'USD', description = 'Luxora service', returnUrl, cancelUrl }) {
  const required = missing('PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET');
  if (required.length) throw new Error(`Missing env: ${required.join(', ')}`);
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(tokenBody?.error_description || 'PayPal authentication failed');
  const applicationContext = { brand_name: 'Luxora', user_action: 'PAY_NOW' };
  if (returnUrl) applicationContext.return_url = returnUrl;
  if (cancelUrl) applicationContext.cancel_url = cancelUrl;
  const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, { method: 'POST', headers: { Authorization: `Bearer ${tokenBody.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: currency, value: Number(amount).toFixed(2) }, description }], application_context: applicationContext }) });
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
  const value = Number(amount).toFixed(2);
  const hash = md5(merchantId + orderId + value + currency + md5(process.env.PAYHERE_MERCHANT_SECRET));
  return { merchant_id: merchantId, order_id: orderId, items: customer.items || 'Luxora service', amount: value, currency, first_name: customer.firstName || 'Luxora', last_name: customer.lastName || 'Customer', email: customer.email || '', phone: customer.phone || '', address: customer.address || '', city: customer.city || '', country: 'Sri Lanka', return_url: returnUrl, cancel_url: cancelUrl, hash };
}

export function verifyPayHereWebhook({ merchant_id, order_id, payhere_amount, status_code, payhere_currency, md5sig }) {
  if (!process.env.PAYHERE_MERCHANT_SECRET) return false;
  const md5 = (value) => crypto.createHash('md5').update(value).digest('hex').toUpperCase();
  const expected = md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + md5(process.env.PAYHERE_MERCHANT_SECRET));
  return merchant_id === process.env.PAYHERE_MERCHANT_ID && Boolean(md5sig) && md5sig.toUpperCase() === expected;
}
