import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { sendEmail } from '../services/integrations.js';
import { toPositiveInt, isDate, isTime, isTodayOrFuture, toEnum, BOOKING_STATUSES } from '../middleware/validators.js';

const router = Router();
router.use(authenticateToken);

const PROVIDER_PAYOUT_RATE = 0.85;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const AUTO_ASSIGNMENT_START_HOUR = 7;
const AUTO_ASSIGNMENT_END_HOUR = 16;
const AUTO_ASSIGNMENT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// Legal status transitions a provider can perform (admin has an override endpoint).
const PROVIDER_TRANSITIONS = {
  PENDING: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED'],
};

function normalizeTown(town) {
  return typeof town === 'string' && town.trim() ? town.trim().replace(/\s+/g, ' ') : null;
}

function servesTown(provider, town) {
  if (!town) return false;
  const wanted = town.toLocaleLowerCase();
  return provider.serviceTowns.split(',').some((servedTown) => servedTown.trim().toLocaleLowerCase() === wanted);
}

function bookingStart(date, time) {
  const match = String(time).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
}

function isInAutoAssignmentWindow(date, time) {
  const start = bookingStart(date, time);
  return Boolean(start) && start.getHours() >= AUTO_ASSIGNMENT_START_HOUR && start.getHours() <= AUTO_ASSIGNMENT_END_HOUR;
}

function cooldownEndsAt(booking) {
  const start = bookingStart(booking.bookingDate, booking.bookingTime);
  const sixHoursAfterStart = new Date(start.getTime() + AUTO_ASSIGNMENT_COOLDOWN_MS);
  // A provider may only shorten the default cooldown, never extend it.
  return booking.expectedEndTime && new Date(booking.expectedEndTime) < sixHoursAfterStart
    ? new Date(booking.expectedEndTime)
    : sixHoursAfterStart;
}

// Pick the least-loaded approved+available provider matching the booking town.
// A provider's latest same-day auto assignment governs their cooldown.
async function pickProvider(categoryName, town, bookingDate, bookingTime) {
  const candidates = await prisma.provider.findMany({
    where: { category: categoryName, kycStatus: 'APPROVED', availabilityStatus: 'available' },
    select: { id: true, userId: true, serviceTowns: true },
  });
  const scheduledStart = bookingStart(bookingDate, bookingTime);
  const townCandidates = candidates.filter((provider) => servesTown(provider, town));
  if (townCandidates.length === 0) return null;

  const priorAutoAssignments = await prisma.booking.findMany({
    where: {
      providerId: { in: townCandidates.map((provider) => provider.id) },
      bookingDate,
      autoAssigned: true,
      status: { not: 'CANCELLED' },
    },
    select: { providerId: true, bookingDate: true, bookingTime: true, expectedEndTime: true },
  });
  const latestAutoAssignmentByProvider = new Map();
  for (const assignment of priorAutoAssignments) {
    const latest = latestAutoAssignmentByProvider.get(assignment.providerId);
    if (!latest || bookingStart(assignment.bookingDate, assignment.bookingTime) > bookingStart(latest.bookingDate, latest.bookingTime)) {
      latestAutoAssignmentByProvider.set(assignment.providerId, assignment);
    }
  }
  const eligible = townCandidates.filter((provider) => {
    const latestAssignment = latestAutoAssignmentByProvider.get(provider.id);
    const cooldownEnd = latestAssignment && cooldownEndsAt(latestAssignment);
    return !cooldownEnd || scheduledStart >= cooldownEnd;
  });
  if (eligible.length === 0) return null;

  const load = await prisma.booking.groupBy({
    by: ['providerId'],
    where: {
      providerId: { in: eligible.map((c) => c.id) },
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
    },
    _count: { _all: true },
  });
  const loadMap = new Map(load.map((l) => [l.providerId, l._count._all]));

  return eligible.reduce((best, c) =>
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

  const customer = await prisma.user.findUnique({ where: { id: userId }, select: { town: true, email: true, name: true } });
  const town = normalizeTown(customer?.town);
  const shouldAutoAssign = Boolean(town) && isInAutoAssignmentWindow(booking_date, booking_time);
  const provider = shouldAutoAssign ? await pickProvider(service.category.name, town, booking_date, booking_time) : null;
  const provider_id = provider ? provider.id : null;
  const status = provider_id ? 'ASSIGNED' : 'PENDING';

  const booking = await prisma.booking.create({
    data: {
      userId,
      providerId: provider_id,
      serviceId,
      bookingDate: booking_date,
      bookingTime: booking_time.trim().toUpperCase(),
      town,
      status,
      autoAssigned: Boolean(provider_id),
      pinCode: pin_code,
      totalPrice: service.price,
    },
  });

  if (provider_id) {
    await notify(provider.userId, `New booking assigned: ${service.title} on ${booking_date} at ${booking_time}.`);
  }
  sendEmail({ to: customer?.email, subject: `Luxora booking confirmed #${booking.id}`, html: `<p>Hi ${customer?.name || 'Customer'},</p><p>Your ${service.title} booking is scheduled for ${booking_date} at ${booking_time}.</p><p>Booking status: ${status.toLowerCase()}.</p>` }).catch((error) => console.warn('[email] booking confirmation failed:', error.message));

  res.status(201).json({
    booking_id: booking.id,
    pin_code,
    status: status.toLowerCase(),
    total_price: service.price,
    message: 'Booking placed successfully',
  });
});

