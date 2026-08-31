import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { sendEmail } from '../services/integrations.js';
import { toPositiveInt, isDate, isTime, isTodayOrFuture, toEnum, BOOKING_STATUSES } from '../middleware/validators.js';
import { findBookableEntitlement } from '../services/entitlements.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { bookingStart, getPlatformSettings, isInAutoAssignmentWindow, providerCanTakeBooking, providerOffersCategory, servesTown } from '../services/scheduling.js';
import { processExpiredBookings, getAssignedDeadline, getInProgressDeadline } from '../services/bookingTimeouts.js';

const router = Router();
router.use(authenticateToken);

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
async function pickProvider(client, categoryName, town, addressDistrict, bookingDate, bookingTime, service, settings) {
  const candidates = await client.provider.findMany({
    where: { kycStatus: 'APPROVED', availabilityStatus: 'available' },
    select: { id: true, userId: true, category: true, serviceTowns: true },
  });
  const scheduledStart = bookingStart(bookingDate, bookingTime);
  const townCandidates = candidates.filter((provider) => providerOffersCategory(provider, categoryName) && servesTown(provider, town, addressDistrict));
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
  const requested = { bookingDate, bookingTime, town, addressDistrict, serviceId: service.id, service };
  const conflictFree = [];
  for (const provider of eligible) {
    const fullProvider = { ...provider, kycStatus: 'APPROVED', availabilityStatus: 'available' };
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

  const normalizedTime = booking_time.trim().toUpperCase();

  // Rapid double-click / retry idempotency check within 15 seconds
  const recentDuplicate = await prisma.booking.findFirst({
    where: {
      userId,
      serviceId,
      bookingDate: booking_date,
      bookingTime: normalizedTime,
      status: { not: 'CANCELLED' },
      createdAt: { gte: new Date(Date.now() - 15000) },
    },
  });

  if (recentDuplicate) {
    return res.status(200).json({
      booking_id: recentDuplicate.id,
      status: recentDuplicate.status.toLowerCase(),
      total_price: recentDuplicate.totalPrice,
      duplicate: true,
      message: 'A booking for this service and time slot was already submitted and is confirmed',
    });
  }

  const entitlement = await findBookableEntitlement(prisma, userId, service.categoryId);
  if (!entitlement) return res.status(403).json({ error: `An active ${service.category.name} entitlement with remaining service units is required to book this service` });

  const startPin = crypto.randomInt(100000, 1000000).toString();
  const completionPin = crypto.randomInt(100000, 1000000).toString();
  const [startPinHash, completionPinHash] = await Promise.all([
    bcrypt.hash(startPin, 12),
    bcrypt.hash(completionPin, 12),
  ]);
  const customerStartPinCipher = encryptPin(startPin);
  const customerCompletionPinCipher = encryptPin(completionPin);

  const customer = await prisma.user.findUnique({ where: { id: userId }, select: { town: true, addressStreet: true, addressDistrict: true, email: true, name: true } });
  const town = normalizeTown(customer?.town);
  const settings = await getPlatformSettings(prisma);
  const shouldAutoAssign = Boolean(town) && isInAutoAssignmentWindow(booking_date, booking_time, settings);
  const scheduled = bookingStart(booking_date, booking_time);
  const pinExpiresAt = scheduled ? new Date(scheduled.getTime() + 24 * 60 * 60 * 1000) : null;

  let booking;
  for (let attempt = 1; attempt <= 3 && !booking; attempt += 1) {
    try {
      booking = await prisma.$transaction(async (tx) => {
        const lockedEntitlement = await findBookableEntitlement(tx, userId, service.categoryId);
        if (!lockedEntitlement) {
          const error = new Error('No remaining entitlement units');
          error.statusCode = 409;
          throw error;
        }
        entitlement.subscriptionId = lockedEntitlement.subscriptionId;
        entitlement.remainingUnits = lockedEntitlement.remainingUnits;

        const duplicate = await tx.booking.findFirst({
          where: { userId, serviceId, bookingDate: booking_date, bookingTime: normalizedTime, status: { not: 'CANCELLED' } },
          select: { id: true },
        });
        if (duplicate) {
          const error = new Error('You already have this service booked for the selected date and time');
          error.statusCode = 409;
          throw error;
        }

        // Provider selection must share the Serializable transaction with the
        // booking insert. Otherwise two customers can both select the same
        // apparently-free provider before either booking becomes visible.
        const provider = shouldAutoAssign
          ? await pickProvider(tx, service.category.name, town, customer?.addressDistrict, booking_date, normalizedTime, service, settings)
          : null;
        return tx.booking.create({
          data: {
            userId,
            providerId: provider?.id || null,
            serviceId,
            subscriptionId: lockedEntitlement.subscriptionId,
            bookingDate: booking_date,
            bookingTime: normalizedTime,
            town,
            addressStreet: customer?.addressStreet || null,
            addressDistrict: customer?.addressDistrict || null,
            status: provider ? 'ASSIGNED' : 'PENDING',
            autoAssigned: Boolean(provider),
            startPinHash,
            completionPinHash,
            customerStartPinCipher,
            customerCompletionPinCipher,
            pinExpiresAt,
            totalPrice: service.price,
            providerEarning: service.providerEarning,
          },
        });
      }, { maxWait: 5000, timeout: 15000, isolationLevel: 'Serializable' });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      const serializationConflict = err.code === 'P2034' || err.message?.includes('could not serialize access') || err.message?.includes('write conflict');
      if (!serializationConflict) throw err;
      const existing = await prisma.booking.findFirst({
        where: { userId, serviceId, bookingDate: booking_date, bookingTime: normalizedTime, status: { not: 'CANCELLED' } },
      });
      if (existing) {
        return res.status(200).json({
          booking_id: existing.id,
          status: existing.status.toLowerCase(),
          total_price: existing.totalPrice,
          duplicate: true,
          message: 'A booking for this service and time slot was already submitted and is confirmed',
          entitlement: { plan_title: entitlement.planTitle, remaining_units: entitlement.remainingUnits },
        });
      }
      if (attempt === 3) return res.status(409).json({ error: 'A conflicting booking request is being processed. Please try again.' });
      await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
    }
  }

  if (booking.providerId) {
    const assignedProvider = await prisma.provider.findUnique({ where: { id: booking.providerId } });
    if (assignedProvider) await notify(assignedProvider.userId, `New booking assigned: ${service.title} on ${booking_date} at ${booking_time}.`);
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

// My bookings (customer). Generic booking list returns high-level status;
// active service PINs are retrieved on demand via GET /bookings/:id/pins.
router.get('/my', async (req, res) => {
  await processExpiredBookings(prisma).catch(() => {});
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
    pin_code: undefined,
    pinAttempts: undefined,
    pinLockedUntil: undefined,
    expectedEndTime: undefined,
    status: b.status.toLowerCase(),
    service_title: b.service?.title,
    category_name: b.service?.category?.name,
    provider_name: b.provider?.user?.name,
    provider_phone: b.provider?.user?.phone,
  })));
});

