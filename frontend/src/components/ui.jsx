import { useEffect, useState } from 'react'
import './ui.css'

// Shared portal UI primitives. Styled with the same --p-* tokens as PortalShell
// so every dialog inherits the role accent of the portal it is opened from.

export function Modal({ title, kicker, onClose, children, footer, wide, printTarget }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="ui-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}>
    <div className={`ui-modal ${wide ? 'ui-modal--wide' : ''} ${printTarget ? 'print-target' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Dialog'}>
      <header className="ui-modal-head">
        <div>{kicker && <p className="portal-kicker">{kicker}</p>}{title && <h3>{title}</h3>}</div>
        <button className="ui-modal-close" onClick={onClose} aria-label="Close dialog">✕</button>
      </header>
      <div className="ui-modal-body">{children}</div>
      {footer && <footer className="ui-modal-foot">{footer}</footer>}
    </div>
  </div>
}

// Direct replacement for window.confirm — keeps the portal look, supports a
// danger tone for destructive actions.
export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  return <Modal title={title} onClose={onClose} footer={<>
    <button className="ui-button ui-button--text" onClick={onClose}>Keep</button>
    <button className={`ui-button ${danger ? 'ui-button--danger' : 'ui-button--primary'}`} onClick={onConfirm}>{confirmLabel}</button>
  </>}>
    <p className="ui-confirm-message">{message}</p>
  </Modal>
}

// Direct replacement for window.prompt chains: one dialog, several typed
// fields, prefilled values, required-aware. onSubmit receives { name: value }.
export function PromptDialog({ title, kicker, fields, submitLabel = 'Save', onSubmit, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.name, field.initial ?? ''])))
  const [error, setError] = useState('')
  const submit = () => {
    const missing = fields.find((field) => field.required && !String(values[field.name] || '').trim())
    if (missing) { setError(`${missing.label} is required`); return }
    onSubmit(values)
  }
  return <Modal title={title} kicker={kicker} onClose={onClose} footer={<>
    <button className="ui-button ui-button--text" onClick={onClose}>Cancel</button>
    <button className="ui-button ui-button--primary" onClick={submit}>{submitLabel}</button>
  </>}>
    <div className="ui-fields">
      {fields.map((field) => <label key={field.name} className={`ui-field ${field.full ? 'ui-field--full' : ''}`}>
        <span>{field.label}{field.required ? ' *' : ''}</span>
        {field.type === 'select' ? <select value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>
          {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select> : field.type === 'textarea' ? <textarea value={values[field.name]} placeholder={field.placeholder || ''} maxLength={field.maxLength} rows={field.rows || 3} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />
          : <input type={field.type || 'text'} value={values[field.name]} placeholder={field.placeholder || ''} inputMode={field.inputMode} maxLength={field.maxLength} min={field.min} max={field.max} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />}
        {field.hint && <small>{field.hint}</small>}
      </label>)}
    </div>
    {error && <p className="ui-field-error">{error}</p>}
  </Modal>
}

export function FilterPills({ options, value, onChange, ariaLabel = 'Filter' }) {
  return <div className="ui-pills" role="group" aria-label={ariaLabel}>
    {options.map((option) => <button key={String(option.value)} className={value === option.value ? 'is-active' : ''} onClick={() => onChange(option.value)}>{option.label}{option.count !== undefined ? <b>{option.count}</b> : null}</button>)}
  </div>
}

export function SearchInput({ value, onChange, placeholder = 'Search', ariaLabel = 'Search' }) {
  return <div className="ui-search"><span aria-hidden="true">⌕</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={ariaLabel} /></div>
}

// The Luxora coin — one coin funds one service booking in its category
// (Auto / Garden / Pet). Coins are the customer-facing face of the backend's
// per-category entitlement units.
export function Coin({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="luxora-coin">
    <circle cx="12" cy="12" r="11" fill="#c9a84c" />
    <circle cx="12" cy="12" r="8.4" fill="none" stroke="rgba(23,20,13,0.55)" strokeWidth="1.1" />
    <circle cx="9.4" cy="8.6" r="3.1" fill="rgba(255,244,214,0.5)" />
    <text x="12" y="16.1" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#17140d">L</text>
  </svg>
}

// Per-category glyph for the coin display (Auto / Garden / Pet). The icon name
// comes from the category row in the database via the entitlements API; the
// category name is only a fallback hint when no icon is stored.
export function CategoryIcon({ icon, name, size = 16 }) {
  const hint = `${icon || ''} ${name || ''}`.toLowerCase()
  let glyph
  if (/(auto|car)/.test(hint)) {
    glyph = <>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />
    </>
  } else if (/(garden|tree|leaf|plant)/.test(hint)) {
    glyph = <>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </>
  } else if (/(pet|dog|paw)/.test(hint)) {
    glyph = <>
      <circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
    </>
  } else {
    glyph = <path d="M12 3l2.1 5L19 10l-4.9 2L12 17l-2.1-5L5 10l4.9-2Z" />
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="luxora-category-icon">{glyph}</svg>
}
