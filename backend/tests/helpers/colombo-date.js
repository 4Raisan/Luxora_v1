// Colombo-local YYYY-MM-DD for N days from now. The test runner pins TZ to
// Asia/Colombo, so local getters are Colombo's calendar. UTC-based arithmetic
// (toISOString) rots once Colombo's day is ahead of UTC's: a "tomorrow"
// booking can silently become a same-day booking and fail the 4-hour lead
// time during the UTC-evening window.
export function colomboDate(offsetDays = 1) {
  const day = new Date(Date.now() + offsetDays * 86400000);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
