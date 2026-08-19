import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { toPositiveInt, isNonEmptyString } from '../middleware/validators.js';
import { notify } from '../services/notify.js';

const router = Router();
router.use(authenticateToken);

router.get('/my', async (req, res) => {
  const complaints = await prisma.complaint.findMany({ where: { userId: req.user.id }, include: { booking: { select: { id: true, bookingDate: true, bookingTime: true, service: { select: { title: true } } } } }, orderBy: { updatedAt: 'desc' } });
  res.json(complaints.map((item) => ({ id: item.id, subject: item.subject, description: item.description, status: item.status.toLowerCase(), admin_note: item.adminNote, created_at: item.createdAt, updated_at: item.updatedAt, booking: item.booking && { id: item.booking.id, date: item.booking.bookingDate, time: item.booking.bookingTime, service: item.booking.service?.title } })));
});

router.post('/', async (req, res) => {
  const { booking_id, subject, description } = req.body;

  if (!isNonEmptyString(subject, 150)) return res.status(400).json({ error: 'Subject is required (max 150 chars)' });
  if (!isNonEmptyString(description, 2000)) return res.status(400).json({ error: 'Description is required (max 2000 chars)' });

  let bookingId = null;
  if (booking_id !== undefined && booking_id !== null && booking_id !== '') {
    bookingId = toPositiveInt(booking_id);
    if (!bookingId) return res.status(400).json({ error: 'booking_id must be a positive integer' });
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId: req.user.id } });
    if (!booking) return res.status(400).json({ error: 'Booking not found among your bookings' });
  }

  const complaint = await prisma.complaint.create({
    data: { userId: req.user.id, bookingId, subject: subject.trim(), description: description.trim() },
  });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
  await Promise.all(admins.map((admin) => notify(admin.id, `New complaint #${complaint.id}: ${complaint.subject}`, '/admin-dashboard')));
  res.status(201).json({
    message: 'Complaint registered successfully. Admin will review shortly.',
    complaint: { id: complaint.id, subject: complaint.subject, description: complaint.description, status: complaint.status.toLowerCase(), created_at: complaint.createdAt },
  });
});

export default router;
