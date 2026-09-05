import { Router } from 'express';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { encryptAccountNumber, maskAccountNumber, hashAccountNumber } from '../services/bankingCrypto.js';
import { bookingStart, colomboNow, getPlatformSettings, pickProvider, providerCancellationPolicy, reassignOrUnassignProviderBookings, PROVIDER_CANCELLATION_NOTICE_HOURS } from '../services/scheduling.js';
import { notify } from '../services/notify.js';
import { broadcastBookingEvent } from '../services/realtime.js';
import { getSriLankaLocation, SRI_LANKA_TOWNS } from '../services/sriLankaLocations.js';
import { getSriLankanBank } from '../services/sriLankaBanks.js';

const router = Router();
router.use(authenticateToken, requireRole('PROVIDER'));
router.use(async (req, res, next) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id }, select: { kycStatus: true } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  if (provider.kycStatus !== 'APPROVED') return res.status(403).json({ error: 'Provider KYC approval is required for operational access' });
  next();
});

router.get('/availability', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id }, select: { availabilityStatus: true, serviceTowns: true, category: true } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const categories = provider.category.split(',').map((category) => category.trim()).filter(Boolean);
  res.json({ availability_status: provider.availabilityStatus, service_towns: provider.serviceTowns, category: categories[0] || '', categories });
});

router.put('/service-categories', async (req, res) => {
  if (!Array.isArray(req.body.categories)) return res.status(400).json({ error: 'categories must be an array' });
  const requested = req.body.categories.map((category) => typeof category === 'string' ? category.trim().replace(/\s+/g, ' ') : '').filter(Boolean);
  const uniqueRequested = [...new Map(requested.map((category) => [category.toLocaleLowerCase(), category])).values()];
  if (uniqueRequested.length === 0 || uniqueRequested.length > 3) return res.status(400).json({ error: 'Select between one and three service categories' });

  const knownCategories = await prisma.category.findMany({ where: { name: { in: uniqueRequested } }, select: { name: true } });
  if (knownCategories.length !== uniqueRequested.length) return res.status(400).json({ error: 'One or more service categories are invalid' });

  const canonicalByName = new Map(knownCategories.map((category) => [category.name.toLocaleLowerCase(), category.name]));
  const categories = uniqueRequested.map((category) => canonicalByName.get(category.toLocaleLowerCase()));
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id }, select: { id: true } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  await prisma.provider.update({ where: { id: provider.id }, data: { category: categories.join(', ') } });
  res.json({ category: categories[0], categories });
});

router.put('/service-towns', async (req, res) => {
  const towns = String(req.body.service_towns || '').split(',').map((town) => town.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const uniqueTowns = [...new Map(towns.map((town) => [town.toLocaleLowerCase(), town])).values()];
  if (uniqueTowns.length > 10 || uniqueTowns.some((town) => town.length > 100)) {
    return res.status(400).json({ error: 'service_towns may contain up to 10 towns, each at most 100 characters' });
  }
  const provinceByName = new Map([...new Set(SRI_LANKA_TOWNS.map((location) => location.province))].map((province) => [province.toLowerCase(), province]));
  const selectedAreas = uniqueTowns.map((area) => {
    if (area.toLowerCase().startsWith('province:')) {
      const province = provinceByName.get(area.slice('province:'.length).trim().toLowerCase());
      return province ? `province:${province}` : null;
    }
    return getSriLankaLocation(area)?.name || null;
  });
  if (selectedAreas.some((area) => !area)) return res.status(400).json({ error: 'Select service towns or provinces from the Sri Lanka location list' });
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const service_towns = selectedAreas.join(', ');
  await prisma.provider.update({ where: { id: provider.id }, data: { serviceTowns: service_towns } });
  res.json({ service_towns });
});

router.put('/availability', async (req, res) => {
  const { availability_status } = req.body;
  const normalized = String(availability_status || '').trim().toLowerCase();
  if (!['available', 'online', 'offline'].includes(normalized)) {
    return res.status(400).json({ error: 'Invalid availability status. Supported statuses are online and offline.' });
  }
  const targetStatus = (normalized === 'online' || normalized === 'available') ? 'available' : 'offline';
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });

  if (targetStatus === 'offline') {
    const activeBookings = await prisma.booking.findMany({
      where: { providerId: provider.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
      include: { service: { select: { title: true } } },
    });
    if (activeBookings.some((booking) => booking.status === 'IN_PROGRESS')) {
      return res.status(400).json({ error: 'Cannot go offline while a service is currently in progress. Please complete the active service first.' });
    }
    // V1 notice anchor is 4 hours (same as provider cancellation): nearer
    // ASSIGNED bookings stay with this provider and are never stripped.
    const wallNow = colomboNow(new Date());
    const nearBooking = activeBookings.find((booking) => {
      const start = bookingStart(booking.bookingDate, booking.bookingTime);
      return start && (start.getTime() - wallNow.getTime()) / 3600000 < PROVIDER_CANCELLATION_NOTICE_HOURS;
    });
    if (nearBooking) {
      return res.status(400).json({ error: `Cannot go offline: you have an assigned booking (#${nearBooking.id} for ${nearBooking.service?.title || 'Service'}) scheduled within 4 hours (${nearBooking.bookingDate} at ${nearBooking.bookingTime}). Please complete this booking, or cancel it from its details if at least four hours remain.` });
    }
  }

  await prisma.provider.update({ where: { id: provider.id }, data: { availabilityStatus: targetStatus } });
  if (targetStatus === 'offline') await reassignOrUnassignProviderBookings(prisma, provider.id, notify, { preserveNearTerm: true }).catch(() => {});
  res.json({ message: `Availability set to ${targetStatus}`, availability_status: targetStatus });
});

