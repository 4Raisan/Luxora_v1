import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { toPositiveInt } from '../middleware/validators.js';
import { sendEmail, escapeHtml } from '../services/integrations.js';
import { getEntitlementSnapshot } from '../services/entitlements.js';
import { notify } from '../services/notify.js';
import { activePromotionWhere, calculatePromotionPrice, serializePromotion } from '../services/promotions.js';

const router = Router();
const planFeatures = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const displayPackageType = (value, entitlements = []) => {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'auto care' || type === 'auto') return 'Auto Care';
  if (type === 'garden care' || type === 'garden') return 'Garden Care';
  if (type === 'pet care' || type === 'pet') return 'Pet Care';
  if (type === 'combo' || type === 'combo package') return 'Combo Package';
  // Older seeded plans used the generic "single" value. Infer their real
  // category from the one entitlement so they render in the right section
  // until an admin saves them with the canonical package type.
  if (type === 'single' || type === 'single package') {
    const categoryName = entitlements[0]?.category?.name || entitlements[0]?.category_name;
    return ['Auto Care', 'Garden Care', 'Pet Care'].includes(categoryName) ? categoryName : 'Auto Care';
  }
  return String(value || 'Auto Care');
};

router.get('/categories', async (_req, res) => {
  res.json(await prisma.category.findMany());
});

router.get('/services', async (_req, res) => {
  const services = await prisma.service.findMany({ include: { category: true } });
  res.json(services.map((s) => ({
    ...s,
    category_id: s.categoryId,
    category_name: s.category?.name,
  })));
});

