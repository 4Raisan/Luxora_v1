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
  const rows = await Promise.all(subscriptions.map(async (subscription) => ({ ...subscription, used_units: await subscriptionUsage(subscription.id), eligible: subscription.status === 'active' && !subscription.refundRequest && await subscriptionUsage(subscription.id) === 0, payment: subscription.payments.find((payment) => payment.status === 'COMPLETED') || null })));
  res.json(rows);
});

router.post('/refunds', authenticateToken, async (req, res) => {
  const subscriptionId = toPositiveInt(req.body.subscription_id);
  const reason = String(req.body.reason || '').trim();
  if (!subscriptionId || reason.length > 1000) return res.status(400).json({ error: 'A valid subscription_id and optional reason up to 1000 characters are required' });
  const subscription = await prisma.userSubscription.findFirst({ where: { id: subscriptionId, userId: req.user.id }, include: details });
  if (!subscription) return res.status(404).json({ error: 'Package purchase not found' });
  if (subscription.status !== 'active' || subscription.refundRequest || await subscriptionUsage(subscription.id) !== 0) return res.status(409).json({ error: 'Only a completely unused active package purchase is eligible for refund' });
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
  if (!refund || refund.status !== 'REQUESTED') return res.status(404).json({ error: 'Pending refund request not found' });
  const decision = String(req.body.status || '').toUpperCase();
  const adminNote = String(req.body.admin_note || '').trim();
  if (!['APPROVED', 'REJECTED'].includes(decision) || adminNote.length > 2000) return res.status(400).json({ error: 'status must be APPROVED or REJECTED and note up to 2000 characters' });
  const demo = refund.payment?.gateway === 'DEMO';
  // Business rule: PayHere money is only refunded on gateway confirmation (webhook
  // status_code -3), which also disables the package. An admin approval on a real
  // PayHere payment therefore stays APPROVED — awaiting gateway confirmation — and
  // the package remains active until that webhook settles it atomically.
  const alreadyRefundedByGateway = refund.subscription?.status === 'refunded';
  const finalStatus = decision === 'APPROVED' && (demo || alreadyRefundedByGateway) ? 'REFUNDED' : decision;
  await prisma.$transaction(async (tx) => {
    await tx.refundRequest.update({ where: { id: refund.id }, data: { status: finalStatus, adminNote: adminNote || null, reviewedAt: new Date(), reviewedById: req.user.id } });
    if (finalStatus === 'REFUNDED') { await tx.userSubscription.update({ where: { id: refund.subscriptionId }, data: { status: 'refunded', autoRenew: false, nextRenewalDate: null } }); if (refund.paymentId) await tx.payment.update({ where: { id: refund.paymentId }, data: { status: 'REFUNDED' } }); }
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
  logAdminAction({ adminId: req.user.id, action: `REFUND_${finalStatus}`, targetType: 'RefundRequest', targetId: String(refund.id), details: { status: finalStatus, adminNote, awaitingGateway }, ipAddress: req.ip }).catch(() => {});
  res.json({ status: finalStatus.toLowerCase(), ...(awaitingGateway ? { awaiting_gateway_confirmation: true } : {}) });
});

export default router;
