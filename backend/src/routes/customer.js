import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/dashboard', async (req, res) => {
  const userId = req.user.id;
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });

  const activeSubs = await prisma.userSubscription.findMany({
    where: { userId, status: 'active' },
    include: { plan: true },
    orderBy: { startDate: 'desc' },
  });

  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: { service: { include: { category: true } }, provider: { include: { user: true } } },
    orderBy: [{ bookingDate: 'asc' }, { bookingTime: 'asc' }],
  });

  const now = new Date();
  const upcoming = bookings.filter((b) => {
    if (b.status === 'COMPLETED' || b.status === 'CANCELLED') return false;
    const d = new Date(`${b.bookingDate}T${b.bookingTime || '00:00'}`);
    return d >= now;
  });
  const past = bookings.filter((b) => !upcoming.includes(b));

  const reviews = await prisma.review.findMany({
    where: { userId },
    include: { service: true, provider: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    profile,
    activeSubscriptions: activeSubs,
    upcomingBookings: upcoming,
    pastBookings: past,
    reviews: reviews.map((r) => ({
      ...r,
      service_title: r.service?.title,
      provider_name: r.provider?.user?.name,
    })),
  });
});

export default router;
