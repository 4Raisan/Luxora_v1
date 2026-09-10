// V2 Slice 1 — refund ledger core (design: docs/planning/V2_PLAN.md §2-3).
// Luxora-ledger-first: this slice records and governs the refund lifecycle.
// Provider interaction is manual/portal-recorded (`providerRef`); no provider
// refund-initiation API is assumed. Gateway-initiated external reversals
// (PayHere -3 / NOWPayments refunded IPN) keep their V1.5 behavior unchanged.
import { prisma } from '../config/prisma.js';
import { notify } from './notify.js';
import { broadcastToRole, broadcastToUser } from './realtime.js';

export const OPEN_REFUND_STATUSES = ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'];

// Admin transition map -> customer notification text (single source shared by
// the admin route and gateway settlement; sent once per real transition).
export const REFUND_CUSTOMER_MESSAGES = {
  UNDER_REVIEW: (refund) => `Your refund request #${refund.id} is being reviewed by our team.`,
  APPROVED: (refund) => `Your refund request #${refund.id} has been approved and is being prepared for processing.`,
  PROCESSING: (refund) => `Your refund of ${refund.currency} ${Number(refund.amount).toFixed(2)} is being processed back to your original payment method.`,
  COMPLETED: (refund) => `Your refund of ${refund.currency} ${Number(refund.amount).toFixed(2)} has been completed.`,
  FAILED: (refund) => `Your refund request #${refund.id} could not be processed. Our support team will contact you.`,
  REJECTED: (refund) => `Your refund request #${refund.id} has been declined. Please check your dashboard for details.`,
};

const notifyRefundTransition = (userId, refund) => {
  const builder = REFUND_CUSTOMER_MESSAGES[refund.status];
  return builder ? notify(userId, builder(refund), '/customer-dashboard') : Promise.resolve();
};

const fail = (statusCode, message) => {
  throw Object.assign(new Error(message), { statusCode });
};

// Legal transitions per actor. Admin actions drive the review pipeline;
// the requesting customer may only cancel while the request is still open.
const TRANSITIONS = {
  review: { from: ['REQUESTED'], to: 'UNDER_REVIEW', role: 'ADMIN' },
  approve: { from: ['UNDER_REVIEW'], to: 'APPROVED', role: 'ADMIN' },
  reject: { from: ['UNDER_REVIEW'], to: 'REJECTED', role: 'ADMIN' },
  cancel: { from: ['REQUESTED', 'UNDER_REVIEW'], to: 'CANCELLED', role: 'REQUESTER' },
  process: { from: ['APPROVED'], to: 'PROCESSING', role: 'ADMIN' },
  complete: { from: ['PROCESSING'], to: 'COMPLETED', role: 'ADMIN' },
  fail: { from: ['PROCESSING'], to: 'FAILED', role: 'ADMIN' },
};

// Amount still available for refund: captured amount minus every refund already
// COMPLETED and every refund still OPEN (open requests reserve their amount, so
// two overlapping requests can never promise the same money twice).
async function remainingRefundableInTx(tx, payment, { excludeRefundId = null } = {}) {
  const refunds = await tx.refundRequest.findMany({
    where: { paymentId: payment.id },
    select: { id: true, amount: true, status: true },
  });
  const reduce = (list) => list.reduce((total, r) => total + Number(r.amount), 0);
  const captured = Number(payment.capturedAmount || 0);
  const completed = reduce(refunds.filter((r) => r.status === 'COMPLETED'));
  const open = reduce(refunds.filter((r) => OPEN_REFUND_STATUSES.includes(r.status) && r.id !== excludeRefundId));
  return { captured, reserved: completed + open, remaining: captured - completed - open };
}

function validateAmount(amount, remaining) {
  if (amount === undefined || amount === null) return remaining; // default: full remaining
  const value = Number(amount);
  if (!Number.isFinite(value)) fail(400, 'Refund amount must be a number');
  if (value <= 0) fail(400, 'Refund amount must be greater than zero');
  if (value > remaining) fail(400, `Refund amount exceeds the refundable amount (${remaining.toFixed(2)})`);
  return value;
}

