import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { sendEmail } from '../services/integrations.js';
import { toPositiveInt, isDate, isTime, isTodayOrFuture, toEnum, BOOKING_STATUSES } from '../middleware/validators.js';
import { findBookableEntitlement } from '../services/entitlements.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { bookingStart, bookingEndsAt, getPlatformSettings, hasTimeConflict, isInAutoAssignmentWindow, providerCanTakeBooking, servesTown } from '../services/scheduling.js';

const router = Router();
router.use(authenticateToken);

const PROVIDER_PAYOUT_RATE = 0.85;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const pinKey = crypto.createHash('sha256').update(JWT_SECRET).digest();
function encryptPin(pin) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', pinKey, iv); return Buffer.concat([iv, cipher.update(pin, 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64'); }
function decryptPin(value) { const data = Buffer.from(value, 'base64'); const iv = data.subarray(0, 12); const tag = data.subarray(data.length - 16); const decipher = crypto.createDecipheriv('aes-256-gcm', pinKey, iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(data.subarray(12, data.length - 16)), decipher.final()]).toString('utf8'); }

// Legal status transitions a provider can perform (admin has an override endpoint).
const PROVIDER_TRANSITIONS = {
  PENDING: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
};

function normalizeTown(town) {
  return typeof town === 'string' && town.trim() ? town.trim().replace(/\s+/g, ' ') : null;
}

function cooldownEndsAt(booking, cooldownHours) {
  const start = bookingStart(booking.bookingDate, booking.bookingTime);
  const cooldownEnd = new Date(start.getTime() + cooldownHours * 60 * 60 * 1000);
  // A provider may only shorten the default cooldown, never extend it.
  return booking.expectedEndTime && new Date(booking.expectedEndTime) < cooldownEnd
    ? new Date(booking.expectedEndTime)
    : cooldownEnd;
}

// Pick the least-loaded approved+available provider matching the booking town.
// A provider's latest same-day auto assignment governs their cooldown.
async function pickProvider(client, categoryName, town, bookingDate, bookingTime, service, settings) {
  const candidates = await client.provider.findMany({
    where: { category: categoryName, kycStatus: 'APPROVED', availabilityStatus: 'available' },
    select: { id: true, userId: true, serviceTowns: true },
  });
  const scheduledStart = bookingStart(bookingDate, bookingTime);
  const townCandidates = candidates.filter((provider) => servesTown(provider, town));
  if (townCandidates.length === 0) return null;

  const priorAutoAssignments = await client.booking.findMany({
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
    const cooldownEnd = latestAssignment && cooldownEndsAt(latestAssignment, settings.autoAssignmentCooldownHours);
    return !cooldownEnd || scheduledStart >= cooldownEnd;
  });
  const requested = { bookingDate, bookingTime, town, serviceId: service.id, service };
  const conflictFree = [];
  for (const provider of eligible) {
    const fullProvider = { ...provider, category: categoryName, kycStatus: 'APPROVED', availabilityStatus: 'available' };
    if ((await providerCanTakeBooking(client, fullProvider, requested)).ok) conflictFree.push(provider);
  }
  if (conflictFree.length === 0) return null;

  const load = await client.booking.groupBy({
    by: ['providerId'],
    where: {
      providerId: { in: conflictFree.map((c) => c.id) },
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
    },
    _count: { _all: true },
  });
  const loadMap = new Map(load.map((l) => [l.providerId, l._count._all]));

  return conflictFree.reduce((best, c) =>
    (loadMap.get(c.id) || 0) < (loadMap.get(best.id) || 0) ? c : best
  );
}

