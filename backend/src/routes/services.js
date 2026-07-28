import { Router } from 'express';
import { prisma } from '../config/prisma.js';

const router = Router();

router.get('/categories', async (_req, res) => {
  res.json(await prisma.category.findMany());
});

router.get('/services', async (_req, res) => {
  const services = await prisma.service.findMany({ include: { category: true } });
  res.json(services.map((s) => ({ ...s, category_name: s.category?.name })));
});

router.get('/subscriptions', async (_req, res) => {
  const plans = await prisma.subscriptionPlan.findMany();
  res.json(plans.map((p) => ({ ...p, features: JSON.parse(p.features || '[]') })));
});

router.post('/subscriptions/subscribe', async (req, res) => {
  const { plan_id } = req.body;
  const userId = req.user.id;
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: plan_id } });
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  await prisma.userSubscription.create({
    data: { userId, planId: plan_id, endDate, status: 'active' },
  });
  res.json({ message: 'Subscribed successfully', plan, endDate });
});

export default router;
