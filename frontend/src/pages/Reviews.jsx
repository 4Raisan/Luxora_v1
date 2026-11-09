import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { apiRequest } from '../services/api'
import './Reviews.css'

export default function Reviews() {
  const navigate = useNavigate()
  const [token] = useState(sessionStorage.getItem('token') || '')
  const [bookings, setBookings] = useState([])
  const [selected, setSelected] = useState(null)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadCompletedBookings = useCallback(async () => {
    if (!token) { navigate('/login'); return }
    try {
      const b = await apiRequest('/bookings/my', 'GET', null, token)
      const done = (b || []).filter((x) => x.status === 'completed' && !x.reviewed_at)
      setBookings(done)
      if (done.length) setSelected(done[0].id)
      else setSelected(null)
    } catch {
      setError('Could not load your completed bookings. Please refresh or try again shortly.')
    } finally {
      setLoading(false)
    }
  }, [token, navigate])

  useEffect(() => {
    void loadCompletedBookings()
  }, [loadCompletedBookings])

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    setError('')
    if (!rating) { setError('Please select a star rating.'); return }
    if (!selected) { setError('Please select a completed booking to review.'); return }
    try {
      await apiRequest('/reviews', 'POST', { booking_id: Number(selected), rating, comment }, token)
      setMsg('Thank you — your review has been recorded.')
      setComment('')
      setRating(0)
      await loadCompletedBookings()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <motion.div className="rv" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="rv-card">
        <p className="rv-eyebrow">SHARE YOUR EXPERIENCE</p>
        <h1 className="rv-title">Rate a Service</h1>

        {loading ? (
          <p className="rv-empty">Loading your completed services…</p>
        ) : bookings.length === 0 ? (
          <>
            <p className="rv-empty">No completed services to review yet.</p>
            {error && <div className="rv-error">{error}</div>}
          </>
        ) : (
          <form className="rv-form" onSubmit={submit}>
            <label className="rv-label" htmlFor="rv-booking">Completed Service</label>
            <select id="rv-booking" className="rv-select" value={selected || ''} onChange={(e) => setSelected(Number(e.target.value))}>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  #{b.id} · {b.service_title} · {b.bookingDate}
                </option>
              ))}
            </select>

            <span className="rv-label" id="rv-rating-label">Your Rating</span>
            <div className="rv-stars" role="group" aria-labelledby="rv-rating-label">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  className={`rv-star ${(hover || rating) >= n ? 'rv-star--on' : ''}`}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  aria-label={`${n} star`}
                >
                  ★
                </button>
              ))}
            </div>

            <label className="rv-label" htmlFor="rv-comment">Comment</label>
            <textarea
              id="rv-comment"
              className="rv-textarea"
              rows="4"
              placeholder="Tell us about the experience…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />

            {error && <div className="rv-error">{error}</div>}
            {msg && <div className="rv-ok">{msg}</div>}

            <button className="rv-submit" type="submit">Submit Review</button>
          </form>
        )}
      </div>
    </motion.div>
  )
}
