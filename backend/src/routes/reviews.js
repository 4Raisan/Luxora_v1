import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { toPositiveInt, isNonEmptyString } from '../middleware/validators.js';
import { notify } from '../services/notify.js';

const router = Router();
router.use(authenticateToken, requireRole('CUSTOMER'));

router.post('/', async (req, res) => {
  const { booking_id, rating, comment } = req.body;

  const bookingId = toPositiveInt(booking_id);
  if (!bookingId) return res.status(400).json({ error: 'booking_id is required' });

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Rating must be an integer from 1 to 5' });
  }
  if (comment && !isNonEmptyString(comment, 1000)) {
    return res.status(400).json({ error: 'Comment must be 1-1000 characters' });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId: req.user.id },
    include: { provider: { select: { userId: true } } },
  });
  if (!booking) return res.status(404).json({ error: 'Booking not found or not eligible for review' });
  if (booking.status !== 'COMPLETED') return res.status(400).json({ error: 'Only completed services can be reviewed' });
  if (!booking.providerId) return res.status(400).json({ error: 'This booking has no assigned provider to review' });

  try {
    const review = await prisma.review.create({
      data: { bookingId, userId: req.user.id, providerId: booking.providerId, rating: ratingNum, comment: comment || null },
    });
    await notify(booking.provider.userId, `A customer rated booking #${booking.id} ${ratingNum}/5 stars.`, '/provider-dashboard').catch(() => {});
    res.status(201).json({ message: 'Review submitted successfully', review: { id: review.id, booking_id: review.bookingId, rating: review.rating, comment: review.comment, created_at: review.createdAt } });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Review already submitted for this booking' });
    throw err;
  }
});

export default router;
