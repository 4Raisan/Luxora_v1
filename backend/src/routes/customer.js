import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// The town is retained on the user and copied to each newly-created booking.
router.put('/town', async (req, res) => {
  const town = typeof req.body.town === 'string' ? req.body.town.trim().replace(/\s+/g, ' ') : '';
  if (town.length > 100) return res.status(400).json({ error: 'town must be at most 100 characters' });
  await prisma.user.update({ where: { id: req.user.id }, data: { town: town || null } });
  res.json({ town: town || null });
});

router.get('/dashboard', async (req, res) => {
  const userId = req.user.id;
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, phoneVerified: true, town: true, addressStreet: true, addressDistrict: true, role: true, createdAt: true },
  });
  if (!profile) return res.status(404).json({ error: 'User not found' });

  const activeSubs = await prisma.userSubscription.findMany({
    where: { userId, status: 'active', endDate: { gt: new Date() } },
    include: { plan: true },
    orderBy: { startDate: 'desc' },
  });

  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: { service: { include: { category: true } }, provider: { include: { user: { select: { id: true, name: true, phone: true, email: true } } } } },
    orderBy: [{ bookingDate: 'asc' }, { bookingTime: 'asc' }],
  });

  const now = new Date();
  const upcoming = bookings.filter((b) => {
    if (b.status === 'COMPLETED' || b.status === 'CANCELLED') return false;
    const match = String(b.bookingTime || '00:00').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    let d = new Date(`${b.bookingDate}T00:00:00`);
    if (match) { let hour = Number(match[1]); const minute = Number(match[2]); const meridiem = match[3]?.toUpperCase(); if (meridiem === 'AM' && hour === 12) hour = 0; if (meridiem === 'PM' && hour !== 12) hour += 12; d = new Date(`${b.bookingDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`); }
    return d >= now;
  });
  const past = bookings.filter((b) => !upcoming.includes(b));

  // Review has no direct service relation — go through the booking
  const reviews = await prisma.review.findMany({
    where: { userId },
    include: { booking: { include: { service: true } }, provider: { select: { user: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  // expectedEndTime is provider-only scheduling metadata. Keep this helper at
  // every customer-facing booking boundary, including nested review bookings.
  const withoutProviderSchedule = (booking) => ({ ...booking, startPinHash: undefined, completionPinHash: undefined, customerStartPinCipher: undefined, customerCompletionPinCipher: undefined, pinCode: undefined, expectedEndTime: undefined });
  res.json({
    profile,
    activeSubscriptions: activeSubs,
    upcomingBookings: upcoming.map(withoutProviderSchedule),
    pastBookings: past.map(withoutProviderSchedule),
    reviews: reviews.map((r) => ({
      ...r,
      booking: r.booking ? withoutProviderSchedule(r.booking) : r.booking,
      service_title: r.booking?.service?.title,
      provider_name: r.provider?.user?.name,
    })),
  });
});

export default router;
