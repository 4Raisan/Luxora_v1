import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { toEnum, toPositiveInt, BOOKING_STATUSES, KYC_STATUSES, COMPLAINT_STATUSES } from '../middleware/validators.js';
import { getPlatformSettings, providerCanTakeBooking } from '../services/scheduling.js';
import { maskAccountNumber, queueMonthlyPayouts } from '../services/payouts.js';

const router = Router();
router.use(authenticateToken, requireRole('ADMIN'));

// providers.serviceTowns is persisted as a comma-separated string; the admin UI
// renders town lists as arrays, so every admin response serializes it explicitly.
const townsList = (value) => String(value || '').split(',').map((town) => town.trim()).filter(Boolean);
const normalizePackageType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'single' || type === 'single package') return 'Single Package';
  if (type === 'combo' || type === 'combo package') return 'Combo Package';
  return null;
};
// Admins can assign, unassign, or cancel operational work, but cannot bypass
// the provider's photo + PIN verification stages.
const ADMIN_TRANSITIONS = { PENDING: ['ASSIGNED', 'CANCELLED'], ASSIGNED: ['PENDING', 'CANCELLED'], IN_PROGRESS: ['CANCELLED'], CANCELLED: ['PENDING'], COMPLETED: [] };

router.get('/settings/scheduling', async (_req, res) => res.json(await getPlatformSettings(prisma)));
router.put('/settings/scheduling', async (req, res) => {
  const cooldown = Number(req.body.auto_assignment_cooldown_hours);
  const start = Number(req.body.auto_assignment_start_hour);
  const end = Number(req.body.auto_assignment_end_hour);
  if (!Number.isInteger(cooldown) || cooldown < 1 || cooldown > 24 || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 23 || start > end) return res.status(400).json({ error: 'Use cooldown 1-24 hours and valid start/end hours (0-23)' });
  const setting = await prisma.platformSetting.upsert({ where: { id: 1 }, create: { id: 1, autoAssignmentCooldownHours: cooldown, autoAssignmentStartHour: start, autoAssignmentEndHour: end }, update: { autoAssignmentCooldownHours: cooldown, autoAssignmentStartHour: start, autoAssignmentEndHour: end } });
  res.json(setting);
});
router.post('/settings/scheduling/restore-defaults', async (_req, res) => {
  const setting = await prisma.platformSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: { autoAssignmentCooldownHours: 6, autoAssignmentStartHour: 7, autoAssignmentEndHour: 16 } });
  res.json(setting);
});

router.get('/providers', async (_req, res) => {
  const providers = await prisma.provider.findMany({ include: { user: { select: { id: true, name: true, email: true, phone: true, town: true, role: true, active: true } } } });
  res.json(providers.map((p) => ({
    ...p,
    id: p.id,
    name: p.user?.name,
    email: p.user?.email,
    phone: p.user?.phone,
    kyc_status: p.kycStatus.toLowerCase(),
    availability_status: p.availabilityStatus,
    service_towns: townsList(p.serviceTowns),
  })));
});

router.put('/providers/:id/kyc', async (req, res) => {
  const status = toEnum(req.body.status, KYC_STATUSES);
  if (!status) return res.status(400).json({ error: 'status must be one of: pending, approved, rejected' });

  const provider = await prisma.provider.findUnique({ where: { id: Number(req.params.id) } });
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  const rejectionReason = typeof req.body.rejection_reason === 'string' ? req.body.rejection_reason.trim() : '';
  if (status === 'REJECTED' && (rejectionReason.length < 3 || rejectionReason.length > 500)) return res.status(400).json({ error: 'rejection_reason must be 3-500 characters' });
  await prisma.provider.update({ where: { id: provider.id }, data: { kycStatus: status, kycRejectionReason: status === 'REJECTED' ? rejectionReason : null } });

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
  const [pendingProviders, activeSubscriptions, completedBookings, completedPayments, rating] = await Promise.all([
    prisma.provider.count({ where: { kycStatus: 'PENDING' } }),
    prisma.userSubscription.count({ where: { status: 'active', endDate: { gt: new Date() } } }),
    prisma.booking.count({ where: { status: 'COMPLETED' } }),
    prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { capturedAmount: true } }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: { rating: true } }),
  ]);
  // Aggregates over DECIMAL columns return Decimal objects (always truthy),
  // so the fallback chain must run on plain numbers.
  const capturedRevenue = Number(completedPayments._sum.capturedAmount ?? 0) || 0;
  const bookingRevenue = Number(agg._sum.totalPrice ?? 0) || 0;
  res.json({ totalUsers, totalProviders, pendingProviders, activeSubscriptions, totalBookings, completedBookings, totalRevenue: capturedRevenue || bookingRevenue, openComplaints, averageRating: rating._avg.rating || 0, ratingCount: rating._count.rating });
});

