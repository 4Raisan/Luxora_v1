import crypto from 'node:crypto';

const sameMoney = (left, right, toleranceCents = 1) => {
  const numLeft = Number(left);
  const numRight = Number(right);
  if (!Number.isFinite(numLeft) || !Number.isFinite(numRight)) return false;
  const leftCents = Math.round(numLeft * 100);
  const rightCents = Math.round(numRight * 100);
  return Math.abs(leftCents - rightCents) <= toleranceCents;
};

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

/**
 * Recursively sorts an object's keys alphabetically for NOWPayments IPN signature hashing.
 */
export function sortObject(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = (obj[key] && typeof obj[key] === 'object') ? sortObject(obj[key]) : obj[key];
      return result;
    }, {});
}

/**
 * Verifies the NOWPayments IPN signature header (x-nowpayments-sig) using HMAC-SHA512.
 */
export function verifyNowPaymentsSignature(payload, signature, ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET) {
  if (!ipnSecret || !signature || !payload || typeof payload !== 'object') return false;
  try {
    const sorted = sortObject(payload);
    const jsonString = JSON.stringify(sorted);
    const hmac = crypto.createHmac('sha512', String(ipnSecret).trim());
    const digest = hmac.update(jsonString).digest('hex');

    const providedSig = String(signature).toLowerCase().trim();
    const computedSig = digest.toLowerCase().trim();

    const sigBuffer = Buffer.from(providedSig, 'utf8');
    const digestBuffer = Buffer.from(computedSig, 'utf8');

    if (sigBuffer.length !== digestBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, digestBuffer);
  } catch {
    return false;
  }
}

/**
 * Classifies a NOWPayments IPN payload against an internal payment record.
 */
export function classifyNowPaymentsIpn(payment, payload = {}) {
  if (!payment || payment.gateway !== 'NOWPAYMENTS') return 'missing';
  if (payment.status === 'COMPLETED') return 'already_completed';

  const conversion = payment.webhookPayload?.conversion;
  const expectedGatewayAmount = conversion ? Number(conversion.convertedAmount) : Number(payment.expectedAmount);
  const expectedGatewayCurrency = conversion ? String(conversion.convertedCurrency).toUpperCase() : String(payment.expectedCurrency || '').toUpperCase();

  // If invoice price_amount & price_currency are provided in IPN, verify matching values
  if (payload.price_amount !== undefined && payload.price_amount !== null) {
    const amount = Number(payload.price_amount);
    const currency = String(payload.price_currency || '').toUpperCase();
    if (!sameMoney(amount, expectedGatewayAmount) || (currency && currency !== expectedGatewayCurrency)) {
      return 'amount_mismatch';
    }
  }

  const rawStatus = String(payload.payment_status || '').toLowerCase().trim();
  // ONLY 'finished' is final payment settlement
  if (rawStatus === 'finished') return 'success';
  // 'waiting', 'confirming', 'confirmed', and 'sending' remain processing/in-progress states
  if (['waiting', 'confirming', 'confirmed', 'sending'].includes(rawStatus)) return 'pending';
  if (['failed', 'expired'].includes(rawStatus)) return 'failed';
  if (rawStatus === 'refunded') return 'refunded';
  if (rawStatus === 'partially_paid') return 'partially_paid';

  return 'unsupported';
}
