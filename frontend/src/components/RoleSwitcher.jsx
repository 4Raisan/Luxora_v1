import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api'
import { ROLE_ACCOUNTS, ROLE_LABELS, UNIVERSAL_PW, isUniversalTester } from '../services/roles'
import './RoleSwitcher.css'

const ROLE_ROUTES = {
  customer: '/customer-dashboard',
  provider: '/provider-dashboard',
  admin: '/admin-dashboard',
}

export default function RoleSwitcher() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const currentRole = localStorage.getItem('luxora_role') || 'customer'
  const currentEmail = localStorage.getItem('luxora_email') || ''

  if (!isUniversalTester(currentEmail)) return null

  const switchTo = async (role) => {
    if (role === currentRole) { setOpen(false); return }
    setBusy(true)
    try {
      const res = await apiRequest('/auth/login', 'POST', {
        email: ROLE_ACCOUNTS[role],
        password: UNIVERSAL_PW,
      })
      localStorage.setItem('luxora_token', res.token)
      localStorage.setItem('luxora_role', res.user.role)
      setOpen(false)
      navigate(ROLE_ROUTES[role])
    } catch (e) {
      alert('Switch failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rs">
      <button className="rs-trigger" onClick={() => setOpen((o) => !o)} disabled={busy}>
        <span className="rs-dot" />
        {ROLE_LABELS[currentRole] || currentRole}
        <span className="rs-caret">▾</span>
      </button>
      {open && (
        <div className="rs-menu">
          <p className="rs-menu__hint">Switch role (tester@gmail.com)</p>
          {Object.keys(ROLE_ACCOUNTS).map((r) => (
            <button
              key={r}
              className={`rs-item ${r === currentRole ? 'rs-item--active' : ''}`}
              onClick={() => switchTo(r)}
              disabled={busy}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
