// Dynamic real-time Currency Conversion Service for Luxora (LKR -> USD/Crypto)

let cachedRate = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Fetches the live USD to LKR exchange rate from reliable real-time forex APIs.
 */
export async function getLiveLkrToUsdRate() {
  const now = Date.now();
  if (cachedRate && (now - lastFetchTime) < CACHE_TTL_MS) {
    return { rate: cachedRate, timestamp: new Date(lastFetchTime).toISOString(), cached: true };
  }

  // 1. Primary: open.er-api.com
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000) });
    if (response.ok) {
      const data = await response.json();
      const lkrRate = Number(data?.rates?.LKR);
      if (Number.isFinite(lkrRate) && lkrRate > 50 && lkrRate < 1000) {
        cachedRate = lkrRate;
        lastFetchTime = now;
        return { rate: lkrRate, timestamp: new Date(now).toISOString(), source: 'open.er-api.com' };
      }
    }
  } catch (err) {
    console.warn('[currency] Primary exchange rate fetch failed:', err.message);
  }

  // 2. Fallback: api.exchangerate-api.com
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(4000) });
    if (response.ok) {
      const data = await response.json();
      const lkrRate = Number(data?.rates?.LKR);
      if (Number.isFinite(lkrRate) && lkrRate > 50 && lkrRate < 1000) {
        cachedRate = lkrRate;
        lastFetchTime = now;
        return { rate: lkrRate, timestamp: new Date(now).toISOString(), source: 'exchangerate-api.com' };
      }
    }
  } catch (err) {
    console.warn('[currency] Fallback exchange rate fetch failed:', err.message);
  }

  // 3. Fallback to cached rate if available or safe baseline
  const fallbackRate = cachedRate || 328.0;
  return { rate: fallbackRate, timestamp: new Date(now).toISOString(), source: cachedRate ? 'cache_expired' : 'baseline_fallback' };
}

/**
 * Converts an LKR amount to USD with exact 2-decimal rounding.
 */
export async function convertLkrToUsd(lkrAmount) {
  const numericLkr = Number(lkrAmount);
  if (!Number.isFinite(numericLkr) || numericLkr <= 0) {
    throw new Error('Invalid LKR amount for currency conversion');
  }

  const { rate, timestamp, source } = await getLiveLkrToUsdRate();
  const usdAmount = Number((numericLkr / rate).toFixed(2));

  // Ensure minimum 1 cent for valid financial transactions
  const finalUsd = Math.max(0.01, usdAmount);

  return {
    originalAmount: numericLkr,
    originalCurrency: 'LKR',
    convertedAmount: finalUsd,
    convertedCurrency: 'USD',
    exchangeRate: rate,
    rateTimestamp: timestamp,
    source,
  };
}
