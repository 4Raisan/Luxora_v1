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
  const result = await prisma.notification.updateMany({
    where: { id: Number(req.params.id), userId: req.user.id },
    data: { read: true },
  });
  if (result.count === 0) return res.status(404).json({ error: 'Notification not found' });
  res.json({ message: 'Marked read' });
});

// Mark all of the user's notifications as read
router.put('/read-all', async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });
  res.json({ message: 'All notifications marked read', updated: result.count });
});

export default router;
