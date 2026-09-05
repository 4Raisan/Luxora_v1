import { Router } from 'express';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';
import { notify } from '../services/notify.js';
import {
  createPayHereFields,
  sendEmail,
  verifyPayHereWebhook,
  createNowPaymentsInvoice,
  nowPaymentsConfigured,
  fetchNowPaymentsPaymentStatus,
} from '../services/integrations.js';
import {
  verifyNowPaymentsSignature,
  classifyNowPaymentsIpn,
} from '../services/paymentContracts.js';
import { convertLkrToUsd } from '../services/currency.js';
import { toPositiveInt } from '../middleware/validators.js';import { rateLimit } from '../middleware/rateLimit.js';
import { calculatePromotionPrice, findActivePromotionForPlan } from '../services/promotions.js';
import { activateSubscription, completePaymentExperience, buildReceiptHtml } from '../services/paymentFulfilment.js';

const router = Router();
// Money is normalized and compared as exact 2-decimal-place Decimals end to end.
const money = (value) => new Prisma.Decimal(value).toDecimalPlaces(2);
const sameMoney = (left, right) => {
  try { return new Prisma.Decimal(left).toDecimalPlaces(2).equals(new Prisma.Decimal(right).toDecimalPlaces(2)); }
  catch { return false; }
};
const emailLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const environment = () => String(process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk').includes('sandbox') ? 'SANDBOX' : 'LIVE';
const payHereUrls = () => {
  const frontend = (process.env.FRONTEND_URL || 'https://luxora.bond').replace(/\/+$/, '');
  const backend = (process.env.BACKEND_PUBLIC_URL || 'https://site--luxora-backend--6kb9tg67ytl4.code.run').replace(/\/+$/, '');
  return {
    returnUrl: String(process.env.PAYHERE_RETURN_URL || `${frontend}/customer-dashboard?payhere=return`).trim(),
    cancelUrl: String(process.env.PAYHERE_CANCEL_URL || `${frontend}/customer-dashboard?payhere=cancel`).trim(),
    notifyUrl: String(process.env.PAYHERE_NOTIFY_URL || `${backend}/api/payments/payhere/webhook`).trim(),
  };
};
export function isPublicHttpsUrl(value) {
  try {
    const url = new URL(String(value));
    const hostname = url.hostname.toLowerCase();
    const privateHost = hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '[::1]'
      || hostname.startsWith('10.')
      || hostname.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    return url.protocol === 'https:' && !privateHost && !String(value).includes('YOUR_');
  } catch {
    return false;
  }
}
const payHereIsReady = () => {
  const urls = payHereUrls();
  return Boolean(process.env.PAYHERE_MERCHANT_ID && process.env.PAYHERE_MERCHANT_SECRET)
    && Object.values(urls).every(isPublicHttpsUrl);
};
// Demo checkout availability is independent from the configured real
// gateways. Enabling it must never disable PayHere or NOWPayments.

async function promotionPricingForPlan(plan) {
  const promotion = await findActivePromotionForPlan(prisma, plan.id);
  const pricing = calculatePromotionPrice(plan.priceMonthly, promotion?.discountPct || 0);
  return { promotion, ...pricing };
}

const promotionPaymentData = ({ promotion, originalAmount, discountAmount }) => ({
  promotionId: promotion?.id || null,
  originalAmount,
  discountAmount,
  webhookPayload: {
    promotion: promotion ? {
      id: promotion.id,
      code: promotion.code,
      title: promotion.title,
      discountPct: Number(promotion.discountPct),
      originalAmount: Number(originalAmount),
      discountAmount: Number(discountAmount),
    } : null,
  },
});

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

router.post('/payments/payhere/order', authenticateToken, requireRole('CUSTOMER'), async (req, res) => {
  try {
    if (!payHereIsReady()) return res.status(503).json({ error: 'PayHere is not ready. Configure public HTTPS return, cancel, and webhook URLs before enabling checkout.' });
    const planId = toPositiveInt(req.body.plan_id);
    if (!planId) return res.status(400).json({ error: 'plan_id is required' });
    const [plan, user] = await Promise.all([prisma.subscriptionPlan.findFirst({ where: { id: planId, active: true } }), prisma.user.findUnique({ where: { id: req.user.id } })]);
    if (!plan || !user) return res.status(404).json({ error: 'Plan or customer not found' });
    const pricing = await promotionPricingForPlan(plan);
    const amount = pricing.discountedAmount;
    const urls = payHereUrls();

    // Deduplicate rapid duplicate clicks within 15 seconds
    const recentPending = await prisma.payment.findFirst({
      where: {
        userId: user.id,
        planId: plan.id,
        promotionId: pricing.promotion?.id || null,
        gateway: 'PAYHERE',
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 15000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    let payment = recentPending;
    let orderId = recentPending?.gatewayOrderId;
    if (!payment) {
      orderId = `LUX-PH-${user.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      payment = await prisma.payment.create({ data: { userId: user.id, planId: plan.id, gateway: 'PAYHERE', gatewayOrderId: orderId, idempotencyKey: orderId, expectedAmount: amount, expectedCurrency: 'LKR', ...promotionPaymentData(pricing) } });
    }

    const promoLabel = pricing.promotion ? ` — ${Number(pricing.promotion.discountPct)}% off` : '';
    const fields = createPayHereFields({ amount, orderId, currency: 'LKR', customer: { firstName: user.name.split(/\s+/)[0], lastName: user.name.split(/\s+/).slice(1).join(' ') || 'Customer', email: user.email, phone: user.phone || '', city: user.town || '', items: `${plan.title}${promoLabel}` }, returnUrl: urls.returnUrl, cancelUrl: urls.cancelUrl });
    fields.notify_url = urls.notifyUrl;
    res.json({ paymentId: payment.id, orderId, environment: environment(), checkoutUrl: `${process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk'}/pay/checkout`, fields });
  } catch (error) { console.error('[payhere] order creation failed:', error.message); res.status(502).json({ error: 'Could not create payment order' }); }
});

router.post('/payments/nowpayments/order', authenticateToken, requireRole('CUSTOMER'), async (req, res) => {
  try {
    if (!nowPaymentsConfigured()) {
      return res.status(503).json({ error: 'NOWPayments is not configured on the server. Please configure NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET.' });
    }

    const planId = toPositiveInt(req.body.plan_id);
    if (!planId) return res.status(400).json({ error: 'plan_id is required' });
    const [plan, user] = await Promise.all([
      prisma.subscriptionPlan.findFirst({ where: { id: planId, active: true } }),
      prisma.user.findUnique({ where: { id: req.user.id } }),
    ]);
    if (!plan || !user) return res.status(404).json({ error: 'Plan or customer not found' });

    const pricing = await promotionPricingForPlan(plan);
    const lkrAmount = Number(pricing.discountedAmount);
    const conversion = await convertLkrToUsd(lkrAmount);

    // Deduplicate rapid duplicate clicks within 15 seconds
    const recentPending = await prisma.payment.findFirst({
      where: {
        userId: user.id,
        planId: plan.id,
        promotionId: pricing.promotion?.id || null,
        gateway: 'NOWPAYMENTS',
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 15000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    let payment = recentPending;
    let orderId = recentPending?.gatewayOrderId;
    if (!payment) {
      orderId = `LUX-NP-${user.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      payment = await prisma.payment.create({
        data: {
          userId: user.id,
          planId: plan.id,
          gateway: 'NOWPAYMENTS',
          gatewayOrderId: orderId,
          idempotencyKey: orderId,
          expectedAmount: money(lkrAmount),
          expectedCurrency: 'LKR',
          webhookPayload: {
            ...promotionPaymentData(pricing).webhookPayload,
            conversion,
          },
          promotionId: pricing.promotion?.id || null,
          originalAmount: pricing.originalAmount,
          discountAmount: pricing.discountAmount,
        },
      });
    }

    const backendUrl = (process.env.BACKEND_PUBLIC_URL || 'https://site--luxora-backend--6kb9tg67ytl4.code.run').replace(/\/+$/, '');
    const frontendUrl = (process.env.FRONTEND_URL || 'https://luxora.bond').replace(/\/+$/, '');
    const ipnCallbackUrl = `${backendUrl}/api/payments/nowpayments/ipn`;
    const successUrl = `${frontendUrl}/customer-dashboard?payment=success&order_id=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${frontendUrl}/customer-dashboard?payment=cancelled&order_id=${encodeURIComponent(orderId)}`;

    const invoice = await createNowPaymentsInvoice({
      amount: conversion.convertedAmount,
      currency: conversion.convertedCurrency,
      orderId,
      orderDescription: `Luxora Plan: ${plan.title}${pricing.promotion ? ` (${Number(pricing.promotion.discountPct)}% off)` : ''} (LKR ${lkrAmount.toLocaleString()})`,
      ipnCallbackUrl,
      successUrl,
      cancelUrl,
    });

    res.json({
      paymentId: payment.id,
      orderId,
      invoiceId: invoice.id,
      invoiceUrl: invoice.invoiceUrl,
      originalAmount: lkrAmount,
      originalCurrency: 'LKR',
      convertedAmount: conversion.convertedAmount,
      convertedCurrency: conversion.convertedCurrency,
      exchangeRate: conversion.exchangeRate,
    });
  } catch (error) {
    console.error('[nowpayments] order creation failed:', error.message);
    res.status(502).json({ error: error.message || 'Could not create NOWPayments payment order' });
  }
});

async function handleNowPaymentsIpn(req, res) {
  const payload = req.body || {};
  const signature = req.headers['x-nowpayments-sig'];

  if (!signature || !verifyNowPaymentsSignature(payload, signature)) {
    return res.status(400).json({ error: 'Invalid IPN signature' });
  }

  const orderId = String(payload.order_id || '').trim();
  if (!orderId) {
    return res.status(400).json({ error: 'order_id is required in IPN payload' });
  }

  const payment = await prisma.payment.findUnique({
    where: { gatewayOrderId: orderId },
  });

  if (!payment || payment.gateway !== 'NOWPAYMENTS') {
    return res.status(404).json({ error: 'Payment record not found' });
  }

  const classification = classifyNowPaymentsIpn(payment, payload);

  // Idempotency: duplicate delivery of an already-completed payment is acknowledged immediately
  if (classification === 'already_completed') {
    return res.status(200).json({ status: 'ok', message: 'Payment already completed' });
  }

  if (classification === 'amount_mismatch') {
    if (payment.status === 'PENDING') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          webhookPayload: {
            ...(typeof payment.webhookPayload === 'object' && payment.webhookPayload ? payment.webhookPayload : {}),
            mismatchedPayload: payload,
          },
        },
      });
    }
    return res.status(400).json({ error: 'Amount or currency mismatch' });
  }

  if (classification === 'success') {
    // A browser redirect is never sufficient, and even a valid IPN must be
    // bound to the authoritative payment object before benefits are granted.
    if (!payload.payment_id || !process.env.NOWPAYMENTS_API_KEY) {
      return res.status(503).json({ error: 'Authoritative payment verification is temporarily unavailable' });
    }
    let livePayment;
    try {
      livePayment = await fetchNowPaymentsPaymentStatus(payload.payment_id);
    } catch (error) {
      console.warn('[nowpayments] live status verification failed:', error.message);
    }
    if (!livePayment) return res.status(503).json({ error: 'Authoritative payment verification is temporarily unavailable' });
    if (String(livePayment.order_id || '') !== orderId || String(livePayment.payment_id || '') !== String(payload.payment_id)) {
      return res.status(400).json({ error: 'NOWPayments payment identity mismatch' });
    }
    const liveClassification = classifyNowPaymentsIpn(payment, livePayment);
    if (liveClassification === 'amount_mismatch') return res.status(400).json({ error: 'Authoritative amount or currency mismatch' });
    if (liveClassification !== 'success') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          webhookPayload: {
            ...(typeof payment.webhookPayload === 'object' && payment.webhookPayload ? payment.webhookPayload : {}),
            ...payload,
            liveApiStatus: livePayment.payment_status,
          },
        },
      });
      return res.status(200).json({ status: 'pending', message: 'Payment status pending blockchain completion' });
    }

    const capturedAmount = payload.price_amount !== undefined ? payload.price_amount : (payload.actually_paid || payload.pay_amount || payment.expectedAmount);
    const capturedCurrency = payload.price_currency || payload.pay_currency || payment.expectedCurrency;

    const completed = await activateSubscription(payment, payload, {
      capturedAmount,
      capturedCurrency,
    });

    if (completed) {
      await completePaymentExperience(completed, 'nowpayments');
    }
  } else if (classification === 'failed') {
    if (payment.status === 'PENDING') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          webhookPayload: {
            ...(typeof payment.webhookPayload === 'object' && payment.webhookPayload ? payment.webhookPayload : {}),
            ...payload,
          },
        },
      });
      await notify(payment.userId, 'Your Luxora cryptocurrency payment was not completed.', '/customer-dashboard');
    }
  } else if (classification === 'refunded') {
    if (payment.status === 'COMPLETED') {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'REFUNDED',
            webhookPayload: {
              ...(typeof payment.webhookPayload === 'object' && payment.webhookPayload ? payment.webhookPayload : {}),
              ...payload,
            },
          },
        }),
        ...(payment.subscriptionId
          ? [
              prisma.userSubscription.update({
                where: { id: payment.subscriptionId },
                data: { status: 'refunded', autoRenew: false, nextRenewalDate: null },
              }),
            ]
          : []),
      ]);
      await notify(payment.userId, 'Your Luxora payment has been refunded.', '/customer-dashboard');
    }
  } else if (payment.status === 'PENDING') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        webhookPayload: {
          ...(typeof payment.webhookPayload === 'object' && payment.webhookPayload ? payment.webhookPayload : {}),
          ...payload,
        },
      },
    });
  }

  return res.status(200).json({ status: 'ok' });
}

router.post('/payments/nowpayments/ipn', handleNowPaymentsIpn);
router.post('/payments/nowpayments/webhook', handleNowPaymentsIpn);

router.get('/payments/mode', authenticateToken, (_req, res) => {
  // Per-gateway availability diagnostic. Demo Payment is an independent
  // gateway that is always enabled and never depends on a global mode.
  res.json({
    mode: 'independent',
    label: 'Independent payment gateways',
    gateways: {
      payhere: {
        enabled: payHereIsReady(),
        environment: environment(),
        label: `PayHere ${environment()}`,
      },
      nowpayments: {
        enabled: nowPaymentsConfigured(),
        environment: 'LIVE',
        label: 'NOWPayments cryptocurrency',
      },
      demo: {
        enabled: true,
        environment: 'DEMO',
        label: 'Demo payment — no real charge',
      },
    },
  });
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

router.post('/payments/:id/receipt/resend', authenticateToken, async (req, res) => {
  const paymentId = toPositiveInt(req.params.id);
  if (!paymentId) return res.status(400).json({ error: 'Valid payment ID is required' });

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { plan: { include: { entitlements: true } }, subscription: true },
  });

  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.userId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized to resend receipt for this payment' });
  }
  if (payment.status !== 'COMPLETED') {
    return res.status(400).json({ error: 'Receipts can only be sent for completed payments' });
  }

  const user = await prisma.user.findUnique({ where: { id: payment.userId }, select: { email: true, name: true } });
  if (!user?.email) return res.status(400).json({ error: 'Customer has no email address configured' });

  const coinsGranted = Array.isArray(payment.plan?.entitlements)
    ? payment.plan.entitlements.reduce((total, entitlement) => total + entitlement.units, 0)
    : 0;
  const providerName = payment.gateway === 'NOWPAYMENTS' ? 'NOWPayments (Cryptocurrency)' : payment.gateway === 'PAYHERE' ? 'PayHere' : 'Demo Checkout';
  const displayAmount = Number(payment.expectedAmount).toLocaleString();
  const conversionInfo = payment.webhookPayload?.conversion
    ? `<p style="margin:4px 0;color:#666;font-size:13px;">Converted Crypto Invoice: <strong>$${payment.webhookPayload.conversion.convertedAmount} ${payment.webhookPayload.conversion.convertedCurrency}</strong> (Rate: 1 USD = ${payment.webhookPayload.conversion.exchangeRate} LKR)</p>`
    : '';

  const html = buildReceiptHtml({ user, payment, mode: payment.gateway.toLowerCase(), coinsGranted, providerName, displayAmount, conversionInfo });

  try {
    const result = await sendEmail({
      to: user.email,
      subject: `Luxora Payment Confirmation & Receipt — ${payment.plan?.title || 'Luxora Package'} (Resent)`,
      html,
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        webhookPayload: {
          ...(typeof payment.webhookPayload === 'object' && payment.webhookPayload ? payment.webhookPayload : {}),
          receipt: {
            status: result.configured ? 'sent' : 'not_configured',
            recipient: user.email,
            attemptedAt: new Date().toISOString(),
            resendId: result.id || null,
          },
        },
      },
    });

    res.json({ message: 'Receipt resent successfully', email_delivery: result.configured ? 'sent' : 'not_configured' });
  } catch (error) {
    console.warn('[email] resending receipt failed:', error.message);
    res.status(502).json({ error: 'Could not deliver receipt email. Please try again later.' });
  }
});

export default router;
