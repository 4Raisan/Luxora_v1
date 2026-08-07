import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { toPositiveInt } from '../middleware/validators.js';

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
  const plans = await prisma.subscriptionPlan.findMany();
  res.json(plans.map((p) => ({ ...p, features: JSON.parse(p.features || '[]') })));
});

// Subscribe to a plan (requires auth — previously crashed with a TypeError)
router.post('/subscriptions/subscribe', authenticateToken, async (req, res) => {
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
  res.status(201).json({ message: 'Subscribed successfully', plan, endDate });
});

export default router;
