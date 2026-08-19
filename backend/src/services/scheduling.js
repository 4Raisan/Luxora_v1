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

export function servesTown(provider, town) {
  if (!town) return false;
  const wanted = town.toLocaleLowerCase();
  return String(provider.serviceTowns || '').split(',').some((served) => served.trim().toLocaleLowerCase() === wanted);
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

export async function providerCanTakeBooking(client, provider, booking, { ignoreBookingId = null } = {}) {
  if (!provider || provider.kycStatus !== 'APPROVED' || provider.availabilityStatus !== 'available') {
    return { ok: false, error: 'Provider must be KYC approved and available' };
  }
  const service = booking.service || await client.service.findUnique({ where: { id: booking.serviceId }, include: { category: true } });
  if (!service || service.category?.name !== provider.category) return { ok: false, error: 'Provider does not offer this service category' };
  if (!servesTown(provider, booking.town)) return { ok: false, error: 'Provider does not serve this booking town' };
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
