import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { notify, logAdminAction } from '../services/notify.js';
import { sendEmail, escapeHtml } from '../services/integrations.js';
import { toEnum, toPositiveInt, BOOKING_STATUSES, KYC_STATUSES, COMPLAINT_STATUSES } from '../middleware/validators.js';
import { getPlatformSettings, providerCanTakeBooking, reassignOrUnassignProviderBookings } from '../services/scheduling.js';
import { maskAccountNumber, queueMonthlyPayouts } from '../services/payouts.js';
import { processExpiredBookings } from '../services/bookingTimeouts.js';

const router = Router();
router.use(authenticateToken, requireRole('ADMIN'));

// providers.serviceTowns is persisted as a comma-separated string; the admin UI
// renders town lists as arrays, so every admin response serializes it explicitly.
const townsList = (value) => String(value || '').split(',').map((town) => town.trim()).filter(Boolean);
const planFeatures = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const normalizePlanFeatures = (features) => features
  .map((feature) => String(feature || '').trim())
  .filter(Boolean)
  .slice(0, 20)
  .map((feature) => feature.slice(0, 160));
const normalizePackageType = (value, entitlements = []) => {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'auto care' || type === 'auto') return 'Auto Care';
  if (type === 'garden care' || type === 'garden') return 'Garden Care';
  if (type === 'pet care' || type === 'pet') return 'Pet Care';
  if (type === 'combo' || type === 'combo package') return 'Combo Package';
  if (type === 'single' || type === 'single package') {
    const categoryName = entitlements[0]?.category?.name || entitlements[0]?.category_name;
    return ['Auto Care', 'Garden Care', 'Pet Care'].includes(categoryName) ? categoryName : 'Auto Care';
  }
  return null;
};

const CATEGORY_BY_PACKAGE_TYPE = {
  'Auto Care': 'Auto Care',
  'Garden Care': 'Garden Care',
  'Pet Care': 'Pet Care',
};

async function validatePackageEntitlements(client, packageType, entitlements) {
  if (!Array.isArray(entitlements) || !entitlements.length) {
    return 'A package requires at least one category entitlement with one or more units';
  }
  const normalized = entitlements.map((item) => ({ categoryId: toPositiveInt(item.category_id), units: Number(item.units) }));
  if (normalized.some((item) => !item.categoryId || !Number.isInteger(item.units) || item.units < 1)) {
    return 'Each entitlement needs a valid category and one or more units';
  }
  if (new Set(normalized.map((item) => item.categoryId)).size !== normalized.length) {
    return 'A category can only appear once in a package';
  }
  const singleCategoryName = CATEGORY_BY_PACKAGE_TYPE[packageType];
  if (!singleCategoryName) {
    return normalized.length >= 2 ? null : 'Combo Package must include at least two care categories';
  }
  if (normalized.length !== 1) return `${packageType} packages must include that category only`;
  const category = await client.category.findUnique({ where: { id: normalized[0].categoryId }, select: { name: true } });
  return category?.name === singleCategoryName ? null : `${packageType} packages must include that category only`;
}
// Admins can assign, unassign, or cancel operational work, but cannot bypass
// the provider's photo + PIN verification stages. Cancelled bookings are terminal.
const ADMIN_TRANSITIONS = { PENDING: ['ASSIGNED', 'CANCELLED'], ASSIGNED: ['PENDING', 'CANCELLED'], IN_PROGRESS: ['CANCELLED'], CANCELLED: [], COMPLETED: [] };

