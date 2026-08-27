import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendWhatsAppVerificationCode, verifyWhatsAppCode, normalizePhoneNumber } from '../services/integrations.js';
import { isEmail, isNonEmptyString } from '../middleware/validators.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
const otpSendLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const otpVerifyLimiter = rateLimit({ max: 10, windowMs: 15 * 60 * 1000 });
router.use(authenticateToken);

router.get('/', async (req, res) => {
  const profile = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, phone: true, phoneVerified: true, town: true, addressStreet: true, addressDistrict: true, role: true, createdAt: true } });
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
    const rawPhone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const phone = rawPhone ? normalizePhoneNumber(rawPhone) : null;
    if (rawPhone && !phone) return res.status(400).json({ error: 'phone must be a valid E.164 number or Sri Lankan mobile number' });
    data.phone = phone;
    data.phoneVerified = false;
  }
  if (req.body.town !== undefined) {
    const town = typeof req.body.town === 'string' ? req.body.town.trim().replace(/\s+/g, ' ') : '';
    if (town.length > 100) return res.status(400).json({ error: 'town must be at most 100 characters' });
    data.town = town || null;
  }
  if (req.body.address_street !== undefined) {
    const value = typeof req.body.address_street === 'string' ? req.body.address_street.trim().replace(/\s+/g, ' ') : '';
    if (value.length > 200) return res.status(400).json({ error: 'address_street must be at most 200 characters' });
    data.addressStreet = value || null;
  }
  if (req.body.address_district !== undefined) {
    const value = typeof req.body.address_district === 'string' ? req.body.address_district.trim().replace(/\s+/g, ' ') : '';
    if (value.length > 100) return res.status(400).json({ error: 'address_district must be at most 100 characters' });
    data.addressDistrict = value || null;
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Provide name, email, phone, town, or address to update' });
  const profile = await prisma.user.update({ where: { id: req.user.id }, data, select: { id: true, name: true, email: true, phone: true, phoneVerified: true, town: true, addressStreet: true, addressDistrict: true, role: true } });
  res.json(profile);
});

router.post('/phone/send', otpSendLimiter, async (req, res) => {
  const phone = normalizePhoneNumber(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'phone must be in E.164 format, e.g. +94771234567' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { phone: true } });
  if (user?.phone !== phone) return res.status(409).json({ error: 'Save this phone number to your profile before requesting a code' });
  try {
    const result = await sendWhatsAppVerificationCode(phone);
    res.json(result);
  } catch (error) {
    console.warn('[whatsapp] send failed:', error.message);
    res.status(502).json({ error: error.message || 'Could not send WhatsApp verification code' });
  }
});

router.post('/phone/verify', otpVerifyLimiter, async (req, res) => {
  const phone = normalizePhoneNumber(req.body.phone);
  const code = String(req.body.code || '').trim();
  if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'valid phone and 6-digit WhatsApp code are required' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { phone: true } });
  if (user?.phone !== phone) return res.status(409).json({ error: 'The verification code must match your current saved phone number' });
  try {
    const result = await verifyWhatsAppCode(phone, code);
    if (result.approved) await prisma.user.update({ where: { id: req.user.id }, data: { phone, phoneVerified: true } });
    res.json(result);
  } catch (error) {
    console.warn('[whatsapp] verify failed:', error.message);
    res.status(502).json({ error: error.message || 'Could not verify the WhatsApp code' });
  }
});

export default router;
