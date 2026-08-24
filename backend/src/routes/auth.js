import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { isEmail, isNonEmptyString, isPassword } from '../middleware/validators.js';
import { sendEmail, sendWhatsAppVerificationCode, verifyWhatsAppCode } from '../services/integrations.js';
import { notify } from '../services/notify.js';

const router = Router();

const authLimiter = rateLimit({ max: 60, windowMs: 15 * 60 * 1000 });
const phoneOtpLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });

const phoneForVerify = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^07\d{8}$/.test(digits)) return `+94${digits.slice(1)}`;
  return /^\+947\d{8}$/.test(String(value || '').trim()) ? String(value).trim() : null;
};

router.post('/register/phone/send', phoneOtpLimiter, async (req, res) => {
  const phone = phoneForVerify(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a valid Sri Lankan mobile number' });
  try {
    const result = await sendWhatsAppVerificationCode(phone);
    res.json({ phone, status: result.status, channel: 'whatsapp', mode: result.demo ? 'demo' : 'live' });
  } catch (error) { console.warn('[whatsapp] send failed:', error.message); res.status(502).json({ error: 'Could not send WhatsApp verification code' }); }
});

router.post('/register/phone/verify', async (req, res) => {
  const phone = phoneForVerify(req.body.phone);
  if (!phone || !/^\d{6}$/.test(String(req.body.code || ''))) return res.status(400).json({ error: 'Valid phone and 6-digit code are required' });
  try {
    const result = await verifyWhatsAppCode(phone, req.body.code);
    if (!result.approved) return res.status(400).json({ error: 'Invalid verification code' });
    const verificationToken = jwt.sign({ scope: 'provider_phone_verified', phone }, JWT_SECRET, { expiresIn: '10m' });
    res.json({ verified: true, phone, verification_token: verificationToken });
  } catch (error) { console.warn('[whatsapp] verify failed:', error.message); res.status(502).json({ error: 'Could not verify the WhatsApp code' }); }
});

// Register (customer or provider only — admin accounts are seeded, never self-registered)
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, phone, town, service_towns, role, nic, category } = req.body;

  if (!isNonEmptyString(name, 100)) return res.status(400).json({ error: 'Name is required' });
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!isPassword(password)) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const normalizedEmail = email.trim().toLowerCase();
  const userRole = String(role || '').toLowerCase() === 'provider' ? 'PROVIDER' : 'CUSTOMER';
  const verifiedPhone = phoneForVerify(phone);
  if (userRole === 'PROVIDER') {
    try {
      const proof = jwt.verify(String(req.body.phone_verification_token || ''), JWT_SECRET);
      if (proof.scope !== 'provider_phone_verified' || proof.phone !== verifiedPhone) throw new Error('invalid proof');
    } catch { return res.status(400).json({ error: 'Provider phone verification is required before registration' }); }
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
      data: { name: name.trim(), email: normalizedEmail, passwordHash, phone: verifiedPhone || phone || '', phoneVerified: userRole === 'PROVIDER', town: normalizeTown(town), role: userRole },
    });

    if (userRole === 'PROVIDER') {
      await prisma.provider.create({
        data: { userId: user.id, nic: nic || '', category: providerCategory, serviceTowns: providerTowns || '', kycStatus: 'PENDING' },
      });
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
      await Promise.all(admins.map((admin) => notify(admin.id, `New provider awaiting KYC approval: ${user.name}.`, '/admin-dashboard')));
    }

    const token = jwt.sign({ id: user.id, email: normalizedEmail, role: userRole, name }, JWT_SECRET, { expiresIn: '7d' });
    sendEmail({ to: normalizedEmail, subject: 'Welcome to Luxora', html: `<p>Welcome to Luxora, ${name.trim()}.</p><p>Your concierge account is ready.</p>` }).catch((error) => console.warn('[email] welcome failed:', error.message));
    res.status(201).json({ token, user: { id: user.id, name, email: normalizedEmail, role: userRole, phone: phone || '', town: normalizeTown(town) } });
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
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: resetTokenHash(token), expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?reset_token=${encodeURIComponent(token)}`;
    sendEmail({ to: email, subject: 'Reset your Luxora password', html: `<p>We received a password reset request.</p><p><a href="${resetUrl}">Reset your password</a> (valid for 15 minutes).</p>` }).catch((error) => console.warn('[email] reset failed:', error.message));
  }
  res.json({ message: 'If that account exists, a password reset email has been sent.' });
});

router.post('/password-reset/confirm', async (req, res) => {
  const record = await prisma.passwordResetToken.findFirst({ where: { tokenHash: resetTokenHash(req.body.token), usedAt: null, expiresAt: { gt: new Date() } } });
  if (!record || !isPassword(req.body.password)) return res.status(400).json({ error: 'Invalid or expired reset token' });
  const passwordHash = await bcrypt.hash(req.body.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
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

// Google One Tap / button sign-in. The Google ID token (credential) is verified
// by Google's tokeninfo endpoint; the audience must match this backend's
// GOOGLE_CLIENT_ID and the email must be verified. Google sign-in is for
// CUSTOMER accounts only: new emails create a customer account, while existing
// provider/admin accounts are asked to use their password sign-in instead.
router.post('/google', authLimiter, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return res.status(503).json({ error: 'Google sign-in is not configured' })
  const credential = String(req.body.credential || '')
  if (!credential) return res.status(400).json({ error: 'Google credential is required' })
  let profile
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
    // No local password: the account signs in via Google; a password can be set
    // later through the normal email reset flow.
    const passwordHash = await bcrypt.hash(`${crypto.randomUUID()}${crypto.randomUUID()}`, 10);
    user = await prisma.user.create({ data: { name: String(profile.name || email.split('@')[0]).slice(0, 100), email, passwordHash, phone: '', phoneVerified: false, role: 'CUSTOMER' } });
    sendEmail({ to: email, subject: 'Welcome to Luxora', html: `<p>Welcome to Luxora, ${user.name}.</p><p>Your concierge account is ready.</p>` }).catch(() => {});
  }
  if (!user.active) return res.status(403).json({ error: 'This account has been deactivated. Contact Luxora support.' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, phoneVerified: user.phoneVerified, town: user.town }, provider: null });
});

// Login — every account authenticates through the normal bcrypt.compare flow
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
    if (!provider || provider.kycStatus !== 'APPROVED') {
      return res.status(403).json({ error: provider?.kycStatus === 'REJECTED' ? 'Your provider verification was rejected. Contact Luxora support.' : 'Your provider verification is still pending.' });
    }
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