router.get('/settings/scheduling', async (_req, res) => res.json(await getPlatformSettings(prisma)));
router.put('/settings/scheduling', async (req, res) => {
  const cooldown = Number(req.body.auto_assignment_cooldown_hours ?? req.body.autoAssignmentCooldownHours);
  const start = Number(req.body.auto_assignment_start_hour ?? req.body.autoAssignmentStartHour);
  const end = Number(req.body.auto_assignment_end_hour ?? req.body.autoAssignmentEndHour);
  if (!Number.isInteger(cooldown) || cooldown < 1 || cooldown > 24 || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 23 || start > end) return res.status(400).json({ error: 'Use cooldown 1-24 hours and valid start/end hours (0-23)' });
  const setting = await prisma.platformSetting.upsert({ where: { id: 1 }, create: { id: 1, autoAssignmentCooldownHours: cooldown, autoAssignmentStartHour: start, autoAssignmentEndHour: end }, update: { autoAssignmentCooldownHours: cooldown, autoAssignmentStartHour: start, autoAssignmentEndHour: end } });
  logAdminAction({ adminId: req.user.id, action: 'UPDATE_SCHEDULING_SETTINGS', targetType: 'PlatformSetting', targetId: '1', details: { cooldown, start, end }, ipAddress: req.ip }).catch(() => {});
  res.json(setting);
});
router.post('/settings/scheduling/restore-defaults', async (req, res) => {
  const setting = await prisma.platformSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: { autoAssignmentCooldownHours: 6, autoAssignmentStartHour: 7, autoAssignmentEndHour: 16 } });
  logAdminAction({ adminId: req.user.id, action: 'RESTORE_SCHEDULING_DEFAULTS', targetType: 'PlatformSetting', targetId: '1', ipAddress: req.ip }).catch(() => {});
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

  const provider = await prisma.provider.findUnique({
    where: { id: Number(req.params.id) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  const rejectionReason = typeof req.body.rejection_reason === 'string' ? req.body.rejection_reason.trim() : '';
  if (status === 'REJECTED' && (rejectionReason.length < 3 || rejectionReason.length > 500)) return res.status(400).json({ error: 'rejection_reason must be 3-500 characters' });
  
  const isStatusTransition = provider.kycStatus !== status;
  await prisma.provider.update({ where: { id: provider.id }, data: { kycStatus: status, kycRejectionReason: status === 'REJECTED' ? rejectionReason : null } });

  if (isStatusTransition) {
    if (status === 'APPROVED') {
      await notify(provider.userId, 'Your KYC has been approved. You can now receive bookings.', '/provider-dashboard');
      if (provider.user?.email) {
        sendEmail({
          to: provider.user.email,
          subject: 'Congratulations – Your Luxora Journey Begins!',
          html: `<p>Hi ${escapeHtml(provider.user.name || 'Provider')},</p><p>Congratulations! Your KYC documents have been reviewed and approved by the Luxora concierge team.</p><p>Your account is now fully active, and you are eligible to receive and fulfill customer service bookings.</p>`,
        }).catch((err) => console.warn('[email] KYC approval email failed:', err.message));
      }
    } else if (status === 'REJECTED') {
      await reassignOrUnassignProviderBookings(prisma, provider.id, notify);
      await notify(provider.userId, 'Your KYC has been rejected. Please contact support.', '/provider-dashboard');
      if (provider.user?.email) {
        sendEmail({
          to: provider.user.email,
          subject: 'Luxora KYC Verification Update',
          html: `<p>Hi ${escapeHtml(provider.user.name || 'Provider')},</p><p>Your KYC verification could not be approved at this time.</p><p><strong>Reason:</strong> ${escapeHtml(rejectionReason)}</p><p>Please review your submitted documents or reach out to support for assistance.</p>`,
        }).catch((err) => console.warn('[email] KYC rejection email failed:', err.message));
      }
    }
  }

  logAdminAction({ adminId: req.user.id, action: `KYC_${status}`, targetType: 'Provider', targetId: String(provider.id), details: { status, rejectionReason }, ipAddress: req.ip }).catch(() => {});

  res.json({ message: `Provider KYC updated to ${status.toLowerCase()}`, status: status.toLowerCase() });
});

router.get('/stats', async (_req, res) => {
  const totalUsers = await prisma.user.count({ where: { role: 'CUSTOMER' } });
  const totalProviders = await prisma.provider.count({ where: { kycStatus: 'APPROVED' } });
  const totalBookings = await prisma.booking.count();
  const openComplaints = await prisma.complaint.count({ where: { status: { not: 'RESOLVED' } } });
  const [pendingProviders, activeSubscriptions, completedBookings, completedPayments, rating] = await Promise.all([
    prisma.provider.count({ where: { kycStatus: 'PENDING' } }),
    prisma.userSubscription.count({ where: { status: 'active', endDate: { gt: new Date() } } }),
    prisma.booking.count({ where: { status: 'COMPLETED' } }),
    prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { expectedAmount: true } }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: { rating: true } }),
  ]);
  // Aggregates over DECIMAL columns return Decimal objects (always truthy),
  // so the fallback chain must run on plain numbers.
  // expectedAmount is the verified LKR plan price for every gateway. Summing
  // capturedAmount would mix LKR PayHere rows with USD NOWPayments rows.
  const settledRevenueLkr = Number(completedPayments._sum.expectedAmount ?? 0) || 0;
  res.json({ totalUsers, totalProviders, pendingProviders, activeSubscriptions, totalBookings, completedBookings, totalRevenue: settledRevenueLkr, revenueCurrency: 'LKR', openComplaints, averageRating: rating._avg.rating || 0, ratingCount: rating._count.rating });
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
  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) return res.status(404).json({ error: 'User not found' });

  const user = await prisma.user.update({ where: { id }, data: { active: req.body.active }, select: { id: true, role: true, active: true } });

  if (user.role === 'CUSTOMER' && req.body.active === false) {
    const activeBookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] },
      },
      include: { service: true },
    });
    for (const b of activeBookings) {
      await prisma.booking.update({
        where: { id: b.id },
        data: { status: 'CANCELLED', cancellationReason: 'Customer account was deactivated' },
      });
      await notify(user.id, `Your active booking #${b.id} was cancelled because your account was deactivated.`, '/customer-dashboard').catch(() => {});
      if (b.providerId) {
        const prov = await prisma.provider.findUnique({ where: { id: b.providerId } });
        if (prov) {
          await notify(prov.userId, `Booking #${b.id} was cancelled because customer account was deactivated.`, '/provider-dashboard').catch(() => {});
        }
      }
    }
  } else if (user.role === 'PROVIDER' && req.body.active === false) {
    const prov = await prisma.provider.findUnique({ where: { userId: user.id } });
    if (prov) {
      await reassignOrUnassignProviderBookings(prisma, prov.id, notify);
    }
  }

  logAdminAction({ adminId: req.user.id, action: req.body.active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', targetType: 'User', targetId: String(id), ipAddress: req.ip }).catch(() => {});
  res.json(user);
});

