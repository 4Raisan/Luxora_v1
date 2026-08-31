import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { toPositiveInt } from '../middleware/validators.js';
import { notify, logAdminAction } from '../services/notify.js';

const router = Router();

async function subscriptionUsage(subscriptionId) {
  const bookings = await prisma.booking.findMany({ where: { subscriptionId, status: { not: 'CANCELLED' } }, select: { service: { select: { categoryId: true } } } });
  return bookings.length;
}
const details = { plan: { include: { entitlements: { include: { category: true } } } }, payments: { orderBy: { createdAt: 'desc' } }, refundRequest: true };

router.get('/refunds/my', authenticateToken, async (req, res) => {
  const subscriptions = await prisma.userSubscription.findMany({ where: { userId: req.user.id }, include: details, orderBy: { startDate: 'desc' } });
  const rows = await Promise.all(subscriptions.map(async (subscription) => ({ ...subscription, used_units: await subscriptionUsage(subscription.id), eligible: subscription.status === 'active' && !subscription.refundRequest, payment: subscription.payments.find((payment) => payment.status === 'COMPLETED') || null })));
  res.json(rows);
});

router.post('/refunds', authenticateToken, async (req, res) => {
  const subscriptionId = toPositiveInt(req.body.subscription_id);
  const reason = String(req.body.reason || '').trim();
  if (!subscriptionId || reason.length > 1000) return res.status(400).json({ error: 'A valid subscription_id and optional reason up to 1000 characters are required' });
  const subscription = await prisma.userSubscription.findFirst({ where: { id: subscriptionId, userId: req.user.id }, include: details });
  if (!subscription) return res.status(404).json({ error: 'Package purchase not found' });
  if (subscription.status !== 'active' || subscription.refundRequest) return res.status(409).json({ error: 'Only an active package purchase without an existing request is eligible for refund' });
  const payment = subscription.payments.find((item) => item.status === 'COMPLETED');
  const refund = await prisma.refundRequest.create({ data: { userId: req.user.id, subscriptionId: subscription.id, paymentId: payment?.id || null, reason: reason || null } });
  await notify(req.user.id, `Refund request #${refund.id} was received.`, '/customer-dashboard');
  res.status(201).json(refund);
});

router.get('/admin/refunds', authenticateToken, requireRole('ADMIN'), async (_req, res) => {
  const refunds = await prisma.refundRequest.findMany({
    include: {
      user: { select: { name: true, email: true } },
      subscription: { include: { plan: { include: { entitlements: { include: { category: true } } } } } },
      payment: true,
    },
    orderBy: { requestedAt: 'desc' },
  });
  res.json(refunds);
});

router.put('/admin/refunds/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const refund = await prisma.refundRequest.findUnique({ where: { id: toPositiveInt(req.params.id) || 0 }, include: { subscription: true, payment: true } });
  if (!refund) return res.status(404).json({ error: 'Refund request not found' });
  if (!['REQUESTED', 'APPROVED'].includes(refund.status)) {
    return res.status(400).json({ error: 'Only pending or approved refund requests can be reviewed or settled' });
  }

  const decision = String(req.body.status || '').toUpperCase();
  const adminNote = String(req.body.admin_note || '').trim();
  const allowedDecisions = refund.status === 'REQUESTED'
    ? ['APPROVED', 'REJECTED', 'REFUNDED']
    : ['REFUNDED', 'REJECTED'];

  if (!allowedDecisions.includes(decision) || adminNote.length > 2000) {
    return res.status(400).json({ error: `status must be one of: ${allowedDecisions.join(', ').toLowerCase()} and note up to 2000 characters` });
  }

  const demo = refund.payment?.gateway === 'DEMO';
  const manualSettlement = decision === 'REFUNDED' && (refund.status === 'APPROVED' || req.body.manual_settlement === true);
  const alreadyRefundedByGateway = refund.subscription?.status === 'refunded';

  let finalStatus;
  if (decision === 'REJECTED') {
    finalStatus = 'REJECTED';
  } else if (manualSettlement || demo || alreadyRefundedByGateway) {
    finalStatus = 'REFUNDED';
  } else if (decision === 'APPROVED') {
    finalStatus = 'APPROVED';
  } else {
    finalStatus = decision;
  }

  await prisma.$transaction(async (tx) => {
    await tx.refundRequest.update({
      where: { id: refund.id },
      data: { status: finalStatus, adminNote: adminNote || null, reviewedAt: new Date(), reviewedById: req.user.id },
    });
    if (finalStatus === 'REFUNDED') {
      await tx.userSubscription.update({
        where: { id: refund.subscriptionId },
        data: { status: 'refunded', autoRenew: false, nextRenewalDate: null },
      });
      if (refund.paymentId) {
        await tx.payment.update({
          where: { id: refund.paymentId },
          data: { status: 'REFUNDED' },
        });
      }
    }
  });

  const awaitingGateway = finalStatus === 'APPROVED' && refund.payment?.gateway === 'PAYHERE';
  const message = finalStatus === 'REFUNDED' && demo
    ? `Demo refund completed for package purchase #${refund.subscriptionId}. No real money was moved.`
    : finalStatus === 'REFUNDED'
      ? `Refund completed for package purchase #${refund.subscriptionId}. Your package has been disabled.`
      : awaitingGateway
        ? `Refund request #${refund.id} was approved. PayHere will confirm the refund; your package remains active until the gateway confirms it.`
        : `Refund request #${refund.id} was ${finalStatus.toLowerCase()}.`;

  await notify(refund.userId, message, '/customer-dashboard');
  logAdminAction({
    adminId: req.user.id,
    action: `REFUND_${finalStatus}`,
    targetType: 'RefundRequest',
    targetId: String(refund.id),
    details: { status: finalStatus, adminNote, awaitingGateway, manualSettlement: Boolean(manualSettlement) },
    ipAddress: req.ip,
  }).catch(() => {});

  res.json({
    status: finalStatus.toLowerCase(),
    ...(awaitingGateway ? { awaiting_gateway_confirmation: true } : {}),
    ...(manualSettlement ? { manually_settled: true } : {}),
  });
});

export default router;
