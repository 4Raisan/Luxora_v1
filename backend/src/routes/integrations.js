import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';
import { toPositiveInt } from '../middleware/validators.js';
import { createPayHereFields, createPayPalOrder, capturePayPalOrder, verifyPayHereWebhook, sendEmail } from '../services/integrations.js';

const router = Router();

const asMoney = (value) => Math.round(Number(value) * 100) / 100;
const sameMoney = (left, right) => Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.round(Number(left) * 100) === Math.round(Number(right) * 100);

export function classifyPayHereWebhook(payment, payload = {}) {
  if (!payment || payment.gateway !== 'PAYHERE') return 'missing';
  if (payment.status === 'COMPLETED') return 'already_completed';
  const amount = Number(payload.payhere_amount);
  const currency = String(payload.payhere_currency || '').toUpperCase();
  if (!sameMoney(amount, payment.expectedAmount) || currency !== String(payment.expectedCurrency || '').toUpperCase()) return 'amount_mismatch';
  const statusCode = Number(payload.status_code);
  if (statusCode === 0) return 'pending';
  if (statusCode === -1 || statusCode === -2) return 'failed';
  if (statusCode === -3) return 'refunded';
  if (statusCode === 2) return 'success';
  return 'unsupported';
}

export function verifyPayPalCapture(payment, capture = {}) {
  const captureRecord = capture.purchase_units?.[0]?.payments?.captures?.[0];
  const capturedAmount = Number(captureRecord?.amount?.value);
  const capturedCurrency = String(captureRecord?.amount?.currency_code || '').toUpperCase();
  const valid = Boolean(payment) && capture.status === 'COMPLETED' && captureRecord?.status === 'COMPLETED' && sameMoney(capturedAmount, payment.expectedAmount) && capturedCurrency === String(payment.expectedCurrency || '').toUpperCase();
  return { valid, capturedAmount, capturedCurrency };
}

const errorStatus = (error) => Number.isInteger(error?.statusCode) ? error.statusCode : 502;

