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

const whatsAppConfigured = () => missing('WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TEMPLATE').length === 0;

export async function sendWhatsAppVerificationCode(phone) {
  const configured = whatsAppConfigured();
  const code = configured ? crypto.randomInt(100000, 1000000).toString() : DEMO_WHATSAPP_CODE;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const codeHash = await bcrypt.hash(code, 10);
  await prisma.phoneOtpChallenge.upsert({ where: { phone }, update: { codeHash, expiresAt }, create: { phone, codeHash, expiresAt } });

  if (!configured) return { configured: true, demo: true, channel: 'whatsapp', status: 'pending' };
  const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v22.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: phone.replace(/^\+/, ''), type: 'template',
      template: {
        name: process.env.WHATSAPP_VERIFY_TEMPLATE,
        language: { code: process.env.WHATSAPP_VERIFY_TEMPLATE_LANGUAGE || 'en_US' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
      },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `WhatsApp Cloud API request failed (${response.status})`);
  return { configured: true, channel: 'whatsapp', status: 'pending', messageId: result.messages?.[0]?.id };
}

export async function verifyWhatsAppCode(phone, code) {
  const challenge = await prisma.phoneOtpChallenge.findUnique({ where: { phone } });
  const approved = Boolean(challenge && challenge.expiresAt > new Date() && await bcrypt.compare(String(code), challenge.codeHash));
  if (approved) await prisma.phoneOtpChallenge.delete({ where: { phone } });
  return { configured: true, demo: !whatsAppConfigured(), channel: 'whatsapp', approved, status: approved ? 'approved' : 'pending' };
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