router.get('/providers/:id', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { id: toPositiveInt(req.params.id) || 0 }, include: { user: { select: { id: true, name: true, email: true, phone: true, town: true, active: true } }, kycDocuments: { select: { id: true, documentType: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } }, reviews: { select: { rating: true } } } });
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  const averageRating = provider.reviews.length ? provider.reviews.reduce((sum, item) => sum + item.rating, 0) / provider.reviews.length : null;
  res.json({ ...provider, averageRating, service_towns: townsList(provider.serviceTowns), documents: provider.kycDocuments.map((document) => ({ ...document, url: `/api/uploads/kyc/${document.id}` })) });
});

router.get('/subscriptions', async (_req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    include: {
      entitlements: { include: { category: true } },
      _count: { select: { userSubscriptions: true } },
    },
    orderBy: [
      { type: 'asc' },
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
  });
  res.json(plans.map((plan) => ({
    ...plan,
    displayOrder: plan.displayOrder,
    type: normalizePackageType(plan.type, plan.entitlements) || plan.type,
    features: planFeatures(plan.features),
  })));
});

router.post('/subscriptions', async (req, res) => {
  const { title, type, price_monthly, description = '', recommended = false, features = [], duration_days = 30, entitlements = [], display_order, displayOrder } = req.body;
  const normalizedType = normalizePackageType(type);
  if (typeof title !== 'string' || !title.trim() || !normalizedType || !Number.isFinite(Number(price_monthly)) || Number(price_monthly) <= 0 || Number(duration_days) !== 30) return res.status(400).json({ error: 'title, type, a positive price_monthly, and a 30-day duration are required' });
  if (!Array.isArray(features) || !Array.isArray(entitlements)) return res.status(400).json({ error: 'features and entitlements must be arrays' });
  const entitlementError = await validatePackageEntitlements(prisma, normalizedType, entitlements);
  if (entitlementError) return res.status(400).json({ error: entitlementError });
  const normalized = entitlements.map((item) => ({ categoryId: toPositiveInt(item.category_id), units: Number(item.units) }));
  if (typeof recommended !== 'boolean') return res.status(400).json({ error: 'recommended must be a boolean' });
  const orderVal = Number(display_order ?? displayOrder);
  const normalizedOrder = Number.isInteger(orderVal) && orderVal >= 0 ? orderVal : 0;
  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: title.trim(),
      type: normalizedType,
      priceMonthly: Number(price_monthly),
      durationDays: 30,
      description: String(description).slice(0, 1000),
      recommended,
      features: JSON.stringify(normalizePlanFeatures(features)),
      displayOrder: normalizedOrder,
      entitlements: { create: normalized },
    },
    include: { entitlements: true },
  });
  logAdminAction({ adminId: req.user.id, action: 'CREATE_PLAN', targetType: 'SubscriptionPlan', targetId: String(plan.id), details: { title: plan.title, type: plan.type, priceMonthly: plan.priceMonthly, displayOrder: plan.displayOrder }, ipAddress: req.ip }).catch(() => {});
  res.status(201).json(plan);
});

