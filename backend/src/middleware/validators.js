// Shared input validators used across routes.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Accepts '09:00', '23:59' and '10:00 AM' / '10:00am'
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d(\s?(AM|PM))?$/i;

export const isEmail = (v) => typeof v === 'string' && EMAIL_RE.test(v.trim());
export const isDate = (v) => typeof v === 'string' && DATE_RE.test(v);
export const isTime = (v) => typeof v === 'string' && TIME_RE.test(v.trim());
export const isNonEmptyString = (v, max = 500) =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;

export const toPositiveInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const isTodayOrFuture = (dateStr) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateStr >= todayStr;
};

export const isPassword = (v) => typeof v === 'string' && v.length >= 6;

// Normalizes any-case status string to a Prisma enum value.
// Returns null when the value is not one of the allowed enum members.
export const toEnum = (value, allowed) => {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  return allowed.includes(upper) ? upper : null;
};

export const BOOKING_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const KYC_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
export const COMPLAINT_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED'];
