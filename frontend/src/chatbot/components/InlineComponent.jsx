import React, { useState } from 'react'

export function InlineComponent({ comp, onSendPayload, onSendMessage }) {
  if (!comp || !comp.type) return null

  switch (comp.type) {
    // 1. Working +/- Stepper Selector (Cars, Pets)
    case 'STEPPER_SELECTOR': {
      return <StepperWidget comp={comp} onSendPayload={onSendPayload} />
    }

    // 2. Option Chips (Garden acreage, Types)
    case 'OPTION_CHIPS': {
      return <OptionChipsWidget comp={comp} onSendPayload={onSendPayload} />
    }

    // 3. Recommendation Cards (Curated Packages with features & why-we-recommend)
    case 'RECOMMENDATION_CARDS': {
      return <RecommendationCardsWidget comp={comp} onSendMessage={onSendMessage} />
    }

    // 4. Special Ask / Custom Request Input Form with Photo Upload
    case 'SPECIAL_ASK_INPUT':
    case 'CUSTOM_REQUEST_INPUT': {
      return <SpecialAskFormWidget comp={comp} onSendPayload={onSendPayload} />
    }

    // 5. Special Ask Review & Summary Card
    case 'SPECIAL_ASK_SUMMARY':
    case 'CUSTOM_REQUEST_SUMMARY': {
      return <SummaryCardWidget comp={comp} onSendPayload={onSendPayload} />
    }

    // 6. Escalation Modal ("Talk to Us")
    case 'ESCALATION_MODAL': {
      return <EscalationWidget comp={comp} onSendMessage={onSendMessage} />
    }

    default:
      return null
  }
}

function StepperWidget({ comp, onSendPayload }) {
  const [count, setCount] = useState(comp.value !== undefined ? comp.value : 1)
  const min = comp.min !== undefined ? comp.min : 0
  const max = comp.max !== undefined ? comp.max : 15

  return (
    <div className="in-chat-widget stepper-box">
      <div className="stepper-control-row">
        <button
          type="button"
          className="stepper-btn-large"
          onClick={() => count > min && setCount((c) => c - 1)}
        >
          −
        </button>
        <span className="stepper-display-value">{count}</span>
        <button
          type="button"
          className="stepper-btn-large"
          onClick={() => count < max && setCount((c) => c + 1)}
        >
          +
        </button>
      </div>

      <div className="in-chat-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            onSendPayload({
              wizardType: comp.wizardType || 'SIZING_WIZARD',
              stepAction: 'NEXT',
              value: count
            })
          }
        >
          {comp.submitLabel || 'Continue →'}
        </button>

        {comp.hasBack && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              onSendPayload({
                wizardType: comp.wizardType || 'SIZING_WIZARD',
                stepAction: 'GO_BACK'
              })
            }
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  )
}