router.put('/subscriptions/:id', async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid plan id' });
  const data = {};
  if (req.body.title !== undefined) data.title = String(req.body.title).trim();
  if (req.body.description !== undefined) data.description = String(req.body.description).slice(0, 1000);
  if (req.body.price_monthly !== undefined) { if (!Number.isFinite(Number(req.body.price_monthly)) || Number(req.body.price_monthly) <= 0) return res.status(400).json({ error: 'price_monthly must be positive' }); data.priceMonthly = Number(req.body.price_monthly); }
  if (req.body.type !== undefined) { const type = normalizePackageType(req.body.type); if (!type) return res.status(400).json({ error: 'type must be Auto Care, Garden Care, Pet Care, or Combo Package' }); data.type = type; }
  if (req.body.duration_days !== undefined && Number(req.body.duration_days) !== 30) return res.status(400).json({ error: 'Packages always run for 30 days' });
  if (typeof req.body.active === 'boolean') data.active = req.body.active;
  if (req.body.recommended !== undefined) { if (typeof req.body.recommended !== 'boolean') return res.status(400).json({ error: 'recommended must be a boolean' }); data.recommended = req.body.recommended; }
  if (req.body.features !== undefined) { if (!Array.isArray(req.body.features)) return res.status(400).json({ error: 'features must be an array' }); data.features = JSON.stringify(normalizePlanFeatures(req.body.features)); }
  if (req.body.display_order !== undefined || req.body.displayOrder !== undefined) {
    const orderVal = Number(req.body.display_order ?? req.body.displayOrder);
    if (!Number.isInteger(orderVal) || orderVal < 0) return res.status(400).json({ error: 'display_order must be a non-negative integer' });
    data.displayOrder = orderVal;
  }
  const current = await prisma.subscriptionPlan.findUnique({ where: { id }, include: { entitlements: { include: { category: true } } } });
  if (!current) return res.status(404).json({ error: 'Package not found' });
  const nextType = data.type || normalizePackageType(current.type, current.entitlements);
  const nextEntitlements = req.body.entitlements === undefined
    ? current.entitlements.map((item) => ({ category_id: item.categoryId, units: item.units }))
    : req.body.entitlements;
  if (req.body.entitlements !== undefined) {
    if (!Array.isArray(req.body.entitlements)) return res.status(400).json({ error: 'entitlements must be an array' });
  }
  const entitlementError = await validatePackageEntitlements(prisma, nextType, nextEntitlements);
  if (entitlementError) return res.status(400).json({ error: entitlementError });
  const updated = await prisma.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlan.update({ where: { id }, data });
    if (req.body.entitlements !== undefined) {
      await tx.subscriptionEntitlement.deleteMany({ where: { planId: id } });
      await tx.subscriptionEntitlement.createMany({ data: req.body.entitlements.map((item) => ({ planId: id, categoryId: toPositiveInt(item.category_id), units: Number(item.units) })) });
    }
    return tx.subscriptionPlan.findUnique({ where: { id: plan.id }, include: { entitlements: true } });
  });
  logAdminAction({ adminId: req.user.id, action: 'UPDATE_PLAN', targetType: 'SubscriptionPlan', targetId: String(id), details: { changes: data }, ipAddress: req.ip }).catch(() => {});
  res.json(updated);
});