// My bookings (customer). The PIN belongs to the customer, so it is returned
// on their own bookings — they need it to verify the provider on arrival.
router.get('/my', async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user.id },
    include: { service: { include: { category: true } }, provider: { include: { user: true } } },
    orderBy: { id: 'desc' },
  });
  res.json(bookings.map((b) => ({
    ...b,
    pinCode: undefined,
    pinAttempts: undefined,
    pinLockedUntil: undefined,
    expectedEndTime: undefined,
    pin_code: b.status === 'CANCELLED' ? undefined : b.pinCode,
    status: b.status.toLowerCase(),
    service_title: b.service?.title,
    category_name: b.service?.category?.name,
    provider_name: b.provider?.user?.name,
    provider_phone: b.provider?.user?.phone,
  })));
});

// Assigned bookings (provider): own bookings plus same-category manual jobs in served towns.
// Legacy bookings without a town remain visible to every provider in that category.
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
  res.json(bookings
    .filter((b) => b.providerId === provider.id || !b.town || servesTown(provider, b.town))
    .map((b) => ({
    ...b,
    pinCode: undefined,
    pinAttempts: undefined,
    pinLockedUntil: undefined,
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
    if (booking.town && !servesTown(provider, booking.town)) {
      return res.status(403).json({ error: 'You do not serve this booking town' });
    }
  }

  const allowedNext = PROVIDER_TRANSITIONS[booking.status] || [];
  if (!allowedNext.includes(nextStatus)) {
    return res.status(400).json({ error: `Cannot move booking from ${booking.status.toLowerCase()} to ${nextStatus.toLowerCase()}` });
  }

  if (nextStatus === 'COMPLETED' || nextStatus === 'IN_PROGRESS') {
    // PIN lockout check
    if (booking.pinLockedUntil && new Date(booking.pinLockedUntil) > new Date()) {
      const remainingMin = Math.ceil((new Date(booking.pinLockedUntil) - new Date()) / 60000);
      return res.status(429).json({
        error: `PIN verification is temporarily locked. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`,
        locked_until: booking.pinLockedUntil,
        attempts: booking.pinAttempts,
      });
    }

    // Clear expired lockout so the attempt counter resets naturally
    if (booking.pinLockedUntil && new Date(booking.pinLockedUntil) <= new Date()) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { pinAttempts: 0, pinLockedUntil: null },
      });
      booking.pinAttempts = 0;
    }

    if (booking.pinCode !== String(pin_code)) {
      const newAttempts = booking.pinAttempts + 1;
      const isLocked = newAttempts >= MAX_PIN_ATTEMPTS;
      const lockUntil = isLocked ? new Date(Date.now() + PIN_LOCKOUT_MS) : null;

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          pinAttempts: newAttempts,
          pinLockedUntil: lockUntil,
        },
      });

      if (isLocked) {
        return res.status(429).json({
          error: `Too many failed PIN attempts (${MAX_PIN_ATTEMPTS}). Verification locked for 15 minutes.`,
          locked_until: lockUntil,
          attempts: newAttempts,
        });
      }

      return res.status(400).json({
        error: `Invalid PIN Code! ${MAX_PIN_ATTEMPTS - newAttempts} attempt${MAX_PIN_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining before lockout.`,
        attempts_remaining: MAX_PIN_ATTEMPTS - newAttempts,
      });
    }

    // Correct PIN — reset counter
    await prisma.booking.update({
      where: { id: booking.id },
      data: { pinAttempts: 0, pinLockedUntil: null },
    });
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
    const customer = await prisma.user.findUnique({ where: { id: booking.userId }, select: { email: true, name: true } });
    sendEmail({ to: customer?.email, subject: `Luxora service completed #${id}`, html: `<p>Hi ${customer?.name || 'Customer'},</p><p>Your Luxora service booking #${id} is complete. Thank you for choosing us.</p>` }).catch((error) => console.warn('[email] completion notification failed:', error.message));
  } else if (nextStatus === 'IN_PROGRESS') {
    await notify(booking.userId, `Your provider has started service on booking #${id}.`);
  } else if (nextStatus === 'ASSIGNED') {
    await notify(booking.userId, `A provider has been assigned to your booking #${id}.`);
  }

  res.json({ message: `Booking status updated to ${nextStatus.toLowerCase()}`, status: nextStatus.toLowerCase() });
});

// Internal provider scheduling only. Customer endpoints deliberately omit this field.
router.put('/:id/schedule', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const booking = await prisma.booking.findFirst({ where: { id: Number(req.params.id), providerId: provider.id } });
  if (!booking) return res.status(404).json({ error: 'Booking not found or not assigned to you' });

  const expectedEndTime = new Date(req.body.expected_end_time);
  const start = bookingStart(booking.bookingDate, booking.bookingTime);
  const latestAllowed = new Date(start.getTime() + AUTO_ASSIGNMENT_COOLDOWN_MS);
  if (Number.isNaN(expectedEndTime.getTime()) || expectedEndTime <= start || expectedEndTime > latestAllowed) {
    return res.status(400).json({ error: 'expected_end_time must be after the booking start and no later than its 6-hour cooldown end' });
  }
  await prisma.booking.update({ where: { id: booking.id }, data: { expectedEndTime } });
  res.json({ message: 'Expected end time saved', expected_end_time: expectedEndTime });
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