function OptionChipsWidget({ comp, onSendPayload }) {
  return (
    <div className="in-chat-widget">
      <div className="option-chips-container">
        {(comp.options || []).map((opt) => (
          <button
            key={opt.id || opt.label}
            type="button"
            className={`option-chip ${comp.selected === opt.id ? 'selected' : ''}`}
            onClick={() =>
              onSendPayload({
                wizardType: comp.wizardType || 'SIZING_WIZARD',
                stepAction: 'NEXT',
                value: opt.id || opt.label
              })
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {comp.hasBack && (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: '8px' }}
          onClick={() =>
            onSendPayload({
              wizardType: comp.wizardType || 'SIZING_WIZARD',
              stepAction: 'GO_BACK'
            })
          }
        >
          Go Back
        </button>
      )}
    </div>
  )
}

function RecommendationCardsWidget({ comp, onSendMessage }) {
  const cards = comp.cards || []

  const handleSelectAndBook = (card) => {
    const categoryKey = card.categoryKey || (card.name.toLowerCase().includes('auto') ? 'auto' : card.name.toLowerCase().includes('garden') ? 'garden' : card.name.toLowerCase().includes('pet') ? 'pet' : 'auto')

    // Store customer intent for website booking; the plan id ties the
    // selection to the exact database subscription plan.
    if (card.planId !== undefined && card.planId !== null) {
      sessionStorage.setItem('selectedPlanId', String(card.planId))
    } else {
      sessionStorage.removeItem('selectedPlanId')
    }
    sessionStorage.setItem('selectedCategory', categoryKey)
    sessionStorage.setItem('selectedPlanName', card.name)
    sessionStorage.setItem('loginRedirect', '/customer-dashboard?bookSession=1')

    const token = sessionStorage.getItem('token')
    const user = JSON.parse(sessionStorage.getItem('user') || '{}')
    if (!token || user?.role?.toLowerCase() !== 'customer') {
      window.location.href = '/login?role=customer'
    } else {
      window.location.href = '/customer-dashboard?bookSession=1'
    }
  }

  return (
    <div className="rec-cards-list">
      {cards.map((card, idx) => (
        <div
          key={card.name || idx}
          className={`rec-card-item ${idx === 0 ? 'best-match' : ''}`}
        >
          {card.badge && <span className="rec-badge">{card.badge}</span>}
          <div className="rec-title-row">
            <span className="rec-name">{card.name}</span>
            <span className="rec-price">{card.price}</span>
          </div>

          {card.features && card.features.length > 0 && (
            <ul className="rec-features-list">
              {card.features.map((f, fIdx) => (
                <li key={fIdx}>{f}</li>
              ))}
            </ul>
          )}

          {card.why && (
            <div className="rec-why-box">
              <strong style={{ color: 'var(--lx-chat-gold-light)' }}>
                Why we recommend it:
              </strong>{' '}
              {card.why}
            </div>
          )}

          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: '10px', width: '100%' }}
            onClick={() => handleSelectAndBook(card)}
          >
            ✦ Select & Book Service →
          </button>
        </div>
      ))}
    </div>
  )
}

function SpecialAskFormWidget({ comp, onSendPayload }) {
  // Only real catalog categories — these are the values the dashboard bespoke
  // form and POST /support/service-requests accept.
  const categories = comp.categories || [
    'Auto Care',
    'Garden Care',
    'Pet Care'
  ]

  const [title, setTitle] = useState(comp.title || '')
  const [category, setCategory] = useState(comp.category || 'Auto Care')
  const [date, setDate] = useState(comp.date || '')
  const [notes, setNotes] = useState(comp.notes || '')
  const [validationError, setValidationError] = useState(comp.error || '')

  const todayStr = new Date().toISOString().split('T')[0]

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    if (!title.trim()) {
      setValidationError('Please enter a Service Subject / Title.')
      return
    }
    if (!category || !categories.includes(category)) {
      setValidationError('Please select a valid Category.')
      return
    }
    if (!date) {
      setValidationError('Please select a Preferred Date.')
      return
    }
    if (!notes.trim()) {
      setValidationError('Please provide Special Requirements & Details.')
      return
    }

    setValidationError('')
    onSendPayload({
      wizardType: 'SPECIAL_ASK',
      stepAction: 'NEXT',
      title: title.trim(),
      category: category,
      date: date,
      notes: notes.trim()
    })
  }

  return (
    <div className="in-chat-widget">
      <div style={{ fontWeight: 700, color: 'var(--lx-chat-gold-light)', fontSize: '0.92rem', marginBottom: '4px' }}>
        ✦ Bespoke Concierge / Requested Service
      </div>
      <p style={{ fontSize: '0.76rem', color: 'var(--lx-chat-text-muted)', marginBottom: '10px' }}>
        Submit your custom service specifications. All fields are required to prepare your bespoke proposal.
      </p>

      {validationError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ff8080', padding: '6px 10px', borderRadius: '6px', fontSize: '0.76rem', marginBottom: '8px' }}>
          ⚠️ {validationError}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--lx-chat-gold)', fontWeight: 700, marginBottom: '3px' }}>
            1. SERVICE SUBJECT / TITLE *
          </label>
          <input
            className="form-input"
            required
            placeholder="e.g. Villa Marble Floor Polishing & Restoration"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setValidationError('') }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--lx-chat-gold)', fontWeight: 700, marginBottom: '3px' }}>
            2. CATEGORY *
          </label>
          <select
            className="form-input"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setValidationError('') }}
            style={{ cursor: 'pointer' }}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat} style={{ background: '#111', color: '#fff' }}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--lx-chat-gold)', fontWeight: 700, marginBottom: '3px' }}>
            3. PREFERRED DATE *
          </label>
          <input
            type="date"
            className="form-input"
            required
            min={todayStr}
            value={date}
            onChange={(e) => { setDate(e.target.value); setValidationError('') }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--lx-chat-gold)', fontWeight: 700, marginBottom: '3px' }}>
            4. SPECIAL REQUIREMENTS & DETAILS *
          </label>
          <textarea
            className="inline-text-area"
            required
            rows="3"
            placeholder="Describe your custom service requirements, estate dimensions, specialized instructions, or urgency..."
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setValidationError('') }}
          />
        </div>

        <div className="in-chat-actions" style={{ marginTop: '4px' }}>
          <button type="submit" className="btn-primary" style={{ width: '100%' }}>
            {comp.submitLabel || 'Review Request Summary →'}
          </button>
        </div>
      </form>
    </div>
  )
}

