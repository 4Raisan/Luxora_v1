import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { isNonEmptyString } from '../middleware/validators.js';
import { activePromotionWhere } from '../services/promotions.js';

const router = Router();

const serialize = (p) => ({
  id: p.id,
  title: p.title,
  description: p.description,
  code: p.code,
  discount_percent: p.discountPct,
  discountPct: p.discountPct,
  is_active: p.active,
  active: p.active,
  starts_at: p.startsAt,
  startsAt: p.startsAt,
  ends_at: p.endsAt,
  endsAt: p.endsAt,
  plan_ids: (p.planAssignments || []).map((assignment) => assignment.planId),
  packages: (p.planAssignments || []).map((assignment) => ({ id: assignment.planId, title: assignment.plan?.title })).filter((plan) => plan.title),
});

const normalizePlanIds = (value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  return ids.length === value.length ? ids : null;
};

const validatePlanIds = async (planIds) => {
  if (!planIds?.length) return null;
  const count = await prisma.subscriptionPlan.count({ where: { id: { in: planIds } } });
  return count === planIds.length ? null : 'One or more selected packages do not exist';
};

router.get('/', async (_req, res) => {
  const now = new Date();
  const promos = await prisma.promotion.findMany({ where: activePromotionWhere(now), include: { planAssignments: { include: { plan: { select: { id: true, title: true } } } } } });
  res.json(promos.map(serialize));
});

router.use(authenticateToken, requireRole('ADMIN'));

router.get('/all', async (_req, res) => {
  const promotions = await prisma.promotion.findMany({ include: { planAssignments: { include: { plan: { select: { id: true, title: true } } } } }, orderBy: { createdAt: 'desc' } });
  res.json(promotions.map(serialize));
});

router.post('/', async (req, res) => {
  const { title, description, code, discount_pct, starts_at, ends_at } = req.body;
  const planIds = normalizePlanIds(req.body.plan_ids);
  if (!isNonEmptyString(title, 150)) return res.status(400).json({ error: 'Title required' });
  if (planIds === null) return res.status(400).json({ error: 'plan_ids must be an array of valid package IDs' });

  const pct = Number(discount_pct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'discount_pct must be between 0 and 100' });
  }

  const startsAt = starts_at ? new Date(starts_at) : null;
  const endsAt = ends_at ? new Date(ends_at) : null;
  if ((starts_at && Number.isNaN(startsAt.getTime())) || (ends_at && Number.isNaN(endsAt.getTime())) || (startsAt && endsAt && endsAt <= startsAt)) return res.status(400).json({ error: 'Invalid promotion dates' });
  const planIdError = await validatePlanIds(planIds);
  if (planIdError) return res.status(400).json({ error: planIdError });
  const p = await prisma.promotion.create({
    data: {
      title: title.trim(), description: description || '', code: code?.trim().toUpperCase() || null, discountPct: pct, startsAt, endsAt,
      ...(planIds?.length ? { planAssignments: { create: planIds.map((planId) => ({ planId })) } } : {}),
    },
  });
  res.status(201).json({ id: p.id, message: 'Promotion created' });
});

// Toggle active. Accepts { active: 1|0|true|false } from the admin UI, or toggles when omitted.
router.put('/:id', async (req, res) => {
  const p = await prisma.promotion.findUnique({ where: { id: Number(req.params.id) } });
  if (!p) return res.status(404).json({ error: 'Promotion not found' });

  const body = req.body || {};
  const requested = body.active !== undefined && body.active !== null && body.active !== ''
    ? !!Number(body.active)
    : !p.active;

  const data = { active: requested };
  if (req.body.title !== undefined) data.title = String(req.body.title).trim();
  if (req.body.description !== undefined) data.description = String(req.body.description).slice(0, 1000);
  if (req.body.discount_pct !== undefined) { const pct = Number(req.body.discount_pct); if (!Number.isFinite(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'discount_pct must be between 0 and 100' }); data.discountPct = pct; }
  const planIds = normalizePlanIds(req.body.plan_ids);
  if (planIds === null) return res.status(400).json({ error: 'plan_ids must be an array of valid package IDs' });
  const planIdError = await validatePlanIds(planIds);
  if (planIdError) return res.status(400).json({ error: planIdError });
  if (planIds !== undefined) {
    await prisma.$transaction([
      prisma.promotion.update({ where: { id: p.id }, data }),
      prisma.promotionPlan.deleteMany({ where: { promotionId: p.id } }),
      ...(planIds.length ? [prisma.promotionPlan.createMany({ data: planIds.map((planId) => ({ promotionId: p.id, planId })) })] : []),
    ]);
  } else {
    await prisma.promotion.update({ where: { id: p.id }, data });
  }
  res.json({ message: `Promotion ${requested ? 'activated' : 'deactivated'}`, is_active: requested });
});

// Promotions that already affected a payment stay available for financial
// history; admins can deactivate those campaigns instead of deleting them.
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid promotion id' });

  const promotion = await prisma.promotion.findUnique({
    where: { id },
    select: { id: true, title: true, _count: { select: { payments: true } } },
  });
  if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
  if (promotion._count.payments > 0) {
    return res.status(409).json({ error: 'This promotion has payment history and cannot be removed. Deactivate it instead.' });
  }

  await prisma.promotion.delete({ where: { id: promotion.id } });
  res.json({ message: 'Promotion removed' });
});

export default router;
