import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendVerificationCode, verifyCode } from '../services/integrations.js';
import { isEmail, isNonEmptyString } from '../middleware/validators.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
const otpSendLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const otpVerifyLimiter = rateLimit({ max: 10, windowMs: 15 * 60 * 1000 });
router.use(authenticateToken);

router.get('/', async (req, res) => {
  const profile = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, phone: true, phoneVerified: true, town: true, avatar: true, role: true, createdAt: true } });
  if (!profile) return res.status(404).json({ error: 'User not found' });
  res.json(profile);
});

router.put('/', async (req, res) => {
  const data = {};
  if (req.body.name !== undefined) {
    if (!isNonEmptyString(req.body.name, 100)) return res.status(400).json({ error: 'name must be 1-100 characters' });
    data.name = req.body.name.trim();
  }
  if (req.body.email !== undefined) {
    const email = String(req.body.email).trim().toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
    const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (owner && owner.id !== req.user.id) return res.status(409).json({ error: 'Email is already in use' });
    data.email = email;
  }
  if (req.body.phone !== undefined) {
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    if (phone.length > 25) return res.status(400).json({ error: 'phone must be at most 25 characters' });
    data.phone = phone || null;
  }
  if (req.body.town !== undefined) {
    const town = typeof req.body.town === 'string' ? req.body.town.trim().replace(/\s+/g, ' ') : '';
    if (town.length > 100) return res.status(400).json({ error: 'town must be at most 100 characters' });
    data.town = town || null;
  }
  if (req.body.avatar !== undefined) {
    const avatar = typeof req.body.avatar === 'string' ? req.body.avatar.trim() : null;
    data.avatar = avatar;
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Provide name, email, phone, town, or avatar to update' });
  const profile = await prisma.user.update({ where: { id: req.user.id }, data, select: { id: true, name: true, email: true, phone: true, phoneVerified: true, town: true, avatar: true, role: true } });
  res.json(profile);
});

router.post('/phone/send', otpSendLimiter, async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return res.status(400).json({ error: 'phone must be in E.164 format, e.g. +94771234567' });
  try { res.json(await sendVerificationCode(phone)); }
  catch (error) { console.warn('[otp] send failed:', error.message); res.status(502).json({ error: 'Could not send verification code' }); }
});

router.post('/phone/verify', otpVerifyLimiter, async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{4,10}$/.test(String(req.body.code || ''))) return res.status(400).json({ error: 'valid phone and OTP code are required' });
  try {
    const result = await verifyCode(phone, req.body.code);
    if (result.approved) await prisma.user.update({ where: { id: req.user.id }, data: { phone, phoneVerified: true } });
    res.json(result);
  } catch (error) { console.warn('[otp] verify failed:', error.message); res.status(502).json({ error: 'Could not verify the code' }); }
});

export default router;
