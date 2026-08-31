import React, { useState } from 'react'

export function SpecialAskCard({ onSubmitSpecialAsk }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [details, setDetails] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!details.trim()) return
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setSubmitted(true)
      onSubmitSpecialAsk?.({ details })
    }, 800)
  }

  return (
    <div className="lx-special-ask-card">
      <div className="lx-special-ask-card__header">
        <span className="lx-special-ask-card__badge">BESPOKE CONCIERGE</span>
        <h4 style={{ fontFamily: 'var(--lx-chat-font-display)', fontSize: '0.95rem', color: '#FFF' }}>
          Special Ask Service
        </h4>
      </div>

      <p className="lx-special-ask-card__text">
        Your requirement falls outside our standard service coverage. I can help you submit a Special Ask to the Luxora team so they can review your requirements and provide the appropriate solution.
      </p>

      <div className="lx-special-ask-card__notice">
        <strong>Important:</strong> Special Ask Service is individually assessed by our concierge team. Prices are never automated or estimated without human review.
      </div>

      {submitted ? (
        <div style={{ padding: '8px 12px', background: 'rgba(95, 189, 139, 0.15)', border: '1px solid #5FBD8B', borderRadius: '8px', color: '#5FBD8B', fontSize: '0.8rem' }}>
          ✓ Special Ask inquiry submitted. Our Senior Concierge Desk will review and contact you directly.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <textarea
            placeholder="Describe your custom requirement (e.g. multi-car fleet ceramic coat, estate acreage overhaul, private event staging)..."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--lx-chat-line)',
              borderRadius: '8px',
              color: '#FFF',
              padding: '8px 10px',
              fontSize: '0.8rem',
              fontFamily: 'inherit',
              resize: 'none'
            }}
            required
          />
          <button
            type="submit"
            className="lx-special-ask-card__btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Routing to Concierge Desk…' : 'Submit Special Ask Request →'}
          </button>
        </form>
      )}
    </div>
  )
}

export default SpecialAskCard
