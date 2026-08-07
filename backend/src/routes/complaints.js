import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { toPositiveInt, isNonEmptyString } from '../middleware/validators.js';

const router = Router();
router.use(authenticateToken);

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

  await prisma.complaint.create({
    data: { userId: req.user.id, bookingId, subject: subject.trim(), description: description.trim() },
  });
  res.status(201).json({ message: 'Complaint registered successfully. Admin will review shortly.' });
});

export default router;