router.get('/users', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const role = String(req.query.role || '').toUpperCase();
  const users = await prisma.user.findMany({
    where: { ...(role && ['CUSTOMER', 'PROVIDER', 'ADMIN'].includes(role) ? { role } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}) },
    select: { id: true, name: true, email: true, phone: true, town: true, role: true, active: true, createdAt: true, provider: { select: { id: true, category: true, kycStatus: true } }, subscriptions: { where: { status: 'active', endDate: { gt: new Date() } }, select: { id: true, plan: { select: { title: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

router.put('/users/:id', async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (!id || typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'A valid user id and boolean active value are required' });
  if (id === req.user.id && !req.body.active) return res.status(400).json({ error: 'You cannot deactivate your own account' });
  const user = await prisma.user.update({ where: { id }, data: { active: req.body.active }, select: { id: true, active: true } });
  res.json(user);
});

router.get('/providers/:id', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { id: toPositiveInt(req.params.id) || 0 }, include: { user: { select: { id: true, name: true, email: true, phone: true, town: true, active: true } }, kycDocuments: { select: { id: true, documentType: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } }, reviews: { select: { rating: true } } } });
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  const averageRating = provider.reviews.length ? provider.reviews.reduce((sum, item) => sum + item.rating, 0) / provider.reviews.length : null;
  res.json({ ...provider, averageRating, service_towns: townsList(provider.serviceTowns), documents: provider.kycDocuments.map((document) => ({ ...document, url: `/api/uploads/kyc/${document.id}` })) });
});

router.get('/subscriptions', async (_req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({ include: { entitlements: { include: { category: true } }, _count: { select: { userSubscriptions: true } } }, orderBy: { id: 'desc' } });
  res.json(plans.map((plan) => ({ ...plan, type: normalizePackageType(plan.type) || plan.type })));
});

router.post('/subscriptions', async (req, res) => {
  const { title, type, price_monthly, description = '', recommended = false, features = [], duration_days = 30, entitlements = [] } = req.body;
  const normalizedType = normalizePackageType(type);
  if (typeof title !== 'string' || !title.trim() || !normalizedType || !Number.isFinite(Number(price_monthly)) || Number(price_monthly) <= 0 || Number(duration_days) !== 30) return res.status(400).json({ error: 'title, type, a positive price_monthly, and a 30-day duration are required' });
  if (!Array.isArray(features) || !Array.isArray(entitlements)) return res.status(400).json({ error: 'features and entitlements must be arrays' });
  const normalized = entitlements.map((item) => ({ categoryId: toPositiveInt(item.category_id), units: Number(item.units) }));
  if (!normalized.length || normalized.some((item) => !item.categoryId || !Number.isInteger(item.units) || item.units < 1)) return res.status(400).json({ error: 'A package requires at least one category entitlement with one or more units' });
  if (typeof recommended !== 'boolean') return res.status(400).json({ error: 'recommended must be a boolean' });
  const plan = await prisma.subscriptionPlan.create({ data: { title: title.trim(), type: normalizedType, priceMonthly: Number(price_monthly), durationDays: 30, description: String(description).slice(0, 1000), recommended, features: JSON.stringify(features), entitlements: { create: normalized } }, include: { entitlements: true } });
  res.status(201).json(plan);
});

router.put('/subscriptions/:id', async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid plan id' });
  const data = {};
  if (req.body.title !== undefined) data.title = String(req.body.title).trim();
  if (req.body.description !== undefined) data.description = String(req.body.description).slice(0, 1000);
  if (req.body.price_monthly !== undefined) { if (!Number.isFinite(Number(req.body.price_monthly)) || Number(req.body.price_monthly) <= 0) return res.status(400).json({ error: 'price_monthly must be positive' }); data.priceMonthly = Number(req.body.price_monthly); }
  if (req.body.type !== undefined) { const type = normalizePackageType(req.body.type); if (!type) return res.status(400).json({ error: 'type must be Single Package or Combo Package' }); data.type = type; }
  if (req.body.duration_days !== undefined && Number(req.body.duration_days) !== 30) return res.status(400).json({ error: 'Packages always run for 30 days' });
  if (typeof req.body.active === 'boolean') data.active = req.body.active;
  if (req.body.recommended !== undefined) { if (typeof req.body.recommended !== 'boolean') return res.status(400).json({ error: 'recommended must be a boolean' }); data.recommended = req.body.recommended; }
  if (req.body.features !== undefined) { if (!Array.isArray(req.body.features)) return res.status(400).json({ error: 'features must be an array' }); data.features = JSON.stringify(req.body.features); }
  const updated = await prisma.subscriptionPlan.update({ where: { id }, data, include: { entitlements: true } });
  if (req.body.entitlements) {
    if (!Array.isArray(req.body.entitlements)) return res.status(400).json({ error: 'entitlements must be an array' });
    await prisma.$transaction([prisma.subscriptionEntitlement.deleteMany({ where: { planId: id } }), prisma.subscriptionEntitlement.createMany({ data: req.body.entitlements.map((item) => ({ planId: id, categoryId: toPositiveInt(item.category_id), units: Number(item.units) })) })]);
  }
  res.json(updated);
});

router.get('/reports', async (req, res) => {
  const from = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : new Date(Date.now() - 30 * 86400000);
  const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return res.status(400).json({ error: 'Use valid from/to dates' });
  const dateRange = { createdAt: { gte: from, lte: to } };
  const subscriptionDateRange = { startDate: { gte: from, lte: to } };
  const [customers, providers, bookings, completedBookings, payments, subscriptions, complaints, ratings, popularServices, providerPerformance] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER', ...dateRange } }),
    prisma.provider.count({ where: { user: { is: dateRange } } }),
    prisma.booking.count({ where: dateRange }),
    prisma.booking.count({ where: { ...dateRange, status: 'COMPLETED' } }),
    prisma.payment.aggregate({ where: { ...dateRange, status: 'COMPLETED' }, _sum: { capturedAmount: true }, _count: { id: true } }),
    prisma.userSubscription.count({ where: { ...subscriptionDateRange, status: 'active' } }),
    prisma.complaint.count({ where: dateRange }),
    prisma.review.aggregate({ where: dateRange, _avg: { rating: true }, _count: { rating: true } }),
    prisma.booking.groupBy({ by: ['serviceId'], where: dateRange, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
    prisma.booking.groupBy({ by: ['providerId'], where: { ...dateRange, status: 'COMPLETED', providerId: { not: null } }, _count: { id: true }, _sum: { totalPrice: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
  ]);
  const serviceIds = popularServices.map((item) => item.serviceId);
  const providerIds = providerPerformance.map((item) => item.providerId).filter(Boolean);
  const [services, providerRows] = await Promise.all([prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, title: true } }), prisma.provider.findMany({ where: { id: { in: providerIds } }, include: { user: { select: { name: true } } } })]);
  res.json({ from, to, summary: { customers, providers, bookings, completedBookings, revenue: Number(payments._sum.capturedAmount ?? 0) || 0, completedPayments: payments._count.id, activeSubscriptions: subscriptions, complaints, averageRating: ratings._avg.rating || 0, ratingCount: ratings._count.rating }, servicePopularity: popularServices.map((item) => ({ serviceId: item.serviceId, service: services.find((service) => service.id === item.serviceId)?.title || 'Unknown', bookings: item._count.id })), providerPerformance: providerPerformance.map((item) => ({ providerId: item.providerId, provider: providerRows.find((provider) => provider.id === item.providerId)?.user.name || 'Unknown', completedBookings: item._count.id, serviceValue: Number(item._sum.totalPrice ?? 0) || 0 })) });
});

router.get('/bookings', async (_req, res) => {
  const bookings = await prisma.booking.findMany({
    include: { service: { include: { category: true } }, user: { select: { id: true, name: true, email: true, phone: true, town: true, role: true, active: true } }, provider: { include: { user: { select: { id: true, name: true, email: true, phone: true, town: true, role: true, active: true } } } } },
    orderBy: { createdAt: 'desc' },
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
    startPinUsedAt: undefined,
    completionPinUsedAt: undefined,
    status: b.status.toLowerCase(),
    service_title: b.service?.title,
    category_name: b.service?.category?.name,
    customer_name: b.user?.name,
    customer_email: b.user?.email,
    provider_name: b.provider?.user?.name,
    total_price: b.totalPrice,
  })));
});