// Create booking
router.post('/', async (req, res) => {
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Only customers can create bookings' });
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

  const entitlement = await findBookableEntitlement(prisma, userId, service.categoryId);
  if (!entitlement) return res.status(403).json({ error: `An active ${service.category.name} entitlement with remaining service units is required to book this service` });

  const startPin = crypto.randomInt(100000, 1000000).toString();
  const completionPin = crypto.randomInt(100000, 1000000).toString();

  const customer = await prisma.user.findUnique({ where: { id: userId }, select: { town: true, email: true, name: true } });
  const town = normalizeTown(customer?.town);
  const settings = await getPlatformSettings(prisma);
  const shouldAutoAssign = Boolean(town) && isInAutoAssignmentWindow(booking_date, booking_time, settings);
  const booking = await prisma.$transaction(async (tx) => {
    const lockedEntitlement = await findBookableEntitlement(tx, userId, service.categoryId);
    if (!lockedEntitlement) { const error = new Error('No remaining entitlement units'); error.statusCode = 409; throw error; }
    entitlement.subscriptionId = lockedEntitlement.subscriptionId;
    entitlement.remainingUnits = lockedEntitlement.remainingUnits;
    const normalizedTime = booking_time.trim().toUpperCase();
    const duplicate = await tx.booking.findFirst({ where: { userId, serviceId, bookingDate: booking_date, bookingTime: normalizedTime, status: { not: 'CANCELLED' } }, select: { id: true } });
    if (duplicate) {
      const error = new Error('You already have this service booked for the selected date and time');
      error.statusCode = 409;
      throw error;
    }
    const provider = shouldAutoAssign ? await pickProvider(tx, service.category.name, town, booking_date, booking_time, service, settings) : null;
    const scheduled = bookingStart(booking_date, booking_time);
    return tx.booking.create({
      data: {
        userId,
        providerId: provider?.id || null,
        serviceId,
        subscriptionId: entitlement.subscriptionId,
        bookingDate: booking_date,
        bookingTime: normalizedTime,
        town,
        status: provider ? 'ASSIGNED' : 'PENDING',
        autoAssigned: Boolean(provider),
        startPinHash: await bcrypt.hash(startPin, 12),
        completionPinHash: await bcrypt.hash(completionPin, 12),
        customerStartPinCipher: encryptPin(startPin),
        customerCompletionPinCipher: encryptPin(completionPin),
        pinExpiresAt: scheduled ? new Date(scheduled.getTime() + 24 * 60 * 60 * 1000) : null,
        totalPrice: service.price,
      },
    });
  }, { isolationLevel: 'Serializable' });

  if (booking.providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: booking.providerId } });
    if (provider) await notify(provider.userId, `New booking assigned: ${service.title} on ${booking_date} at ${booking_time}.`);
  }
  sendEmail({ to: customer?.email, subject: `Luxora booking confirmed #${booking.id}`, html: `<p>Hi ${customer?.name || 'Customer'},</p><p>Your ${service.title} booking is scheduled for ${booking_date} at ${booking_time}.</p><p>Booking status: ${booking.status.toLowerCase()}.</p>` }).catch((error) => console.warn('[email] booking confirmation failed:', error.message));

  res.status(201).json({
    booking_id: booking.id,
    pin_code: startPin,
    start_pin: startPin,
    completion_pin: completionPin,
    pin_expires_at: booking.pinExpiresAt,
    status: booking.status.toLowerCase(),
    total_price: service.price,
    message: 'Booking placed successfully',
    entitlement: { plan_title: entitlement.planTitle, remaining_units: entitlement.remainingUnits - 1 },
  });
});