function paymentOrderId(gateway, userId) {
  return `LUX-${gateway}-${userId}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function customerFields(user) {
  const nameParts = String(user?.name || 'Luxora Customer').trim().split(/\s+/);
  return {
    firstName: nameParts.shift() || 'Luxora',
    lastName: nameParts.join(' ') || 'Customer',
    email: user?.email || '',
    city: user?.town || '',
  };
}

async function findOwnedBooking(userId, bookingId) {
  if (bookingId === undefined || bookingId === null || bookingId === '') return null;
  const id = toPositiveInt(bookingId);
  if (!id) {
    const error = new Error('Invalid booking_id');
    error.statusCode = 400;
    throw error;
  }
  const booking = await prisma.booking.findFirst({ where: { id, userId }, select: { id: true, totalPrice: true } });
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }
  return booking;
}

async function getPlanAndUser(userId, planId) {
  const [plan, user] = await Promise.all([
    prisma.subscriptionPlan.findUnique({ where: { id: planId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, town: true } }),
  ]);
  if (!plan) {
    const error = new Error('Plan not found');
    error.statusCode = 404;
    throw error;
  }
  if (!user) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }
  const amount = asMoney(plan.priceMonthly);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error('The selected plan does not have a valid server price');
    error.statusCode = 409;
    throw error;
  }
  return { plan, user, amount };
}

async function createPendingPayment({ userId, planId, bookingId, gateway, gatewayOrderId, expectedAmount, expectedCurrency }) {
  return prisma.payment.create({
    data: {
      userId,
      planId,
      bookingId: bookingId || undefined,
      gateway,
      gatewayOrderId,
      status: 'PENDING',
      expectedAmount,
      expectedCurrency,
      idempotencyKey: gatewayOrderId,
    },
  });
}

async function settleVerifiedPayment({ paymentId, capturedAmount, capturedCurrency, payload }) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { plan: true },
    });
    if (!payment) return { outcome: 'missing' };
    if (payment.status === 'COMPLETED') return { outcome: 'already_completed', payment };
    if (payment.status !== 'PENDING') return { outcome: 'not_pending', payment };

    const existingSubscription = await tx.userSubscription.findFirst({
      where: { userId: payment.userId, planId: payment.planId, status: 'active', endDate: { gt: new Date() } },
    });
    const subscription = existingSubscription || await tx.userSubscription.create({
      data: {
        userId: payment.userId,
        planId: payment.planId,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active',
      },
    });
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        capturedAmount,
        capturedCurrency,
        webhookPayload: payload,
        subscriptionId: subscription.id,
      },
      include: { plan: true, subscription: true },
    });
    return { outcome: existingSubscription ? 'completed_existing_subscription' : 'completed', payment: updatedPayment };
  }, { isolationLevel: 'Serializable' });
}

async function sendSubscriptionReceipt(payment) {
  if (!payment?.plan) return;
  const subscriber = await prisma.user.findUnique({ where: { id: payment.userId }, select: { email: true, name: true } });
  if (!subscriber?.email) return;
  sendEmail({
    to: subscriber.email,
    subject: `Luxora subscription confirmed: ${payment.plan.title}`,
    html: `<p>Hi ${subscriber.name || 'Customer'},</p><p>Your ${payment.plan.title} subscription is active until ${payment.subscription?.endDate?.toISOString().slice(0, 10)}.</p><p>Amount: ${payment.expectedCurrency} ${Number(payment.expectedAmount).toLocaleString()}</p>`,
  }).catch((error) => console.warn('[email] subscription receipt failed:', error.message));
}

function payPalUsdAmount(lkrAmount) {
  const rate = Number(process.env.PAYPAL_LKR_TO_USD_RATE);
  if (!Number.isFinite(rate) || rate <= 0) {
    const error = new Error('PayPal LKR-to-USD conversion is not configured');
    error.statusCode = 503;
    throw error;
  }
  const amount = asMoney(lkrAmount * rate);
  if (amount < 0.01) {
    const error = new Error('The selected plan is below PayPal minimum amount');
    error.statusCode = 409;
    throw error;
  }
  return amount;
}

// PayHere calls this server-to-server and therefore cannot use a user JWT.
router.post('/payments/payhere/webhook', async (req, res) => {
  const payload = req.body || {};
  if (!verifyPayHereWebhook(payload)) return res.status(400).send('Invalid signature');

  const gatewayOrderId = String(payload.order_id || '');
  const payment = await prisma.payment.findUnique({ where: { gatewayOrderId } });
  const classification = classifyPayHereWebhook(payment, payload);
  if (classification === 'missing') return res.status(404).send('Payment not found');
  if (classification === 'already_completed') return res.status(200).send('OK');

  const amount = Number(payload.payhere_amount);
  const currency = String(payload.payhere_currency || '').toUpperCase();
  if (classification === 'amount_mismatch') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', webhookPayload: payload } });
    return res.status(400).send('Payment amount or currency mismatch');
  }
  if (classification === 'pending') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PENDING', webhookPayload: payload } });
    return res.status(200).send('OK');
  }
  if (classification === 'failed') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', webhookPayload: payload } });
    return res.status(200).send('OK');
  }
  if (classification === 'refunded') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', webhookPayload: payload } });
    return res.status(200).send('OK');
  }
  if (classification === 'unsupported') return res.status(400).send('Unsupported payment status');

  const settled = await settleVerifiedPayment({ paymentId: payment.id, capturedAmount: asMoney(amount), capturedCurrency: currency, payload });
  if (settled.outcome === 'not_pending') return res.status(409).send('Payment is not pending');
  if (settled.outcome === 'missing') return res.status(404).send('Payment not found');
  if (settled.outcome === 'completed') await sendSubscriptionReceipt(settled.payment);
  return res.status(200).send('OK');
});

router.post('/payments/payhere/order', authenticateToken, async (req, res) => {
  try {
    const planId = toPositiveInt(req.body.plan_id);
    if (!planId) return res.status(400).json({ error: 'plan_id is required' });
    const booking = await findOwnedBooking(req.user.id, req.body.booking_id);
    const { plan, user, amount } = await getPlanAndUser(req.user.id, planId);
    const orderId = paymentOrderId('PH', req.user.id);
    const payment = await createPendingPayment({ userId: req.user.id, planId, bookingId: booking?.id, gateway: 'PAYHERE', gatewayOrderId: orderId, expectedAmount: amount, expectedCurrency: 'LKR' });
    const fields = createPayHereFields({ amount, orderId, currency: 'LKR', customer: { ...customerFields(user), items: plan.title }, returnUrl: process.env.PAYHERE_RETURN_URL || process.env.FRONTEND_URL || 'http://localhost:3000', cancelUrl: process.env.PAYHERE_CANCEL_URL || process.env.FRONTEND_URL || 'http://localhost:3000' });
    res.json({ paymentId: payment.id, orderId, checkoutUrl: `${process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk'}/pay/checkout`, fields });
  } catch (error) { res.status(errorStatus(error)).json({ error: error.message }); }
});

