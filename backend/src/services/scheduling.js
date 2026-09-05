// Shared scheduling rules.  All assignment paths use these helpers so a manual
// assignment cannot bypass the same safety checks used by automatic matching.
//
// TIME MODEL: bookingDate/bookingTime are Asia/Colombo wall-clock strings
// (customers pick local time; Sri Lanka observes UTC+5:30 with no DST).
// All rule comparisons below are Colombo-explicit so they hold regardless of
// the server/container timezone. Do not compare naive wall-clock Dates
// against `new Date()` directly.
export const COLOMBO_TZ = 'Asia/Colombo';
export const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // UTC+5:30, no DST

export function parseBookingTime(time) {
  const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  return { hour, minute };
}

export function bookingStart(date, time) {
  const parsed = parseBookingTime(time);
  if (!parsed) return null;
  return new Date(`${date}T${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}:00`);
}

// Wall-clock hour (0-23) of a booking slot, parsed from the stored strings so
// the auto-assignment window never depends on server timezone.
export function bookingWallHour(date, time) {
  void date;
  const parsed = parseBookingTime(time);
  return parsed ? parsed.hour : null;
}

// Colombo wall-clock "now", expressed in the server frame so it can be
// compared against naive wall-clock Dates from bookingStart().
export function colomboNow(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  return new Date(current.getTime() + current.getTimezoneOffset() * 60000 + COLOMBO_OFFSET_MS);
}

// V1 lead-time rule: a new/rescheduled booking must start at least
// `hours` after now. Exactly on the boundary is allowed.
export const BOOKING_LEAD_TIME_HOURS = 4;

export function meetsLeadTimeHours(date, time, hours = BOOKING_LEAD_TIME_HOURS, now = new Date()) {
  const scheduledStart = bookingStart(date, time);
  if (!scheduledStart || Number.isNaN(scheduledStart.getTime())) return false;
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) return false;
  return scheduledStart.getTime() - colomboNow(current).getTime() >= hours * 60 * 60 * 1000;
}

export const PROVIDER_CANCELLATION_NOTICE_HOURS = 4;

export function providerCancellationPolicy(date, time, now = new Date()) {
  const scheduledStart = bookingStart(date, time);
  if (!scheduledStart || Number.isNaN(scheduledStart.getTime())) {
    return { canCancel: false, scheduledStart: null, cancellationDeadline: null };
  }
  const cancellationDeadline = new Date(
    scheduledStart.getTime() - PROVIDER_CANCELLATION_NOTICE_HOURS * 60 * 60 * 1000,
  );
  const currentTime = now instanceof Date ? now : new Date(now);
  return {
    canCancel: !Number.isNaN(currentTime.getTime()) && colomboNow(currentTime) <= cancellationDeadline,
    scheduledStart,
    cancellationDeadline,
  };
}

export function servesTown(provider, town, addressDistrict = null) {
  if (!town) return false;
  const wanted = town.toLocaleLowerCase();
  const district = String(addressDistrict || '').trim().toLocaleLowerCase();
  return String(provider.serviceTowns || '').split(',').some((served) => {
    const normalized = served.trim().toLocaleLowerCase();
    return normalized === wanted || (normalized.startsWith('province:') && district && normalized === `province:${district}`);
  });
}

// Providers created before multi-category support have a single category value.
// New selections are stored as a comma-separated list, so both forms remain
// assignable without rewriting existing provider records.
export function providerOffersCategory(provider, categoryName) {
  const wanted = String(categoryName || '').trim().toLocaleLowerCase();
  if (!wanted) return false;
  return String(provider?.category || '').split(',').some((category) => category.trim().toLocaleLowerCase() === wanted);
}

