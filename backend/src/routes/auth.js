import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { isEmail, isNonEmptyString, validatePassword } from '../middleware/validators.js';
import { sendEmail, escapeHtml, normalizePhoneNumber } from '../services/integrations.js';
import { notify } from '../services/notify.js';
import { getSriLankaLocation } from '../services/sriLankaLocations.js';

const router = Router();

const authLimiter = rateLimit({ max: 60, windowMs: 15 * 60 * 1000 });

// Register (customer or provider — admin accounts are seeded, never self-registered)
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, phone, town, address_street, service_towns, role, nic, category, categories } = req.body;

  if (!isNonEmptyString(name, 100)) return res.status(400).json({ error: 'Name is required' });
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) return res.status(400).json({ error: passwordCheck.error });

  const normalizedEmail = email.trim().toLowerCase();
  const userRole = String(role || '').toLowerCase() === 'provider' ? 'PROVIDER' : 'CUSTOMER';
  const normalizedPhone = normalizePhoneNumber(phone) || (typeof phone === 'string' ? phone.trim() : null);

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    let providerCategories = ['Auto Care'];
    if (userRole === 'PROVIDER') {
      if (categories !== undefined && !Array.isArray(categories)) return res.status(400).json({ error: 'categories must be an array' });
      const requested = (Array.isArray(categories) ? categories : [category || 'Auto Care'])
        .map((value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '').filter(Boolean);
      const unique = [...new Map(requested.map((value) => [value.toLocaleLowerCase(), value])).values()];
      if (unique.length === 0 || unique.length > 3) return res.status(400).json({ error: 'Select between one and three service categories' });
      const known = await prisma.category.findMany({ where: { name: { in: unique } }, select: { name: true } });
      if (known.length !== unique.length) return res.status(400).json({ error: 'One or more service categories are invalid' });
      const canonical = new Map(known.map((item) => [item.name.toLocaleLowerCase(), item.name]));
      providerCategories = unique.map((value) => canonical.get(value.toLocaleLowerCase()));
    }

    const providerLocation = userRole === 'PROVIDER' ? getSriLankaLocation(town) : null;
    if (userRole === 'PROVIDER' && !providerLocation) {
      return res.status(400).json({ error: 'Select a town from the Sri Lanka provider registration list' });
    }
    const customerLocation = userRole === 'CUSTOMER' && town ? getSriLankaLocation(town) : null;
    if (userRole === 'CUSTOMER' && town && !customerLocation) {
      return res.status(400).json({ error: 'Select a valid town from the Sri Lanka location list' });
    }
    const providerTowns = normalizeServiceTowns(service_towns);
    if (userRole === 'PROVIDER' && providerTowns === null) {
      return res.status(400).json({ error: 'service_towns must contain at most 10 towns' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        phone: normalizedPhone || '',
        town: providerLocation?.name || customerLocation?.name || null,
        addressStreet: normalizeTown(address_street),
        addressDistrict: providerLocation?.province || customerLocation?.province || null,
        role: userRole,
      },
    });

    if (userRole === 'PROVIDER') {
      await prisma.provider.create({
        data: {
          userId: user.id,
          nic: nic || '',
          category: providerCategories.join(', '),
          serviceTowns: providerTowns || '',
          kycStatus: 'PENDING',
        },
      });
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
      await Promise.all(admins.map((admin) => notify(admin.id, `New provider awaiting KYC approval: ${user.name}.`, '/admin-dashboard')));
    }

    const token = jwt.sign({ id: user.id, email: normalizedEmail, role: userRole, name, tokenVersion: user.tokenVersion }, JWT_SECRET, { expiresIn: '7d' });
    if (userRole === 'PROVIDER') {
      sendEmail({
        to: normalizedEmail,
        subject: 'Luxora Provider Registration Received – KYC Pending',
        html: `<p>Welcome to the Luxora Concierge Network, ${escapeHtml(name.trim())}.</p><p>We have received your provider registration and details. Your account is currently in <strong>KYC Pending</strong> status while our operations team reviews your information.</p><p>You will receive an update as soon as your verification is complete.</p>`,
      }).catch((error) => console.warn('[email] provider registration notification failed:', error.message));
    } else {
      sendEmail({
        to: normalizedEmail,
        subject: 'Welcome to Luxora',
        html: `<p>Welcome to Luxora, ${escapeHtml(name.trim())}.</p><p>Your concierge account is ready.</p>`,
      }).catch((error) => console.warn('[email] welcome failed:', error.message));
    }

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: normalizedEmail,
        role: userRole,
        phone: user.phone || '',
        town: providerLocation?.name || normalizeTown(town),
        province: providerLocation?.province || null,
      },
    });
  } catch (err) {
    console.error('[auth] registration failed:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

const resetTokenHash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const resetLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });

router.post('/password-reset/request', resetLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return the same response to avoid account enumeration.
  if (user) {
    const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: resetTokenHash(token),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?reset_token=${encodeURIComponent(token)}`;
    sendEmail({
      to: email,
      subject: 'Reset your Luxora password',
      html: `<p>We received a password reset request.</p><p><a href="${resetUrl}">Reset your password</a> (valid for 15 minutes).</p>`,
    }).catch((error) => console.warn('[email] reset failed:', error.message));
  }
  res.json({ message: 'If that account exists, a password reset email has been sent.' });
});

router.post('/password-reset/confirm', resetLimiter, async (req, res) => {
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash: resetTokenHash(req.body.token),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!record) return res.status(400).json({ error: 'Invalid or expired reset token' });
  const passwordCheck = validatePassword(req.body.password);
  if (!passwordCheck.valid) return res.status(400).json({ error: passwordCheck.error });
  const passwordHash = await bcrypt.hash(req.body.password, 10);
  try {
    await prisma.$transaction(async (tx) => {
      const usedAt = new Date();
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt },
      });
      if (claimed.count !== 1) {
        const error = new Error('Invalid or expired reset token');
        error.statusCode = 400;
        throw error;
      }
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt },
      });
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash, tokenVersion: { increment: 1 } } });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error.statusCode || error.code === 'P2034') return res.status(400).json({ error: 'Invalid or expired reset token' });
    throw error;
  }
  res.json({ message: 'Password updated successfully' });
});

function normalizeTown(value) {
  return typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ') : null;
}

function normalizeServiceTowns(value) {
  if (value === undefined || value === null || value === '') return '';
  const towns = String(value).split(',').map((town) => normalizeTown(town)).filter(Boolean);
  if (towns.length > 10) return null;
  return [...new Map(towns.map((town) => [town.toLocaleLowerCase(), town])).values()].join(', ');
}

// Google sign-in
router.post('/google', authLimiter, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json({ error: 'Google sign-in is not configured' });
  const credential = String(req.body.credential || '');
  if (!credential) return res.status(400).json({ error: 'Google credential is required' });
  let profile;
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(401).json({ error: 'Invalid Google credential' });
    profile = await response.json();
  } catch { return res.status(502).json({ error: 'Could not verify Google credential' }); }
  const valid = profile
    && profile.aud === clientId
    && String(profile.email_verified) === 'true'
    && Number(profile.exp) * 1000 > Date.now()
    && isEmail(String(profile.email || '').toLowerCase());
  if (!valid) return res.status(401).json({ error: 'Invalid Google credential' });
  const email = String(profile.email).toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (user && user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'This email belongs to a provider or admin account. Please sign in with your email and password.' });
  }
  if (!user) {
    const passwordHash = await bcrypt.hash(`${crypto.randomUUID()}${crypto.randomUUID()}`, 10);
    user = await prisma.user.create({ data: { name: String(profile.name || email.split('@')[0]).slice(0, 100), email, passwordHash, phone: '', role: 'CUSTOMER' } });
    sendEmail({ to: email, subject: 'Welcome to Luxora', html: `<p>Welcome to Luxora, ${escapeHtml(user.name)}.</p><p>Your concierge account is ready.</p>` }).catch(() => {});
  }
  if (!user.active) return res.status(403).json({ error: 'This account has been deactivated. Contact Luxora support.' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name, tokenVersion: user.tokenVersion }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, town: user.town }, provider: null });
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!user.active) return res.status(403).json({ error: 'This account has been deactivated. Contact Luxora support.' });

  let provider = null;
  if (user.role === 'PROVIDER') {
    provider = await prisma.provider.findUnique({ where: { userId: user.id } });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name, tokenVersion: user.tokenVersion }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, town: user.town },
    provider,
  });
});

// Current profile
router.get('/me', authenticateToken, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, phone: true, town: true, role: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  let provider = null;
  if (user.role === 'PROVIDER') provider = await prisma.provider.findUnique({ where: { userId: user.id } });
  res.json({ user, provider });
});

export default router;