// Historical purchases must remain referentially intact. A package may only
// be removed when it has never been purchased or used as a payment target.
// Packages with history can be disabled through the existing update endpoint.
router.delete('/subscriptions/:id', async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid package id' });
  try {
    await prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id },
        select: { id: true, title: true, _count: { select: { userSubscriptions: true, payments: true } } },
      });
      if (!plan) {
        const error = new Error('Package not found');
        error.statusCode = 404;
        throw error;
      }
      if (plan._count.userSubscriptions || plan._count.payments) {
        const error = new Error('This package has purchase history and cannot be removed. Disable it instead.');
        error.statusCode = 409;
        throw error;
      }
      await tx.subscriptionPlan.delete({ where: { id: plan.id } });
    }, { isolationLevel: 'Serializable' });
    logAdminAction({ adminId: req.user.id, action: 'DELETE_PLAN', targetType: 'SubscriptionPlan', targetId: String(id), ipAddress: req.ip }).catch(() => {});
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
  res.json({ message: 'Package removed' });
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
    prisma.payment.aggregate({ where: { ...dateRange, status: 'COMPLETED' }, _sum: { expectedAmount: true }, _count: { id: true } }),
    prisma.userSubscription.count({ where: { ...subscriptionDateRange, status: 'active' } }),
    prisma.complaint.count({ where: dateRange }),
    prisma.review.aggregate({ where: dateRange, _avg: { rating: true }, _count: { rating: true } }),
    prisma.booking.groupBy({ by: ['serviceId'], where: dateRange, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
    prisma.booking.groupBy({ by: ['providerId'], where: { ...dateRange, status: 'COMPLETED', providerId: { not: null } }, _count: { id: true }, _sum: { totalPrice: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
  ]);
  const serviceIds = popularServices.map((item) => item.serviceId);
  const providerIds = providerPerformance.map((item) => item.providerId).filter(Boolean);
  const [services, providerRows] = await Promise.all([prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, title: true } }), prisma.provider.findMany({ where: { id: { in: providerIds } }, include: { user: { select: { name: true } } } })]);
  res.json({ from, to, summary: { customers, providers, bookings, completedBookings, revenue: Number(payments._sum.expectedAmount ?? 0) || 0, revenueCurrency: 'LKR', completedPayments: payments._count.id, activeSubscriptions: subscriptions, complaints, averageRating: ratings._avg.rating || 0, ratingCount: ratings._count.rating }, servicePopularity: popularServices.map((item) => ({ serviceId: item.serviceId, service: services.find((service) => service.id === item.serviceId)?.title || 'Unknown', bookings: item._count.id })), providerPerformance: providerPerformance.map((item) => ({ providerId: item.providerId, provider: providerRows.find((provider) => provider.id === item.providerId)?.user.name || 'Unknown', completedBookings: item._count.id, serviceValue: Number(item._sum.totalPrice ?? 0) || 0 })) });
});