export async function getPlatformSettings(client) {
  return client.platformSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

export function isInAutoAssignmentWindow(date, time, settings) {
  // Hour-granular by design: settings carry whole hours, so the full 16th
  // hour (16:00-16:59) is inside a 07:00-16:00 window. Parsed from the stored
  // Colombo wall-clock strings — never from server-local Date hours.
  const hour = bookingWallHour(date, time);
  return hour !== null && hour >= settings.autoAssignmentStartHour && hour <= settings.autoAssignmentEndHour;
}

export function bookingEndsAt(booking) {
  const start = bookingStart(booking.bookingDate, booking.bookingTime);
  if (!start) return null;
  if (booking.expectedEndTime) return new Date(booking.expectedEndTime);
  return new Date(start.getTime() + Number(booking.service?.durationMins || 60) * 60000);
}

// Adjacent appointments are allowed: [start, end) intervals do not overlap
// when one booking ends exactly as the other starts.
export function hasTimeConflict(existingBookings, requestedStart, requestedEnd) {
  return existingBookings.some((booking) => {
    const start = bookingStart(booking.bookingDate, booking.bookingTime);
    const end = bookingEndsAt(booking);
    return start && end && start < requestedEnd && requestedStart < end;
  });
}

export function cooldownEndsAt(booking) {
  const end = bookingEndsAt(booking);
  if (!end) return null;
  return new Date(end.getTime() + 2 * 60 * 60 * 1000);
}

export async function providerCanTakeBooking(client, provider, booking, { ignoreBookingId = null, requireOnline = true } = {}) {
  if (!provider || provider.kycStatus !== 'APPROVED') {
    return { ok: false, error: 'Provider must be KYC approved' };
  }
  if (requireOnline && provider.availabilityStatus !== 'available') {
    return { ok: false, error: 'Provider must be available (online)' };
  }
  if (provider.user && provider.user.active === false) {
    return { ok: false, error: 'Provider account is deactivated' };
  }
  const service = booking.service || await client.service.findUnique({ where: { id: booking.serviceId }, include: { category: true } });
  if (!service || !providerOffersCategory(provider, service.category?.name)) return { ok: false, error: 'Provider does not offer this service category' };
  if (!servesTown(provider, booking.town, booking.addressDistrict)) return { ok: false, error: 'Provider does not serve this booking town' };
  const requestedStart = bookingStart(booking.bookingDate, booking.bookingTime);
  const requestedEnd = bookingEndsAt({ ...booking, service });
  if (!requestedStart || !requestedEnd) return { ok: false, error: 'Booking schedule is invalid' };
  const commitments = await client.booking.findMany({
    where: { providerId: provider.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}) },
    include: { service: { select: { durationMins: true } } },
  });
  if (hasTimeConflict(commitments, requestedStart, requestedEnd)) return { ok: false, error: 'Provider has a conflicting scheduled booking' };
  return { ok: true };
}

