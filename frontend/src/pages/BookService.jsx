import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { apiRequest } from '../services/api'
import { ActionButton } from '../components/ui'
import SessionConfirmationAnimation from '../components/SessionConfirmationAnimation'
import './BookService.css'

export default function BookService() {
  const navigate = useNavigate()
  const [token] = useState(sessionStorage.getItem('token') || '')
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [petType, setPetType] = useState('dog')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    let cancelled = false
    Promise.all([
      apiRequest('/services').catch(() => null),
      apiRequest('/subscriptions').catch(() => null),
    ]).then(([serviceData, planData]) => {
      if (cancelled) return
      setServices(serviceData || [])

      // Chatbot/package handoffs pass selectedPlanId. Resolve it against the
      // live catalog so the pre-selection and package details shown are
      // always the admin-managed database record, never stale UI state.
      const planId = sessionStorage.getItem('selectedPlanId')
      const planName = sessionStorage.getItem('selectedPlanName')
      const selectedCat = sessionStorage.getItem('selectedCategory')

      let resolvedPlan = null
      if (planData && planId) {
        resolvedPlan = planData.find((p) => String(p.id) === String(planId)) || null
      }
      if (!resolvedPlan && planData && planName) {
        resolvedPlan = planData.find((p) => p.title?.toLowerCase() === planName.toLowerCase()) || null
      }

      let matched = false
      if (serviceData && serviceData.length > 0) {
        if (resolvedPlan) {
          const firstEntitlement = (resolvedPlan.entitlements || []).find((e) => Number(e.units) > 0)
          if (firstEntitlement) {
            const match = serviceData.find((s) => s.category_id === firstEntitlement.category_id)
              || serviceData.find((s) => (s.category_name || '') === firstEntitlement.category_name)
            if (match) {
              setServiceId(String(match.id))
              matched = true
            }
          }
        }
        if (!matched && planName) {
          const match = serviceData.find((s) =>
            s.title?.toLowerCase().includes(planName.toLowerCase()) ||
            planName.toLowerCase().includes(s.title?.toLowerCase())
          )
          if (match) {
            setServiceId(String(match.id))
            matched = true
          }
        }
        if (!matched && selectedCat && selectedCat !== 'combo') {
          const catMatch = serviceData.find((s) =>
            (s.category_name || '').toLowerCase().includes(selectedCat.toLowerCase())
          )
          if (catMatch) {
            setServiceId(String(catMatch.id))
            matched = true
          }
        }
      }

      if (resolvedPlan) setSelectedPlan(resolvedPlan)
      // Consume the handoff keys so stale selections never resurface later.
      sessionStorage.removeItem('selectedPlanId')
      sessionStorage.removeItem('selectedPlanName')
      sessionStorage.removeItem('selectedCategory')
    }).catch(() => {})
    apiRequest('/categories').then(setCategories).catch(() => {})
    return () => { cancelled = true }
  }, [token, navigate])

  const selectedService = services.find(s => s.id === Number(serviceId))
  const selectedCatName = (selectedService?.category_name || '').toLowerCase()
  const detectedCategory = selectedCatName.includes('auto') ? 'auto' : selectedCatName.includes('garden') ? 'garden' : selectedCatName.includes('pet') ? 'pet' : 'auto'

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setResult(null); setLoading(true)
    try {
      let r = await apiRequest('/bookings', 'POST', {
        service_id: Number(serviceId),
        booking_date: date,
        booking_time: time,
        pet_type: detectedCategory === 'pet' ? petType : null,
      }, token)
      if (r && !r.pin_code && !r.start_pin && r.booking_id) {
        try {
          const pins = await apiRequest('/bookings/' + r.booking_id + '/pins', 'GET', null, token)
          r = { ...r, pin_code: pins.start_pin, start_pin: pins.start_pin, completion_pin: pins.completion_pin }
        } catch {
          // PIN recovery will occur on the customer dashboard
        }
      }
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
            <div style={{ marginBottom: '1.25rem' }}>
              <SessionConfirmationAnimation
                category={detectedCategory}
                petType={petType || 'dog'}
                compact={false}
                replayable={true}
              />
            </div>
            <div className="bs-success__icon">✓</div>
            <h2>Booking Confirmed</h2>
            <p className="bs-pin">
              {result.pin_code || result.start_pin
                ? <>Start PIN: <strong>{result.pin_code || result.start_pin}</strong></>
                : <>Security PIN: <strong>Unlocks once specialist is assigned</strong></>}
            </p>
            <p className="bs-price">LKR {Number(result.total_price).toLocaleString()}</p>
            <div className="bs-success__actions">
              <button className="bs-btn-gold" onClick={() => navigate('/customer-dashboard')}>View Dashboard</button>
              <button className="bs-btn-ghost" onClick={() => { setResult(null); setServiceId(''); setDate('') }}>Book Another</button>
            </div>
          </motion.div>
        ) : (
          <form className="bs-form" onSubmit={submit}>
            {selectedPlan && (
              <div className="bs-plan-banner" data-testid="selected-package-banner">
                <div className="bs-plan-banner__head">
                  <span className="bs-plan-banner__eyebrow">SELECTED PACKAGE</span>
                  <strong className="bs-plan-banner__title">{selectedPlan.title}</strong>
                </div>
                <div className="bs-plan-banner__meta">
                  <span className="bs-plan-banner__price">
                    LKR {Number(selectedPlan.discountedPriceMonthly ?? selectedPlan.priceMonthly).toLocaleString()}/month
                  </span>
                  <span className="bs-plan-banner__coins">
                    {(selectedPlan.entitlements || [])
                      .filter((e) => Number(e.units) > 0)
                      .map((e) => `${e.units} ${e.category_name} coin${Number(e.units) === 1 ? '' : 's'}`)
                      .join(' · ')}
                  </span>
                </div>
                <p className="bs-plan-banner__note">
                  Bookings under this package consume 1 coin per service visit.
                </p>
              </div>
            )}
            {error && (
              <div className="bs-error">
                {error}
                {/entitlement|package|subscription/i.test(error) && (
                  <div style={{ marginTop: '0.6rem' }}>
                    <button
                      type="button"
                      onClick={() => navigate('/customer-dashboard')}
                      style={{
                        background: 'var(--gold, #c9a84c)',
                        color: '#000',
                        border: 'none',
                        padding: '0.45rem 0.9rem',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      View Packages & Subscriptions
                    </button>
                  </div>
                )}
              </div>
            )}
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

            {detectedCategory === 'pet' && (
              <div style={{ marginBottom: '1.25rem', marginTop: '0.5rem' }}>
                <label className="bs-label">Pet Care Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setPetType('dog')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: petType === 'dog' ? '2px solid var(--gold, #c9a84c)' : '1px solid #333',
                      background: petType === 'dog' ? 'rgba(201,168,76,0.15)' : '#18181c',
                      color: petType === 'dog' ? 'var(--gold, #c9a84c)' : '#aaa',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>🐕</span> Dog Care
                  </button>
                  <button
                    type="button"
                    onClick={() => setPetType('cat')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: petType === 'cat' ? '2px solid var(--gold, #c9a84c)' : '1px solid #333',
                      background: petType === 'cat' ? 'rgba(201,168,76,0.15)' : '#18181c',
                      color: petType === 'cat' ? 'var(--gold, #c9a84c)' : '#aaa',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>🐈</span> Cat Care
                  </button>
                </div>
              </div>
            )}

            <div className="bs-row">
              <div className="bs-field">
                <label className="bs-label">Date</label>
                <input className="bs-input" type="date" value={date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="bs-field">
                <label className="bs-label">Time</label>
                <input className="bs-input" type="time" value={time} step="900" onChange={(e) => setTime(e.target.value)} required />
              </div>
            </div>

            <ActionButton
              className="bs-submit"
              type="submit"
              loading={loading}
              loadingText="Reserving concierge..."
            >
              Confirm Reservation
            </ActionButton>
          </form>
        )}
      </div>
    </motion.div>
  )
}
