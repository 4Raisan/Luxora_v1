import express from 'express';
import cors from 'cors';
import { PORT } from './config/env.js';
import authRoutes from './routes/auth.js';
import serviceRoutes from './routes/services.js';
import bookingRoutes from './routes/bookings.js';
import reviewRoutes from './routes/reviews.js';
import complaintRoutes from './routes/complaints.js';
import adminRoutes from './routes/admin.js';
import customerRoutes from './routes/customer.js';
import providerRoutes from './routes/provider.js';
import promotionRoutes from './routes/promotions.js';
import notificationRoutes from './routes/notifications.js';

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/notifications', notificationRoutes);

// Seed a welcome promotion on first run (idempotent)
import { prisma } from './config/prisma.js';
prisma.promotion.count().then((c) => {
  if (c === 0) {
    prisma.promotion.create({
      data: {
        title: 'Welcome to Luxora',
        description: '15% off your first subscription — a gift for joining the concierge network.',
        code: 'LUXORA15',
        discountPct: 15,
      },
    });
  }
}).catch(() => {});

app.listen(PORT, () => {
  console.log(`Luxora Backend API server running on http://localhost:${PORT}`);
});
