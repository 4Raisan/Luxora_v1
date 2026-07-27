import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken, requireRole('PROVIDER'));

router.put('/availability', async (req, res) => {
  const { availability_status } = req.body;
  const allowed = ['available', 'busy', 'offline'];
  if (!allowed.includes(availability_status)) return res.status(400).json({ error: 'Invalid availability status' });
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  await prisma.provider.update({ where: { id: provider.id }, data: { availabilityStatus: availability_status } });
  res.json({ message: `Availability set to ${availability_status}`, availability_status });
});

router.get('/earnings', async (_req, res) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const completedJobs = await prisma.booking.count({ where: { providerId: provider.id, status: 'COMPLETED' } });
  const history = await prisma.booking.findMany({
    where: { providerId: provider.id },
    include: { service: true },
    orderBy: { bookingDate: 'desc' },
    take: 50,
  });
  res.json({
    earnings: provider.earnings,
    completedJobs,
    history: history.map((h) => ({
      id: h.id, booking_date: h.bookingDate, booking_time: h.bookingTime,
      service_title: h.service?.title, total_price: h.totalPrice, status: h.status,
    })),
  });
});

export default router;
