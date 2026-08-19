import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { toPositiveInt } from '../middleware/validators.js';
import { getEntitlementSnapshot } from '../services/entitlements.js';

const router = Router();

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
    const plans = await prisma.subscriptionPlan.findMany({ include: { entitlements: { include: { category: true } } } });
  res.json(plans.map((p) => ({
    ...p,
    features: JSON.parse(p.features || '[]'),
    entitlements: p.entitlements.map((item) => ({ category_id: item.categoryId, category_name: item.category.name, units: item.units })),
  })));

});


router.get('/subscriptions/entitlements', authenticateToken, async (req, res) => {
  res.json({ entitlements: await getEntitlementSnapshot(prisma, req.user.id) });
});

router.put('/subscriptions/:id/cancel', authenticateToken, async (req, res) => {
  if (req.body.confirmed !== true) return res.status(400).json({ error: 'Cancellation confirmation is required' });
  const subscriptionId = toPositiveInt(req.params.id);
  if (!subscriptionId) return res.status(400).json({ error: 'Invalid subscription id' });
  const subscription = await prisma.userSubscription.findFirst({ where: { id: subscriptionId, userId: req.user.id } });
  if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
  if (subscription.status !== 'active') return res.status(400).json({ error: 'Only active subscriptions can be cancelled' });
  await prisma.userSubscription.update({ where: { id: subscription.id }, data: { status: 'cancelled' } });
  res.json({ message: 'Subscription cancelled', subscription_id: subscription.id, status: 'cancelled' });
});

router.post('/subscriptions/subscribe', authenticateToken, async (_req, res) => {
  return res.status(410).json({
    error: 'Direct subscription activation is disabled. Complete a verified PayHere or PayPal payment instead.',
  });
});

export default router;
