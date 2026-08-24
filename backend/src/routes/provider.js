import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole, requireVerifiedPhone } from '../middleware/auth.js';
import { maskAccountNumber } from '../services/payouts.js';

const router = Router();
router.use(authenticateToken, requireRole('PROVIDER'), requireVerifiedPhone);
router.use(async (req, res, next) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id }, select: { kycStatus: true } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  if (provider.kycStatus !== 'APPROVED') return res.status(403).json({ error: 'Provider KYC approval is required for operational access' });
  next();
});

router.get('/availability', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id }, select: { availabilityStatus: true, serviceTowns: true, category: true } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  res.json({ availability_status: provider.availabilityStatus, service_towns: provider.serviceTowns, category: provider.category });
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
  const allowed = ['available', 'busy', 'offline'];
  if (!allowed.includes(availability_status)) return res.status(400).json({ error: 'Invalid availability status' });
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  await prisma.provider.update({ where: { id: provider.id }, data: { availabilityStatus: availability_status } });
  res.json({ message: `Availability set to ${availability_status}`, availability_status });
});

router.get('/earnings', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const completedJobs = await prisma.booking.count({ where: { providerId: provider.id, status: 'COMPLETED' } });
  const history = await prisma.booking.findMany({
    where: { providerId: provider.id },
    include: { service: true, user: { select: { name: true } }, payments: { where: { status: 'COMPLETED' }, select: { status: true } } },
    orderBy: { bookingDate: 'desc' },
    take: 50,
  });
  const [bankAccounts, payouts] = await Promise.all([
    prisma.providerBankAccount.findMany({ where: { providerId: provider.id }, orderBy: [{ selected: 'desc' }, { id: 'desc' }] }),
    prisma.providerPayout.findMany({ where: { providerId: provider.id }, include: { bankAccount: true }, orderBy: { createdAt: 'desc' }, take: 24 }),
  ]);
  res.json({
    earnings: provider.earnings,
    completedJobs,
    history: history.map((h) => ({
      id: h.id, booking_date: h.bookingDate, booking_time: h.bookingTime,
      service_title: h.service?.title, customer_name: h.user?.name, total_price: h.totalPrice, job_earnings: h.status === 'COMPLETED' ? h.providerEarning : 0, payment_status: h.payments[0]?.status?.toLowerCase() || 'not_applicable', status: h.status.toLowerCase(),
    })),
    bank_accounts: bankAccounts.map((account) => ({ id: account.id, bank_name: account.bankName, account_holder: account.accountHolder, account_number: maskAccountNumber(account.accountNumber), selected: account.selected })),
    payouts: payouts.map((payout) => ({ id: payout.id, period: payout.period, amount: payout.amount, status: payout.status.toLowerCase(), paid_at: payout.paidAt, bank_name: payout.bankAccount.bankName, account_number: maskAccountNumber(payout.bankAccount.accountNumber) })),
  });
});

router.post('/bank-accounts', async (req, res) => {
  const bankName = String(req.body.bank_name || '').trim();
  const accountHolder = String(req.body.account_holder || '').trim();
  const accountNumber = String(req.body.account_number || '').replace(/\s+/g, '');
  if (!bankName || !accountHolder || accountNumber.length < 4 || accountNumber.length > 40) return res.status(400).json({ error: 'bank_name, account_holder, and a valid account_number are required' });
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const account = await prisma.$transaction(async (tx) => {
    await tx.providerBankAccount.updateMany({ where: { providerId: provider.id }, data: { selected: false } });
    return tx.providerBankAccount.create({ data: { providerId: provider.id, bankName, accountHolder, accountNumber, selected: true } });
  });
  res.status(201).json({ id: account.id, bank_name: account.bankName, account_holder: account.accountHolder, account_number: maskAccountNumber(account.accountNumber), selected: true });
});

router.put('/bank-accounts/:id/select', async (req, res) => {
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  const account = await prisma.providerBankAccount.findFirst({ where: { id: Number(req.params.id), providerId: provider?.id } });
  if (!account) return res.status(404).json({ error: 'Bank account not found' });
  await prisma.$transaction([
    prisma.providerBankAccount.updateMany({ where: { providerId: provider.id }, data: { selected: false } }),
    prisma.providerBankAccount.update({ where: { id: account.id }, data: { selected: true } }),
  ]);
  res.json({ message: 'Bank account selected' });
});

export default router;