// Creates a refund request. Customer requests default to the full remaining
// amount and enter REQUESTED; admin-initiated (goodwill) refunds enter APPROVED.
// Concurrency: advisory lock on the payment id serializes creation and state
// transitions, so parallel requests can never over-commit the captured amount.
export async function createRefundRequest({ paymentId, requestedBy, amount, reason, isAdmin = false }) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(paymentId)})`;
    const payment = await tx.payment.findUnique({ where: { id: Number(paymentId) } });
    if (!payment) fail(404, 'Payment not found');
    if (payment.status !== 'COMPLETED') fail(400, 'Only completed payments can be refunded');
    if (!Number(payment.capturedAmount) || Number(payment.capturedAmount) <= 0) fail(400, 'This payment has no captured amount to refund');
    if (!isAdmin && payment.userId !== Number(requestedBy)) fail(403, 'This payment does not belong to you');

    const open = await tx.refundRequest.findFirst({
      where: { paymentId: payment.id, status: { in: OPEN_REFUND_STATUSES } },
    });
    if (open) return { alreadyOpen: true, refund: open };

    const { remaining } = await remainingRefundableInTx(tx, payment);
    const refundAmount = validateAmount(amount, remaining);

    return tx.refundRequest.create({
      data: {
        paymentId: payment.id,
        requestedBy: Number(requestedBy),
        amount: refundAmount,
        currency: payment.capturedCurrency || 'LKR',
        status: isAdmin ? 'APPROVED' : 'REQUESTED',
        reason: typeof reason === 'string' ? reason.trim().slice(0, 500) || null : null,
        decidedAt: isAdmin ? new Date() : null,
      },
    });
  }, { maxWait: 5000, timeout: 15000, isolationLevel: 'Serializable' });
}

// Applies one lifecycle transition. Race losers get 409 after the lock re-read;
// the winner's change is the only visible effect.
export async function transitionRefund(args) {
  try {
    return await runTransition(args);
  } catch (error) {
    // Duplicate provider references (portal/reference typos) are a client-facing conflict.
    if (error.code === 'P2002') fail(409, 'A refund with this provider reference is already in use');
    // Serializable write conflicts are race losers, not server faults: surface
    // them as conflicts so retries see the winner's state (matches payouts).
    if (error.code === 'P2034') fail(409, 'This refund was modified concurrently, retry the action');
    throw error;
  }
}

function runTransition({ refundId, actorUserId, actorRole, action, adminNote, providerRef }) {
  const spec = TRANSITIONS[action];
  if (!spec) fail(400, 'Unknown refund action');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.refundRequest.findUnique({ where: { id: Number(refundId) } });
    if (!existing) fail(404, 'Refund request not found');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(existing.paymentId)})`;
    const refund = await tx.refundRequest.findUnique({ where: { id: existing.id } });

    if (spec.role === 'ADMIN' && actorRole !== 'ADMIN') {
      // Slice 5: a signature-verified gateway refund event may drive only
      // process/complete (with a provider reference); review, approve,
      // reject, and fail stay admin-only so external events can never make
      // (or fake) an admin decision.
      const gatewayActor = actorRole === 'GATEWAY' && (action === 'process' || action === 'complete');
      if (!gatewayActor) fail(403, 'Only administrators can perform this refund action');
    }
    if (spec.role === 'REQUESTER' && refund.requestedBy !== Number(actorUserId)) fail(403, 'Only the requester can cancel this refund');
    if (!spec.from.includes(refund.status)) {
      fail(409, `Invalid refund transition: cannot ${action} a refund in status ${refund.status}`);
    }

    const data = { status: spec.to, updatedAt: new Date() };
    if (adminNote !== undefined && adminNote !== null) {
      const note = String(adminNote).trim();
      if (note.length > 1000) fail(400, 'adminNote must be at most 1000 characters');
      if (note) data.adminNote = note;
    }
    if (action === 'reject' && !data.adminNote) fail(400, 'A rejection requires an admin note');

    if (spec.to === 'APPROVED' || spec.to === 'REJECTED') data.decidedAt = new Date();

    if (spec.to === 'PROCESSING') {
      const ref = providerRef !== undefined && providerRef !== null ? String(providerRef).trim() : refund.providerRef;
      if (!ref) fail(400, 'A provider reference is required to mark a refund as processing');
      data.providerRef = ref;
    }

    if (spec.to === 'COMPLETED') {
      const ref = providerRef !== undefined && providerRef !== null ? String(providerRef).trim() : refund.providerRef;
      if (!ref) fail(400, 'A provider reference is required to complete a refund');
      data.providerRef = ref;
      data.completedAt = new Date();

      const payment = await tx.payment.findUnique({ where: { id: refund.paymentId } });
      // Defense in depth: remaining excludes this refund (it reserved its amount
      // at creation and the one-open-per-payment rule held since), so a captured
      // amount can never be over-refunded even if rows changed unexpectedly.
      const { remaining } = await remainingRefundableInTx(tx, payment, { excludeRefundId: refund.id });
      if (Number(refund.amount) > remaining) fail(409, 'Refund exceeds the refundable amount');

      // Mirror the gateway-refund revoke path: completing a refund revokes the
      // subscription that payment created, in the same transaction.
      if (payment?.subscriptionId) {
        await tx.userSubscription.update({
          where: { id: payment.subscriptionId },
          data: { status: 'refunded', autoRenew: false, nextRenewalDate: null },
        });
      }
    }

    const updated = await tx.refundRequest.update({ where: { id: refund.id }, data });
    return updated;
  }, { maxWait: 5000, timeout: 15000, isolationLevel: 'Serializable' });
}

