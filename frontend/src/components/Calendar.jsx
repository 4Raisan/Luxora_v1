import { useState, useEffect } from 'react'
import './Calendar.css'

const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

/* Returns the calendar grid: array of day objects (or null for empty cells) */
const buildCalendarDays = (year, month) => {
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells = []

  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, type: 'prev' })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, type: 'current' })
  }

  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, type: 'next' })
    }
  }

  return cells
}

const Calendar = ({ bookings = [], selectedDay, onSelectDay }) => {
  const today = new Date()
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [localSelected, setLocalSelected] = useState(selectedDay || today.getDate())

  useEffect(() => {
    if (selectedDay) setLocalSelected(selectedDay)
  }, [selectedDay])

  const cells = buildCalendarDays(viewYear, viewMonth)

  const goToPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const goToNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleDayClick = (day) => {
    setLocalSelected(day)
    if (onSelectDay) onSelectDay(day)
  }

  const isToday = (cell) =>
    cell.type === 'current' &&
    cell.day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear()

  // Booking days map e.g. [16, 19, 22, 25] (skipping CANCELLED bookings).
  // More than one service can share a day, including accepted requested services.
  const bookingDaysMap = {}
  bookings.forEach(b => {
    if (b.status === 'CANCELLED') return
    const scheduledDate = b.bookingDate ? new Date(`${b.bookingDate}T00:00:00`) : null
    if (scheduledDate && !Number.isNaN(scheduledDate.getTime())
      && (scheduledDate.getFullYear() !== viewYear || scheduledDate.getMonth() !== viewMonth)) return
    const d = scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate.getDate() : parseInt(b.day, 10)
    if (!isNaN(d)) bookingDaysMap[d] = [...(bookingDaysMap[d] || []), b]
  })

  const matchedBookings = bookingDaysMap[localSelected] || []
  const matchedBooking = matchedBookings[0]

  return (
    <div className="cal" id="cal-widget">
      {/* Header */}
      <div className="cal__header">
        <span className="cal__month-label">
          {MONTHS[viewMonth].toUpperCase()} {viewYear}
        </span>
        <div className="cal__nav">
          <button className="cal__nav-btn" onClick={goToPrev} id="cal-prev-btn" aria-label="Previous month">
            ‹
          </button>
          <button className="cal__nav-btn" onClick={goToNext} id="cal-next-btn" aria-label="Next month">
            ›
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="cal__grid">
        {DAYS_OF_WEEK.map(d => (
          <span key={d} className="cal__dow">{d}</span>
        ))}

        {/* Day cells */}
        {cells.map((cell, i) => {
          const isTod = isToday(cell)
          const dayBookings = bookingDaysMap[cell.day] || []
          const hasBooking = cell.type === 'current' && dayBookings.length > 0
          const isSel = cell.type === 'current' && cell.day === localSelected

          return (
            <button
              key={i}
              id={cell.type === 'current' ? `cal-day-${cell.day}` : undefined}
              className={[
                'cal__day',
                cell.type !== 'current' ? 'cal__day--faded' : '',
                isTod ? 'cal__day--today' : '',
                hasBooking ? 'cal__day--has-booking' : '',
                isSel && !isTod ? 'cal__day--selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => cell.type === 'current' && handleDayClick(cell.day)}
              tabIndex={cell.type === 'current' ? 0 : -1}
            >
              {cell.day}
              {hasBooking && <span className="cal__booking-dot" style={{ background: isTod ? '#000' : dayBookings[0].color }} />}
            </button>
          )
        })}
      </div>

      {/* Footer: selected date */}
      {matchedBooking ? (
        <div className="cal__footer cal__footer--active" style={{ borderLeftColor: matchedBooking.color }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="cal__footer-dot" style={{ background: matchedBooking.color }} />
              <strong style={{ color: '#fff', fontSize: '0.75rem' }}>{localSelected} {MONTHS[viewMonth]} {viewYear}</strong>
              <span style={{ fontSize: '0.62rem', color: matchedBooking.color, border: `1px solid ${matchedBooking.color}`, padding: '0.1rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
                {matchedBookings.length > 1 ? `${matchedBookings.length} SERVICES` : matchedBooking.status}
              </span>
            </div>
            {matchedBookings.map((booking) => (
              <div key={`${booking.apiId || booking.id}-${booking.title}`} style={{ marginTop: '0.25rem' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 600 }}>{booking.title}</p>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.65rem', color: '#888' }}>{booking.sub}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="cal__footer">
          <span className="cal__footer-dot" />
          <span className="cal__footer-text">
            {localSelected} {MONTHS[viewMonth]} {viewYear} — No Scheduled Service
          </span>
        </div>
      )}
    </div>
  )
}

export default Calendar