export async function pickProvider(tx, categoryName, town, district, booking_date, normalizedTime, service, settings, { ignoreAssignmentWindow = false } = {}) {
  if (!ignoreAssignmentWindow && !isInAutoAssignmentWindow(booking_date, normalizedTime, settings)) return null;

  const candidates = await tx.provider.findMany({
    where: {
      kycStatus: 'APPROVED',
      availabilityStatus: 'available',
      user: { active: true },
    },
    include: { user: { select: { id: true, name: true, phone: true, email: true, active: true } } },
  });

  const slotStart = bookingStart(booking_date, normalizedTime);
  const slotEnd = new Date(slotStart.getTime() + Number(service.durationMins || 60) * 60000);

  const eligible = [];
  for (const candidate of candidates) {
    if (!candidate.user?.active) continue;
    if (!providerOffersCategory(candidate, categoryName)) continue;
    if (!servesTown(candidate, town, district)) continue;

    const existing = await tx.booking.findMany({
      where: { providerId: candidate.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
      include: { service: { select: { durationMins: true } } },
    });

    if (!hasTimeConflict(existing, slotStart, slotEnd)) {
      eligible.push(candidate);
    }
  }

  if (!eligible.length) return null;

  const history = await tx.booking.findMany({
    where: { providerId: { in: eligible.map((p) => p.id) }, status: { in: ['COMPLETED', 'ASSIGNED', 'IN_PROGRESS'] } },
    select: { providerId: true },
  });
  const counts = eligible.reduce((acc, p) => { acc[p.id] = 0; return acc; }, {});
  for (const h of history) {
    if (counts[h.providerId] !== undefined) counts[h.providerId] += 1;
  }
  eligible.sort((a, b) => counts[a.id] - counts[b.id]);
  return eligible[0];
}

export async function reassignOrUnassignProviderBookings(client, providerId, notifyFn, { preserveNearTerm = false } = {}) {
  const affectedBookings = await client.booking.findMany({
    where: {
      providerId,
      status: { in: ['ASSIGNED', 'PENDING'] },
    },
    include: {
      service: { include: { category: true } },
      user: true,
    },
  });

  const wallNow = colomboNow(new Date());
  const settings = await getPlatformSettings(client);

  for (const booking of affectedBookings) {
    const scheduledStart = bookingStart(booking.bookingDate, booking.bookingTime);
    const isFuture = scheduledStart && scheduledStart > wallNow;
    if (!isFuture) continue;
    // Race-safe near-term preserve (Rule 5B): an ASSIGNED booking starting
    // within the notice window stays with its provider and must never be
    // stripped or auto-cancelled by a concurrent availability change.
    if (preserveNearTerm && scheduledStart.getTime() - wallNow.getTime() <= PROVIDER_CANCELLATION_NOTICE_HOURS * 60 * 60 * 1000) continue;

    let newProvider = null;
    if (booking.service) {
      newProvider = await pickProvider(
        client,
        booking.service.category?.name,
        booking.town,
        booking.addressDistrict,
        booking.bookingDate,
        booking.bookingTime,
        booking.service,
        settings
      );
    }

    if (newProvider) {
      await client.booking.update({
        where: { id: booking.id },
        data: {
          providerId: newProvider.id,
          status: 'ASSIGNED',
        },
      });
      if (notifyFn) {
        await notifyFn(newProvider.userId, `New urgent booking assigned: ${booking.service?.title || 'Service'} on ${booking.bookingDate} at ${booking.bookingTime}.`, '/provider-dashboard').catch(() => {});
        await notifyFn(booking.userId, `Your booking for ${booking.service?.title || 'Service'} has been reassigned to a new provider.`, '/customer-dashboard').catch(() => {});
      }
    } else {
      await client.booking.update({
        where: { id: booking.id },
        data: {
          providerId: null,
          status: 'PENDING',
        },
      });
      if (notifyFn) {
        await notifyFn(booking.userId, `Your booking for ${booking.service?.title || 'Service'} is being reassigned to an available provider.`, '/customer-dashboard').catch(() => {});
      }
    }
  }
}

// Admin provider HOLD (Rule 7). IN_PROGRESS bookings are never touched here.
// ASSIGNED/PENDING bookings starting within the 4-hour notice window are
// CANCELLED (coin restores implicitly because usage excludes CANCELLED rows).
// Bookings further out are rerouted; with no replacement they stay
// PENDING/unassigned so the scheduler can retry. Every mutation re-reads
// state inside an advisory-locked transaction: concurrent admin actions,
// provider/customer cancels, or scheduler runs cannot double-restore a coin
// or reroute a booking that already moved to IN_PROGRESS/COMPLETED/CANCELLED.
export async function handleProviderHoldBookings(client, providerId, notifyFn, now = new Date()) {
  const wallNow = colomboNow(now instanceof Date ? now : new Date(now));
  const candidates = await client.booking.findMany({
    where: { providerId, status: { in: ['ASSIGNED', 'PENDING'] } },
    include: { service: { include: { category: true } } },
  });
  const settings = await getPlatformSettings(client);
  const outcome = { cancelled: [], reassigned: [], leftPending: [], skipped: [] };

  for (const booking of candidates) {
    const scheduledStart = bookingStart(booking.bookingDate, booking.bookingTime);
    if (!scheduledStart || scheduledStart <= wallNow) {
      outcome.skipped.push(booking.id);
      continue;
    }
    const withinNoticeWindow = scheduledStart.getTime() - wallNow.getTime() <= PROVIDER_CANCELLATION_NOTICE_HOURS * 60 * 60 * 1000;

    const result = await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(booking.id)})`;
      const fresh = await tx.booking.findUnique({ where: { id: booking.id } });
      if (!fresh || fresh.providerId !== providerId || !['ASSIGNED', 'PENDING'].includes(fresh.status)) {
        return 'stale';
      }
      if (withinNoticeWindow) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED', cancellationReason: 'Cancelled because the assigned provider account was put on hold within four hours of the scheduled start; the service coin was restored.' },
        });
        return 'cancelled';
      }
      const service = booking.service || await tx.service.findUnique({ where: { id: fresh.serviceId }, include: { category: true } });
      const replacement = service
        ? await pickProvider(tx, service.category?.name, fresh.town, fresh.addressDistrict, fresh.bookingDate, fresh.bookingTime, service, settings)
        : null;
      if (replacement && replacement.id !== providerId) {
        await tx.booking.update({ where: { id: booking.id }, data: { providerId: replacement.id, status: 'ASSIGNED' } });
        return { rerouted: replacement };
      }
      await tx.booking.update({ where: { id: booking.id }, data: { providerId: null, status: 'PENDING' } });
      return 'pending';
    });

    if (result === 'stale' || result === 'skipped') {
      outcome.skipped.push(booking.id);
    } else if (result === 'cancelled') {
      outcome.cancelled.push(booking.id);
      if (notifyFn) {
        await notifyFn(booking.userId, `Booking #${booking.id} was cancelled because the provider account was put on hold. Your service coin has been restored.`, '/customer-dashboard').catch(() => {});
      }
    } else if (result === 'pending') {
      outcome.leftPending.push(booking.id);
      if (notifyFn) {
        await notifyFn(booking.userId, `Your booking #${booking.id} is being reassigned to an available provider.`, '/customer-dashboard').catch(() => {});
      }
    } else if (result?.rerouted) {
      outcome.reassigned.push(booking.id);
      if (notifyFn) {
        await notifyFn(booking.userId, `Your booking #${booking.id} has been reassigned to another provider.`, '/customer-dashboard').catch(() => {});
        await notifyFn(result.rerouted.userId, `Booking #${booking.id} (${booking.service?.title || 'Service'}) has been assigned to you.`, '/provider-dashboard').catch(() => {});
      }
    }
  }

  return outcome;
}
