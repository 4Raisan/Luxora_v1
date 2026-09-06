// Asia/Colombo wall-clock helpers. Booking dates/times are Colombo wall-clock
// strings end to end (see backend/src/services/scheduling.js "TIME MODEL"), so
// client-side defaults must never be derived from the device timezone or UTC.
export const COLOMBO_TZ = 'Asia/Colombo'

// Today's date in Sri Lanka as a YYYY-MM-DD string.
export function colomboToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// The earliest bookable slot: `msAhead` from now, rounded up to a 15-minute
// boundary, expressed as Colombo wall-clock { date, hour, minute, ampm }.
export function colomboSlotAfter(msAhead = 4 * 60 * 60 * 1000, now = new Date()) {
  const slot = new Date(Math.ceil((now.getTime() + msAhead) / (15 * 60 * 1000)) * (15 * 60 * 1000))
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(slot)
  const get = (type) => parts.find((p) => p.type === type)?.value || '00'
  const hour24 = Number(get('hour')) % 24
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: String(hour12).padStart(2, '0'),
    minute: get('minute'),
    ampm: hour24 >= 12 ? 'PM' : 'AM',
  }
}
