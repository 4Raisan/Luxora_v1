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
    
    // Store customer intent for website booking
    sessionStorage.setItem('selectedCategory', categoryKey)
    sessionStorage.setItem('selectedPlanName', card.name)
    sessionStorage.setItem('loginRedirect', '/book-service')

    const token = sessionStorage.getItem('token')
    const user = JSON.parse(sessionStorage.getItem('user') || '{}')
    if (!token || user?.role?.toLowerCase() !== 'customer') {
      window.location.href = '/login?role=customer'
    } else {
      window.location.href = '/book-service'
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
  const [scope, setScope] = useState(comp.scope || comp.quantity || '')
  const [requiredServices, setRequiredServices] = useState(comp.requiredServices || '')
  const [preferredSchedule, setPreferredSchedule] = useState(comp.preferredSchedule || '')
  const [customerName, setCustomerName] = useState(comp.customerName || '')
  const [contactInfo, setContactInfo] = useState(comp.contactInfo || '')
  const [notes, setNotes] = useState(comp.initialNotes || comp.initialText || '')
  const [uploadedFiles, setUploadedFiles] = useState([])

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (loadEvt) => {
        const dataUrl = loadEvt.target.result
        setUploadedFiles((prev) => [...prev, { fileName: file.name, fileUrl: dataUrl }])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleRemoveFile = (dataUrl) => {
    setUploadedFiles((prev) => prev.filter((f) => f.fileUrl !== dataUrl))
  }

  const handleSubmit = () => {
    onSendPayload({
      wizardType: 'SPECIAL_ASK',
      stepAction: 'NEXT',
      scope: scope || 'Custom scope',
      requiredServices: requiredServices || 'Custom requirements',
      preferredSchedule: preferredSchedule || 'Flexible',
      customerName: customerName || 'Valued Member',
      contactInfo: contactInfo || 'Provided in chat',
      notes: notes || 'Special Ask Service evaluation',
      text: notes || 'Special Ask Service evaluation',
      files: uploadedFiles,
      category: comp.category
    })
  }

  return (
    <div className="in-chat-widget">
      <div style={{ fontWeight: 700, color: 'var(--lx-chat-gold-light)', fontSize: '0.92rem', marginBottom: '4px' }}>
        ✦ Special Ask Service ({comp.categoryName})
      </div>
      <p style={{ fontSize: '0.76rem', color: 'var(--lx-chat-text-muted)', marginBottom: '10px' }}>
        Have a requirement that doesn’t fit our standard packages? Submit a special request and our Luxora team will review your requirements and get back to you with the appropriate solution.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        <input
          className="form-input"
          placeholder="Number of vehicles / pets / property size"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        />
        <input
          className="form-input"
          placeholder="Required services (e.g. Full wash + detailing, landscaping, etc.)"
          value={requiredServices}
          onChange={(e) => setRequiredServices(e.target.value)}
        />
        <input
          className="form-input"
          placeholder="Preferred schedule (e.g. Bi-weekly on weekends)"
          value={preferredSchedule}
          onChange={(e) => setPreferredSchedule(e.target.value)}
        />
        <input
          className="form-input"
          placeholder="Your Name (e.g. Alexander Wright)"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
        <input
          className="form-input"
          placeholder="Phone or Email (e.g. +94 77 123 4567)"
          value={contactInfo}
          onChange={(e) => setContactInfo(e.target.value)}
        />
      </div>

      <textarea
        className="inline-text-area"
        placeholder="Additional notes, access instructions, or special requests..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <label className="image-uploader-dropzone">
        <div style={{ fontSize: '18px', marginBottom: '2px' }}>📷</div>
        <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#fff' }}>
          Add Photo (Optional)
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      </label>

      {uploadedFiles.length > 0 && (
        <div className="upload-thumbnails">
          {uploadedFiles.map((file, idx) => (
            <div key={idx} className="thumb-preview">
              <img src={file.fileUrl} alt={file.fileName} />
              <div
                className="thumb-remove"
                onClick={() => handleRemoveFile(file.fileUrl)}
              >
                ✕
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="in-chat-actions">
        <button type="button" className="btn-primary" onClick={handleSubmit}>
          {comp.submitLabel || 'Submit Special Ask'}
        </button>
      </div>
    </div>
  )
}

function SummaryCardWidget({ comp, onSendPayload }) {
  return (
    <div className="summary-review-card">
      <div style={{ fontWeight: 700, color: 'var(--lx-chat-gold-light)', fontSize: '0.88rem', marginBottom: '8px' }}>
        ✦ REVIEW SPECIAL ASK SERVICE
      </div>
      <div className="summary-details">
        <div className="summary-row">
          <span className="summary-label">Category:</span>
          <span className="summary-val">{comp.categoryName}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Scope / Assets:</span>
          <span className="summary-val">{comp.scope || comp.quantity || 'Custom Scope'}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Required Services:</span>
          <span className="summary-val">{comp.requiredServices || 'Tailored assessment'}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Preferred Schedule:</span>
          <span className="summary-val">{comp.preferredSchedule || 'Flexible'}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Name:</span>
          <span className="summary-val">{comp.customerName || 'Valued Member'}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Contact:</span>
          <span className="summary-val">{comp.contactInfo || 'On File'}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Photos attached:</span>
          <span className="summary-val">{comp.attachmentsCount || 0} photo(s)</span>
        </div>
        <div style={{ marginTop: '6px' }}>
          <span className="summary-label">Additional Notes:</span>
          <div className="summary-val" style={{ textAlign: 'left', marginTop: '3px', fontStyle: 'italic' }}>
            &quot;{comp.notes || comp.description || 'None'}&quot;
          </div>
        </div>
      </div>

      <div className="in-chat-actions">
        {(comp.actions || []).map((act, idx) => (
          <button
            key={idx}
            type="button"
            className={act.primary ? 'btn-primary' : 'btn-secondary'}
            onClick={() =>
              onSendPayload({
                wizardType: 'SPECIAL_ASK',
                stepAction: act.action
              })
            }
          >
            {act.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function EscalationWidget({ comp, onSendMessage }) {
  const channels = comp.channels || [
    { id: 'phone', label: '📞 Direct Concierge Line', desc: '+94 11 234 5678 (Instant Call)' },
    { id: 'whatsapp', label: '💬 WhatsApp Concierge', desc: '+94 77 123 4567 (Chat with agent)' }
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
