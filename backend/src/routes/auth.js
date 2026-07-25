import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// Register (user or provider)
router.post('/register', async (req, res) => {
  const { name, email, password, phone, role, nic, category } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const userRole = role === 'provider' ? 'PROVIDER' : role === 'admin' ? 'ADMIN' : 'CUSTOMER';

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, phone: phone || '', role: userRole },
    });

    if (userRole === 'PROVIDER') {
      await prisma.provider.create({
        data: { userId: user.id, nic: nic || '', category: category || 'Auto Care', kycStatus: 'PENDING' },
      });
    }

    const token = jwt.sign({ id: user.id, email, role: userRole, name }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name, email, role: userRole, phone } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login (universal tester: tester@gmail.com / 12345678 switches role via email)
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  let user;
  if (email === 'tester@gmail.com') {
    const target = role === 'provider' ? 'tester.provider@gmail.com'
      : role === 'admin' ? 'tester.admin@gmail.com' : 'tester@gmail.com';
    user = await prisma.user.findUnique({ where: { email: target } });
    if (!user) user = await prisma.user.findUnique({ where: { email: 'tester@gmail.com' } });
  } else {
    user = await prisma.user.findUnique({ where: { email } });
  }

  const isUniversal = email === 'tester@gmail.com' && password === '12345678';
  if (!user || (!isUniversal && !(await bcrypt.compare(password, user.passwordHash)))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  let provider = null;
  if (user.role === 'PROVIDER') {
    provider = await prisma.provider.findUnique({ where: { userId: user.id } });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    provider,
  });
});

// Current profile
router.get('/me', authenticateToken, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });
  let provider = null;
  if (user.role === 'PROVIDER') provider = await prisma.provider.findUnique({ where: { userId: user.id } });
  res.json({ user, provider });
});

export default router;
