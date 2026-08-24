const sameMoney = (left, right) => Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.round(Number(left) * 100) === Math.round(Number(right) * 100);

export function classifyPayHereWebhook(payment, payload = {}) {
  if (!payment || payment.gateway !== 'PAYHERE') return 'missing';
  if (payment.status === 'COMPLETED') return 'already_completed';
  const amount = Number(payload.payhere_amount);
  const currency = String(payload.payhere_currency || '').toUpperCase();
  if (!sameMoney(amount, payment.expectedAmount) || currency !== String(payment.expectedCurrency || '').toUpperCase()) return 'amount_mismatch';
  const statusCode = Number(payload.status_code);
  if (statusCode === 0) return 'pending';
  if (statusCode === -1 || statusCode === -2) return 'failed';
  if (statusCode === -3) return 'refunded';
  if (statusCode === 2) return 'success';
  return 'unsupported';
}