function SummaryCardWidget({ comp, onSendPayload }) {
  const handleContinue = () => {
    // 1. Store request data in sessionStorage to prevent any data loss
    const requestData = {
      title: comp.title || '',
      category: comp.category || 'Auto Care',
      date: comp.date || '',
      notes: comp.notes || ''
    }
    sessionStorage.setItem('pendingBespokeRequest', JSON.stringify(requestData))

    // 2. Check login status
    const token = sessionStorage.getItem('token')
    const user = JSON.parse(sessionStorage.getItem('user') || '{}')
    const isCustomer = token && user?.role?.toLowerCase() === 'customer'

    if (isCustomer) {
      window.location.href = '/customer-dashboard?openBespoke=true'
    } else {
      sessionStorage.setItem('loginRedirect', '/customer-dashboard?openBespoke=true')
      window.location.href = '/login?role=customer'
    }
  }

  return (
    <div className="summary-review-card">
      <div style={{ fontWeight: 700, color: 'var(--lx-chat-gold-light)', fontSize: '0.88rem', marginBottom: '8px' }}>
        ✦ REVIEW BESPOKE SERVICE REQUEST
      </div>
      <div className="summary-details">
        <div className="summary-row">
          <span className="summary-label">Subject / Title:</span>
          <span className="summary-val" style={{ color: 'var(--lx-chat-gold-light)' }}>{comp.title || 'Custom Service'}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Category:</span>
          <span className="summary-val">{comp.category}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Preferred Date:</span>
          <span className="summary-val">{comp.date || 'Not specified'}</span>
        </div>
        <div style={{ marginTop: '6px' }}>
          <span className="summary-label">Requirements & Details:</span>
          <div className="summary-val" style={{ textAlign: 'left', marginTop: '3px', fontStyle: 'italic' }}>
            &quot;{comp.notes || 'None'}&quot;
          </div>
        </div>
      </div>

      <div className="in-chat-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={handleContinue}
        >
          Continue & Submit →
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            onSendPayload({
              wizardType: 'SPECIAL_ASK',
              stepAction: 'EDIT'
            })
          }
        >
          ✎ Edit Request
        </button>
      </div>
    </div>
  )
}

function EscalationWidget({ comp, onSendMessage }) {
  const channels = comp.channels || [
    { id: 'phone', label: '📞 Direct Concierge Line', desc: '+94 11 234 5678 (Instant Call)' },
    { id: 'whatsapp', label: '💬 WhatsApp Concierge', desc: '+94 77 100 0001 (Chat with agent)' }
  ]

  return (
    <div className="in-chat-widget">
      <div style={{ fontWeight: 700, color: 'var(--lx-chat-gold-light)', fontSize: '0.88rem', marginBottom: '4px' }}>
        ✦ {comp.title || 'Direct VIP Concierge Channels'}
      </div>
      <p style={{ fontSize: '0.74rem', color: 'var(--lx-chat-text-muted)', marginBottom: '10px' }}>
        {comp.reason || 'Our Senior Concierge Team is available around the clock to assist you.'}
      </p>

      <div className="escalation-channels-grid">
        {channels.map((ch, idx) => (
          <div
            key={idx}
            className="channel-btn"
            onClick={() =>
              onSendMessage(`Selected: ${ch.label}. Please connect me with your team.`)
            }
          >
            <div className="channel-title">{ch.label}</div>
            <div className="channel-desc">{ch.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default InlineComponent
