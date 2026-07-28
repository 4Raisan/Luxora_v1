import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.post('/', async (req, res) => {
  const { booking_id, subject, description } = req.body;
  await prisma.complaint.create({
    data: { userId: req.user.id, bookingId: booking_id || null, subject, description },
  });
  res.status(201).json({ message: 'Complaint registered successfully. Admin will review shortly.' });
});

export default router;
