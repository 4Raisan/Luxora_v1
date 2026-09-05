import { prisma } from '../config/prisma.js';
import { bookingStart, bookingEndsAt, colomboNow, pickProvider, getPlatformSettings } from './scheduling.js';
import { notify } from './notify.js';
import { sendEmail, escapeHtml } from './integrations.js';

// V1 Rule 8: a PENDING/unassigned booking is cancelled as soon as real time
// reaches its scheduled start. No grace period — stale PENDING rows must not
// survive past their start time. Coin restoration is implicit (entitlement
// usage excludes CANCELLED) and exactly-once via the guarded transition
// below; repeat scheduler runs find no PENDING row left.
export const PENDING_TIMEOUT_MS = 0;
export const ASSIGNED_START_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours after start
export const IN_PROGRESS_FINISH_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours after end

export function getPendingDeadline(booking) {
  const start = bookingStart(booking.bookingDate, booking.bookingTime);
  return start ? new Date(start.getTime() + PENDING_TIMEOUT_MS) : null;
}

export function getAssignedDeadline(booking) {
  const start = bookingStart(booking.bookingDate, booking.bookingTime);
  return start ? new Date(start.getTime() + ASSIGNED_START_TIMEOUT_MS) : null;
}

export function getInProgressDeadline(booking) {
  const end = bookingEndsAt(booking);
  return end ? new Date(end.getTime() + IN_PROGRESS_FINISH_TIMEOUT_MS) : null;
}

export async function processExpiredBookings(client = prisma, now = new Date()) {
  // Compare in Colombo wall-clock terms so scheduler behavior is identical
  // regardless of the server/container timezone.
  const wallNow = colomboNow(now instanceof Date ? now : new Date(now));
  const activeBookings = await client.booking.findMany({
    where: {
      status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] },
    },
    include: {
      service: { include: { category: true } },
      user: { select: { id: true, name: true, email: true } },
      provider: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  const cancelledBookings = [];

  for (const booking of activeBookings) {
    let deadline = null;
    let reason = '';
    let notificationMsg = '';
    let emailSubject = '';
    let emailBody = '';

    if (booking.status === 'PENDING') {
      deadline = getPendingDeadline(booking);
      if (deadline && wallNow >= deadline) {
        reason = 'Booking reached its scheduled start time without a provider assignment (Auto-cancelled)';
        notificationMsg = `Your booking #${booking.id} (${booking.service?.title || 'Service'}) was cancelled because no provider was assigned by the scheduled start time. Your entitlement unit has been restored.`;
        emailSubject = `Luxora Booking #${booking.id} - Unassigned Timeout`;
        emailBody = `<p>Hi ${escapeHtml(booking.user?.name || 'Customer')},</p><p>Your booking #${booking.id} for <strong>${escapeHtml(booking.service?.title || 'Service')}</strong> could not be assigned to a provider by the scheduled start time and has been cancelled.</p><p>Your subscription entitlement unit has been restored to your balance.</p>`;
      } else if (!booking.providerId && booking.service) {
        try {
          const settings = await getPlatformSettings(client);
          const newProvider = await pickProvider(
            client,
            booking.service.category?.name,
            booking.town,
            booking.addressDistrict,
            booking.bookingDate,
            booking.bookingTime,
            booking.service,
            settings
          );
          if (newProvider) {
            await client.booking.update({
              where: { id: booking.id },
              data: { providerId: newProvider.id, status: 'ASSIGNED', autoAssigned: true },
            });
            await notify(newProvider.userId, `New booking assigned: ${booking.service.title} on ${booking.bookingDate} at ${booking.bookingTime}.`, '/provider-dashboard').catch(() => {});
            await notify(booking.userId, `A provider has been assigned to your booking #${booking.id}.`, '/customer-dashboard').catch(() => {});
          }
        } catch (retryErr) {
          console.warn(`[booking-retry] failed to assign booking #${booking.id}:`, retryErr.message);
        }
      }
    } else if (booking.status === 'ASSIGNED') {
      deadline = getAssignedDeadline(booking);
      if (deadline && wallNow > deadline) {
        reason = 'Provider did not start service within 2 hours of scheduled time (Auto-cancelled)';
        notificationMsg = `Your booking #${booking.id} (${booking.service?.title || 'Service'}) was cancelled because service was not started within 2 hours of scheduled start time. Your entitlement unit has been restored.`;
        emailSubject = `Luxora Booking #${booking.id} - Provider No-Show / Start Timeout`;
        emailBody = `<p>Hi ${escapeHtml(booking.user?.name || 'Customer')},</p><p>Your booking #${booking.id} for <strong>${escapeHtml(booking.service?.title || 'Service')}</strong> was cancelled because the provider did not start the service within 2 hours of the scheduled start time.</p><p>Your subscription entitlement unit has been restored to your balance.</p>`;
      }
    } else if (booking.status === 'IN_PROGRESS') {
      deadline = getInProgressDeadline(booking);
      if (deadline && wallNow > deadline) {
        reason = 'Service was not completed within 2 hours after scheduled end time (Auto-cancelled)';
        notificationMsg = `Your booking #${booking.id} (${booking.service?.title || 'Service'}) timed out as it was not completed within 2 hours of scheduled end time. Your entitlement unit has been restored.`;
        emailSubject = `Luxora Booking #${booking.id} - Service Completion Timeout`;
        emailBody = `<p>Hi ${escapeHtml(booking.user?.name || 'Customer')},</p><p>Your booking #${booking.id} for <strong>${escapeHtml(booking.service?.title || 'Service')}</strong> timed out because the service was not marked as completed within 2 hours after the scheduled end time.</p><p>Your subscription entitlement unit has been restored to your balance.</p>`;
      }
    }

    if (reason) {
      try {
        const cancelled = await client.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(booking.id)})`;
          const current = await tx.booking.findUnique({ where: { id: booking.id } });
          if (!current || !['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(current.status)) {
            return null;
          }
          return tx.booking.update({
            where: { id: booking.id },
            data: {
              status: 'CANCELLED',
              cancellationReason: reason,
            },
          });
        });

        if (cancelled) {
          cancelledBookings.push(cancelled);
          await notify(booking.userId, notificationMsg, '/customer-dashboard');
          if (booking.user?.email) {
            sendEmail({
              to: booking.user.email,
              subject: emailSubject,
              html: emailBody,
            }).catch((err) => console.warn(`[email] timeout notification failed for booking #${booking.id}:`, err.message));
          }

          if (booking.provider?.userId) {
            await notify(booking.provider.userId, `Booking #${booking.id} has been automatically cancelled: ${reason}.`);
          }
        }
      } catch (err) {
        console.error(`[booking-timeout] Failed to expire booking #${booking.id}:`, err.message);
      }
    }
  }

  return cancelledBookings;
}

let lastThrottledScan = 0;
const THROTTLE_MS = 30000; // Run at most once every 30 seconds when called from HTTP read routes

export async function processExpiredBookingsThrottled(client = prisma, now = new Date()) {
  const nowMs = Date.now();
  if (nowMs - lastThrottledScan < THROTTLE_MS) {
    return [];
  }
  lastThrottledScan = nowMs;
  return processExpiredBookings(client, now);
}

export function startBookingTimeoutScheduler() {
  const tick = async () => {
    try {
      await processExpiredBookings(prisma);
    } catch (err) {
      console.error('[booking-timeouts] scheduler tick failed:', err.message);
    }
  };
  // Run initial scan
  tick();
  // Run every 60 seconds
  return setInterval(tick, 60 * 1000).unref();
}
