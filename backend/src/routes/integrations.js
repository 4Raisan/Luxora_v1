import { Router } from 'express';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
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
import { getEntitlementSnapshot } from '../services/entitlements.js';
import { convertLkrToUsd } from '../services/currency.js';
import { toPositiveInt } from '../middleware/validators.js';
import { rateLimit } from '../middleware/rateLimit.js';

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
const isPublicHttpsUrl = (value) => /^https?:\/\/[^/]+/i.test(value) && !value.includes('YOUR_');
const payHereIsReady = () => {
  const urls = payHereUrls();
  return Boolean(process.env.PAYHERE_MERCHANT_ID && process.env.PAYHERE_MERCHANT_SECRET)
    && Object.values(urls).every(isPublicHttpsUrl);
};
// Demo checkout is opt-in at deployment time. It never calls PayHere and is
// intentionally unavailable unless PAYMENT_MODE=demo is set on the backend.
const paymentMode = () => String(process.env.PAYMENT_MODE || 'payhere').trim().toLowerCase() === 'demo' ? 'demo' : 'payhere';

export async function activateSubscription(payment, payload = {}, { capturedAmount, capturedCurrency, autoRenew = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.payment.findUnique({ where: { id: payment.id }, include: { plan: { include: { entitlements: true } } } });
    if (!fresh || fresh.status === 'COMPLETED') return null;
    if (fresh.status !== 'PENDING') return null;
    const days = fresh.plan.durationDays || 30;
    const endDate = new Date(Date.now() + days * 86400000);
    const subscription = await tx.userSubscription.create({ data: { userId: fresh.userId, planId: fresh.planId, endDate, status: 'active', autoRenew, renewalIntervalDays: days, nextRenewalDate: endDate } });
    const finalAmount = Number(capturedAmount ?? payload.payhere_amount ?? payload.price_amount ?? fresh.expectedAmount);
    const finalCurrency = String(capturedCurrency ?? payload.payhere_currency ?? payload.price_currency ?? fresh.expectedCurrency).toUpperCase();
    return tx.payment.update({
      where: { id: fresh.id },
      data: {
        status: 'COMPLETED',
        capturedAmount: finalAmount,
        capturedCurrency: finalCurrency,
        webhookPayload: {
          ...(typeof fresh.webhookPayload === 'object' && fresh.webhookPayload ? fresh.webhookPayload : {}),
          ...payload,
          settledAt: new Date().toISOString(),
        },
        subscriptionId: subscription.id,
      },
      include: { plan: { include: { entitlements: true } }, subscription: true },
    });
  }, { maxWait: 5000, timeout: 15000, isolationLevel: 'Serializable' });
}

