import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { isDate, isNonEmptyString, isQuarterHourTime, isTodayOrFuture, toEnum, toPositiveInt } from '../middleware/validators.js';
import { getPlatformSettings, pickProvider, providerCanTakeBooking, providerOffersCategory, servesTown } from '../services/scheduling.js';
import { broadcastToRole, broadcastToUser } from '../services/realtime.js';

const router = Router();
router.use(authenticateToken);

const serviceRequestPayload = (ticket) => ({
  id: ticket.id,
  subject: ticket.subject,
  notes: ticket.message,
  category: ticket.category,
  preferred_date: ticket.preferredDate,
  preferred_time: ticket.preferredTime,
  town: ticket.town,
  address_district: ticket.addressDistrict,
  status: String(ticket.status || 'OPEN').toLowerCase(),
  assignment_status: ticket.providerId ? 'assigned' : 'pending',
  claimable: !ticket.providerId,
  provider_id: ticket.providerId,
  provider_name: ticket.provider?.user?.name || null,
  customer_name: ticket.user?.name || null,
  customer_phone: ticket.user?.phone || null,
  created_at: ticket.createdAt,
  updated_at: ticket.updatedAt,
});

const serviceRequestInclude = {
  user: { select: { id: true, name: true, phone: true, email: true } },
  provider: { include: { user: { select: { id: true, name: true, phone: true } } } },
};

// Customer bespoke requests are persisted separately from ordinary support
// tickets and immediately matched to an eligible provider when possible.
router.post('/service-requests', requireRole('CUSTOMER'), async (req, res) => {
  const subject = String(req.body.subject || '').trim();
  const notes = String(req.body.notes || '').trim();
  const requestedCategory = String(req.body.category || '').trim();
  const preferredDate = String(req.body.preferred_date || '').trim();
  const preferredTime = String(req.body.preferred_time || '').trim().toUpperCase();

  if (!isNonEmptyString(subject, 150) || !isNonEmptyString(notes, 4000)) {
    return res.status(400).json({ error: 'Subject and service requirements are required' });
  }
  if (!isDate(preferredDate) || !isTodayOrFuture(preferredDate)) {
    return res.status(400).json({ error: 'Preferred date must be today or a future date' });
  }
  if (!isQuarterHourTime(preferredTime)) {
    return res.status(400).json({ error: 'Preferred time must use a 15-minute interval' });
  }

  const category = await prisma.category.findFirst({
    where: { name: { equals: requestedCategory, mode: 'insensitive' } },
    select: { name: true },
  });
  if (!category) return res.status(400).json({ error: 'Select a valid service category' });

  const customer = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, phone: true, email: true, town: true, addressDistrict: true },
  });
  if (!customer?.town) return res.status(400).json({ error: 'Add your town in profile settings before requesting a service' });

  const recentDuplicate = await prisma.supportTicket.findFirst({
    where: {
      userId: req.user.id,
      kind: 'SERVICE_REQUEST',
      subject,
      category: category.name,
      preferredDate,
      preferredTime,
      createdAt: { gte: new Date(Date.now() - 15000) },
    },
    include: serviceRequestInclude,
  });
  if (recentDuplicate) return res.status(200).json(serviceRequestPayload(recentDuplicate));

  const settings = await getPlatformSettings(prisma);
  const provider = await pickProvider(
    prisma,
    category.name,
    customer.town,
    customer.addressDistrict,
    preferredDate,
    preferredTime,
    { durationMins: 60 },
    settings,
  );

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.user.id,
      providerId: provider?.id || null,
      subject,
      message: notes,
      kind: 'SERVICE_REQUEST',
      category: category.name,
      preferredDate,
      preferredTime,
      town: customer.town,
      addressDistrict: customer.addressDistrict,
      priority: 'NORMAL',
    },
    include: serviceRequestInclude,
  });

  const payload = serviceRequestPayload(ticket);
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
  await Promise.all([
    ...admins.map((admin) => notify(admin.id, `New requested service #${ticket.id}: ${ticket.subject}`, '/admin-dashboard')),
    ...(provider ? [notify(provider.userId, `New requested service assigned: ${ticket.subject} on ${preferredDate} at ${preferredTime}.`, '/provider-dashboard')] : []),
  ]);

  broadcastToRole('ADMIN', 'SERVICE_REQUEST_CREATED', payload);
  broadcastToUser(req.user.id, 'SERVICE_REQUEST_CREATED', payload);
  if (provider) broadcastToUser(provider.userId, 'SERVICE_REQUEST_CREATED', payload);
  else broadcastToRole('PROVIDER', 'SERVICE_REQUEST_CREATED', payload);

  res.status(201).json(payload);
});

router.get('/service-requests/my', requireRole('CUSTOMER'), async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.user.id, kind: 'SERVICE_REQUEST' },
    include: serviceRequestInclude,
    orderBy: { updatedAt: 'desc' },
  });
  res.json(tickets.map(serviceRequestPayload));
});

