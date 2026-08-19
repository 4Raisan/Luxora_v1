import { Router } from 'express';
import crypto from 'node:crypto';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';
import { notify } from '../services/notify.js';
import { createPayHereFields, sendEmail, sendVerificationCode, verifyCode, verifyPayHereWebhook } from '../services/integrations.js';
import { toPositiveInt } from '../middleware/validators.js';

const router = Router();
const money = (value) => Math.round(Number(value) * 100) / 100;
const sameMoney = (left, right) => Number.isFinite(Number(left)) && Math.round(Number(left) * 100) === Math.round(Number(right) * 100);
const environment = () => String(process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk').includes('sandbox') ? 'SANDBOX' : 'LIVE';

async function activateSubscription(payment, payload) {
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.payment.findUnique({ where: { id: payment.id }, include: { plan: true } });
    if (!fresh || fresh.status === 'COMPLETED') return fresh;
    if (fresh.status !== 'PENDING') return null;
    const subscription = await tx.userSubscription.create({ data: { userId: fresh.userId, planId: fresh.planId, endDate: new Date(Date.now() + (fresh.plan.durationDays || 30) * 86400000), status: 'active' } });
    return tx.payment.update({ where: { id: fresh.id }, data: { status: 'COMPLETED', capturedAmount: Number(payload.payhere_amount), capturedCurrency: String(payload.payhere_currency).toUpperCase(), webhookPayload: payload, subscriptionId: subscription.id }, include: { plan: true, subscription: true } });
  }, { isolationLevel: 'Serializable' });
}

router.post('/payments/payhere/webhook', async (req, res) => {
  const payload = req.body || {};
  if (!verifyPayHereWebhook(payload)) return res.status(400).send('Invalid signature');
  const payment = await prisma.payment.findUnique({ where: { gatewayOrderId: String(payload.order_id || '') } });
  if (!payment || payment.gateway !== 'PAYHERE') return res.status(404).send('Payment not found');
  if (payment.status === 'COMPLETED') return res.status(200).send('OK');
  const amount = Number(payload.payhere_amount);
  const currency = String(payload.payhere_currency || '').toUpperCase();
  if (!sameMoney(amount, payment.expectedAmount) || currency !== payment.expectedCurrency) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', webhookPayload: payload } });
    return res.status(400).send('Amount or currency mismatch');
  }
  const status = Number(payload.status_code);
  if (status === 2) {
    const completed = await activateSubscription(payment, payload);
    if (completed) {
      await notify(completed.userId, 'Payment successful. Your Luxora membership is now active.', '/customer-dashboard');
      const user = await prisma.user.findUnique({ where: { id: completed.userId }, select: { email: true, name: true } });
      sendEmail({ to: user?.email, subject: 'Luxora payment successful', html: `<p>Hi ${user?.name || 'Customer'},</p><p>Your ${completed.plan.title} membership is active.</p>` }).catch(() => {});
    }
  } else if (status === -1 || status === -2) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', webhookPayload: payload } });
    await notify(payment.userId, 'Your Luxora payment was not completed. You can try again.', '/customer-dashboard');
  } else if (status === -3) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', webhookPayload: payload } });
    await notify(payment.userId, 'Your Luxora payment has been refunded.', '/customer-dashboard');
  } else {
    await prisma.payment.update({ where: { id: payment.id }, data: { webhookPayload: payload } });
  }
  res.status(200).send('OK');
});

router.post('/payments/payhere/order', authenticateToken, async (req, res) => {
  try {
    const planId = toPositiveInt(req.body.plan_id);
    if (!planId) return res.status(400).json({ error: 'plan_id is required' });
    const [plan, user] = await Promise.all([prisma.subscriptionPlan.findFirst({ where: { id: planId, active: true } }), prisma.user.findUnique({ where: { id: req.user.id } })]);
    if (!plan || !user) return res.status(404).json({ error: 'Plan or customer not found' });
    const amount = money(plan.priceMonthly);
    const orderId = `LUX-PH-${user.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const payment = await prisma.payment.create({ data: { userId: user.id, planId: plan.id, gateway: 'PAYHERE', gatewayOrderId: orderId, idempotencyKey: orderId, expectedAmount: amount, expectedCurrency: 'LKR' } });
    const fields = createPayHereFields({ amount, orderId, currency: 'LKR', customer: { firstName: user.name.split(/\s+/)[0], lastName: user.name.split(/\s+/).slice(1).join(' ') || 'Customer', email: user.email, phone: user.phone || '', city: user.town || '', items: plan.title }, returnUrl: process.env.PAYHERE_RETURN_URL || 'http://localhost:3000/customer-dashboard?payment=payhere', cancelUrl: process.env.PAYHERE_CANCEL_URL || 'http://localhost:3000/customer-dashboard?payment=cancelled' });
    fields.notify_url = process.env.PAYHERE_NOTIFY_URL || '';
    res.json({ paymentId: payment.id, orderId, environment: environment(), checkoutUrl: `${process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk'}/pay/checkout`, fields });
  } catch (error) { res.status(502).json({ error: error.message }); }
});

router.get('/payments/my', authenticateToken, async (req, res) => {
  const payments = await prisma.payment.findMany({ where: { userId: req.user.id }, include: { plan: { select: { title: true } }, subscription: { select: { id: true, startDate: true, endDate: true, status: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ environment: environment(), payments });
});

router.post('/email', authenticateToken, async (req, res) => {
  if (!req.body.to || !req.body.subject || !req.body.html) return res.status(400).json({ error: 'to, subject and html are required' });
  if (req.body.to !== req.user.email && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'You can only email your own address' });
  try { res.json(await sendEmail(req.body)); } catch (error) { res.status(502).json({ error: error.message }); }
});
router.post('/otp/send', authenticateToken, async (req, res) => { try { res.json(await sendVerificationCode(req.body.phone)); } catch (error) { res.status(502).json({ error: error.message }); } });
router.post('/otp/verify', authenticateToken, async (req, res) => { try { res.json(await verifyCode(req.body.phone, req.body.code)); } catch (error) { res.status(502).json({ error: error.message }); } });

export default router;
