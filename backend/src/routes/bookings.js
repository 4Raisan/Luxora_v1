import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { notify } from '../services/notify.js';

const router = Router();
router.use(authenticateToken);

// Create booking
router.post('/', async (req, res) => {
  const { service_id, booking_date, booking_time } = req.body;
  const userId = req.user.id;

  const service = await prisma.service.findUnique({ where: { id: service_id } });
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const pin_code = Math.floor(1000 + Math.random() * 9000).toString();

  const provider = await prisma.provider.findFirst({
    where: { category: service.category.name, kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });
  const provider_id = provider ? provider.id : null;
  const status = provider_id ? 'ASSIGNED' : 'PENDING';

  const booking = await prisma.booking.create({
    data: { userId, providerId: provider_id, serviceId: service_id, bookingDate: booking_date, bookingTime: booking_time, status, pinCode: pin_code, totalPrice: service.price },
  });

  if (provider_id) {
    const pUser = await prisma.provider.findUnique({ where: { id: provider_id } });
    if (pUser) await notify(pUser.userId, `New booking assigned: ${service.title} on ${booking_date} at ${booking_time}.`);
  }

  res.status(201).json({ booking_id: booking.id, pin_code, status, total_price: service.price, message: 'Booking placed successfully' });
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
    service_title: b.service?.title,
    category_name: b.service?.category?.name,
    provider_name: b.provider?.user?.name,
    provider_phone: b.provider?.user?.phone,
  })));
});

// Assigned bookings (provider)
router.get('/assigned', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });

  const bookings = await prisma.booking.findMany({
    where: { OR: [{ providerId: provider.id }, { status: 'PENDING' }] },
    include: { service: true, user: true },
    orderBy: { id: 'desc' },
  });
  res.json(bookings.map((b) => ({
    ...b,
    service_title: b.service?.title,
    service_desc: b.service?.description,
    customer_name: b.user?.name,
    customer_phone: b.user?.phone,
  })));
});

// Update status (provider, with PIN)
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, pin_code, before_photo, after_photo } = req.body;

  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });

  const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (status === 'COMPLETED' || status === 'IN_PROGRESS') {
    if (booking.pinCode !== pin_code) {
      return res.status(400).json({ error: 'Invalid PIN Code! Customer verification failed.' });
    }
  }

  await prisma.booking.update({
    where: { id: Number(id) },
    data: {
      status,
      providerId: provider.id,
      beforePhoto: before_photo || undefined,
      afterPhoto: after_photo || undefined,
    },
  });

  if (status === 'COMPLETED') {
    const payout = booking.totalPrice * 0.85;
    await prisma.provider.update({ where: { id: provider.id }, data: { earnings: { increment: payout } } });
    await notify(booking.userId, `Your service #${id} has been completed. Leave a review!`, '/reviews');
  } else if (status === 'IN_PROGRESS') {
    await notify(booking.userId, `Your provider has started service on booking #${id}.`);
  }

  res.json({ message: `Booking status updated to ${status}` });
});

// Cancel own pending/assigned booking (customer)
router.put('/:id/cancel', async (req, res) => {
  const booking = await prisma.booking.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'PENDING' && booking.status !== 'ASSIGNED') {
    return res.status(400).json({ error: 'Only pending or assigned bookings can be cancelled' });
  }
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
  res.json({ message: 'Booking cancelled' });
});

export default router;