router.get('/bookings', async (_req, res) => {
  await processExpiredBookings(prisma).catch(() => {});
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
  if (booking.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot modify a cancelled booking' });

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

  // Atomic transition: re-read inside a Serializable transaction so
  // concurrent admin clicks cannot double-pay provider earnings.
  if (nextStatus === 'COMPLETED' && booking.status !== 'COMPLETED') {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(booking.id)})`;
      const fresh = await tx.booking.findUnique({ where: { id: booking.id } });
      if (!fresh || fresh.status === 'COMPLETED') return; // already completed
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'COMPLETED', providerId: nextProviderId ?? fresh.providerId },
      });
      const payoutProviderId = nextProviderId ?? fresh.providerId;
      if (payoutProviderId) {
        const payout = fresh.providerEarning;
        await tx.provider.update({
          where: { id: payoutProviderId },
          data: { earnings: { increment: payout } },
        });
      }
    }, { maxWait: 5000, timeout: 15000, isolationLevel: 'Serializable' });
  } else {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: nextStatus, providerId: nextProviderId },
    });
  }

  if (nextStatus && nextStatus !== booking.status) {
    await notify(booking.userId, `Your booking #${id} status is now ${nextStatus.toLowerCase()}.`);
    if (nextStatus === 'CANCELLED' && booking.providerId) {
      const assignedProvider = await prisma.provider.findUnique({ where: { id: booking.providerId } });
      if (assignedProvider) {
        await notify(assignedProvider.userId, `Booking #${id} was cancelled by administrator.`, '/provider-dashboard');
      }
    }
  }
  if (nextProviderId && nextProviderId !== booking.providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: nextProviderId } });
    if (provider) await notify(provider.userId, `Booking #${id} has been assigned to you.`);
  }

  logAdminAction({ adminId: req.user.id, action: 'OVERRIDE_BOOKING', targetType: 'Booking', targetId: String(id), details: { status: nextStatus, providerId: nextProviderId }, ipAddress: req.ip }).catch(() => {});

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
  logAdminAction({ adminId: req.user.id, action: `COMPLAINT_${status}`, targetType: 'Complaint', targetId: String(complaint.id), details: { status, adminNote }, ipAddress: req.ip }).catch(() => {});
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
  logAdminAction({ adminId: req.user.id, action: 'RUN_PAYOUTS', targetType: 'ProviderPayout', details: { period, queued: payouts.length }, ipAddress: req.ip }).catch(() => {});
  res.status(201).json({ queued: payouts.length, payouts });
});

router.put('/payouts/:id', async (req, res) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!['PAID', 'FAILED'].includes(status)) return res.status(400).json({ error: 'status must be paid or failed' });
  const payoutId = toPositiveInt(req.params.id);
  if (!payoutId) return res.status(400).json({ error: 'Valid payout id is required' });
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const payout = await tx.providerPayout.findUnique({ where: { id: payoutId } });
      if (!payout) return null;
      const changed = await tx.providerPayout.updateMany({
        where: { id: payout.id, status: 'PENDING' },
        data: { status, paidAt: status === 'PAID' ? new Date() : null },
      });
      if (changed.count !== 1) return null;
      // A queued payout already deducted provider.earnings. If the transfer
      // fails, restore the exact Decimal amount once so it can be queued later.
      if (status === 'FAILED') {
        await tx.provider.update({ where: { id: payout.providerId }, data: { earnings: { increment: payout.amount } } });
      }
      return tx.providerPayout.findUnique({ where: { id: payout.id } });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error.code === 'P2034') return res.status(409).json({ error: 'Payout decision is already being processed' });
    throw error;
  }
  if (!updated) return res.status(404).json({ error: 'Pending payout not found' });
  logAdminAction({ adminId: req.user.id, action: `PAYOUT_${status}`, targetType: 'ProviderPayout', targetId: String(updated.id), details: { status }, ipAddress: req.ip }).catch(() => {});
  res.json({ id: updated.id, status: updated.status.toLowerCase(), paid_at: updated.paidAt });
});

router.get('/audit-logs', async (req, res) => {
  const take = Math.min(toPositiveInt(req.query.limit) || 100, 200);
  const logs = await prisma.adminAuditLog.findMany({
    include: { admin: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take,
  });
  res.json(logs);
});

export default router;
