// V2 Slice 4 — customer refund UI helpers.
// Pure presentation logic only: the backend refund service
// (backend/src/services/refunds.js) stays the single source of truth for
// eligibility, amounts, and the state machine. These helpers never decide
// whether a refund is allowed — they only translate API data into what a
// customer sees. Kept dependency-free so node:test can exercise them.

// Backend RefundRequest.status -> customer-friendly wording.
export const REFUND_STATUS_LABELS = {
  requested: 'Request received',
  under_review: 'Being reviewed',
  approved: 'Approved',
  processing: 'Refund being processed',
  completed: 'Refund completed',
  rejected: 'Refund rejected',
  failed: 'Refund failed',
  cancelled: 'Cancelled',
};

export function refundStatusLabel(status) {
  const key = String(status || '').toLowerCase();
  return REFUND_STATUS_LABELS[key] || String(status || '');
}

// Open (active) lifecycle states while the request can still change.
export const REFUND_OPEN_STATUSES = ['requested', 'under_review', 'approved', 'processing'];

export function isOpenRefundStatus(status) {
  return REFUND_OPEN_STATUSES.includes(String(status || '').toLowerCase());
}

// Badge tone: open requests stay gold, success turns green, closed outcomes
// are muted so terminal states read as finished at a glance.
export function refundStatusTone(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'completed') return 'completed';
  if (key === 'failed' || key === 'rejected') return 'failed';
  if (REFUND_OPEN_STATUSES.includes(key)) return 'active';
  return 'closed';
}

// Cancelling is the backend's call; the UI only offers the action while the
// service still accepts it — per the refund transitions a requester may cancel
// only from REQUESTED/UNDER_REVIEW (approved/processing are already in flight).
const REFUND_CANCELLABLE_STATUSES = ['requested', 'under_review'];

export function refundCanShowCancel(status) {
  return REFUND_CANCELLABLE_STATUSES.includes(String(status || '').toLowerCase());
}

// Maps one GET /payments/refunds/my row to the customer-visible display model.
// Only the fields a customer may see are copied out; anything else on the row
// (admin notes, internal refs, provider data) is dropped by construction.
export function mapCustomerRefundRow(row) {
  if (!row || typeof row !== 'object') return null;
  const amount = Number(row.amount);
  const updatedAt = row.completed_at || row.decided_at || null;
  return {
    id: row.id,
    paymentId: row.payment_id,
    payment: row.payment
      ? { id: row.payment.id, gateway: row.payment.gateway, capturedAmount: Number(row.payment.captured_amount || 0), capturedCurrency: row.payment.captured_currency }
      : null,
    amount: Number.isFinite(amount) ? amount : 0,
    currency: row.currency || 'LKR',
    status: String(row.status || '').toLowerCase(),
    reason: typeof row.reason === 'string' ? row.reason : '',
    requestedAt: row.created_at || null,
    updatedAt,
    cancellable: refundCanShowCancel(row.status),
  };
}

export function mapCustomerRefundRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapCustomerRefundRow).filter(Boolean);
}

// Parses the refund amount the customer typed (or the prefilled payment
// amount) into a positive number for the API call. Returns null when the
// input is not a usable positive amount; the backend re-validates everything.
export function parseRefundAmountInput(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw);
  if (text.includes('-')) return null; // "-5" must not be cleaned into 5
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
