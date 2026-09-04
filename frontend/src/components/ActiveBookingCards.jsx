import './ActiveBookingCards.css'

const statusKey = (status) => String(status || 'PENDING').toLowerCase()

const bookingDateParts = (value) => {
  const parsed = value ? new Date(`${value}T00:00:00`) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return { month: 'DATE', day: '—' }
  return {
    month: parsed.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: parsed.getDate(),
  }
}

const ActiveBookingCards = ({
  bookings,
  selectedBookingId,
  onToggleDetails,
  onCancel,
  onReview,
  isPinUnlocked,
}) => {
  if (!bookings.length) {
    return (
      <div className="cd-active-booking-empty">
        <span className="cd-active-booking-empty__icon">◇</span>
        <strong>No active service bookings found</strong>
        <small>Try clearing the filters or schedule a new concierge service.</small>
      </div>
    )
  }

  return (
    <div className="cd-active-booking-list">
      {bookings.map((booking) => {
        const status = String(booking.status || 'PENDING').toUpperCase()
        const statusClass = statusKey(status)
        const selected = selectedBookingId === booking.id
        const canCancel = status === 'PENDING' || status === 'ASSIGNED'
        const pinUnlocked = typeof isPinUnlocked === 'function' && isPinUnlocked(booking)
        const { month, day } = bookingDateParts(booking.date)

        return (
          <article
            key={booking.id}
            className={`cd-active-booking-card cd-active-booking-card--${statusClass} ${selected ? 'is-expanded' : ''}`}
          >
            <div className="cd-active-booking-card__summary">
              <div className="cd-active-booking-date" aria-label={booking.date || 'Date not set'}>
                <span>{month}</span>
                <strong>{day}</strong>
              </div>

              <div className="cd-active-booking-card__identity">
                <div className="cd-active-booking-card__title-row">
                  <h2>{booking.service || 'Concierge Service'}</h2>
                  <span
                    className={`cd-active-booking-status cd-active-booking-status--${statusClass}`}
                    title={booking.cancellationReason || undefined}
                  >
                    {status.replaceAll('_', ' ')}
                  </span>
                </div>
                <p>
                  {booking.providerName || 'Awaiting assignment'}
                  <span>•</span>
                  {booking.location || 'Town not set'}
                </p>
                {booking.providerPhone && (
                  <small className="cd-active-booking-card__phone">📞 {booking.providerPhone}</small>
                )}
                <div className="cd-active-booking-card__meta">
                  <span>Booking #{booking.id}</span>
                  <span>{booking.time || 'Time not set'}</span>
                </div>
              </div>
            </div>

            {selected && status !== 'CANCELLED' && (
              <div className="cd-active-booking-details">
                <div className="cd-active-booking-detail">
                  <span>Provider</span>
                  <strong>{booking.providerName || 'Awaiting assignment'}</strong>
                  <small>{booking.providerPhone || 'Contact appears after assignment'}</small>
                </div>
                <div className="cd-active-booking-detail">
                  <span>Service location</span>
                  <strong>{booking.location || 'Address not set'}</strong>
                  <small>{booking.date || 'Date not set'} · {booking.time || 'Time not set'}</small>
                </div>
                <div className="cd-active-booking-detail cd-active-booking-detail--pin">
                  <span>Start security PIN</span>
                  <strong>{status === 'ASSIGNED' || status === 'IN_PROGRESS' ? (booking.startPin || booking.pin || '••••••') : 'AWAITING PROVIDER'}</strong>
                  <small>{status === 'ASSIGNED' || status === 'IN_PROGRESS' ? 'Share when provider arrives' : 'Available once provider is assigned'}</small>
                </div>
                <div className="cd-active-booking-detail cd-active-booking-detail--pin">
                  <span>Completion PIN</span>
                  <strong>{status === 'IN_PROGRESS' ? (booking.completionPin || booking.endPin || '••••••') : 'HIDDEN'}</strong>
                  <small>{status === 'IN_PROGRESS' ? 'Share once service is completed' : 'Unlocks after provider starts service'}</small>
                </div>
              </div>
            )}

            <div className="cd-active-booking-card__actions">
              {status !== 'CANCELLED' && (
                <button
                  type="button"
                  className="cd-active-booking-action cd-active-booking-action--primary"
                  onClick={() => onToggleDetails(booking.id)}
                >
                  {selected ? 'HIDE DETAILS' : pinUnlocked ? 'VIEW DETAILS & PIN' : 'VIEW DETAILS'}
                </button>
              )}
              {booking.providerPhone && status !== 'CANCELLED' && (
                <a className="cd-active-booking-action" href={`tel:${booking.providerPhone}`}>CALL PROVIDER</a>
              )}
              {canCancel && (
                <button type="button" className="cd-active-booking-action cd-active-booking-action--danger" onClick={() => onCancel(booking.id)}>
                  CANCEL BOOKING
                </button>
              )}
              {status === 'COMPLETED' && !booking.reviewRating && booking.providerName && booking.providerName !== 'Awaiting assignment' && (
                <button type="button" className="cd-active-booking-action" onClick={() => onReview(booking)}>★ RATE SERVICE</button>
              )}
              {status === 'COMPLETED' && booking.reviewRating && (
                <span className="cd-active-booking-action" aria-label={`Your rating: ${booking.reviewRating} out of 5 stars`} style={{ cursor: 'default' }}>
                  {'★'.repeat(Number(booking.reviewRating))}{'☆'.repeat(5 - Number(booking.reviewRating))} YOUR RATING
                </span>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

export default ActiveBookingCards