// Providers fulfil only bookings assigned by the server scheduling flow.
router.get('/assigned', async (req, res) => {
  await processExpiredBookings(prisma).catch(() => {});
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  if (provider.kycStatus !== 'APPROVED') {
    return res.status(403).json({ error: 'Your KYC must be approved before you can view assigned bookings' });
  }

  const bookings = await prisma.booking.findMany({
    where: { providerId: provider.id },
    include: { service: { include: { category: true } }, user: { select: { id: true, name: true, phone: true, email: true } } },
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
    status: b.status.toLowerCase(),
    service_title: b.service?.title,
    service_desc: b.service?.description,
    category_name: b.service?.category?.name,
    customer_name: b.user?.name,
    customer_phone: b.user?.phone,
  })));
});

router.get('/:id/pins', async (req, res) => {
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Only the booking customer can view their Service PINs' });
  }
  const bookingId = toPositiveInt(req.params.id);
  if (!bookingId) {
    return res.status(400).json({ error: 'Valid booking ID is required' });
  }
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId: req.user.id },
  });
  if (!booking || ['CANCELLED', 'COMPLETED'].includes(booking.status)) {
    return res.status(404).json({ error: 'Active booking PINs not found' });
  }
  if (!booking.customerStartPinCipher || !booking.customerCompletionPinCipher) {
    return res.status(409).json({ error: 'PIN recovery is unavailable for this legacy booking' });
  }
  try {
    res.json({
      start_pin: decryptPin(booking.customerStartPinCipher),
      completion_pin: decryptPin(booking.customerCompletionPinCipher),
      expires_at: booking.pinExpiresAt,
    });
  } catch {
    res.status(500).json({ error: 'Could not recover booking PINs' });
  }
});

