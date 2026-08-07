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
});

router.get('/', async (_req, res) => {
  const promos = await prisma.promotion.findMany({ where: { active: true } });
  res.json(promos.map(serialize));
});

router.use(authenticateToken, requireRole('ADMIN'));

router.post('/', async (req, res) => {
  const { title, description, code, discount_pct } = req.body;
  if (!isNonEmptyString(title, 150)) return res.status(400).json({ error: 'Title required' });

  const pct = Number(discount_pct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'discount_pct must be between 0 and 100' });
  }

  const p = await prisma.promotion.create({
    data: { title: title.trim(), description: description || '', code: code || '', discountPct: pct },
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

  await prisma.promotion.update({ where: { id: p.id }, data: { active: requested } });
  res.json({ message: `Promotion ${requested ? 'activated' : 'deactivated'}`, is_active: requested });
});

export default router;