// Correlation helper for later slices (webhooks / admin recording): returns the
// open refund for a payment whose lifecycle expects the given provider
// reference, or null. Kept in the service so webhook handling and the admin API
// share one definition of "open".
export async function findOpenRefundForPayment(paymentId) {
  return prisma.refundRequest.findFirst({
    where: { paymentId: Number(paymentId), status: { in: OPEN_REFUND_STATUSES } },
  });
}

// Slice 5 — gateway settlement correlation. A signature-verified provider
// refund event (PayHere -3 IPN / NOWPayments refunded IPN) proves the money
// was returned outside Luxora. If an APPROVED or PROCESSING refund request
// exists for that payment, it settles through the exact same state machine an
// admin uses — never from REQUESTED/UNDER_REVIEW, which still require an
// explicit admin decision. Without a matching refund this is a no-op and V1.5
// reversal behavior stands untouched.
// - APPROVED: the verified event reference records the externally handled
//   settlement (PROCESSING), then the same evidence completes it.
// - PROCESSING: the admin already recorded the real external reference, so it
//   is preserved and only the completion is recorded.
// Duplicate deliveries and lost races surface as statusCode errors and are
// absorbed: correlation is best-effort and never fails the V1.5 payment
// handling that the caller has already applied.
export async function settleRefundFromGatewayEvent({ paymentId, providerRef }) {
  if (!providerRef) return null;
  const refund = await findOpenRefundForPayment(paymentId);
  if (!refund || !['APPROVED', 'PROCESSING'].includes(refund.status)) return null;
  try {
    if (refund.status === 'APPROVED') {
      const processing = await transitionRefund({ refundId: refund.id, actorRole: 'GATEWAY', action: 'process', providerRef });
      await notifyRefundTransition(refund.requestedBy, processing);
      const processingSse = { refundId: processing.id, paymentId: processing.paymentId, status: 'processing' };
      broadcastToRole('ADMIN', 'REFUND_UPDATED', processingSse);
      broadcastToUser(processing.requestedBy, 'REFUND_UPDATED', processingSse);
    }
    const settled = await transitionRefund({ refundId: refund.id, actorRole: 'GATEWAY', action: 'complete' });
    await notifyRefundTransition(refund.requestedBy, settled);
    const settledSse = { refundId: settled.id, paymentId: settled.paymentId, status: 'completed' };
    broadcastToRole('ADMIN', 'REFUND_UPDATED', settledSse);
    broadcastToUser(settled.requestedBy, 'REFUND_UPDATED', settledSse);
    return settled;
  } catch (error) {
    if (error.statusCode) return null;
    throw error;
  }
}