function buildReceiptHtml({ user, payment, _mode, coinsGranted, providerName, displayAmount, conversionInfo }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0b0b0d; color: #d4af37; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; letter-spacing: 2px;">LUXORA</h1>
        <p style="margin: 4px 0 0; font-size: 12px; text-transform: uppercase; color: #bbb;">The Gold Standard of Modern Living</p>
      </div>
      <div style="padding: 24px 28px;">
        <h2 style="margin-top: 0; color: #0b0b0d; font-size: 18px;">Payment Receipt</h2>
        <p>Hi <strong>${user?.name || 'Customer'}</strong>,</p>
        <p>Thank you for your payment. Your subscription to <strong>${payment.plan?.title || 'Luxora Package'}</strong> is now active.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Order ID:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${payment.gatewayOrderId}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Plan / Service:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${payment.plan?.title || 'Package'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Amount:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0b0b0d;">${payment.expectedCurrency} ${displayAmount}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Payment Gateway:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${providerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Transaction Reference:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${payment.webhookPayload?.payment_id || payment.webhookPayload?.nowpayments_payment_id || payment.gatewayOrderId}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Payment Status:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #16a34a;">PAID / COMPLETED</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Service Coins Added:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #b45309;">+${coinsGranted} coins</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Subscription Valid Until:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${payment.subscription?.endDate ? payment.subscription.endDate.toISOString().slice(0, 10) : 'Active'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Date / Time:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${new Date().toUTCString()}</td>
          </tr>
        </table>
        
        ${conversionInfo}
        
        <p style="margin-top: 24px; font-size: 13px; color: #666;">You can view and manage your active entitlements anytime in your <a href="${process.env.FRONTEND_URL || 'https://luxora.bond'}/customer-dashboard" style="color: #d4af37; text-decoration: none; font-weight: bold;">Customer Dashboard</a>.</p>
      </div>
      <div style="background-color: #f9f9f9; padding: 12px 24px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
        Luxora Home Concierge — Automated Transaction Notification
      </div>
    </div>
  `;
}

async function completePaymentExperience(payment, mode) {
  const coinsGranted = Array.isArray(payment.plan?.entitlements)
    ? payment.plan.entitlements.reduce((total, entitlement) => total + entitlement.units, 0)
    : 0;

  const [entitlements, user] = await Promise.all([
    getEntitlementSnapshot(prisma, payment.userId),
    prisma.user.findUnique({ where: { id: payment.userId }, select: { email: true, name: true } }),
    notify(payment.userId, `${mode === 'demo' ? 'Demo ' : ''}payment successful. Your ${payment.plan?.title || 'package'} is active with ${coinsGranted} service coin${coinsGranted === 1 ? '' : 's'}.`, '/customer-dashboard'),
  ]);

  const providerName = mode === 'nowpayments' ? 'NOWPayments (Cryptocurrency)' : mode === 'payhere' ? 'PayHere' : 'Demo Checkout';
  const displayAmount = Number(payment.expectedAmount).toLocaleString();
  const conversionInfo = payment.webhookPayload?.conversion
    ? `<p style="margin:4px 0;color:#666;font-size:13px;">Converted Crypto Invoice: <strong>$${payment.webhookPayload.conversion.convertedAmount} ${payment.webhookPayload.conversion.convertedCurrency}</strong> (Rate: 1 USD = ${payment.webhookPayload.conversion.exchangeRate} LKR)</p>`
    : '';

  const html = buildReceiptHtml({ user, payment, mode, coinsGranted, providerName, displayAmount, conversionInfo });

  let emailDelivery = 'not_configured';
  let emailError = null;
  let resendMessageId = null;

  try {
    const result = await sendEmail({
      to: user?.email,
      subject: `Luxora Payment Confirmation & Receipt — ${payment.plan?.title || 'Luxora Package'}`,
      html,
    });
    if (result.configured) {
      emailDelivery = 'sent';
      resendMessageId = result.id || null;
    }
  } catch (error) {
    emailDelivery = 'failed';
    emailError = error.message;
    console.warn('[email] payment receipt failed:', error.message);
  }

  // Update payment record with receipt delivery status for full idempotency and retryability
  try {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        webhookPayload: {
          ...(typeof payment.webhookPayload === 'object' && payment.webhookPayload ? payment.webhookPayload : {}),
          receipt: {
            status: emailDelivery,
            recipient: user?.email || null,
            attemptedAt: new Date().toISOString(),
            resendId: resendMessageId,
            error: emailError,
          },
        },
      },
    });
  } catch (dbErr) {
    console.warn('[payment] could not persist receipt delivery state:', dbErr.message);
  }

  return {
    entitlement_snapshot: entitlements,
    receipt: {
      payment_id: payment.id,
      plan_id: payment.planId,
      plan_title: payment.plan?.title,
      amount: Number(payment.expectedAmount),
      currency: payment.expectedCurrency,
      coins_granted: coinsGranted,
      subscription_id: payment.subscription?.id,
      active_until: payment.subscription?.endDate,
      provider: providerName,
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

    // Deduplicate rapid duplicate clicks within 15 seconds
    const recentPending = await prisma.payment.findFirst({
      where: {
        userId: user.id,
        planId: plan.id,
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
      payment = await prisma.payment.create({ data: { userId: user.id, planId: plan.id, gateway: 'PAYHERE', gatewayOrderId: orderId, idempotencyKey: orderId, expectedAmount: amount, expectedCurrency: 'LKR' } });
    }

    const fields = createPayHereFields({ amount, orderId, currency: 'LKR', customer: { firstName: user.name.split(/\s+/)[0], lastName: user.name.split(/\s+/).slice(1).join(' ') || 'Customer', email: user.email, phone: user.phone || '', city: user.town || '', items: plan.title }, returnUrl: urls.returnUrl, cancelUrl: urls.cancelUrl });
    fields.notify_url = urls.notifyUrl;
    res.json({ paymentId: payment.id, orderId, environment: environment(), checkoutUrl: `${process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk'}/pay/checkout`, fields });
  } catch (error) { console.error('[payhere] order creation failed:', error.message); res.status(502).json({ error: 'Could not create payment order' }); }
});

router.post('/payments/nowpayments/order', authenticateToken, async (req, res) => {
  try {
    if (paymentMode() === 'demo') return res.status(409).json({ error: 'Demo payment mode is enabled; use the demo checkout.' });
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

    const lkrAmount = Number(plan.priceMonthly);
    const conversion = await convertLkrToUsd(lkrAmount);

    // Deduplicate rapid duplicate clicks within 15 seconds
    const recentPending = await prisma.payment.findFirst({
      where: {
        userId: user.id,
        planId: plan.id,
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
            conversion,
          },
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
      orderDescription: `Luxora Plan: ${plan.title} (LKR ${lkrAmount.toLocaleString()})`,
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
    // Perform server-side NOWPayments payment-status verification where practical before final settlement
    if (payload.payment_id && process.env.NOWPAYMENTS_API_KEY) {
      try {
        const livePayment = await fetchNowPaymentsPaymentStatus(payload.payment_id);
        if (livePayment && String(livePayment.payment_status || '').toLowerCase() !== 'finished') {
          console.warn(`[nowpayments] IPN reported finished, but live API verification returned '${livePayment.payment_status}' for payment ${payload.payment_id}`);
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
      } catch (error) {
        console.warn('[nowpayments] Live status verification warning:', error.message);
      }
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
