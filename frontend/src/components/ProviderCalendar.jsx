import { useMemo, useState } from 'react'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// Month-grid calendar for the provider portal. Ported from the OG frontend's
// Calendar widget but styled with the portal tokens and driven by real assigned
// bookings: non-cancelled bookings mark their day with a dot; selecting a day
// calls back so the schedule timeline can follow.
export default function ProviderCalendar({ bookings = [], selected, onSelect }) {
  const today = iso(new Date())
  const [cursor, setCursor] = useState(() => new Date(selected || Date.now()))
  const byDay = useMemo(() => {
    const map = new Map()
    for (const booking of bookings) {
      if (String(booking.status).toLowerCase() === 'cancelled') continue
      if (booking.providerId == null) continue
      map.set(booking.bookingDate, (map.get(booking.bookingDate) || 0) + 1)
    }
    return map
  }, [bookings])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7 // Monday-start
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)

  const shift = (delta) => setCursor(new Date(year, month + delta, 1))
  const selectedCount = selected ? byDay.get(selected) || 0 : 0

  return <div className="provider-calendar" role="group" aria-label="Booking calendar">
    <div className="provider-calendar-head">
      <button onClick={() => shift(-1)} aria-label="Previous month">‹</button>
      <b>{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
      <button onClick={() => shift(1)} aria-label="Next month">›</button>
    </div>
    <div className="provider-calendar-grid">
      {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      {cells.map((day, index) => day == null
        ? <i key={`pad-${index}`} className="provider-calendar-day is-empty" />
        : <button key={day} className={[
            'provider-calendar-day',
            iso(new Date(year, month, day)) === today ? 'is-today' : '',
            iso(new Date(year, month, day)) === selected ? 'is-selected' : '',
          ].filter(Boolean).join(' ')} onClick={() => onSelect(iso(new Date(year, month, day)))}>
            {day}
            {(byDay.get(iso(new Date(year, month, day))) || 0) > 0 && <i aria-hidden="true"><b /><b /><b /></i>}
          </button>)}
    </div>
    <p className="provider-calendar-foot">{selected ? `${selectedCount} service${selectedCount === 1 ? '' : 's'} on ${new Date(`${selected}T00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Select a day to view its schedule.'}</p>
  </div>
}
