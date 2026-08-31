// Shared scheduling rules.  All assignment paths use these helpers so a manual
// assignment cannot bypass the same safety checks used by automatic matching.
export function bookingStart(date, time) {
  const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
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
  const start = bookingStart(date, time);
  return Boolean(start) && start.getHours() >= settings.autoAssignmentStartHour && start.getHours() <= settings.autoAssignmentEndHour;
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

export async function providerCanTakeBooking(client, provider, booking, { ignoreBookingId = null } = {}) {
  if (!provider || provider.kycStatus !== 'APPROVED' || provider.availabilityStatus !== 'available') {
    return { ok: false, error: 'Provider must be KYC approved and available' };
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

export async function pickProvider(tx, categoryName, town, district, booking_date, normalizedTime, service, settings) {
  if (!isInAutoAssignmentWindow(booking_date, normalizedTime, settings)) return null;

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

export async function reassignOrUnassignProviderBookings(client, providerId, notifyFn) {
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

  const now = new Date();
  const settings = await getPlatformSettings(client);

  for (const booking of affectedBookings) {
    const scheduledStart = bookingStart(booking.bookingDate, booking.bookingTime);
    const isFuture = scheduledStart && scheduledStart > now;
    if (!isFuture) continue;

    const hoursUntilStart = (scheduledStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    let newProvider = null;
    if (hoursUntilStart <= 24 && booking.service) {
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
