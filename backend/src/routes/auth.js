import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { isEmail, isNonEmptyString, isPassword } from '../middleware/validators.js';

const router = Router();

const authLimiter = rateLimit({ max: 20, windowMs: 15 * 60 * 1000 });

// Register (customer or provider only — admin accounts are seeded, never self-registered)
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, phone, role, nic, category } = req.body;

  if (!isNonEmptyString(name, 100)) return res.status(400).json({ error: 'Name is required' });
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!isPassword(password)) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const normalizedEmail = email.trim().toLowerCase();
  const userRole = String(role || '').toLowerCase() === 'provider' ? 'PROVIDER' : 'CUSTOMER';

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    let providerCategory = 'Auto Care';
    if (userRole === 'PROVIDER' && category) {
      const cat = await prisma.category.findUnique({ where: { name: category } });
      if (!cat) return res.status(400).json({ error: `Unknown service category: ${category}` });
      providerCategory = category;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name: name.trim(), email: normalizedEmail, passwordHash, phone: phone || '', role: userRole },
    });

    if (userRole === 'PROVIDER') {
      await prisma.provider.create({
        data: { userId: user.id, nic: nic || '', category: providerCategory, kycStatus: 'PENDING' },
      });
    }

    const token = jwt.sign({ id: user.id, email: normalizedEmail, role: userRole, name }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name, email: normalizedEmail, role: userRole, phone: phone || '' } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

// Login (demo role switch: tester@gmail.com maps to the provider/admin demo
// accounts — all authenticate through the normal bcrypt.compare flow)
router.post('/login', authLimiter, async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const normalizedEmail = String(email).trim().toLowerCase();

  let user;
  if (normalizedEmail === 'tester@gmail.com') {
    const target = role === 'provider' ? 'tester.provider@gmail.com'
      : role === 'admin' ? 'tester.admin@gmail.com' : 'tester@gmail.com';
    user = await prisma.user.findUnique({ where: { email: target } });
    if (!user) user = await prisma.user.findUnique({ where: { email: 'tester@gmail.com' } });
  } else {
    user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  }

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
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
  if (!user) return res.status(404).json({ error: 'User not found' });
  let provider = null;
  if (user.role === 'PROVIDER') provider = await prisma.provider.findUnique({ where: { userId: user.id } });
  res.json({ user, provider });
});

export default router;
