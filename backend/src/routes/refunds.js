// V2 Slice 2 — customer refund API (design: docs/planning/V2_PLAN.md §3.2).
// The refund service (services/refunds.js) is the single source of truth for
// eligibility, amounts, state, and idempotency; this router only validates
// input, enforces authentication/roles, rate-limits, and serializes responses.
import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { toPositiveInt } from '../middleware/validators.js';
import { createRefundRequest, transitionRefund } from '../services/refunds.js';
import { notify } from '../services/notify.js';
import { broadcastToRole } from '../services/realtime.js';

const router = Router();
// NOTE: this router is mounted at '/api', so authentication is applied
// per-route — a router-level guard would shadow every other /api path
// mounted before/after it (including /api/health and /api/realtime).

// Refunds retain the checkout quota independently per IP and verified user.
const refundRequestLimiter = rateLimit({
  max: 30,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'refund-request',
  strategy: 'hybrid',
  message: 'Too many refund requests, try again later',
});

// Customer-visible fields only: admin decision notes are internal (Slice 3).
function serializeCustomer(refund) {
  return {
    id: refund.id,
    payment_id: refund.paymentId,
    amount: Number(refund.amount),
    currency: refund.currency,
    status: String(refund.status).toLowerCase(),
    reason: refund.reason,
    created_at: refund.requestedAt,
    decided_at: refund.decidedAt,
    completed_at: refund.completedAt,
  };
}

router.post('/payments/refunds', authenticateToken, requireRole('CUSTOMER'), refundRequestLimiter, async (req, res) => {
  const paymentId = toPositiveInt(req.body.payment_id);
  if (!paymentId) return res.status(400).json({ error: 'payment_id is required' });

  const reason = req.body.reason === undefined || req.body.reason === null ? undefined : String(req.body.reason).trim();
  if (reason === undefined || reason.length < 3 || reason.length > 500) {
    return res.status(400).json({ error: 'reason must be 3-500 characters' });
  }
  if (req.body.amount !== undefined && req.body.amount !== null && !Number.isFinite(Number(req.body.amount))) {
    return res.status(400).json({ error: 'amount must be a number' });
  }

  try {
    const result = await createRefundRequest({
      paymentId,
      requestedBy: req.user.id,
      amount: req.body.amount,
      reason,
      isAdmin: false,
    });

    if (result.alreadyOpen) {
      // Idempotent retry: the open request is returned unchanged and no
      // duplicate notification/audit entry is produced.
      return res.status(200).json({
        message: 'An open refund request already exists for this payment.',
        refund: serializeCustomer(result.refund),
      });
    }

    await notify(req.user.id, `Your refund request of ${result.currency} ${Number(result.amount).toFixed(2)} (payment #${paymentId}) has been received.`, '/customer-dashboard');
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
    await Promise.all(admins.map((admin) => notify(admin.id, `New refund request #${result.id} for payment #${paymentId}.`, '/admin-dashboard')));
    broadcastToRole('ADMIN', 'REFUND_CREATED', { refundId: result.id, paymentId, amount: Number(result.amount) });

    res.status(201).json({ message: 'Refund request submitted.', refund: serializeCustomer(result) });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
});

// Requester cancellation — allowed only while the refund is still open
// (REQUESTED/UNDER_REVIEW); the service enforces ownership and state.
router.put('/payments/refunds/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const updated = await transitionRefund({
      refundId: req.params.id,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'cancel',
    });
    res.json({ message: 'Refund request cancelled.', refund: serializeCustomer(updated) });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
});

router.get('/payments/refunds/my', authenticateToken, async (req, res) => {
  const refunds = await prisma.refundRequest.findMany({
    where: { requestedBy: req.user.id },
    orderBy: { requestedAt: 'desc' },
    include: { payment: { select: { id: true, gateway: true, capturedAmount: true, capturedCurrency: true } } },
  });
  res.json(refunds.map((refund) => ({
    id: refund.id,
    payment_id: refund.paymentId,
    payment: refund.payment && {
      id: refund.payment.id,
      gateway: refund.payment.gateway,
      captured_amount: Number(refund.payment.capturedAmount || 0),
      captured_currency: refund.payment.capturedCurrency,
    },
    amount: Number(refund.amount),
    currency: refund.currency,
    status: String(refund.status).toLowerCase(),
    reason: refund.reason,
    created_at: refund.requestedAt,
    decided_at: refund.decidedAt,
    completed_at: refund.completedAt,
  })));
});

export default router;