// Admin override booking status / reassign
router.put('/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status, provider_id } = req.body;

  const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  let nextStatus = undefined;
  if (status !== undefined && status !== null && status !== '') {
    nextStatus = toEnum(status, BOOKING_STATUSES);
    if (!nextStatus) return res.status(400).json({ error: `Invalid status. Allowed: ${BOOKING_STATUSES.map((s) => s.toLowerCase()).join(', ')}` });
    if (nextStatus !== booking.status && !(ADMIN_TRANSITIONS[booking.status] || []).includes(nextStatus)) return res.status(400).json({ error: `Cannot move booking from ${booking.status.toLowerCase()} to ${nextStatus.toLowerCase()}` });
  }

  let nextProviderId = undefined;
  if (provider_id !== undefined && provider_id !== null && provider_id !== '') {
    nextProviderId = toPositiveInt(provider_id);
    if (!nextProviderId) return res.status(400).json({ error: 'provider_id must be a positive integer' });
    const p = await prisma.provider.findUnique({ where: { id: nextProviderId } });
    if (!p) return res.status(400).json({ error: 'Invalid provider' });
    const service = await prisma.service.findUnique({ where: { id: booking.serviceId }, include: { category: true } });
    const eligibility = await providerCanTakeBooking(prisma, p, { ...booking, service }, { ignoreBookingId: booking.id });
    if (!eligibility.ok) return res.status(409).json({ error: eligibility.error });
  }

  if (nextProviderId && nextStatus === undefined && booking.status === 'PENDING') nextStatus = 'ASSIGNED';
  if (nextProviderId && nextStatus === 'CANCELLED') return res.status(400).json({ error: 'A cancelled booking cannot be assigned' });
  if (nextStatus === undefined && nextProviderId === undefined) return res.status(400).json({ error: 'status or provider_id is required' });
  if (nextStatus === 'COMPLETED' && !(nextProviderId ?? booking.providerId)) return res.status(400).json({ error: 'A provider is required before completing a booking' });

  // Pay out exactly once, only when transitioning INTO COMPLETED
  if (nextStatus === 'COMPLETED' && booking.status !== 'COMPLETED' && (nextProviderId ?? booking.providerId)) {
    const payout = booking.providerEarning;
    await prisma.provider.update({
      where: { id: nextProviderId ?? booking.providerId },
      data: { earnings: { increment: payout } },
    });
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: nextStatus, providerId: nextProviderId },
  });

  if (nextStatus && nextStatus !== booking.status) {
    await notify(booking.userId, `Your booking #${id} status is now ${nextStatus.toLowerCase()}.`);
  }
  if (nextProviderId && nextProviderId !== booking.providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: nextProviderId } });
    if (provider) await notify(provider.userId, `Booking #${id} has been assigned to you.`);
  }

  res.json({ message: `Booking #${id} updated` });
});