router.post('/payments/paypal/order', authenticateToken, async (req, res) => {
  try {
    const planId = toPositiveInt(req.body.plan_id);
    if (!planId) return res.status(400).json({ error: 'plan_id is required' });
    const booking = await findOwnedBooking(req.user.id, req.body.booking_id);
    const { plan, amount: lkrAmount } = await getPlanAndUser(req.user.id, planId);
    const expectedAmount = payPalUsdAmount(lkrAmount);
    const orderId = paymentOrderId('PP', req.user.id);
    const paypalOrder = await createPayPalOrder({
      amount: expectedAmount,
      currency: 'USD',
      description: plan.title,
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer-dashboard?payment=paypal`,
      cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer-dashboard?payment=cancelled`,
    });
    const payment = await createPendingPayment({ userId: req.user.id, planId, bookingId: booking?.id, gateway: 'PAYPAL', gatewayOrderId: paypalOrder.orderId, expectedAmount, expectedCurrency: 'USD' });
    res.json({ paymentId: payment.id, ...paypalOrder });
  } catch (error) { res.status(errorStatus(error)).json({ error: error.message }); }
});

router.post('/payments/paypal/capture', authenticateToken, async (req, res) => {
  const paymentId = toPositiveInt(req.body.payment_id);
  if (!paymentId) return res.status(400).json({ error: 'payment_id is required' });
  try {
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, userId: req.user.id }, include: { plan: true } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.gateway !== 'PAYPAL') return res.status(400).json({ error: 'Payment gateway mismatch' });
    if (payment.status === 'COMPLETED') return res.json({ paymentId: payment.id, status: 'COMPLETED', alreadyProcessed: true, subscriptionId: payment.subscriptionId });
    if (payment.status !== 'PENDING') return res.status(409).json({ error: 'Payment is not pending', status: payment.status });

    const capture = await capturePayPalOrder(payment.gatewayOrderId);
    const verification = verifyPayPalCapture(payment, capture);
    if (!verification.valid) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', capturedAmount: Number.isFinite(verification.capturedAmount) ? asMoney(verification.capturedAmount) : undefined, capturedCurrency: verification.capturedCurrency || undefined, webhookPayload: capture } });
      return res.status(400).json({ error: 'PayPal capture verification failed' });
    }

    const settled = await settleVerifiedPayment({ paymentId: payment.id, capturedAmount: asMoney(verification.capturedAmount), capturedCurrency: verification.capturedCurrency, payload: capture });
    if (settled.outcome === 'already_completed') return res.json({ paymentId: payment.id, status: 'COMPLETED', alreadyProcessed: true, subscriptionId: settled.payment.subscriptionId });
    if (settled.outcome === 'not_pending') return res.status(409).json({ error: 'Payment is not pending', status: settled.payment.status });
    if (settled.outcome === 'missing') return res.status(404).json({ error: 'Payment not found' });
    await sendSubscriptionReceipt(settled.payment);
    return res.json({ paymentId: settled.payment.id, status: settled.payment.status, subscriptionId: settled.payment.subscriptionId, gatewayOrderId: settled.payment.gatewayOrderId });
  } catch (error) { return res.status(errorStatus(error)).json({ error: error.message }); }
});

export default router;
