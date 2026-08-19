import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { isNonEmptyString } from '../middleware/validators.js';

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
  ends_at: p.endsAt,
});

router.get('/', async (_req, res) => {
  const now = new Date();
  const promos = await prisma.promotion.findMany({ where: { active: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] } });
  res.json(promos.map(serialize));
});

router.use(authenticateToken, requireRole('ADMIN'));

router.get('/all', async (_req, res) => {
  const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(promotions.map(serialize));
});

router.post('/', async (req, res) => {
  const { title, description, code, discount_pct, starts_at, ends_at } = req.body;
  if (!isNonEmptyString(title, 150)) return res.status(400).json({ error: 'Title required' });

  const pct = Number(discount_pct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'discount_pct must be between 0 and 100' });
  }

  const startsAt = starts_at ? new Date(starts_at) : null;
  const endsAt = ends_at ? new Date(ends_at) : null;
  if ((starts_at && Number.isNaN(startsAt.getTime())) || (ends_at && Number.isNaN(endsAt.getTime())) || (startsAt && endsAt && endsAt <= startsAt)) return res.status(400).json({ error: 'Invalid promotion dates' });
  const p = await prisma.promotion.create({
    data: { title: title.trim(), description: description || '', code: code?.trim().toUpperCase() || null, discountPct: pct, startsAt, endsAt },
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
  await prisma.promotion.update({ where: { id: p.id }, data });
  res.json({ message: `Promotion ${requested ? 'activated' : 'deactivated'}`, is_active: requested });
});

export default router;
