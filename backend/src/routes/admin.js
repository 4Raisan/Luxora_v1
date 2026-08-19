import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { toEnum, toPositiveInt, BOOKING_STATUSES, KYC_STATUSES, COMPLAINT_STATUSES } from '../middleware/validators.js';

const router = Router();
router.use(authenticateToken, requireRole('ADMIN'));

const PROVIDER_PAYOUT_RATE = 0.85;

const ADMIN_TRANSITIONS = {
  PENDING: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PENDING', 'IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  CANCELLED: ['PENDING'],
  COMPLETED: [],
};

function normalizeReason(reason) {
  if (typeof reason !== 'string') return null;
  const value = reason.trim();
  return value.length >= 3 && value.length <= 500 ? value : null;
}

router.get('/providers', async (_req, res) => {
  const providers = await prisma.provider.findMany({
    include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } },
  });
  res.json(providers.map((p) => ({
    ...p,
    id: p.id,
    name: p.user?.name,
    email: p.user?.email,
    phone: p.user?.phone,
    kyc_status: p.kycStatus.toLowerCase(),
    availability_status: p.availabilityStatus,
  })));
});

router.put('/providers/:id/kyc', async (req, res) => {
  const status = toEnum(req.body.status, KYC_STATUSES);
  if (!status) return res.status(400).json({ error: 'status must be one of: pending, approved, rejected' });

  const provider = await prisma.provider.findUnique({ where: { id: Number(req.params.id) } });
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  await prisma.provider.update({ where: { id: provider.id }, data: { kycStatus: status } });

  if (status === 'APPROVED') {
    await notify(provider.userId, 'Your KYC has been approved. You can now receive bookings.');
  } else if (status === 'REJECTED') {
    await notify(provider.userId, 'Your KYC has been rejected. Please contact support.');
  }

  res.json({ message: `Provider KYC updated to ${status.toLowerCase()}`, status: status.toLowerCase() });
});

router.get('/stats', async (_req, res) => {
  const totalUsers = await prisma.user.count({ where: { role: 'CUSTOMER' } });
  const totalProviders = await prisma.provider.count({ where: { kycStatus: 'APPROVED' } });
  const totalBookings = await prisma.booking.count();
  const agg = await prisma.booking.aggregate({ where: { status: 'COMPLETED' }, _sum: { totalPrice: true } });
  const openComplaints = await prisma.complaint.count({ where: { status: { not: 'RESOLVED' } } });
  res.json({ totalUsers, totalProviders, totalBookings, totalRevenue: agg._sum.totalPrice || 0, openComplaints });
});

router.get('/bookings', async (_req, res) => {
  const bookings = await prisma.booking.findMany({
    include: {
      service: { include: { category: true } },
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      provider: { include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings.map((b) => ({
    ...b,
    pinCode: undefined,
    pinAttempts: undefined,
    pinLockedUntil: undefined,
    expectedEndTime: undefined,
    status: b.status.toLowerCase(),
    service_title: b.service?.title,
    category_name: b.service?.category?.name,
    customer_name: b.user?.name,
    customer_email: b.user?.email,
    provider_name: b.provider?.user?.name,
        total_price: b.totalPrice,
    cancellation_reason: b.cancellationReason,
    reschedule_reason: b.rescheduleReason,

  })));
});

// Admin override booking status / reassign
router.put('/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status, provider_id, reason, confirmed } = req.body;

  if (confirmed !== true) return res.status(400).json({ error: 'Admin confirmation is required' });
  const normalizedReason = normalizeReason(reason);
  if (!normalizedReason) return res.status(400).json({ error: 'reason must be between 3 and 500 characters' });

  const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  let nextStatus = undefined;
  if (status !== undefined && status !== null && status !== '') {
    nextStatus = toEnum(status, BOOKING_STATUSES);
    if (!nextStatus) return res.status(400).json({ error: `Invalid status. Allowed: ${BOOKING_STATUSES.map((s) => s.toLowerCase()).join(', ')}` });
    const allowed = ADMIN_TRANSITIONS[booking.status] || [];
    if (nextStatus !== booking.status && !allowed.includes(nextStatus)) {
      return res.status(400).json({ error: `Cannot move booking from ${booking.status.toLowerCase()} to ${nextStatus.toLowerCase()}` });
    }
  }

  let nextProviderId = undefined;
  if (provider_id !== undefined && provider_id !== null && provider_id !== '') {
    nextProviderId = toPositiveInt(provider_id);
    if (!nextProviderId) return res.status(400).json({ error: 'provider_id must be a positive integer' });
    const p = await prisma.provider.findUnique({ where: { id: nextProviderId } });
    if (!p) return res.status(400).json({ error: 'Invalid provider' });
  }
  if (nextStatus === undefined && nextProviderId === undefined) {
    return res.status(400).json({ error: 'status or provider_id is required' });
  }
  if (nextStatus === 'COMPLETED' && !(nextProviderId ?? booking.providerId)) {
    return res.status(400).json({ error: 'A provider is required before completing a booking' });
  }

  // Pay out exactly once, only when transitioning INTO COMPLETED
  if (nextStatus === 'COMPLETED' && booking.status !== 'COMPLETED' && (nextProviderId ?? booking.providerId)) {
    const payout = booking.totalPrice * PROVIDER_PAYOUT_RATE;
    await prisma.provider.update({
      where: { id: nextProviderId ?? booking.providerId },
      data: { earnings: { increment: payout } },
    });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: nextStatus,
      providerId: nextProviderId,
      cancellationReason: nextStatus === 'CANCELLED' ? normalizedReason : (nextStatus === 'PENDING' && booking.status === 'CANCELLED' ? null : undefined),
    },
  });

  if (nextStatus && nextStatus !== booking.status) {
    const action = nextStatus === 'CANCELLED' ? 'cancelled' : nextStatus === 'PENDING' && booking.status === 'CANCELLED' ? 'recovered for reassignment' : `status is now ${nextStatus.toLowerCase()}`;
    await notify(booking.userId, `Your booking #${id} ${action}. Reason: ${normalizedReason}`);
  }
  if (nextProviderId && nextProviderId !== booking.providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: nextProviderId } });
    if (provider) await notify(provider.userId, `Booking #${id} has been assigned to you.`);
  }

  res.json({ message: `Booking #${id} updated`, status: updated.status.toLowerCase(), reason: updated.cancellationReason });
});

router.get('/complaints', async (_req, res) => {
  const complaints = await prisma.complaint.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      booking: { include: { service: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(complaints.map((c) => ({
    ...c,
    status: c.status.toLowerCase(),
    customer_name: c.user?.name,
    customer_email: c.user?.email,
    service_title: c.booking?.service?.title,
  })));
});

router.put('/complaints/:id', async (req, res) => {
  // Accepts lowercase from the admin UI (e.g. 'in_review') and any case variant
  const status = toEnum(req.body.status, COMPLAINT_STATUSES);
  if (!status) return res.status(400).json({ error: 'status must be one of: open, in_review, resolved' });

  const complaint = await prisma.complaint.findUnique({ where: { id: Number(req.params.id) } });
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  await prisma.complaint.update({ where: { id: complaint.id }, data: { status } });
  if (status === 'RESOLVED') {
    await notify(complaint.userId, `Your complaint #${complaint.id} has been resolved.`);
  }
  res.json({ message: `Complaint updated to ${status.toLowerCase()}` });
});

export default router;