router.get('/subscriptions', async (_req, res) => {
  const now = new Date();
  const [plans, promotions] = await Promise.all([
    prisma.subscriptionPlan.findMany({
    where: { active: true },
    include: { entitlements: { include: { category: true } } },
    orderBy: [
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
    }),
    prisma.promotion.findMany({
      where: activePromotionWhere(now),
      include: { planAssignments: { select: { planId: true } } },
      orderBy: [{ discountPct: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);
  res.json(plans.map((p) => {
    const promotion = promotions.find((candidate) => candidate.planAssignments.length === 0 || candidate.planAssignments.some((assignment) => assignment.planId === p.id));
    const price = calculatePromotionPrice(p.priceMonthly, promotion?.discountPct || 0);
    return {
    ...p,
    displayOrder: p.displayOrder,
    type: displayPackageType(p.type, p.entitlements),
    priceMonthly: Number(p.priceMonthly),
    originalPriceMonthly: Number(price.originalAmount),
    discountedPriceMonthly: Number(price.discountedAmount),
    discountAmount: Number(price.discountAmount),
    promotion: serializePromotion(promotion),
    features: planFeatures(p.features),
    entitlements: p.entitlements.map((item) => ({
      category_id: item.categoryId,
      category_name: item.category.name,
      units: item.units,
    })),
  };
  }));
});

export async function renewDueDemoSubscriptions() {
  if (String(process.env.PAYMENT_MODE || 'payhere').toLowerCase() !== 'demo') return [];
  const due = await prisma.userSubscription.findMany({ where: { status: 'active', autoRenew: true, nextRenewalDate: { lte: new Date() } }, include: { plan: true } });
  const renewedSubscriptions = [];
  for (const subscription of due) {
    const renewedSubscription = await prisma.$transaction(async (tx) => {
      const fresh = await tx.userSubscription.findUnique({
        where: { id: subscription.id },
        include: {
          plan: { include: { entitlements: true } },
          entitlements: true,
          user: { select: { email: true, name: true } },
        },
      });
      if (!fresh || fresh.status !== 'active' || !fresh.autoRenew || !fresh.nextRenewalDate || fresh.nextRenewalDate > new Date()) return null;
      const startDate = fresh.nextRenewalDate;
      const endDate = new Date(startDate.getTime() + fresh.renewalIntervalDays * 86400000);
      const orderId = `LUX-DEMO-RENEW-${fresh.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const planTitle = fresh.planTitle || fresh.plan.title;
      const planType = fresh.planType || fresh.plan.type;
      const pricePaid = fresh.pricePaid || fresh.plan.priceMonthly;
      const effectiveEntitlements = fresh.entitlements.length > 0 ? fresh.entitlements : (fresh.plan.entitlements || []);

      const renewed = await tx.userSubscription.create({
        data: {
          userId: fresh.userId,
          planId: fresh.planId,
          planTitle,
          planType,
          pricePaid,
          currency: fresh.currency || 'LKR',
          durationDays: fresh.durationDays,
          startDate,
          endDate,
          status: 'active',
          autoRenew: true,
          renewalIntervalDays: fresh.renewalIntervalDays,
          nextRenewalDate: endDate,
          entitlements: {
            create: effectiveEntitlements.map((e) => ({
              categoryId: e.categoryId,
              units: e.units,
            })),
          },
        },
      });
      await tx.userSubscription.update({ where: { id: fresh.id }, data: { status: 'expired', autoRenew: false } });
      await tx.payment.create({ data: { userId: fresh.userId, planId: fresh.planId, subscriptionId: renewed.id, gateway: 'DEMO', gatewayOrderId: orderId, idempotencyKey: orderId, status: 'COMPLETED', expectedAmount: pricePaid, expectedCurrency: fresh.currency || 'LKR', capturedAmount: pricePaid, capturedCurrency: fresh.currency || 'LKR', webhookPayload: { mode: 'demo', renewal: true } } });
      return { userId: fresh.userId, email: fresh.user.email, name: fresh.user.name, planTitle: planTitle };
    });
    if (renewedSubscription) renewedSubscriptions.push(renewedSubscription);
  }
  await Promise.all(renewedSubscriptions.map(async (renewed) => {
    await notify(renewed.userId, `Demo renewal successful. Your ${renewed.planTitle} package is active for another 30 days.`, '/customer-dashboard');
    await sendEmail({ to: renewed.email, subject: `Luxora demo renewal: ${renewed.planTitle}`, html: `<p>Hi ${escapeHtml(renewed.name || 'Customer')},</p><p>Your ${escapeHtml(renewed.planTitle)} package has renewed for another 30 days. No real money was charged.</p>` }).catch(() => {});
  }));
  return renewedSubscriptions;
}

router.get('/subscriptions/entitlements', authenticateToken, async (req, res) => {
  res.json({ entitlements: await getEntitlementSnapshot(prisma, req.user.id), renewed: 0 });
});

router.put('/subscriptions/:id/auto-renew', authenticateToken, async (req, res) => {
  if (typeof req.body.auto_renew !== 'boolean') return res.status(400).json({ error: 'auto_renew must be true or false' });
  const subscription = await prisma.userSubscription.findFirst({ where: { id: toPositiveInt(req.params.id) || 0, userId: req.user.id, status: 'active' } });
  if (!subscription) return res.status(404).json({ error: 'Active subscription not found' });
  const updated = await prisma.userSubscription.update({ where: { id: subscription.id }, data: { autoRenew: req.body.auto_renew, nextRenewalDate: req.body.auto_renew ? (subscription.nextRenewalDate || subscription.endDate) : null } });
  res.json({ id: updated.id, auto_renew: updated.autoRenew, next_renewal_date: updated.nextRenewalDate });
});

router.put('/subscriptions/:id/cancel', authenticateToken, async (req, res) => {
  if (req.body.confirmed !== true) return res.status(400).json({ error: 'Cancellation confirmation is required' });
  const subscription = await prisma.userSubscription.findFirst({ where: { id: toPositiveInt(req.params.id) || 0, userId: req.user.id } });
  if (!subscription || subscription.status !== 'active') return res.status(404).json({ error: 'Active subscription not found' });
  await prisma.userSubscription.update({ where: { id: subscription.id }, data: { status: 'cancelled', autoRenew: false, nextRenewalDate: null } });
  res.json({ status: 'cancelled', subscription_id: subscription.id });
});

// Subscribe to a plan (requires auth — previously crashed with a TypeError)
router.post('/subscriptions/subscribe', authenticateToken, async (req, res) => {
  return res.status(410).json({ error: 'Direct activation is disabled. Complete verified PayHere sandbox payment.' });
  /* legacy direct activation intentionally unreachable
  const plan_id = toPositiveInt(req.body.plan_id);
  if (!plan_id) return res.status(400).json({ error: 'plan_id is required' });

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: plan_id } });
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const alreadyActive = await prisma.userSubscription.findFirst({
    where: { userId: req.user.id, planId: plan_id, status: 'active', endDate: { gt: new Date() } },
  });
  if (alreadyActive) return res.status(400).json({ error: 'You already have an active subscription to this plan' });

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  await prisma.userSubscription.create({
    data: { userId: req.user.id, planId: plan_id, endDate, status: 'active' },
  });
  const subscriber = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true, name: true } });
  sendEmail({ to: subscriber?.email, subject: `Luxora subscription confirmed: ${plan.title}`, html: `<p>Hi ${subscriber?.name || 'Customer'},</p><p>Your ${plan.title} subscription is active until ${endDate.toISOString().slice(0, 10)}.</p><p>Amount: LKR ${plan.priceMonthly.toLocaleString()}</p>` }).catch((error) => console.warn('[email] subscription receipt failed:', error.message));
  res.status(201).json({ message: 'Subscribed successfully', plan, endDate }); */
});

export default router;