router.get('/complaints', async (_req, res) => {
  const complaints = await prisma.complaint.findMany({
    include: { user: { select: { id: true, name: true, email: true, phone: true, town: true, role: true, active: true } }, booking: { include: { service: true } } },
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

  const adminNote = req.body.admin_note === undefined ? undefined : String(req.body.admin_note).trim();
  if (adminNote !== undefined && adminNote.length > 2000) return res.status(400).json({ error: 'admin_note must be at most 2000 characters' });
  await prisma.complaint.update({ where: { id: complaint.id }, data: { status, adminNote } });
  if (status === 'RESOLVED') {
    await notify(complaint.userId, `Your complaint #${complaint.id} has been resolved.`);
  }
  res.json({ message: `Complaint updated to ${status.toLowerCase()}` });
});

router.get('/payouts', async (_req, res) => {
  const payouts = await prisma.providerPayout.findMany({
    include: { provider: { include: { user: { select: { name: true, email: true } } } }, bankAccount: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(payouts.map((payout) => ({
    id: payout.id,
    period: payout.period,
    amount: payout.amount,
    status: payout.status.toLowerCase(),
    paid_at: payout.paidAt,
    provider_name: payout.provider.user.name,
    provider_email: payout.provider.user.email,
    bank_name: payout.bankAccount.bankName,
    account_number: maskAccountNumber(payout.bankAccount.accountNumber),
  })));
});

router.post('/payouts/run', async (req, res) => {
  const period = typeof req.body.period === 'string' && /^\d{4}-\d{2}$/.test(req.body.period) ? req.body.period : undefined;
  const payouts = await queueMonthlyPayouts({ period });
  res.status(201).json({ queued: payouts.length, payouts });
});

router.put('/payouts/:id', async (req, res) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!['PAID', 'FAILED'].includes(status)) return res.status(400).json({ error: 'status must be paid or failed' });
  const payout = await prisma.providerPayout.findUnique({ where: { id: toPositiveInt(req.params.id) || 0 } });
  if (!payout || payout.status !== 'PENDING') return res.status(404).json({ error: 'Pending payout not found' });
  const updated = await prisma.providerPayout.update({ where: { id: payout.id }, data: { status, paidAt: status === 'PAID' ? new Date() : null } });
  res.json({ id: updated.id, status: updated.status.toLowerCase(), paid_at: updated.paidAt });
});

export default router;
