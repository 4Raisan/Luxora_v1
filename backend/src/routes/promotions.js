import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  const promos = await prisma.promotion.findMany({ where: { active: true } });
  res.json(promos);
});

router.use(authenticateToken, requireRole('ADMIN'));

router.post('/', async (req, res) => {
  const { title, description, code, discount_pct } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const p = await prisma.promotion.create({ data: { title, description: description || '', code: code || '', discountPct: discount_pct || 0 } });
  res.status(201).json({ id: p.id, message: 'Promotion created' });
});

router.put('/:id', async (req, res) => {
  const p = await prisma.promotion.findUnique({ where: { id: Number(req.params.id) } });
  if (!p) return res.status(404).json({ error: 'Promotion not found' });
  await prisma.promotion.update({ where: { id: p.id }, data: { active: !p.active } });
  res.json({ message: `Promotion ${p.active ? 'deactivated' : 'activated'}` });
});

export default router;
