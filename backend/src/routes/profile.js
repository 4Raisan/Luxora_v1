import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendVerificationCode, verifyCode } from '../services/integrations.js';

const router = Router();
router.use(authenticateToken);

router.post('/phone/send', async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return res.status(400).json({ error: 'phone must be in E.164 format, e.g. +94771234567' });
  try { res.json(await sendVerificationCode(phone)); }
  catch (error) { res.status(502).json({ error: error.message }); }
});

router.post('/phone/verify', async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{4,10}$/.test(String(req.body.code || ''))) return res.status(400).json({ error: 'valid phone and OTP code are required' });
  try {
    const result = await verifyCode(phone, req.body.code);
    if (result.approved) await prisma.user.update({ where: { id: req.user.id }, data: { phone, phoneVerified: true } });
    res.json(result);
  } catch (error) { res.status(502).json({ error: error.message }); }
});

export default router;
