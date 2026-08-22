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
