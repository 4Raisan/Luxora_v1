import { Router } from 'express';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';
import { notify } from '../services/notify.js';
import { createPayHereFields, sendEmail, sendWhatsAppVerificationCode, verifyWhatsAppCode, verifyPayHereWebhook, normalizePhoneNumber } from '../services/integrations.js';
import { getEntitlementSnapshot } from '../services/entitlements.js';
import { toPositiveInt } from '../middleware/validators.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
// Money is normalized and compared as exact 2-decimal-place Decimals end to end.
const money = (value) => new Prisma.Decimal(value).toDecimalPlaces(2);
const sameMoney = (left, right) => {
  try { return new Prisma.Decimal(left).toDecimalPlaces(2).equals(new Prisma.Decimal(right).toDecimalPlaces(2)); }
  catch { return false; }
};
const otpSendLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const otpVerifyLimiter = rateLimit({ max: 10, windowMs: 15 * 60 * 1000 });
const emailLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const environment = () => String(process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk').includes('sandbox') ? 'SANDBOX' : 'LIVE';
const payHereUrls = () => ({
  returnUrl: String(process.env.PAYHERE_RETURN_URL || '').trim(),
  cancelUrl: String(process.env.PAYHERE_CANCEL_URL || '').trim(),
  notifyUrl: String(process.env.PAYHERE_NOTIFY_URL || '').trim(),
});
const isPublicHttpsUrl = (value) => /^https:\/\/[^/]+/i.test(value) && !value.includes('YOUR_');
const payHereIsReady = () => {
  const urls = payHereUrls();
  return Boolean(process.env.PAYHERE_MERCHANT_ID && process.env.PAYHERE_MERCHANT_SECRET)
    && Object.values(urls).every(isPublicHttpsUrl);
};
// Demo checkout is opt-in at deployment time. It never calls PayHere and is
// intentionally unavailable unless PAYMENT_MODE=demo is set on the backend.
const paymentMode = () => String(process.env.PAYMENT_MODE || 'payhere').trim().toLowerCase() === 'demo' ? 'demo' : 'payhere';

export async function activateSubscription(payment, payload, { capturedAmount, capturedCurrency, autoRenew = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.payment.findUnique({ where: { id: payment.id }, include: { plan: { include: { entitlements: true } } } });
    if (!fresh || fresh.status === 'COMPLETED') return null;
    if (fresh.status !== 'PENDING') return null;
    const days = fresh.plan.durationDays || 30;
    const endDate = new Date(Date.now() + days * 86400000);
    const subscription = await tx.userSubscription.create({ data: { userId: fresh.userId, planId: fresh.planId, endDate, status: 'active', autoRenew, renewalIntervalDays: days, nextRenewalDate: endDate } });
    return tx.payment.update({ where: { id: fresh.id }, data: { status: 'COMPLETED', capturedAmount: Number(capturedAmount ?? payload.payhere_amount), capturedCurrency: String(capturedCurrency ?? payload.payhere_currency).toUpperCase(), webhookPayload: payload, subscriptionId: subscription.id }, include: { plan: { include: { entitlements: true } }, subscription: true } });
  }, { isolationLevel: 'Serializable' });
}

async function completePaymentExperience(payment, mode) {
  const coinsGranted = payment.plan.entitlements.reduce((total, entitlement) => total + entitlement.units, 0);
  const [entitlements, user] = await Promise.all([
    getEntitlementSnapshot(prisma, payment.userId),
    prisma.user.findUnique({ where: { id: payment.userId }, select: { email: true, name: true } }),
    notify(payment.userId, `${mode === 'demo' ? 'Demo ' : ''}payment successful. Your ${payment.plan.title} package is active with ${coinsGranted} service coin${coinsGranted === 1 ? '' : 's'}.`, '/customer-dashboard'),
  ]);
  const amount = Number(payment.capturedAmount ?? payment.expectedAmount).toLocaleString();
  const emailDelivery = await sendEmail({
    to: user?.email,
    subject: `Luxora payment successful: ${payment.plan.title}`,
    html: `<p>Hi ${user?.name || 'Customer'},</p><p>Your <strong>${payment.plan.title}</strong> package is active until ${payment.subscription.endDate.toISOString().slice(0, 10)}.</p><p>Service coins added: <strong>${coinsGranted}</strong></p><p>Payment: ${payment.capturedCurrency || payment.expectedCurrency} ${amount}${mode === 'demo' ? ' (demo, no real charge)' : ''}</p>`,
  }).then((result) => result.configured ? 'sent' : 'not_configured').catch((error) => {
    console.warn('[email] payment receipt failed:', error.message);
    return 'failed';
  });
  return {
    entitlement_snapshot: entitlements,
    receipt: {
      payment_id: payment.id,
      plan_id: payment.planId,
      plan_title: payment.plan.title,
      amount: Number(payment.capturedAmount ?? payment.expectedAmount),
      currency: payment.capturedCurrency || payment.expectedCurrency,
      coins_granted: coinsGranted,
      subscription_id: payment.subscription.id,
      active_until: payment.subscription.endDate,
    },
    email_delivery: emailDelivery,
  };
}

