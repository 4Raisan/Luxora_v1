// V2 Slice 1 — refund ledger core (design: docs/planning/V2_PLAN.md §2-3).
// Luxora-ledger-first: this slice records and governs the refund lifecycle.
// Provider interaction is manual/portal-recorded (`providerRef`); no provider
// refund-initiation API is assumed. Gateway-initiated external reversals
// (PayHere -3 / NOWPayments refunded IPN) keep their V1.5 behavior unchanged.
import { prisma } from '../config/prisma.js';

export const OPEN_REFUND_STATUSES = ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'];

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

    if (spec.role === 'ADMIN' && actorRole !== 'ADMIN') fail(403, 'Only administrators can perform this refund action');
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