router.get('/service-requests/provider', requireRole('PROVIDER'), async (req, res) => {
  const provider = await prisma.provider.findUnique({
    where: { userId: req.user.id },
    include: { user: { select: { active: true } } },
  });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  if (provider.kycStatus !== 'APPROVED') return res.status(403).json({ error: 'Your KYC must be approved before you can view requested services' });
  if (!provider.user?.active) return res.json([]);

  const tickets = await prisma.supportTicket.findMany({
    where: {
      kind: 'SERVICE_REQUEST',
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      OR: [{ providerId: provider.id }, { providerId: null }],
    },
    include: serviceRequestInclude,
    orderBy: { createdAt: 'desc' },
  });

  const visible = [];
  for (const ticket of tickets) {
    if (ticket.providerId === provider.id) {
      visible.push(ticket);
      continue;
    }
    if (!providerOffersCategory(provider, ticket.category) || !servesTown(provider, ticket.town, ticket.addressDistrict)) continue;
    const canTake = await providerCanTakeBooking(prisma, provider, {
      bookingDate: ticket.preferredDate,
      bookingTime: ticket.preferredTime,
      town: ticket.town,
      addressDistrict: ticket.addressDistrict,
      service: { durationMins: 60, category: { name: ticket.category } },
    }, { requireOnline: false });
    if (canTake.ok) visible.push(ticket);
  }

  res.json(visible.map(serviceRequestPayload));
});

router.post('/service-requests/:id/claim', requireRole('PROVIDER'), async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Valid requested service ID is required' });
  const provider = await prisma.provider.findUnique({
    where: { userId: req.user.id },
    include: { user: { select: { id: true, active: true } } },
  });
  if (!provider || provider.kycStatus !== 'APPROVED' || !provider.user?.active) {
    return res.status(403).json({ error: 'An active, KYC-approved provider account is required' });
  }

  let ticket;
  try {
    ticket = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(id + 1000000000)})`;
      const current = await tx.supportTicket.findUnique({ where: { id }, include: serviceRequestInclude });
      if (!current || current.kind !== 'SERVICE_REQUEST') {
        const error = new Error('Requested service not found'); error.statusCode = 404; throw error;
      }
      if (current.providerId) {
        const error = new Error('This requested service has already been assigned'); error.statusCode = 409; throw error;
      }
      const canTake = await providerCanTakeBooking(tx, provider, {
        bookingDate: current.preferredDate,
        bookingTime: current.preferredTime,
        town: current.town,
        addressDistrict: current.addressDistrict,
        service: { durationMins: 60, category: { name: current.category } },
      }, { requireOnline: false });
      if (!canTake.ok) { const error = new Error(canTake.error); error.statusCode = 409; throw error; }
      return tx.supportTicket.update({ where: { id }, data: { providerId: provider.id }, include: serviceRequestInclude });
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }

  const payload = serviceRequestPayload(ticket);
  await Promise.all([
    notify(ticket.userId, `Your requested service #${ticket.id} has been assigned to a provider.`, '/customer-dashboard'),
    notify(provider.userId, `You accepted requested service #${ticket.id}.`, '/provider-dashboard'),
  ]);
  broadcastToRole('PROVIDER', 'SERVICE_REQUEST_ASSIGNED', payload);
  broadcastToUser(ticket.userId, 'SERVICE_REQUEST_ASSIGNED', payload);
  res.json(payload);
});

router.post('/', async (req, res) => {
  if (!isNonEmptyString(req.body.subject, 150) || !isNonEmptyString(req.body.message, 4000)) return res.status(400).json({ error: 'subject and message are required' });
  const priority = toEnum(req.body.priority || 'normal', ['LOW', 'NORMAL', 'HIGH', 'URGENT']);
  if (!priority) return res.status(400).json({ error: 'Invalid priority' });

  const cleanSubject = req.body.subject.trim();
  const cleanMessage = req.body.message.trim();

  // Deduplicate rapid duplicate clicks within 15 seconds
  const recentDuplicate = await prisma.supportTicket.findFirst({
    where: {
      userId: req.user.id,
      subject: cleanSubject,
      message: cleanMessage,
      createdAt: { gte: new Date(Date.now() - 15000) },
    },
  });

  if (recentDuplicate) {
    return res.status(200).json(recentDuplicate);
  }

  const ticket = await prisma.supportTicket.create({ data: { userId: req.user.id, subject: cleanSubject, message: cleanMessage, priority } });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
  await Promise.all(admins.map((admin) => notify(admin.id, `New support ticket #${ticket.id}: ${ticket.subject}`, '/admin-dashboard')));
  res.status(201).json(ticket);
});

router.get('/my', async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({ where: { userId: req.user.id }, orderBy: { updatedAt: 'desc' } });
  res.json(tickets);
});

router.get('/', requireRole('ADMIN'), async (req, res) => {
  const status = req.query.status ? toEnum(req.query.status, ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) : null;
  const tickets = await prisma.supportTicket.findMany({ where: status ? { status } : {}, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { updatedAt: 'desc' } });
  res.json(tickets);
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = toPositiveInt(req.params.id);
  const status = req.body.status === undefined ? undefined : toEnum(req.body.status, ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
  if (!id || (req.body.status !== undefined && !status)) return res.status(400).json({ error: 'Invalid ticket id or status' });
  const adminResponse = req.body.admin_response === undefined ? undefined : String(req.body.admin_response).trim();
  if (adminResponse !== undefined && (adminResponse.length < 1 || adminResponse.length > 4000)) return res.status(400).json({ error: 'admin_response must be 1-4000 characters' });
  const ticket = await prisma.supportTicket.update({ where: { id }, data: { status, adminResponse }, include: { user: { select: { role: true } } } });
  const destination = ticket.user.role === 'PROVIDER' ? '/provider-dashboard' : '/customer-dashboard';
  await notify(ticket.userId, `Support ticket #${ticket.id} has been updated${adminResponse ? ' with a response' : ''}.`, destination);
  res.json(ticket);
});

export default router;
