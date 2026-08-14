import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { apiRequest } from '../services/api'
import './BookService.css'

export default function BookService() {
  const navigate = useNavigate()
  const [token] = useState(localStorage.getItem('luxora_token') || '')
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    apiRequest('/services').then(setServices).catch(() => {})
    apiRequest('/categories').then(setCategories).catch(() => {})
  }, [token])

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setResult(null); setLoading(true)
    try {
      const r = await apiRequest('/bookings', 'POST', { service_id: Number(serviceId), booking_date: date, booking_time: time }, token)
      setResult(r)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const grouped = categories.map((c) => ({
    ...c,
    items: services.filter((s) => s.category_id === c.id),
  }))

  return (
    <motion.div className="bs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="bs-card">
        <p className="bs-eyebrow">RESERVE A CONCIERGE</p>
        <h1 className="bs-title">Book a Service</h1>
        <p className="bs-sub">Select a bespoke service and a time that suits your residence. A KYC-verified specialist will be assigned automatically.</p>

        {result ? (
          <motion.div className="bs-success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="bs-success__icon">✓</div>
            <h2>Booking Confirmed</h2>
            <p>Booking #{result.booking_id} · <strong>{result.status.toUpperCase()}</strong></p>
            <p className="bs-pin">Your verification PIN: <strong>{result.pin_code}</strong></p>
            <p className="bs-price">LKR {Number(result.total_price).toLocaleString()}</p>
            <div className="bs-success__actions">
              <button className="bs-btn-gold" onClick={() => navigate('/customer-dashboard')}>View Dashboard</button>
              <button className="bs-btn-ghost" onClick={() => { setResult(null); setServiceId(''); setDate('') }}>Book Another</button>
            </div>
          </motion.div>
        ) : (
          <form className="bs-form" onSubmit={submit}>
            {error && <div className="bs-error">{error}</div>}
            <label className="bs-label">Service Category</label>
            <select className="bs-select" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
              <option value="">— Choose a service —</option>
              {grouped.map((g) => (
                <optgroup key={g.id} label={g.name}>
                  {g.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} — LKR {Number(s.price).toLocaleString()}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div className="bs-row">
              <div className="bs-field">
                <label className="bs-label">Date</label>
                <input className="bs-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="bs-field">
                <label className="bs-label">Time</label>
                <input className="bs-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
            </div>

            <button className="bs-submit" type="submit" disabled={loading}>
              {loading ? 'Reserving…' : 'Confirm Reservation'}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  )
}
