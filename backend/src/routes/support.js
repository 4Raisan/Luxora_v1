import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { isNonEmptyString, toEnum, toPositiveInt } from '../middleware/validators.js';

const router = Router();
router.use(authenticateToken);

router.post('/', async (req, res) => {
  if (!isNonEmptyString(req.body.subject, 150) || !isNonEmptyString(req.body.message, 4000)) return res.status(400).json({ error: 'subject and message are required' });
  const priority = toEnum(req.body.priority || 'normal', ['LOW', 'NORMAL', 'HIGH', 'URGENT']);
  if (!priority) return res.status(400).json({ error: 'Invalid priority' });
  const ticket = await prisma.supportTicket.create({ data: { userId: req.user.id, subject: req.body.subject.trim(), message: req.body.message.trim(), priority } });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
  await Promise.all(admins.map((admin) => notify(admin.id, `New support ticket #${ticket.id}: ${ticket.subject}`, '/admin/support')));
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
  const ticket = await prisma.supportTicket.update({ where: { id }, data: { status, adminResponse } });
  await notify(ticket.userId, `Support ticket #${ticket.id} has been updated${adminResponse ? ' with a response' : ''}.`, '/customer-dashboard');
  res.json(ticket);
});

export default router;
