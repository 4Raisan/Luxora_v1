import { Router } from 'express';
import { optionalAuthentication } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getSession, processMessage } = require('../chatbot/services/engine.js');

const router = Router();

// Chat & Interactive Concierge Endpoint (Directly Connected to Live Database)
router.post('/chat', optionalAuthentication, async (req, res) => {
  try {
    const { message, sessionId, structuredPayload } = req.body;
    const user = req.user || null;
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
router.post('/chatbot/special-ask', optionalAuthentication, async (req, res) => {
  try {
    const user = req.user || null;
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
