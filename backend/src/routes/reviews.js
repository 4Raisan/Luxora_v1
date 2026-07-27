import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.post('/', async (req, res) => {
  const { booking_id, rating, comment } = req.body;
  const booking = await prisma.booking.findFirst({ where: { id: booking_id, userId: req.user.id } });
  if (!booking) return res.status(404).json({ error: 'Booking not found or not eligible for review' });
  if (booking.status !== 'COMPLETED') return res.status(400).json({ error: 'Only completed services can be reviewed' });

  try {
    await prisma.review.create({
      data: { bookingId: booking_id, userId: req.user.id, providerId: booking.providerId, rating, comment },
    });
    res.status(201).json({ message: 'Review submitted successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Review already submitted for this booking' });
  }
});

export default router;
