import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  const notes = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notes);
});

router.put('/:id/read', async (req, res) => {
  await prisma.notification.updateMany({ where: { id: Number(req.params.id), userId: req.user.id }, data: { read: true } });
  res.json({ message: 'Marked read' });
});

export default router;
