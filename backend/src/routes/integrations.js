import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createPayHereFields, createPayPalOrder, capturePayPalOrder, sendEmail, sendVerificationCode, verifyCode, verifyPayHereWebhook } from '../services/integrations.js';

const router = Router();

// PayHere calls this server-to-server and therefore cannot use a user JWT.
router.post('/payments/payhere/webhook', (req, res) => {
  if (!verifyPayHereWebhook(req.body)) return res.status(400).send('Invalid signature');
  res.status(200).send('OK');
});

router.post('/payments/payhere/order', authenticateToken, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
    const orderId = `LUX-${req.user.id}-${Date.now()}`;
    const fields = createPayHereFields({ amount, orderId, currency: req.body.currency || 'LKR', customer: req.body.customer || {}, returnUrl: req.body.return_url || process.env.PAYHERE_RETURN_URL || 'http://localhost:3000', cancelUrl: req.body.cancel_url || process.env.PAYHERE_CANCEL_URL || 'http://localhost:3000' });
    res.json({ orderId, checkoutUrl: `${process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk'}/pay/checkout`, fields });
  } catch (error) { res.status(502).json({ error: error.message }); }
});

router.post('/payments/paypal/order', authenticateToken, async (req, res) => {
  try { res.json(await createPayPalOrder({ amount: req.body.amount, currency: req.body.currency || 'USD', description: req.body.description })); }
  catch (error) { res.status(502).json({ error: error.message }); }
});

router.post('/payments/paypal/capture', authenticateToken, async (req, res) => {
  if (!req.body.orderId) return res.status(400).json({ error: 'orderId is required' });
  try { res.json(await capturePayPalOrder(req.body.orderId)); }
  catch (error) { res.status(502).json({ error: error.message }); }
});

router.post('/email', authenticateToken, async (req, res) => {
  if (!req.body.to || !req.body.subject || !req.body.html) return res.status(400).json({ error: 'to, subject and html are required' });
  try { res.json(await sendEmail(req.body)); }
  catch (error) { res.status(502).json({ error: error.message }); }
});

router.post('/otp/send', authenticateToken, async (req, res) => {
  if (!/^\+[1-9]\d{7,14}$/.test(String(req.body.phone || ''))) return res.status(400).json({ error: 'phone must be in E.164 format, e.g. +94771234567' });
  try { res.json(await sendVerificationCode(req.body.phone)); }
  catch (error) { res.status(502).json({ error: error.message }); }
});

router.post('/otp/verify', authenticateToken, async (req, res) => {
  if (!req.body.phone || !/^\d{4,10}$/.test(String(req.body.code || ''))) return res.status(400).json({ error: 'phone and a valid OTP code are required' });
  try { res.json(await verifyCode(req.body.phone, req.body.code)); }
  catch (error) { res.status(502).json({ error: error.message }); }
});

export default router;