// Update status (provider, with PIN for start/complete)
router.put('/:id/status', async (req, res) => {
  const bookingId = toPositiveInt(req.params.id);
  const { status, pin_code, before_photo, after_photo } = req.body;

  if (!bookingId) return res.status(400).json({ error: 'Valid booking ID is required' });
  const nextStatus = toEnum(status, BOOKING_STATUSES);
  if (!nextStatus) return res.status(400).json({ error: `Invalid status. Allowed: ${BOOKING_STATUSES.map((s) => s.toLowerCase()).join(', ')}` });

  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  if (provider.kycStatus !== 'APPROVED') {
    return res.status(403).json({ error: 'Your KYC must be approved before you can manage bookings' });
  }

  let outcome;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      // Serialize all lifecycle and PIN mutations for this booking. Without a
      // per-booking lock, five simultaneous failures all read pinAttempts=0
      // and overwrite it with 1, defeating the lockout policy.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(bookingId)})`;
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { service: true } });
      const fail = (statusCode, message, details = {}) => {
        const error = new Error(message);
        error.statusCode = statusCode;
        error.details = details;
        throw error;
      };
      if (!booking) fail(404, 'Booking not found');
      if (booking.providerId !== provider.id) fail(403, 'This booking is not assigned to you');
      const allowedNext = PROVIDER_TRANSITIONS[booking.status] || [];
      if (!allowedNext.includes(nextStatus)) fail(409, `Cannot move booking from ${booking.status.toLowerCase()} to ${nextStatus.toLowerCase()}`);

      const now = new Date();
      if (nextStatus === 'IN_PROGRESS') {
        const startDeadline = getAssignedDeadline(booking);
        if (startDeadline && now > startDeadline) {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: 'CANCELLED', cancellationReason: 'Provider did not start service within 2 hours of scheduled time (Auto-cancelled)' },
          });
          return {
            booking,
            deadlineFailure: {
              statusCode: 400,
              body: { error: 'The 2-hour window to start this booking has expired. The booking has been auto-cancelled.' },
            },
          };
        }
      } else if (nextStatus === 'COMPLETED') {
        const finishDeadline = getInProgressDeadline(booking);
        if (finishDeadline && now > finishDeadline) {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: 'CANCELLED', cancellationReason: 'Service was not completed within 2 hours after scheduled end time (Auto-cancelled)' },
          });
          return {
            booking,
            deadlineFailure: {
              statusCode: 400,
              body: { error: 'The 2-hour completion deadline for this booking has expired. The booking has been auto-cancelled.' },
            },
          };
        }
      }

      let attempts = booking.pinAttempts;
      if (nextStatus === 'COMPLETED' || nextStatus === 'IN_PROGRESS') {
        const requiredPhotoKind = nextStatus === 'IN_PROGRESS' ? 'BEFORE' : 'AFTER';
        const requiredPhotos = await tx.servicePhoto.count({ where: { bookingId: booking.id, kind: requiredPhotoKind } });
        if (!requiredPhotos) fail(400, `${requiredPhotoKind.toLowerCase()} photo upload is required before this status change`);
        if (booking.pinLockedUntil && booking.pinLockedUntil > now) {
          const remainingMin = Math.ceil((booking.pinLockedUntil - now) / 60000);
          fail(429, `PIN verification is temporarily locked. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`, { locked_until: booking.pinLockedUntil, attempts });
        }
        if (booking.pinLockedUntil && booking.pinLockedUntil <= now) attempts = 0;
        if (booking.pinExpiresAt && booking.pinExpiresAt < now) fail(400, 'The verification PIN has expired. Contact Luxora support.');

        const expectedHash = nextStatus === 'IN_PROGRESS' ? booking.startPinHash : booking.completionPinHash;
        const legacyPinMatches = !expectedHash && booking.pinCode === String(pin_code);
        const pinMatches = expectedHash ? await bcrypt.compare(String(pin_code || ''), expectedHash) : legacyPinMatches;
        if (!pinMatches) {
          const newAttempts = attempts + 1;
          const isLocked = newAttempts >= MAX_PIN_ATTEMPTS;
          const lockUntil = isLocked ? new Date(Date.now() + PIN_LOCKOUT_MS) : null;
          await tx.booking.update({ where: { id: booking.id }, data: { pinAttempts: newAttempts, pinLockedUntil: lockUntil } });
          return {
            booking,
            pinFailure: {
              statusCode: isLocked ? 429 : 400,
              body: isLocked
                ? { error: `Too many failed PIN attempts (${MAX_PIN_ATTEMPTS}). Verification locked for 15 minutes.`, locked_until: lockUntil, attempts: newAttempts }
                : { error: `Invalid PIN Code! ${MAX_PIN_ATTEMPTS - newAttempts} attempt${MAX_PIN_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining before lockout.`, attempts_remaining: MAX_PIN_ATTEMPTS - newAttempts },
            },
          };
        }
      }

      if (nextStatus === 'COMPLETED') {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'COMPLETED', providerId: provider.id, afterPhoto: after_photo || undefined, completionPinUsedAt: new Date(), pinAttempts: 0, pinLockedUntil: null },
        });
        const payout = new Prisma.Decimal(booking.providerEarning || 0).toDecimalPlaces(2);
        await tx.provider.update({ where: { id: provider.id }, data: { earnings: { increment: payout } } });
        return { booking, completedFreshly: true };
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: nextStatus, providerId: provider.id, beforePhoto: before_photo || undefined, startPinUsedAt: nextStatus === 'IN_PROGRESS' ? new Date() : undefined, pinAttempts: 0, pinLockedUntil: null },
      });
      return { booking, completedFreshly: false };
    }, { maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message, ...error.details });
    throw error;
  }

  if (outcome.deadlineFailure) {
    await notify(outcome.booking.userId, `Your booking #${bookingId} was cancelled because service was not started/completed within the allowed deadline. Your entitlement unit has been restored.`, '/customer-dashboard');
    return res.status(outcome.deadlineFailure.statusCode).json(outcome.deadlineFailure.body);
  }
  if (outcome.pinFailure) return res.status(outcome.pinFailure.statusCode).json(outcome.pinFailure.body);
  const { booking, completedFreshly } = outcome;

  if (nextStatus === 'COMPLETED') {
    if (completedFreshly) {
      await notify(booking.userId, `Your service #${bookingId} has been completed. Leave a review!`, '/reviews');
      const customer = await prisma.user.findUnique({ where: { id: booking.userId }, select: { email: true, name: true } });
      sendEmail({ to: customer?.email, subject: `Luxora service completed #${bookingId}`, html: `<p>Hi ${customer?.name || 'Customer'},</p><p>Your Luxora service booking #${bookingId} is complete. Thank you for choosing us.</p>` }).catch((error) => console.warn('[email] completion notification failed:', error.message));
    }
  } else if (nextStatus === 'IN_PROGRESS') {
    await notify(booking.userId, `Your provider has started service on booking #${bookingId}.`);
  } else if (nextStatus === 'ASSIGNED') {
    await notify(booking.userId, `A provider has been assigned to your booking #${bookingId}.`);
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
  const { booking_date, booking_time } = req.body;
  if (!isDate(booking_date) || !isTime(booking_time) || !isTodayOrFuture(booking_date)) {
    return res.status(400).json({ error: 'Use a future valid date and time' });
  }
  const normalizedTime = String(booking_time).trim().toUpperCase();
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'reason must be 3-500 characters' });

  const bookingId = toPositiveInt(req.params.id);
  if (!bookingId) return res.status(400).json({ error: 'Valid booking ID is required' });

  const oldBooking = await prisma.booking.findFirst({
    where: { id: bookingId, userId: req.user.id },
    include: { service: { include: { category: true } } },
  });
  if (!oldBooking || !['PENDING', 'ASSIGNED'].includes(oldBooking.status)) {
    return res.status(404).json({ error: 'Reschedulable booking not found' });
  }

  const customer = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { town: true, addressStreet: true, addressDistrict: true, email: true, name: true },
  });
  const town = normalizeTown(customer?.town);
  const settings = await getPlatformSettings(prisma);
  const shouldAutoAssign = Boolean(town) && isInAutoAssignmentWindow(booking_date, normalizedTime, settings);
  const scheduled = bookingStart(booking_date, normalizedTime);
  const pinExpiresAt = scheduled ? new Date(scheduled.getTime() + 24 * 60 * 60 * 1000) : null;

  const startPin = crypto.randomInt(1000, 9999).toString();
  const completionPin = crypto.randomInt(1000, 9999).toString();
  const startPinHash = await bcrypt.hash(startPin, 10);
  const completionPinHash = await bcrypt.hash(completionPin, 10);
  const customerStartPinCipher = encryptPin(startPin);
  const customerCompletionPinCipher = encryptPin(completionPin);

  let newBooking;
  const previousProviderId = oldBooking.providerId;

  try {
    newBooking = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(oldBooking.id)})`;
      const freshOld = await tx.booking.findUnique({ where: { id: oldBooking.id } });
      if (!freshOld || !['PENDING', 'ASSIGNED'].includes(freshOld.status)) {
        const error = new Error('Booking is no longer eligible for rescheduling');
        error.statusCode = 409;
        throw error;
      }

      const duplicate = await tx.booking.findFirst({
        where: {
          userId: req.user.id,
          serviceId: oldBooking.serviceId,
          bookingDate: booking_date,
          bookingTime: normalizedTime,
          status: { not: 'CANCELLED' },
        },
        select: { id: true },
      });
      if (duplicate) {
        const error = new Error('You already have this service booked for the selected date and time');
        error.statusCode = 409;
        throw error;
      }

      // 1. Cancel old booking and record reschedule reason
      await tx.booking.update({
        where: { id: oldBooking.id },
        data: {
          status: 'CANCELLED',
          cancellationReason: `Rescheduled to ${booking_date} at ${normalizedTime}: ${reason}`,
          rescheduleReason: reason,
        },
      });

      // 2. Perform fresh auto-assignment for new slot
      const provider = shouldAutoAssign
        ? await pickProvider(tx, oldBooking.service.category.name, town, customer?.addressDistrict, booking_date, normalizedTime, oldBooking.service, settings)
        : null;

      // 3. Create new booking linked to the same entitlement subscription
      return tx.booking.create({
        data: {
          userId: req.user.id,
          providerId: provider?.id || null,
          serviceId: oldBooking.serviceId,
          subscriptionId: oldBooking.subscriptionId,
          bookingDate: booking_date,
          bookingTime: normalizedTime,
          town,
          addressStreet: customer?.addressStreet || oldBooking.addressStreet,
          addressDistrict: customer?.addressDistrict || oldBooking.addressDistrict,
          status: provider ? 'ASSIGNED' : 'PENDING',
          autoAssigned: Boolean(provider),
          startPinHash,
          completionPinHash,
          customerStartPinCipher,
          customerCompletionPinCipher,
          pinExpiresAt,
          totalPrice: oldBooking.totalPrice,
          providerEarning: oldBooking.providerEarning,
        },
      });
    }, { maxWait: 5000, timeout: 15000, isolationLevel: 'Serializable' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    throw err;
  }

  if (previousProviderId) {
    const prevProvider = await prisma.provider.findUnique({ where: { id: previousProviderId } });
    if (prevProvider) {
      await notify(prevProvider.userId, `Booking #${oldBooking.id} has been cancelled because the customer rescheduled.`);
    }
  }

  if (newBooking.providerId) {
    const assignedProvider = await prisma.provider.findUnique({ where: { id: newBooking.providerId } });
    if (assignedProvider) {
      await notify(assignedProvider.userId, `New booking assigned: ${oldBooking.service.title} on ${booking_date} at ${normalizedTime}.`);
    }
  }

  await notify(req.user.id, `Booking #${oldBooking.id} was rescheduled. New booking #${newBooking.id} confirmed for ${booking_date} at ${normalizedTime}.`, '/customer-dashboard');

  sendEmail({
    to: customer?.email,
    subject: `Luxora booking rescheduled #${newBooking.id}`,
    html: `<p>Hi ${customer?.name || 'Customer'},</p><p>Your booking #${oldBooking.id} was rescheduled. Your new booking #${newBooking.id} for <strong>${oldBooking.service.title}</strong> is confirmed for <strong>${booking_date} at ${normalizedTime}</strong>.</p><p>Status: ${newBooking.status.toLowerCase()}.</p>`,
  }).catch((error) => console.warn('[email] reschedule confirmation failed:', error.message));

  res.json({
    id: newBooking.id,
    old_booking_id: oldBooking.id,
    status: newBooking.status.toLowerCase(),
    booking_date: newBooking.bookingDate,
    booking_time: newBooking.bookingTime,
    pin_code: startPin,
    start_pin: startPin,
    completion_pin: completionPin,
    pin_expires_at: newBooking.pinExpiresAt,
    message: 'Booking rescheduled successfully',
  });
});

export default router;