router.post('/payments/payhere/webhook', async (req, res) => {
  const payload = req.body || {};
  if (!verifyPayHereWebhook(payload)) return res.status(400).send('Invalid signature');
  const payment = await prisma.payment.findUnique({ where: { gatewayOrderId: String(payload.order_id || '') } });
  if (!payment || payment.gateway !== 'PAYHERE') return res.status(404).send('Payment not found');
  const statusCode = Number(payload.status_code);
  // Idempotency: PayHere retries webhooks, so duplicates of an already-processed
  // state are acked without side effects. A refund (-3) after COMPLETED is a NEW
  // transition, not a duplicate, and must still be processed.
  const duplicateCharge = statusCode === 2 && ['COMPLETED', 'REFUNDED'].includes(payment.status);
  const duplicateRefund = statusCode === -3 && payment.status === 'REFUNDED';
  if (duplicateCharge || duplicateRefund) return res.status(200).send('OK');
  const amount = Number(payload.payhere_amount);
  const currency = String(payload.payhere_currency || '').toUpperCase();
  if (!sameMoney(amount, payment.expectedAmount) || currency !== payment.expectedCurrency) {
    if (payment.status === 'PENDING') await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', webhookPayload: payload } });
    return res.status(400).send('Amount or currency mismatch');
  }
  if (statusCode === 2) {
    const completed = await activateSubscription(payment, payload);
    if (completed) await completePaymentExperience(completed, 'payhere');
  } else if (statusCode === -1 || statusCode === -2) {
    // Failures only apply to payments that never settled.
    if (payment.status === 'PENDING') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', webhookPayload: payload } });
      await notify(payment.userId, 'Your Luxora payment was not completed. You can try again.', '/customer-dashboard');
    }
  } else if (statusCode === -3) {
    // Refunds follow a settled charge: mark payment refunded and revoke the
    // package atomically so entitlements stop immediately.
    if (payment.status === 'COMPLETED') {
      await prisma.$transaction([
        prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', webhookPayload: payload } }),
        ...(payment.subscriptionId ? [prisma.userSubscription.update({ where: { id: payment.subscriptionId }, data: { status: 'refunded', autoRenew: false, nextRenewalDate: null } })] : []),
      ]);
      await notify(payment.userId, 'Your Luxora payment has been refunded.', '/customer-dashboard');
    }
  } else if (payment.status === 'PENDING') {
    await prisma.payment.update({ where: { id: payment.id }, data: { webhookPayload: payload } });
  }
  res.status(200).send('OK');
});

