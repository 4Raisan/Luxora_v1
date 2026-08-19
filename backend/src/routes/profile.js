import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { normalizeSriLankanPhone, sendVerificationCode, verifyCode } from '../services/integrations.js';

const router = Router();
router.use(authenticateToken);

const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: 'Too many OTP requests. Please wait before requesting another code.',
  keyGenerator: (req) => `${req.user?.id || 'unknown'}:${normalizeSriLankanPhone(req.body.phone) || String(req.body.phone || '').trim()}`,
});
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many OTP verification attempts. Please wait before trying again.',
  keyGenerator: (req) => `${req.user?.id || 'unknown'}:${normalizeSriLankanPhone(req.body.phone) || String(req.body.phone || '').trim()}`,
});

router.post('/phone/send', otpSendLimiter, async (req, res) => {
  const phone = normalizeSriLankanPhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a valid Sri Lankan number such as 0771234567 or +94771234567' });
  try {
    const result = await sendVerificationCode(phone);
    res.json({ status: result.status, phone, expires_in_seconds: 600 });
  } catch (error) {
    res.status(error.statusCode || 502).json({ error: error.message || 'Could not send verification code' });
  }
});

router.post('/phone/verify', otpVerifyLimiter, async (req, res) => {
  const phone = normalizeSriLankanPhone(req.body.phone);
  const code = String(req.body.code || '').trim();
  if (!phone || !/^\d{4,10}$/.test(code)) return res.status(400).json({ error: 'Enter a valid Sri Lankan phone number and OTP code' });
  try {
    const result = await verifyCode(phone, code);
    if (!result.approved) {
      const expired = ['canceled', 'expired'].includes(String(result.status || '').toLowerCase());
      return res.status(400).json({ error: expired ? 'This OTP has expired. Request a new code.' : 'Invalid OTP code.', status: result.status, phoneVerified: false });
    }
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { phone, phoneVerified: true }, select: { id: true, phone: true, phoneVerified: true } });
    res.json({ status: result.status, phone: user.phone, phoneVerified: user.phoneVerified });
  } catch (error) {
    res.status(error.statusCode || 502).json({ error: error.message || 'Could not verify OTP code', phoneVerified: false });
  }
});

export default router;