// My bookings (customer). The PIN belongs to the customer, so it is returned
// on their own bookings — they need it to verify the provider on arrival.
router.get('/my', async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user.id },
    include: { service: { include: { category: true } }, provider: { include: { user: { select: { id: true, name: true, phone: true, email: true } } } } },
    orderBy: { id: 'desc' },
  });
  res.json(bookings.map((b) => ({
    ...b,
    startPinHash: undefined,
    completionPinHash: undefined,
    customerStartPinCipher: undefined,
    customerCompletionPinCipher: undefined,
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
  if (provider.kycStatus !== 'APPROVED') {
    return res.status(403).json({ error: 'Your KYC must be approved before you can view assigned bookings' });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { providerId: provider.id },
        { status: 'PENDING', service: { category: { name: provider.category } } },
      ],
    },
    include: { service: { include: { category: true } }, user: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: { id: 'desc' },
  });
  res.json(bookings
    .filter((b) => b.providerId === provider.id || !b.town || servesTown(provider, b.town))
    .map((b) => ({
    ...b,
    startPinHash: undefined,
    completionPinHash: undefined,
    customerStartPinCipher: undefined,
    customerCompletionPinCipher: undefined,
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

router.get('/:id/pins', async (req, res) => {
  const booking = await prisma.booking.findFirst({ where: { id: toPositiveInt(req.params.id) || 0, userId: req.user.id } });
  if (!booking || ['CANCELLED', 'COMPLETED'].includes(booking.status)) return res.status(404).json({ error: 'Active booking PINs not found' });
  if (!booking.customerStartPinCipher || !booking.customerCompletionPinCipher) return res.status(409).json({ error: 'PIN recovery is unavailable for this legacy booking' });
  try { res.json({ start_pin: decryptPin(booking.customerStartPinCipher), completion_pin: decryptPin(booking.customerCompletionPinCipher), expires_at: booking.pinExpiresAt }); } catch (_) { res.status(500).json({ error: 'Could not recover booking PINs' }); }
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
    const eligibility = await providerCanTakeBooking(prisma, provider, { ...booking, service: svc });
    if (!eligibility.ok) return res.status(409).json({ error: eligibility.error });
  }

  const allowedNext = PROVIDER_TRANSITIONS[booking.status] || [];
  if (!allowedNext.includes(nextStatus)) {
    return res.status(400).json({ error: `Cannot move booking from ${booking.status.toLowerCase()} to ${nextStatus.toLowerCase()}` });
  }

  if (nextStatus === 'COMPLETED' || nextStatus === 'IN_PROGRESS') {
    const requiredPhotoKind = nextStatus === 'IN_PROGRESS' ? 'BEFORE' : 'AFTER';
    const requiredPhotos = await prisma.servicePhoto.count({ where: { bookingId: booking.id, kind: requiredPhotoKind } });
    if (!requiredPhotos) return res.status(400).json({ error: `${requiredPhotoKind.toLowerCase()} photo upload is required before this status change` });
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

    if (booking.pinExpiresAt && booking.pinExpiresAt < new Date()) {
      return res.status(400).json({ error: 'The verification PIN has expired. Contact Luxora support.' });
    }
    const expectedHash = nextStatus === 'IN_PROGRESS' ? booking.startPinHash : booking.completionPinHash;
    const legacyPinMatches = !expectedHash && booking.pinCode === String(pin_code);
    const pinMatches = expectedHash ? await bcrypt.compare(String(pin_code || ''), expectedHash) : legacyPinMatches;
    if (!pinMatches) {
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
      startPinUsedAt: nextStatus === 'IN_PROGRESS' ? new Date() : undefined,
      completionPinUsedAt: nextStatus === 'COMPLETED' ? new Date() : undefined,
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
  if (provider.kycStatus !== 'APPROVED') {
    return res.status(403).json({ error: 'Your KYC must be approved before you can manage schedules' });
  }
  const booking = await prisma.booking.findFirst({ where: { id: Number(req.params.id), providerId: provider.id } });
  if (!booking) return res.status(404).json({ error: 'Booking not found or not assigned to you' });
  if (!booking.autoAssigned) {
    return res.status(400).json({ error: 'Expected end time is only used for auto-assigned bookings' });
  }

  const expectedEndTime = new Date(req.body.expected_end_time);
  const start = bookingStart(booking.bookingDate, booking.bookingTime);
  const settings = await getPlatformSettings(prisma);
  const latestAllowed = new Date(start.getTime() + settings.autoAssignmentCooldownHours * 60 * 60 * 1000);
  if (Number.isNaN(expectedEndTime.getTime()) || expectedEndTime <= start || expectedEndTime > latestAllowed) {
    return res.status(400).json({ error: 'expected_end_time must be after the booking start and no later than its 6-hour cooldown end' });
  }
  const service = await prisma.service.findUnique({ where: { id: booking.serviceId }, include: { category: true } });
  const eligibility = await providerCanTakeBooking(prisma, provider, { ...booking, service, expectedEndTime }, { ignoreBookingId: booking.id });
  if (!eligibility.ok) return res.status(409).json({ error: eligibility.error });
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
  await notify(booking.userId, `Booking #${booking.id} has been cancelled.`);
  if (booking.providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: booking.providerId } });
    if (provider) await notify(provider.userId, `Booking #${booking.id} has been cancelled by the customer.`);
  }
  res.json({ message: 'Booking cancelled' });
});

router.put('/:id/reschedule', async (req, res) => {
  if (req.body.confirmed !== true) return res.status(400).json({ error: 'Reschedule confirmation is required' });
  if (!isDate(req.body.booking_date) || !isTime(req.body.booking_time) || !isTodayOrFuture(req.body.booking_date)) return res.status(400).json({ error: 'Use a future valid date and time' });
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'reason must be 3-500 characters' });
  const booking = await prisma.booking.findFirst({ where: { id: toPositiveInt(req.params.id) || 0, userId: req.user.id } });
  if (!booking || !['PENDING', 'ASSIGNED'].includes(booking.status)) return res.status(404).json({ error: 'Reschedulable booking not found' });
  if (booking.providerId) {
    const [provider, service] = await Promise.all([prisma.provider.findUnique({ where: { id: booking.providerId } }), prisma.service.findUnique({ where: { id: booking.serviceId }, include: { category: true } })]);
    const eligibility = await providerCanTakeBooking(prisma, provider, { ...booking, bookingDate: req.body.booking_date, bookingTime: String(req.body.booking_time).trim().toUpperCase(), expectedEndTime: null, service }, { ignoreBookingId: booking.id });
    if (!eligibility.ok) return res.status(409).json({ error: `Reschedule unavailable: ${eligibility.error}` });
  }
  const updated = await prisma.booking.update({ where: { id: booking.id }, data: { bookingDate: req.body.booking_date, bookingTime: String(req.body.booking_time).trim().toUpperCase(), expectedEndTime: null, rescheduleReason: reason } });
  if (booking.providerId) { const provider = await prisma.provider.findUnique({ where: { id: booking.providerId } }); if (provider) await notify(provider.userId, `Booking #${booking.id} has been rescheduled by the customer.`); }
  await notify(booking.userId, `Booking #${booking.id} has been rescheduled.`);
  res.json({ id: updated.id, status: updated.status.toLowerCase(), booking_date: updated.bookingDate, booking_time: updated.bookingTime });
});

export default router;