router.post('/payments/payhere/order', authenticateToken, async (req, res) => {
  try {
    if (paymentMode() === 'demo') return res.status(409).json({ error: 'Demo payment mode is enabled; use the demo checkout.' });
    if (!payHereIsReady()) return res.status(503).json({ error: 'PayHere is not ready. Configure public HTTPS return, cancel, and webhook URLs before enabling checkout.' });
    const planId = toPositiveInt(req.body.plan_id);
    if (!planId) return res.status(400).json({ error: 'plan_id is required' });
    const [plan, user] = await Promise.all([prisma.subscriptionPlan.findFirst({ where: { id: planId, active: true } }), prisma.user.findUnique({ where: { id: req.user.id } })]);
    if (!plan || !user) return res.status(404).json({ error: 'Plan or customer not found' });
    const amount = money(plan.priceMonthly);
    const urls = payHereUrls();
    const orderId = `LUX-PH-${user.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const payment = await prisma.payment.create({ data: { userId: user.id, planId: plan.id, gateway: 'PAYHERE', gatewayOrderId: orderId, idempotencyKey: orderId, expectedAmount: amount, expectedCurrency: 'LKR' } });
    const fields = createPayHereFields({ amount, orderId, currency: 'LKR', customer: { firstName: user.name.split(/\s+/)[0], lastName: user.name.split(/\s+/).slice(1).join(' ') || 'Customer', email: user.email, phone: user.phone || '', city: user.town || '', items: plan.title }, returnUrl: urls.returnUrl, cancelUrl: urls.cancelUrl });
    fields.notify_url = urls.notifyUrl;
    res.json({ paymentId: payment.id, orderId, environment: environment(), checkoutUrl: `${process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk'}/pay/checkout`, fields });
  } catch (error) { console.error('[payhere] order creation failed:', error.message); res.status(502).json({ error: 'Could not create payment order' }); }
});

router.get('/payments/mode', authenticateToken, (_req, res) => res.json({ mode: paymentMode(), label: paymentMode() === 'demo' ? 'DEMO / TEST — no real charge' : `PayHere ${environment()}` }));

router.post('/payments/demo/order', authenticateToken, async (req, res) => {
  if (paymentMode() !== 'demo') return res.status(403).json({ error: 'Demo payments are disabled for this deployment' });
  const planId = toPositiveInt(req.body.plan_id);
  const plan = planId && await prisma.subscriptionPlan.findFirst({ where: { id: planId, active: true } });
  if (!plan) return res.status(404).json({ error: 'Active plan not found' });
  const orderId = `LUX-DEMO-${req.user.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const payment = await prisma.payment.create({ data: { userId: req.user.id, planId: plan.id, gateway: 'DEMO', gatewayOrderId: orderId, idempotencyKey: orderId, expectedAmount: money(plan.priceMonthly), expectedCurrency: 'LKR', webhookPayload: { mode: 'demo', autoRenew: Boolean(req.body.auto_renew) } } });
  res.status(201).json({ payment_id: payment.id, order_id: orderId, plan: { id: plan.id, title: plan.title, amount: payment.expectedAmount, currency: payment.expectedCurrency }, message: 'Demo checkout created. This is not a financial transaction.' });
});

router.post('/payments/demo/:id/complete', authenticateToken, async (req, res) => {
  if (paymentMode() !== 'demo') return res.status(403).json({ error: 'Demo payments are disabled for this deployment' });
  const payment = await prisma.payment.findFirst({ where: { id: toPositiveInt(req.params.id) || 0, userId: req.user.id, gateway: 'DEMO' } });
  if (!payment) return res.status(404).json({ error: 'Demo payment not found' });
  const outcome = String(req.body.outcome || 'success').toLowerCase();
  if (!['success', 'failure', 'cancel'].includes(outcome)) return res.status(400).json({ error: 'outcome must be success, failure, or cancel' });
  if (outcome !== 'success') {
    const status = outcome === 'cancel' ? 'REFUNDED' : 'FAILED';
    await prisma.payment.update({ where: { id: payment.id }, data: { status, webhookPayload: { mode: 'demo', outcome } } });
    return res.json({ status: status.toLowerCase(), message: `Demo payment ${outcome}. No money was charged.` });
  }
  const saved = await activateSubscription(payment, { mode: 'demo', outcome }, { capturedAmount: payment.expectedAmount, capturedCurrency: payment.expectedCurrency, autoRenew: Boolean(payment.webhookPayload?.autoRenew) });
  if (!saved) return res.status(409).json({ error: 'This demo payment can no longer be completed' });
  const experience = await completePaymentExperience(saved, 'demo');
  res.json({ status: 'completed', subscription: saved.subscription, message: 'Demo payment successful. No real money was charged.', ...experience });
});

router.get('/payments/my', authenticateToken, async (req, res) => {
  const payments = await prisma.payment.findMany({ where: { userId: req.user.id }, include: { plan: { select: { title: true } }, subscription: { select: { id: true, startDate: true, endDate: true, status: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ environment: environment(), payments });
});

router.post('/email', authenticateToken, emailLimiter, async (req, res) => {
  if (!req.body.to || !req.body.subject || !req.body.html) return res.status(400).json({ error: 'to, subject and html are required' });
  if (req.body.to !== req.user.email && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'You can only email your own address' });
  try { res.json(await sendEmail(req.body)); } catch (error) { console.warn('[email] send failed:', error.message); res.status(502).json({ error: 'Email delivery failed' }); }
});
router.post('/whatsapp/send', authenticateToken, otpSendLimiter, async (req, res) => {
  const phone = normalizePhoneNumber(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'phone must be in valid international format, e.g. +94771234567' });
  try {
    const result = await sendWhatsAppVerificationCode(phone, { demoAllowed: true });
    res.json(result);
  } catch (error) {
    console.warn('[whatsapp] send failed:', error.message);
    res.status(502).json({ error: error.message || 'Could not send WhatsApp verification code' });
  }
});

router.post('/whatsapp/verify', authenticateToken, otpVerifyLimiter, async (req, res) => {
  const phone = normalizePhoneNumber(req.body.phone);
  const code = String(req.body.code || '').trim();
  if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'valid phone and 6-digit WhatsApp code are required' });
  try {
    const result = await verifyWhatsAppCode(phone, code);
    res.json(result);
  } catch (error) {
    console.warn('[whatsapp] verify failed:', error.message);
    res.status(502).json({ error: error.message || 'Could not verify the WhatsApp code' });
  }
});

export default router;
