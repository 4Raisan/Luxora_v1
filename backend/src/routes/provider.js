import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken, requireRole('PROVIDER'));

router.put('/service-towns', async (req, res) => {
  const towns = String(req.body.service_towns || '').split(',').map((town) => town.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const uniqueTowns = [...new Map(towns.map((town) => [town.toLocaleLowerCase(), town])).values()];
  if (uniqueTowns.length > 10 || uniqueTowns.some((town) => town.length > 100)) {
    return res.status(400).json({ error: 'service_towns may contain up to 10 towns, each at most 100 characters' });
  }
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const service_towns = uniqueTowns.join(', ');
  await prisma.provider.update({ where: { id: provider.id }, data: { serviceTowns: service_towns } });
  res.json({ service_towns });
});

router.put('/availability', async (req, res) => {
  const { availability_status } = req.body;
  const allowed = ['available', 'busy', 'offline'];
  if (!allowed.includes(availability_status)) return res.status(400).json({ error: 'Invalid availability status' });
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  await prisma.provider.update({ where: { id: provider.id }, data: { availabilityStatus: availability_status } });
  res.json({ message: `Availability set to ${availability_status}`, availability_status });
});

router.get('/earnings', async (req, res) => {
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
      service_title: h.service?.title, total_price: h.totalPrice, status: h.status.toLowerCase(),
    })),
  });
});

export default router;
