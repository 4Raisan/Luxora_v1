// Shared input validators used across routes.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Accepts '09:00', '23:59' and '10:00 AM' / '10:00am'
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d(\s?(AM|PM))?$/i;

export const isEmail = (v) => typeof v === 'string' && EMAIL_RE.test(v.trim());
export const isDate = (v) => typeof v === 'string' && DATE_RE.test(v);
export const isTime = (v) => typeof v === 'string' && TIME_RE.test(v.trim());
export const isQuarterHourTime = (v) => {
  if (!isTime(v)) return false;
  const [, minutes] = v.trim().split(/\s+/)[0].split(':');
  return Number(minutes) % 15 === 0;
};
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

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', '12345678', '123456789',
  '1234567890', 'qwerty123', 'qwertyuiop', 'letmein123', 'iloveyou123',
  'admin123', 'admin1234', 'welcome123', 'luxora123', 'luxora12345', 'pass1234',
]);

export function validatePassword(v) {
  if (typeof v !== 'string') {
    return { valid: false, error: 'Password must be a string' };
  }
  if (v.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (v.length > 128) {
    return { valid: false, error: 'Password must be at most 128 characters long' };
  }
  if (COMMON_PASSWORDS.has(v.trim().toLowerCase())) {
    return { valid: false, error: 'Password is too common or easily guessable' };
  }
  const hasLetter = /[a-zA-Z]/.test(v);
  const hasNumber = /\d/.test(v);
  if (!hasLetter || !hasNumber) {
    return { valid: false, error: 'Password must contain both letters and numbers' };
  }
  if (/^(.)\1+$/.test(v)) {
    return { valid: false, error: 'Password cannot consist of a single repeated character' };
  }
  return { valid: true };
}

export const isPassword = (v) => validatePassword(v).valid;

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