// A provider may cancel only an assigned future booking with at least four
// hours notice. The same transaction attempts a replacement assignment first.
// A cancelled booking no longer consumes an entitlement, so the customer's
// token becomes available again through the persisted entitlement calculation.
router.post('/bookings/:id/cancel', async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId < 1) return res.status(400).json({ error: 'Valid booking ID is required.' });

  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id }, select: { id: true, userId: true } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found.' });
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(bookingId)})`;
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, providerId: provider.id, status: 'ASSIGNED' },
      include: { service: { include: { category: true } } },
    });
    if (!booking) return { status: 404, body: { error: 'Only an assigned upcoming booking can be cancelled.' } };

    const cancellationPolicy = providerCancellationPolicy(booking.bookingDate, booking.bookingTime);
    if (!cancellationPolicy.scheduledStart || cancellationPolicy.scheduledStart <= new Date()) {
      return { status: 409, body: { error: 'Only a future assigned booking can be cancelled.' } };
    }
    if (!cancellationPolicy.canCancel) {
      return { status: 409, body: { error: 'Bookings can only be cancelled when at least four hours remain before the scheduled start.' } };
    }

    const settings = await getPlatformSettings(tx);
    const replacement = await pickProvider(
      tx,
      booking.service.category?.name,
      booking.town,
      booking.addressDistrict,
      booking.bookingDate,
      booking.bookingTime,
      booking.service,
      settings,
      { ignoreAssignmentWindow: true },
    );

    if (replacement) {
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { providerId: replacement.id, status: 'ASSIGNED', cancellationReason: null },
        include: { service: { include: { category: true } } },
      });
      return { status: 200, body: { message: 'Booking cancelled and reassigned to another provider.', outcome: 'reassigned' }, booking: updatedBooking, replacement };
    }

    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        cancellationReason: 'Cancelled by provider at least four hours before the booking; no eligible replacement was available.',
      },
      include: { service: { include: { category: true } } },
    });
    return { status: 200, body: { message: 'Booking cancelled. The customer token has been restored because no replacement provider was available.', outcome: 'cancelled' }, booking: updatedBooking };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });

  if (outcome.status !== 200) return res.status(outcome.status).json(outcome.body);

  const serviceName = outcome.booking.service?.title || 'Service';
  if (outcome.body.outcome === 'reassigned') {
    await Promise.all([
      notify(provider.userId, `You cancelled booking #${bookingId}. It has been reassigned to another provider.`, '/provider-dashboard').catch(() => {}),
      notify(outcome.replacement.userId, `Booking #${bookingId} (${serviceName}) has been assigned to you.`, '/provider-dashboard').catch(() => {}),
      notify(outcome.booking.userId, `Your booking #${bookingId} has been reassigned to another provider.`, '/customer-dashboard').catch(() => {}),
    ]);
    broadcastBookingEvent('BOOKING_ASSIGNED', {
      id: outcome.booking.id,
      bookingId: outcome.booking.id,
      userId: outcome.booking.userId,
      providerId: outcome.replacement.id,
      providerUserId: outcome.replacement.userId,
      providerName: outcome.replacement.user?.name,
      providerPhone: outcome.replacement.user?.phone,
      status: 'assigned',
      bookingDate: outcome.booking.bookingDate,
      bookingTime: outcome.booking.bookingTime,
      serviceTitle: serviceName,
      categoryName: outcome.booking.service?.category?.name,
      petType: outcome.booking.petType,
    });
  } else {
    await Promise.all([
      notify(provider.userId, `You cancelled booking #${bookingId}. No eligible replacement was available.`, '/provider-dashboard').catch(() => {}),
      notify(outcome.booking.userId, `Booking #${bookingId} was cancelled because no replacement provider was available. Your token has been restored.`, '/customer-dashboard').catch(() => {}),
    ]);
    broadcastBookingEvent('BOOKING_CANCELLED', {
      id: outcome.booking.id,
      bookingId: outcome.booking.id,
      userId: outcome.booking.userId,
      providerId: provider.id,
      providerUserId: provider.userId,
      reason: outcome.booking.cancellationReason,
      status: 'cancelled',
    });
  }

  res.json(outcome.body);
});

