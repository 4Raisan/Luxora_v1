// Slice 10 — admin webhook/event viewer model. Derived from Payment rows that
// carry a stored webhookPayload (the latest delivery per payment is kept by
// the gateway handlers). Strictly read-only: nothing here mutates records.
// Stored event and viewer representation are separate — payloads are deep
// sanitized before leaving the API so signatures and secret-like fields can
// never reach the browser.
import { prisma } from '../config/prisma.js';
import { Prisma } from '@prisma/client';

const SENSITIVE_KEY_RE = /(sig(?:nature)?|secret|token|password|credential|auth(?:orization)?|api_?key|access_?key|private_?key)/i;
const MAX_VALUE_CHARS = 1000;
const MAX_PAYLOAD_CHARS = 20000;
const GATEWAYS = ['PAYHERE', 'NOWPAYMENTS', 'DEMO'];
const PAYMENT_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 92;

function maskValue() { return '[REDACTED]'; }

// Deep-clones the stored payload with sensitive keys redacted and oversized
// strings truncated. Returns { payload, truncated } where payload is null when
// the sanitized JSON would still exceed MAX_PAYLOAD_CHARS.
export function sanitizeWebhookPayload(raw) {
  if (raw === null || raw === undefined) return { payload: null, truncated: false };
  let anyTruncated = false;
  const walk = (value, depth) => {
    if (value === null || value === undefined) return null;
    if (depth > 8) { anyTruncated = true; return '[depth limit]'; }
    if (typeof value === 'string') {
      if (value.length > MAX_VALUE_CHARS) { anyTruncated = true; return `${value.slice(0, MAX_VALUE_CHARS)}…[truncated ${value.length - MAX_VALUE_CHARS} chars]`; }
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      if (value.length > 50) anyTruncated = true;
      return value.slice(0, 50).map((item) => walk(item, depth + 1));
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length > 100) anyTruncated = true;
      const result = {};
      for (const [key, child] of entries.slice(0, 100)) {
        result[key] = SENSITIVE_KEY_RE.test(key) ? maskValue() : walk(child, depth + 1);
      }
      return result;
    }
    return String(value);
  };
  const sanitized = walk(raw, 0);
  const serialized = JSON.stringify(sanitized);
  if (serialized.length > MAX_PAYLOAD_CHARS) return { payload: null, truncated: true };
  return { payload: sanitized, truncated: anyTruncated };
}

// Presentational classification derived from the stored payload — no new
// provider capabilities are implied.
export function classifyWebhookEvent(gateway, payload) {
  if (!payload || typeof payload !== 'object') return 'unknown';
  if (gateway === 'PAYHERE') {
    if (payload.supersededBy) return 'order_superseded';
    const code = Number(payload.status_code);
    if (code === 2) return 'charge_settled';
    if (code === -3) return 'refund_event';
    if (code === -1) return 'charge_canceled';
    if (code === -2) return 'charge_failed';
    return `status_code_${payload.status_code ?? 'unknown'}`;
  }
  if (gateway === 'NOWPAYMENTS') {
    const status = String(payload.payment_status || '').toLowerCase();
    if (status === 'finished') return 'charge_settled';
    if (status === 'refunded') return 'refund_event';
    if (status === 'expired' || status === 'failed') return 'charge_failed';
    return status ? `ipn_${status}` : 'ipn';
  }
  if (gateway === 'DEMO') return payload.promotion ? 'demo_purchase' : 'demo_event';
  return 'unknown';
}

function parseDayWindow(query) {
  const from = query.from ? String(query.from) : null;
  const to = query.to ? String(query.to) : null;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) return { error: 'from and to must be dates formatted YYYY-MM-DD' };
  if (from && to && to < from) return { error: 'to must not be earlier than from' };
  if (from && to) {
    const days = (new Date(`${to}T00:00:00.000Z`) - new Date(`${from}T00:00:00.000Z`)) / 86400000;
    if (days > MAX_RANGE_DAYS) return { error: `Date range is limited to ${MAX_RANGE_DAYS} days; narrow the range` };
  }
  return {
    from: from ? new Date(`${from}T00:00:00.000Z`) : null,
    to: to ? new Date(`${to}T23:59:59.999Z`) : null,
  };
}

function viewerWhere({ gateway, status, paymentId, reference, from, to }) {
  return {
    webhookPayload: { not: Prisma.AnyNull },
    ...(gateway ? { gateway } : {}),
    ...(status ? { status } : {}),
    ...(paymentId ? { id: paymentId } : {}),
    ...(reference ? { gatewayOrderId: { contains: reference, mode: 'insensitive' } } : {}),
    ...(from || to ? { updatedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
}

function summarize(payment) {
  return {
    payment_id: payment.id,
    gateway: payment.gateway.toLowerCase(),
    reference: payment.gatewayOrderId,
    payment_status: payment.status.toLowerCase(),
    amount: Number(payment.expectedAmount),
    expected_currency: payment.expectedCurrency,
    captured_amount: payment.capturedAmount === null ? null : Number(payment.capturedAmount),
    captured_currency: payment.capturedCurrency,
    received_at: payment.updatedAt,
    event_kind: classifyWebhookEvent(payment.gateway, payment.webhookPayload),
  };
}

// Paginated newest-first list of payments that have a stored webhook payload.
export async function listWebhookEvents({ gateway = null, status = null, paymentId = null, reference = null, from = null, to = null, skip = 0, take = 25 }) {
  const where = viewerWhere({ gateway, status, paymentId, reference, from, to });
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
  ]);
  return { total, events: rows.map(summarize) };
}

// Full sanitized event: viewer summary, redacted payload, and the refund
// correlation recorded for this payment (if any) — everything an operator
// needs to reason about a delivery without raw secret exposure.
export async function describeWebhookEvent(paymentId) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, webhookPayload: { not: Prisma.AnyNull } },
  });
  if (!payment) return null;
  const { payload, truncated } = sanitizeWebhookPayload(payment.webhookPayload);
  const refund = await prisma.refundRequest.findFirst({
    where: { paymentId: payment.id },
    select: { id: true, status: true, providerRef: true, amount: true },
  });
  return {
    ...summarize(payment),
    payload,
    payload_truncated: truncated,
    payload_bytes: JSON.stringify(payment.webhookPayload ?? null).length,
    refund_correlation: refund && {
      refund_id: refund.id,
      status: refund.status.toLowerCase(),
      provider_ref: refund.providerRef,
      amount: Number(refund.amount),
    },
  };
}

export const WEBHOOK_FILTERS = { GATEWAYS: GATEWAYS, STATUSES: PAYMENT_STATUSES, parseDayWindow };
