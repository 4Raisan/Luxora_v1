import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getSession, processMessage } = require('../chatbot/services/engine.js');

const router = Router();

async function getOptionalUser(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) return null;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, phone: true, role: true, active: true }
    });
    return user && user.active ? user : null;
  } catch {
    return null;
  }
}

// Chat & Interactive Concierge Endpoint (Directly Connected to Live Database)
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId, structuredPayload } = req.body;
    const user = await getOptionalUser(req);
    const session = getSession(sessionId || 'guest-session');
    const response = await processMessage(session, message, structuredPayload, { user, prisma });
    res.json({
      sessionId: session.id,
      ...response
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error processing message' });
  }
});

// Live Database Subscription Plans
router.get('/chatbot/catalog', async (_req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { active: true },
      include: { entitlements: { include: { category: true } } },
      orderBy: { displayOrder: 'asc' }
    });
    const services = await prisma.service.findMany({ include: { category: true } });
    const categories = await prisma.category.findMany();
    res.json({ plans, services, categories });
  } catch (err) {
    console.error('Catalog query error:', err);
    res.status(500).json({ error: 'Failed to query live catalog' });
  }
});

// Live Database Special Ask Submission
router.post('/chatbot/special-ask', async (req, res) => {
  try {
    const user = await getOptionalUser(req);
    const { details, name, phone, email, category } = req.body;

    let targetUserId = user ? user.id : null;
    if (!targetUserId) {
      const defaultCustomer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
      targetUserId = defaultCustomer ? defaultCustomer.id : 1;
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: targetUserId,
        subject: `[Special Ask] ${category || 'Custom Service'}`,
        message: `Customer: ${name || (user ? user.name : 'Guest')} | Phone: ${phone || ''} | Email: ${email || ''}\nDetails: ${details || 'No additional details provided'}`
      }
    });

    res.status(201).json({ success: true, ticketId: ticket.id, ticket });
  } catch (err) {
    console.error('Special ask error:', err);
    res.status(500).json({ error: 'Failed to submit special ask request' });
  }
});

export default router;
