import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken, requireRole('ADMIN'));

router.get('/providers', async (_req, res) => {
  const providers = await prisma.provider.findMany({ include: { user: true } });
  res.json(providers);
});

router.put('/providers/:id/kyc', async (req, res) => {
  const { status } = req.body; // APPROVED or REJECTED
  await prisma.provider.update({ where: { id: Number(req.params.id) }, data: { kycStatus: status } });
  res.json({ message: `Provider KYC updated to ${status}` });
});

router.get('/stats', async (_req, res) => {
  const totalUsers = await prisma.user.count({ where: { role: 'CUSTOMER' } });
  const totalProviders = await prisma.provider.count({ where: { kycStatus: 'APPROVED' } });
  const totalBookings = await prisma.booking.count();
  const agg = await prisma.booking.aggregate({ where: { status: 'COMPLETED' }, _sum: { totalPrice: true } });
  res.json({ totalUsers, totalProviders, totalBookings, totalRevenue: agg._sum.totalPrice || 0 });
});

router.get('/bookings', async (_req, res) => {
  const bookings = await prisma.booking.findMany({
    include: { service: { include: { category: true } }, user: true, provider: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings.map((b) => ({
    ...b,
    service_title: b.service?.title,
    category_name: b.service?.category?.name,
    customer_name: b.user?.name,
    customer_email: b.user?.email,
    provider_name: b.provider?.user?.name,
  })));
});

// Admin override booking status / reassign
router.put('/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status, provider_id } = req.body;
  const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (provider_id) {
    const p = await prisma.provider.findUnique({ where: { id: provider_id } });
    if (!p) return res.status(400).json({ error: 'Invalid provider' });
  }
  if (status === 'COMPLETED' && booking.status !== 'COMPLETED' && booking.providerId) {
    const payout = booking.totalPrice * 0.85;
    await prisma.provider.update({ where: { id: booking.providerId }, data: { earnings: { increment: payout } } });
  }
  await prisma.booking.update({
    where: { id: Number(id) },
    data: { status: status || undefined, providerId: provider_id || undefined },
  });
  res.json({ message: `Booking #${id} updated` });
});

router.get('/complaints', async (_req, res) => {
  const complaints = await prisma.complaint.findMany({
    include: { user: true, booking: { include: { service: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(complaints.map((c) => ({
    ...c,
    customer_name: c.user?.name,
    customer_email: c.user?.email,
    service_title: c.booking?.service?.title,
  })));
});

router.put('/complaints/:id', async (req, res) => {
  const { status } = req.body; // OPEN, IN_REVIEW, RESOLVED
  const allowed = ['OPEN', 'IN_REVIEW', 'RESOLVED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await prisma.complaint.update({ where: { id: Number(req.params.id) }, data: { status } });
  res.json({ message: `Complaint updated to ${status}` });
});

export default router;
