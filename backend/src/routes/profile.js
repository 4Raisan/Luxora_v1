import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { normalizePhoneNumber } from '../services/integrations.js';
import { isEmail, isNonEmptyString } from '../middleware/validators.js';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  const profile = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      town: true,
      addressStreet: true,
      addressDistrict: true,
      role: true,
      createdAt: true,
    },
  });
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
  const profile = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      town: true,
      addressStreet: true,
      addressDistrict: true,
      role: true,
    },
  });
  res.json(profile);
});

export default router;