router.get('/earnings', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const completedJobs = await prisma.booking.count({ where: { providerId: provider.id, status: 'COMPLETED' } });
  const history = await prisma.booking.findMany({
    where: { providerId: provider.id, status: 'COMPLETED' },
    include: {
      service: { include: { category: true } },
      user: { select: { name: true, phone: true } },
      payments: { where: { status: 'COMPLETED' }, select: { status: true } },
      review: { select: { rating: true, comment: true, createdAt: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 50,
  });
  const [bankAccounts, payouts, categories, overallEarnings, redeemedPayouts, ratingSummary] = await Promise.all([
    prisma.providerBankAccount.findMany({ where: { providerId: provider.id }, orderBy: [{ selected: 'desc' }, { id: 'desc' }] }),
    prisma.providerPayout.findMany({ where: { providerId: provider.id }, include: { bankAccount: true }, orderBy: { createdAt: 'desc' }, take: 24 }),
    prisma.category.findMany({
      where: { name: { in: ['Auto Care', 'Garden Care', 'Pet Care'] } },
      include: { services: { select: { providerEarning: true } } },
    }),
    prisma.booking.aggregate({ where: { providerId: provider.id, status: 'COMPLETED' }, _sum: { providerEarning: true } }),
    prisma.providerPayout.aggregate({ where: { providerId: provider.id, status: 'PAID' }, _sum: { amount: true } }),
    prisma.review.aggregate({ where: { providerId: provider.id }, _avg: { rating: true }, _count: { rating: true } }),
  ]);
  const sessionPayouts = ['Auto Care', 'Garden Care', 'Pet Care'].map((categoryName) => {
    const payoutsForCategory = categories.find((category) => category.name === categoryName)?.services.map((service) => Number(service.providerEarning)) || [];
    const uniqueAmounts = [...new Set(payoutsForCategory)];
    return {
      category_name: categoryName,
      provider_earning: uniqueAmounts.length === 1 ? uniqueAmounts[0] : null,
    };
  });
  res.json({
    earnings: provider.earnings,
    overall_earnings: overallEarnings._sum.providerEarning || 0,
    redeemed: redeemedPayouts._sum.amount || 0,
    balance: provider.earnings,
    minimum_redemption_amount: 5000,
    completedJobs,
    average_rating: ratingSummary._avg.rating || 0,
    rating_count: ratingSummary._count.rating,
    history: history.map((h) => ({
      id: h.id, booking_date: h.bookingDate, booking_time: h.bookingTime, completed_at: h.updatedAt,
      service_title: h.service?.title, category_name: h.service?.category?.name, customer_name: h.user?.name, customer_phone: h.user?.phone || '', total_price: h.totalPrice, job_earnings: h.status === 'COMPLETED' ? h.providerEarning : 0, payment_status: h.payments[0]?.status?.toLowerCase() || 'not_applicable', status: h.status.toLowerCase(),
      rating: h.review?.rating || null,
      review_comment: h.review?.comment || null,
      reviewed_at: h.review?.createdAt || null,
    })),
    bank_accounts: bankAccounts.map((account) => ({ id: account.id, bank_name: account.bankName, account_holder: account.accountHolder, account_number: maskAccountNumber(account.accountNumber), branch: account.branch, selected: account.selected })),
    payouts: payouts.map((payout) => ({
      id: payout.id,
      period: payout.period,
      kind: payout.kind.toLowerCase(),
      amount: payout.amount,
      status: payout.status.toLowerCase(),
      paid_at: payout.paidAt,
      created_at: payout.createdAt,
      bank_name: payout.bankNameSnapshot || payout.bankAccount.bankName,
      account_holder: payout.accountHolderSnapshot || payout.bankAccount.accountHolder,
      account_number: maskAccountNumber(payout.accountNumberSnapshot || payout.bankAccount.accountNumber),
      branch: payout.branchSnapshot || payout.bankAccount.branch,
    })),
    session_payouts: sessionPayouts,
  });
});

router.post('/bank-accounts', async (req, res) => {
  const bankName = getSriLankanBank(req.body.bank_name);
  const accountHolder = String(req.body.account_holder || '').trim();
  const accountNumber = String(req.body.account_number || '').replace(/\s+/g, '');
  const branch = String(req.body.branch || '').trim().replace(/\s+/g, ' ');
  if (!bankName || !accountHolder || accountHolder.length > 100 || !/^[0-9A-Za-z-]{4,40}$/.test(accountNumber) || !branch || branch.length > 100) {
    return res.status(400).json({ error: 'Select a supported bank and provide a valid account holder, account number, and branch' });
  }
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });

  const encryptedNumber = encryptAccountNumber(accountNumber);
  const mask = maskAccountNumber(accountNumber);
  const accountHash = hashAccountNumber(accountNumber);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(provider.id)})`;
    const existing = await tx.providerBankAccount.findFirst({ where: { providerId: provider.id }, orderBy: [{ selected: 'desc' }, { id: 'asc' }] });
    await tx.providerBankAccount.updateMany({ where: { providerId: provider.id }, data: { selected: false } });
    if (existing) {
      const account = await tx.providerBankAccount.update({
        where: { id: existing.id },
        data: { bankName, accountHolder, accountNumber: encryptedNumber, accountMask: mask, accountHash, branch, selected: true },
      });
      return { account, created: false };
    }
    const account = await tx.providerBankAccount.create({
      data: { providerId: provider.id, bankName, accountHolder, accountNumber: encryptedNumber, accountMask: mask, accountHash, branch, selected: true },
    });
    return { account, created: true };
  }, { isolationLevel: 'Serializable' });

  res.status(result.created ? 201 : 200).json({ id: result.account.id, bank_name: result.account.bankName, account_holder: result.account.accountHolder, account_number: maskAccountNumber(result.account.accountNumber), branch: result.account.branch, selected: true });
});

router.post('/payouts/redeem', async (req, res) => {
  const rawAmount = String(req.body.amount ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(rawAmount)) {
    return res.status(400).json({ error: 'Redemption amount must be at least LKR 5,000 with no more than two decimal places' });
  }
  const requestedAmount = new Prisma.Decimal(rawAmount);
  if (requestedAmount.lt(5000)) return res.status(400).json({ error: 'Redemption amount must be at least LKR 5,000' });
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id }, select: { id: true } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });

  let payout;
  try {
    payout = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(provider.id)})`;
      const fresh = await tx.provider.findUnique({ where: { id: provider.id }, include: { bankAccounts: { where: { selected: true }, take: 1 } } });
      const bankAccount = fresh?.bankAccounts[0];
      if (!bankAccount) { const error = new Error('Add your bank account before requesting a redemption'); error.statusCode = 400; throw error; }
      if (new Prisma.Decimal(fresh.earnings || 0).lt(requestedAmount)) { const error = new Error('Redemption amount exceeds your available balance'); error.statusCode = 400; throw error; }
      await tx.provider.update({ where: { id: provider.id }, data: { earnings: { decrement: requestedAmount } } });
      return tx.providerPayout.create({
        data: {
          providerId: provider.id,
          bankAccountId: bankAccount.id,
          period: `redeem-${Date.now()}-${crypto.randomUUID()}`,
          amount: requestedAmount,
          kind: 'REDEMPTION',
          idempotencyKey: `redemption-${provider.id}-${crypto.randomUUID()}`,
          bankNameSnapshot: bankAccount.bankName,
          accountHolderSnapshot: bankAccount.accountHolder,
          accountNumberSnapshot: bankAccount.accountNumber,
          branchSnapshot: bankAccount.branch,
        },
      });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === 'P2034') return res.status(409).json({ error: 'Your balance changed while the request was submitted. Please try again.' });
    throw error;
  }
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
  await Promise.all(admins.map((admin) => notify(admin.id, `New provider redemption request #${payout.id} for LKR ${requestedAmount.toFixed(2)}.`, '/admin-dashboard')));
  res.status(201).json({ id: payout.id, amount: payout.amount, status: 'pending', message: 'Redemption request sent to the admin.' });
});

router.put('/bank-accounts/:id/select', async (req, res) => {
  const accountId = Number(req.params.id);
  if (!Number.isInteger(accountId) || accountId <= 0) return res.status(400).json({ error: 'Invalid bank account ID' });
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const updatedAccount = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(provider.id)})`;
        const account = await tx.providerBankAccount.findFirst({ where: { id: accountId, providerId: provider.id } });
        if (!account) return null;
        await tx.providerBankAccount.updateMany({ where: { providerId: provider.id }, data: { selected: false } });
        return tx.providerBankAccount.update({ where: { id: account.id }, data: { selected: true } });
      }, { isolationLevel: 'Serializable' });

      if (!updatedAccount) return res.status(404).json({ error: 'Bank account not found' });
      return res.json({ message: 'Bank account selected', id: updatedAccount.id });
    } catch (err) {
      const isConflict = err.code === 'P2034' || err.message?.includes('write conflict') || err.message?.includes('could not serialize access');
      if (isConflict && attempt < 3) {
        await new Promise((r) => setTimeout(r, 50 * attempt));
        continue;
      }
      throw err;
    }
  }
});

export default router;
