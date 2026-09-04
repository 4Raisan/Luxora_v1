import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api'
import { useRealtime } from '../hooks/useRealtime'
import './CustomerCustomRequests.css'

const requestState = (request) => {
  if (request.assignment_status === 'completed' || request.status === 'resolved' || request.status === 'closed') return 'completed'
  if (request.assignment_status === 'assigned' || request.provider_id) return 'assigned'
  return 'awaiting'
}

const requestLabel = (state) => ({
  awaiting: 'Awaiting Provider',
  assigned: 'Provider Assigned',
  completed: 'Completed',
}[state] || 'Awaiting Provider')

const formatDate = (date) => {
  if (!date) return 'Date not set'
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CustomerCustomRequests() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [activeCategory, setActiveCategory] = useState('awaiting')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRequests = useCallback(async () => {
    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token') {
      navigate('/login', { replace: true })
      return
    }
    setLoading(true)
    try {
      const rows = await apiRequest('/support/service-requests/my', 'GET', null, token)
      setRequests(Array.isArray(rows) ? rows : [])
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Could not load your custom requests.')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => { void loadRequests() }, [loadRequests])

  useRealtime({
    onEvent: (type) => {
      if (['SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_ASSIGNED', 'SERVICE_REQUEST_COMPLETED'].includes(type)) void loadRequests()
    },
    onSync: () => { void loadRequests() },
  })

  const grouped = {
    awaiting: requests.filter((request) => requestState(request) === 'awaiting'),
    assigned: requests.filter((request) => requestState(request) === 'assigned'),
    completed: requests.filter((request) => requestState(request) === 'completed'),
  }
  const visibleRequests = grouped[activeCategory]

  return (
    <main className="ccr-page">
      <div className="ccr-shell">
        <header className="ccr-header">
          <div>
            <p className="ccr-eyebrow">LUXORA CONCIERGE</p>
            <h1>Custom Requests</h1>
            <p>Track every tailored service request from submission to completion.</p>
          </div>
          <button type="button" className="ccr-back" onClick={() => navigate('/customer-dashboard')}>← Back to Dashboard</button>
        </header>

        <div className="ccr-tabs" role="tablist" aria-label="Custom request status">
          {['awaiting', 'assigned', 'completed'].map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={activeCategory === category}
              className={activeCategory === category ? 'is-active' : ''}
              onClick={() => setActiveCategory(category)}
            >
              {requestLabel(category)} <span>{grouped[category].length}</span>
            </button>
          ))}
        </div>

        {loading ? <p className="ccr-message">Loading custom requests…</p> : error ? <p className="ccr-message ccr-message--error">{error}</p> : (
          <section className="ccr-list" aria-live="polite">
            {visibleRequests.length === 0 ? (
              <div className="ccr-empty">No {requestLabel(activeCategory).toLowerCase()} requests.</div>
            ) : visibleRequests.map((request) => {
              const state = requestState(request)
              return (
                <article key={request.id} className="ccr-card">
                  <div className="ccr-card__head">
                    <span>REQUEST #{request.id}</span>
                    <strong className={`ccr-status ccr-status--${state}`}>{requestLabel(state)}</strong>
                  </div>
                  <h2>{request.subject || 'Custom service request'}</h2>
                  <p className="ccr-notes">{request.notes || 'No service requirements supplied.'}</p>
                  <dl className="ccr-details">
                    <div><dt>Category</dt><dd>{request.category || 'Not set'}</dd></div>
                    <div><dt>Preferred time</dt><dd>{formatDate(request.preferred_date)} · {request.preferred_time || 'Time not set'}</dd></div>
                    <div><dt>Location</dt><dd>{request.town || 'Not set'}</dd></div>
                    {state !== 'awaiting' && <div><dt>Provider</dt><dd>{request.provider_name || 'Assigned provider'}</dd></div>}
                  </dl>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}
