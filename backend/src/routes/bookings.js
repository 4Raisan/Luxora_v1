import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { toPositiveInt, isDate, isTime, isTodayOrFuture, toEnum, BOOKING_STATUSES } from '../middleware/validators.js';

const router = Router();
router.use(authenticateToken);

const PROVIDER_PAYOUT_RATE = 0.85;

// Legal status transitions a provider can perform (admin has an override endpoint).
const PROVIDER_TRANSITIONS = {
  PENDING: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED'],
};

// Pick the least-loaded approved+available provider for a category.
async function pickProvider(categoryName) {
  const candidates = await prisma.provider.findMany({
    where: { category: categoryName, kycStatus: 'APPROVED', availabilityStatus: 'available' },
    select: { id: true },
  });
  if (candidates.length === 0) return null;

  const load = await prisma.booking.groupBy({
    by: ['providerId'],
    where: {
      providerId: { in: candidates.map((c) => c.id) },
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
    },
    _count: { _all: true },
  });
  const loadMap = new Map(load.map((l) => [l.providerId, l._count._all]));

  return candidates.reduce((best, c) =>
    (loadMap.get(c.id) || 0) < (loadMap.get(best.id) || 0) ? c : best
  );
}

// Create booking
router.post('/', async (req, res) => {
  const { service_id, booking_date, booking_time } = req.body;
  const userId = req.user.id;

  const serviceId = toPositiveInt(service_id);
  if (!serviceId) return res.status(400).json({ error: 'service_id is required' });
  if (!isDate(booking_date)) return res.status(400).json({ error: 'booking_date must be YYYY-MM-DD' });
  if (!isTime(booking_time)) return res.status(400).json({ error: 'booking_time must be HH:MM (e.g. 09:00 or 10:00 AM)' });
  if (!isTodayOrFuture(booking_date)) return res.status(400).json({ error: 'booking_date cannot be in the past' });

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { category: true },
  });
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const pin_code = Math.floor(1000 + Math.random() * 9000).toString();

  const provider = await pickProvider(service.category.name);
  const provider_id = provider ? provider.id : null;
  const status = provider_id ? 'ASSIGNED' : 'PENDING';

  const booking = await prisma.booking.create({
    data: {
      userId,
      providerId: provider_id,
      serviceId,
      bookingDate: booking_date,
      bookingTime: booking_time.trim().toUpperCase(),
      status,
      pinCode: pin_code,
      totalPrice: service.price,
    },
  });

  if (provider_id) {
    await notify(provider.userId, `New booking assigned: ${service.title} on ${booking_date} at ${booking_time}.`);
  }

  res.status(201).json({
    booking_id: booking.id,
    pin_code,
    status: status.toLowerCase(),
    total_price: service.price,
    message: 'Booking placed successfully',
  });
});

// My bookings (customer)
router.get('/my', async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user.id },
    include: { service: { include: { category: true } }, provider: { include: { user: true } } },
    orderBy: { id: 'desc' },
  });
  res.json(bookings.map((b) => ({
    ...b,
    pinCode: undefined,
    status: b.status.toLowerCase(),
    service_title: b.service?.title,
    category_name: b.service?.category?.name,
    provider_name: b.provider?.user?.name,
    provider_phone: b.provider?.user?.phone,
  })));
});

// Assigned bookings (provider): own bookings + unassigned PENDING pool in the provider's category
router.get('/assigned', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });

  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { providerId: provider.id },
        { status: 'PENDING', service: { category: { name: provider.category } } },
      ],
    },
    include: { service: { include: { category: true } }, user: true },
    orderBy: { id: 'desc' },
  });
  res.json(bookings.map((b) => ({
    ...b,
    pinCode: undefined,
    status: b.status.toLowerCase(),
    service_title: b.service?.title,
    service_desc: b.service?.description,
    category_name: b.service?.category?.name,
    customer_name: b.user?.name,
    customer_phone: b.user?.phone,
  })));
});

// Update status (provider, with PIN for start/complete)
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, pin_code, before_photo, after_photo } = req.body;

  const nextStatus = toEnum(status, BOOKING_STATUSES);
  if (!nextStatus) return res.status(400).json({ error: `Invalid status. Allowed: ${BOOKING_STATUSES.map((s) => s.toLowerCase()).join(', ')}` });

  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  if (provider.kycStatus !== 'APPROVED') {
    return res.status(403).json({ error: 'Your KYC must be approved before you can manage bookings' });
  }

  const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Ownership: only the assigned provider may update; an unassigned PENDING booking
  // can only be claimed (ASSIGNED) by a provider of the matching category.
  const isMine = booking.providerId === provider.id;
  const canClaim = booking.status === 'PENDING' && nextStatus === 'ASSIGNED';
  if (!isMine && !canClaim) {
    return res.status(403).json({ error: 'This booking is not assigned to you' });
  }
  if (canClaim && booking.serviceId) {
    const svc = await prisma.service.findUnique({ where: { id: booking.serviceId }, include: { category: true } });
    if (svc?.category?.name !== provider.category) {
      return res.status(403).json({ error: 'This booking belongs to another service category' });
    }
  }

  const allowedNext = PROVIDER_TRANSITIONS[booking.status] || [];
  if (!allowedNext.includes(nextStatus)) {
    return res.status(400).json({ error: `Cannot move booking from ${booking.status.toLowerCase()} to ${nextStatus.toLowerCase()}` });
  }

  if ((nextStatus === 'COMPLETED' || nextStatus === 'IN_PROGRESS') && booking.pinCode !== String(pin_code)) {
    return res.status(400).json({ error: 'Invalid PIN Code! Customer verification failed.' });
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: nextStatus,
      providerId: provider.id,
      beforePhoto: before_photo || undefined,
      afterPhoto: after_photo || undefined,
    },
  });

  if (nextStatus === 'COMPLETED') {
    // Guard against double payout: only pay when transitioning from a non-COMPLETED state
    if (booking.status !== 'COMPLETED') {
      const payout = booking.totalPrice * PROVIDER_PAYOUT_RATE;
      await prisma.provider.update({ where: { id: provider.id }, data: { earnings: { increment: payout } } });
    }
    await notify(booking.userId, `Your service #${id} has been completed. Leave a review!`, '/reviews');
  } else if (nextStatus === 'IN_PROGRESS') {
    await notify(booking.userId, `Your provider has started service on booking #${id}.`);
  } else if (nextStatus === 'ASSIGNED') {
    await notify(booking.userId, `A provider has been assigned to your booking #${id}.`);
  }

  res.json({ message: `Booking status updated to ${nextStatus.toLowerCase()}`, status: nextStatus.toLowerCase() });
});

// Cancel own pending/assigned booking (customer)
router.put('/:id/cancel', async (req, res) => {
  const booking = await prisma.booking.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'PENDING' && booking.status !== 'ASSIGNED') {
    return res.status(400).json({ error: 'Only pending or assigned bookings can be cancelled' });
  }
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
  if (booking.providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: booking.providerId } });
    if (provider) await notify(provider.userId, `Booking #${booking.id} has been cancelled by the customer.`);
  }
  res.json({ message: 'Booking cancelled' });
});

export default router;
