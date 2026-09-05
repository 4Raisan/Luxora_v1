// Demo Payment — an independent third gateway.
//
// It never calls PayHere or NOWPayments, never reads a global payment mode,
// and needs no external credentials. The whole purchase (payment record +
// subscription + service tokens) completes inside one database transaction,
// keyed by the client's idempotency reference so retries and double clicks
// can never grant benefits twice.
import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { toPositiveInt } from '../middleware/validators.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { activateSubscriptionInTx, completePaymentExperience } from '../services/paymentFulfilment.js';
import { findActivePromotionForPlan, calculatePromotionPrice } from '../services/promotions.js';
import { getEntitlementSnapshot } from '../services/entitlements.js';

const router = Router();

const BILLING_OPTIONS = ['one_time', 'auto_renew'];
const checkoutLimiter = rateLimit({ max: 30, windowMs: 15 * 60 * 1000 });

function demoCheckoutResponse(res, { status = 201, duplicate = false, payment }) {
  return res.status(status).json({
    status: 'completed',
    duplicate,
    message: 'Demo payment successful. No real money was charged.',
    subscription: payment.subscription,
    payment: {
      id: payment.id,
      gateway: 'DEMO',
      gateway_order_id: payment.gatewayOrderId,
      amount: Number(payment.expectedAmount),
      currency: payment.expectedCurrency,
    },
    receipt: {
      payment_id: payment.id,
      plan_id: payment.planId,
      plan_title: payment.plan?.title,
      amount: Number(payment.expectedAmount),
      currency: payment.expectedCurrency,
      subscription_id: payment.subscription?.id,
      active_until: payment.subscription?.endDate,
      provider: 'Demo Payment',
      financial_charge: 'No real charge',
    },
  });
}

router.post('/payments/demo/checkout', authenticateToken, requireRole('CUSTOMER'), checkoutLimiter, async (req, res) => {
  try {
    const planId = toPositiveInt(req.body.plan_id);
    const billingOption = String(req.body.billing_option || '').trim().toLowerCase();
    const idempotencyKey = String(req.body.idempotency_key || '').trim();

    if (!planId) return res.status(400).json({ error: 'plan_id is required' });
    if (!BILLING_OPTIONS.includes(billingOption)) return res.status(400).json({ error: "billing_option must be 'one_time' or 'auto_renew'" });
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(idempotencyKey)) return res.status(400).json({ error: 'A valid idempotency_key is required for this checkout' });

    const autoRenew = billingOption === 'auto_renew';

    // Idempotent replay: a checkout reference that already completed returns
    // its stored result without granting tokens or subscriptions twice.
    const existing = await prisma.payment.findUnique({
      where: { idempotencyKey },
      include: { plan: { select: { title: true } }, subscription: true },
    });
    if (existing) {
      if (existing.userId !== req.user.id || existing.gateway !== 'DEMO') {
        return res.status(409).json({ error: 'This checkout reference is already in use' });
      }
      if (existing.status === 'COMPLETED' && existing.subscriptionId) {
        const entitlements = await getEntitlementSnapshot(prisma, req.user.id);
        return demoCheckoutResponse(res, { status: 200, duplicate: true, payment: existing });
      }
      // A stale non-completed row with this reference (a checkout that died
      // before settlement): retire it so the fresh checkout below proceeds.
      await prisma.payment.deleteMany({ where: { id: existing.id, status: { not: 'COMPLETED' } } });
    }

    let settled;
    try {
      settled = await prisma.$transaction(async (tx) => {
        const dupe = await tx.payment.findUnique({ where: { idempotencyKey } });
        if (dupe?.status === 'COMPLETED' && dupe.subscriptionId) return { duplicate: true, payment: dupe };

        // Server-authoritative price: the client never sends an amount.
        const plan = await tx.subscriptionPlan.findFirst({ where: { id: planId, active: true }, include: { entitlements: true } });
        if (!plan) {
          const error = new Error('Active plan not found');
          error.statusCode = 404;
          throw error;
        }

        const promotion = await findActivePromotionForPlan(tx, plan.id);
        const pricing = calculatePromotionPrice(plan.priceMonthly, promotion?.discountPct || 0);

        const payment = await tx.payment.create({
          data: {
            userId: req.user.id,
            planId: plan.id,
            gateway: 'DEMO',
            gatewayOrderId: `LUX-DEMO-${req.user.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
            idempotencyKey,
            status: 'PENDING',
            expectedAmount: pricing.discountedAmount,
            expectedCurrency: 'LKR',
            promotionId: promotion?.id || null,
            originalAmount: pricing.originalAmount,
            discountAmount: pricing.discountAmount,
            webhookPayload: {
              mode: 'demo',
              billing: billingOption,
              promotion: promotion ? { id: promotion.id, code: promotion.code, title: promotion.title, discountPct: Number(promotion.discountPct) } : null,
            },
          },
        });

        const activated = await activateSubscriptionInTx(tx, payment, { mode: 'demo', billing: billingOption }, { capturedAmount: pricing.discountedAmount, capturedCurrency: 'LKR', autoRenew });
        if (!activated) {
          const error = new Error('This demo checkout has already been completed');
          error.statusCode = 409;
          throw error;
        }
        return { duplicate: false, payment: activated };
      }, { maxWait: 5000, timeout: 15000 });
    } catch (error) {
      // Lost an idempotency race: an identical checkout completed first.
      if (error?.code === 'P2002') {
        const winner = await prisma.payment.findUnique({
          where: { idempotencyKey },
          include: { plan: { select: { title: true } }, subscription: true },
        }).catch(() => null);
        if (winner?.status === 'COMPLETED' && winner.subscriptionId && winner.userId === req.user.id) {
          const entitlements = await getEntitlementSnapshot(prisma, req.user.id);
          return demoCheckoutResponse(res, { status: 200, duplicate: true, payment: winner });
        }
        return res.status(409).json({ error: 'This checkout reference is already in use' });
      }
      throw error;
    }

    // Post-transaction fulfilment: customer notification + receipt email.
    const experience = await completePaymentExperience(settled.payment, 'demo');
    const entitlements = await getEntitlementSnapshot(prisma, req.user.id);

    return res.status(settled.duplicate ? 200 : 201).json({
      status: 'completed',
      duplicate: Boolean(settled.duplicate),
      message: 'Demo payment successful. No real money was charged.',
      subscription: settled.payment.subscription,
      payment: {
        id: settled.payment.id,
        gateway: 'DEMO',
        gateway_order_id: settled.payment.gatewayOrderId,
        amount: Number(settled.payment.expectedAmount),
        currency: settled.payment.expectedCurrency,
      },
      receipt: experience.receipt,
      entitlement_snapshot: entitlements,
      email_delivery: experience.email_delivery,
    });
  } catch (error) {
    if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[demo-payment] checkout failed:', error.message);
    return res.status(500).json({ error: 'Demo payment could not be completed. No charge was made.' });
  }
});

export default router;
