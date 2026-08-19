import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { isEmail, isNonEmptyString, isPassword } from '../middleware/validators.js';
import { normalizeSriLankanPhone, sendEmail, sendVerificationCode, verifyCode } from '../services/integrations.js';

const router = Router();

const authLimiter = rateLimit({ max: 60, windowMs: 15 * 60 * 1000 });
const passwordResetLimiter = rateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Too many password reset requests. Please wait before trying again.',
  keyGenerator: (req) => `${req.ip || 'unknown'}:${String(req.body.email || '').trim().toLowerCase()}`,
});
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const registrationOtpSendLimiter = rateLimit({
  max: 3,
  windowMs: 10 * 60 * 1000,
  message: 'Too many OTP requests. Please wait before requesting another code.',
  keyGenerator: (req) => `${req.ip || 'unknown'}:${normalizeSriLankanPhone(req.body.phone) || String(req.body.phone || '').trim()}`,
});
const registrationOtpVerifyLimiter = rateLimit({
  max: 10,
  windowMs: 10 * 60 * 1000,
  message: 'Too many OTP verification attempts. Please wait before trying again.',
  keyGenerator: (req) => `${req.ip || 'unknown'}:${normalizeSriLankanPhone(req.body.phone) || String(req.body.phone || '').trim()}`,
});

router.post('/register/phone/send', registrationOtpSendLimiter, async (req, res) => {
  const phone = normalizeSriLankanPhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a valid Sri Lankan number such as 0771234567 or +94771234567' });
  try {
    const result = await sendVerificationCode(phone);
    const challengeId = jwt.sign({ scope: 'provider_phone_otp', phone }, JWT_SECRET, { expiresIn: '10m' });
    res.json({ challenge_id: challengeId, phone, status: result.status, expires_in_seconds: 600 });
  } catch (error) {
    res.status(error.statusCode || 502).json({ error: error.message || 'Could not send verification code' });
  }
});

router.post('/register/phone/verify', registrationOtpVerifyLimiter, async (req, res) => {
  const phone = normalizeSriLankanPhone(req.body.phone);
  const code = String(req.body.code || '').trim();
  const challengeId = String(req.body.challenge_id || '').trim();
  let challenge;
  try { challenge = jwt.verify(challengeId, JWT_SECRET); } catch (_) { challenge = null; }
  if (!phone || !/^\d{4,10}$/.test(code) || challenge?.scope !== 'provider_phone_otp' || challenge.phone !== phone) {
    return res.status(400).json({ error: 'Invalid or expired OTP challenge', phoneVerified: false });
  }
  try {
    const result = await verifyCode(phone, code);
    if (!result.approved) {
      return res.status(400).json({ error: ['canceled', 'expired'].includes(String(result.status || '').toLowerCase()) ? 'This OTP has expired. Request a new code.' : 'Invalid OTP code.', phoneVerified: false, status: result.status });
    }
    const verificationToken = jwt.sign({ scope: 'provider_phone_verified', phone }, JWT_SECRET, { expiresIn: '10m' });
    res.json({ verified: true, phone, phoneVerified: true, verification_token: verificationToken, status: result.status });
  } catch (error) {
    res.status(error.statusCode || 502).json({ error: error.message || 'Could not verify OTP code', phoneVerified: false });
  }
});

// Register (customer or provider only — admin accounts are seeded, never self-registered)
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, phone, town, service_towns, role, nic, category } = req.body;

  if (!isNonEmptyString(name, 100)) return res.status(400).json({ error: 'Name is required' });
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!isPassword(password)) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone ? normalizeSriLankanPhone(phone) : null;
  if (phone && !normalizedPhone) return res.status(400).json({ error: 'Phone must be a valid Sri Lankan number such as 0771234567 or +94771234567' });
  const userRole = String(role || '').toLowerCase() === 'provider' ? 'PROVIDER' : 'CUSTOMER';
  if (userRole === 'PROVIDER') {
    const verificationToken = String(req.body.phone_verification_token || '').trim();
    let proof;
    try { proof = jwt.verify(verificationToken, JWT_SECRET); } catch (_) { proof = null; }
    if (!normalizedPhone || proof?.scope !== 'provider_phone_verified' || proof.phone !== normalizedPhone) {
      return res.status(400).json({ error: 'A successful phone OTP verification is required before provider registration' });
    }
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    let providerCategory = 'Auto Care';
    if (userRole === 'PROVIDER' && category) {
      const cat = await prisma.category.findUnique({ where: { name: category } });
      if (!cat) return res.status(400).json({ error: `Unknown service category: ${category}` });
      providerCategory = category;
    }

    const providerTowns = normalizeServiceTowns(service_towns);
    if (userRole === 'PROVIDER' && providerTowns === null) {
      return res.status(400).json({ error: 'service_towns must contain at most 10 towns' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name: name.trim(), email: normalizedEmail, passwordHash, phone: normalizedPhone || '', phoneVerified: Boolean(normalizedPhone && userRole === 'PROVIDER'), town: normalizeTown(town), role: userRole },
    });

    if (userRole === 'PROVIDER') {
      await prisma.provider.create({
        data: { userId: user.id, nic: nic || '', category: providerCategory, serviceTowns: providerTowns || '', kycStatus: 'PENDING' },
      });
    }

    const token = jwt.sign({ id: user.id, email: normalizedEmail, role: userRole, name }, JWT_SECRET, { expiresIn: '7d' });
    sendEmail({ to: normalizedEmail, subject: 'Welcome to Luxora', html: `<p>Welcome to Luxora, ${name.trim()}.</p><p>Your concierge account is ready.</p>` }).catch((error) => console.warn('[email] welcome failed:', error.message));
    res.status(201).json({ token, user: { id: user.id, name, email: normalizedEmail, role: userRole, phone: normalizedPhone || '', phoneVerified: user.phoneVerified, town: normalizeTown(town) } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

router.post('/password-reset/request', passwordResetLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return the same response to avoid account enumeration.
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    });
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?reset_token=${encodeURIComponent(token)}`;
    sendEmail({
      to: email,
      subject: 'Reset your Luxora password',
      text: 'We received a password reset request. The link expires in 15 minutes.',
      html: `<p>We received a password reset request.</p><p><a href="${resetUrl}">Reset your password</a> (valid for 15 minutes).</p>`,
    }).catch((error) => console.warn('[email] reset failed:', error.message));
  }
  res.json({ message: 'If that account exists, a password reset email has been sent.' });
});

router.post('/password-reset/confirm', authLimiter, async (req, res) => {
  const token = String(req.body.token || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(token) || !isPassword(req.body.password)) return res.status(400).json({ error: 'Invalid or expired reset token' });
  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findFirst({ where: { tokenHash: hashResetToken(token), usedAt: null, expiresAt: { gt: new Date() } } });
    if (!record) return false;
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return true;
  });
  if (!updated) return res.status(400).json({ error: 'Invalid or expired reset token' });
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

// Login — every account authenticates through the normal bcrypt.compare flow
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

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
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, phoneVerified: user.phoneVerified, town: user.town },
    provider,
  });
});

// Current profile
router.get('/me', authenticateToken, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, phone: true, phoneVerified: true, town: true, role: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  let provider = null;
  if (user.role === 'PROVIDER') provider = await prisma.provider.findUnique({ where: { userId: user.id } });
  res.json({ user, provider });
});

export default router;
