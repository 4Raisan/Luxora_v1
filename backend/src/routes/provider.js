import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { encryptAccountNumber, decryptAccountNumber, maskAccountNumber, hashAccountNumber } from '../services/bankingCrypto.js';
import { notify } from '../services/notify.js';
import { reassignOrUnassignProviderBookings } from '../services/scheduling.js';

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
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const service_towns = uniqueTowns.join(', ');
  await prisma.provider.update({ where: { id: provider.id }, data: { serviceTowns: service_towns } });
  res.json({ service_towns });
});

router.put('/availability', async (req, res) => {
  const { availability_status } = req.body;
  let normalized = String(availability_status || '').toLowerCase().trim();
  if (normalized === 'online') normalized = 'available';

  if (!['available', 'offline'].includes(normalized)) {
    return res.status(400).json({ error: 'Invalid availability status. Supported statuses are online and offline.' });
  }

  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });

  if (normalized === 'offline') {
    const now = new Date();
    const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const activeOrNearBooking = await prisma.booking.findFirst({
      where: {
        providerId: provider.id,
        status: { in: ['IN_PROGRESS', 'ASSIGNED'] },
      },
      include: { service: true },
    });

    if (activeOrNearBooking) {
      if (activeOrNearBooking.status === 'IN_PROGRESS') {
        return res.status(400).json({
          error: 'Cannot go offline while a service is in progress. Please complete or report the active session first.',
        });
      }

      const [startHour = '0', startMin = '0'] = String(activeOrNearBooking.bookingTime || '00:00').split(':');
      const bookingStart = new Date(`${activeOrNearBooking.bookingDate}T00:00:00`);
      bookingStart.setHours(Number(startHour), Number(startMin), 0, 0);

      if (bookingStart.getTime() <= sixHoursLater.getTime()) {
        return res.status(400).json({
          error: 'Cannot go offline within 6 hours of an assigned job. Please complete your scheduled appointment or request cancellation review.',
        });
      }
    }

    await prisma.provider.update({ where: { id: provider.id }, data: { availabilityStatus: 'offline' } });
    await reassignOrUnassignProviderBookings(prisma, provider.id, notify);
    return res.json({ message: 'Availability set to offline. Future jobs have been reassigned.', availability_status: 'offline' });
  }

  await prisma.provider.update({ where: { id: provider.id }, data: { availabilityStatus: 'available' } });
  res.json({ message: 'Availability set to available', availability_status: 'available' });
});

// Providers may ask an admin to cancel an assigned job, but cannot cancel it
// directly. This preserves the booking owner and admin cancellation controls.
router.post('/bookings/:id/cancellation-request', async (req, res) => {
  const bookingId = Number(req.params.id);
  const reason = String(req.body.reason || '').trim();
  if (!Number.isInteger(bookingId) || bookingId < 1) return res.status(400).json({ error: 'Valid booking ID is required.' });
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'Cancellation reason must be 3 to 500 characters.' });

  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id }, include: { user: { select: { name: true } } } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found.' });
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, providerId: provider.id, status: 'ASSIGNED' }, include: { service: { include: { category: true } } } });
  if (!booking) return res.status(404).json({ error: 'Only an assigned upcoming booking can be submitted for cancellation review.' });

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
  const message = `Cancellation request for booking #${booking.id} (${booking.service?.category?.name || booking.service?.title || 'Service'}) from ${provider.user?.name || 'provider'}: ${reason}`;
  await Promise.all(admins.map((admin) => notify(admin.id, message, '/admin-dashboard')));
  res.status(201).json({ message: 'Cancellation request sent to the admin for review.' });
});

router.get('/earnings', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const completedJobs = await prisma.booking.count({ where: { providerId: provider.id, status: 'COMPLETED' } });
  const history = await prisma.booking.findMany({
    where: { providerId: provider.id },
    include: { service: true, user: { select: { name: true, phone: true } }, payments: { where: { status: 'COMPLETED' }, select: { status: true } } },
    orderBy: { bookingDate: 'desc' },
    take: 50,
  });
  const [bankAccounts, payouts, categories] = await Promise.all([
    prisma.providerBankAccount.findMany({ where: { providerId: provider.id }, orderBy: [{ selected: 'desc' }, { id: 'desc' }] }),
    prisma.providerPayout.findMany({ where: { providerId: provider.id }, include: { bankAccount: true }, orderBy: { createdAt: 'desc' }, take: 24 }),
    prisma.category.findMany({
      where: { name: { in: ['Auto Care', 'Garden Care', 'Pet Care'] } },
      include: { services: { select: { providerEarning: true } } },
    }),
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
    completedJobs,
    history: history.map((h) => ({
      id: h.id, booking_date: h.bookingDate, booking_time: h.bookingTime,
      service_title: h.service?.title, customer_name: h.user?.name, customer_phone: h.user?.phone || '', total_price: h.totalPrice, job_earnings: h.status === 'COMPLETED' ? h.providerEarning : 0, payment_status: h.payments[0]?.status?.toLowerCase() || 'not_applicable', status: h.status.toLowerCase(),
    })),
    bank_accounts: bankAccounts.map((account) => ({ id: account.id, bank_name: account.bankName, account_holder: account.accountHolder, account_number: maskAccountNumber(account.accountNumber), selected: account.selected })),
    payouts: payouts.map((payout) => ({ id: payout.id, period: payout.period, amount: payout.amount, status: payout.status.toLowerCase(), paid_at: payout.paidAt, bank_name: payout.bankAccount.bankName, account_number: maskAccountNumber(payout.bankAccount.accountNumber) })),
    session_payouts: sessionPayouts,
  });
});

router.post('/bank-accounts', async (req, res) => {
  const bankName = String(req.body.bank_name || '').trim();
  const accountHolder = String(req.body.account_holder || '').trim();
  const accountNumber = String(req.body.account_number || '').replace(/\s+/g, '');
  if (!bankName || !accountHolder || accountNumber.length < 4 || accountNumber.length > 40) return res.status(400).json({ error: 'bank_name, account_holder, and a valid account_number are required' });
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });

  const encryptedNumber = encryptAccountNumber(accountNumber);
  const mask = maskAccountNumber(accountNumber);
  const accountHash = hashAccountNumber(accountNumber);

  const account = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(provider.id)})`;
    const allAccounts = await tx.providerBankAccount.findMany({ where: { providerId: provider.id } });
    const existing = allAccounts.find((a) => {
      if (a.accountHash && a.accountHash === accountHash) return true;
      try {
        return decryptAccountNumber(a.accountNumber) === accountNumber;
      } catch {
        return a.accountNumber === accountNumber;
      }
    });

    await tx.providerBankAccount.updateMany({ where: { providerId: provider.id }, data: { selected: false } });
    if (existing) {
      return tx.providerBankAccount.update({
        where: { id: existing.id },
        data: {
          bankName,
          accountHolder,
          accountNumber: encryptedNumber,
          accountMask: mask,
          accountHash,
          selected: true,
        },
      });
    }
    return tx.providerBankAccount.create({
      data: {
        providerId: provider.id,
        bankName,
        accountHolder,
        accountNumber: encryptedNumber,
        accountMask: mask,
        accountHash,
        selected: true,
      },
    });
  }, { isolationLevel: 'Serializable' });

  res.status(201).json({ id: account.id, bank_name: account.bankName, account_holder: account.accountHolder, account_number: maskAccountNumber(account.accountNumber), selected: true });
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
