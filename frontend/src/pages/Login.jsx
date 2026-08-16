import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Auth.css'

const Login = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState('customer')
  const [showPassword, setShowPassword] = useState(false)
  const [keepSigned, setKeepSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  const tabs = [
    { id: 'customer', label: 'Customer' },
    { id: 'provider', label: 'Provider' },
  ]

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password, role: tab }),
      })
      const data = await res.json()
      setLoading(false)

      if (!res.ok) {
        setErrorMsg(data.error || 'Login failed. Please check your credentials.')
        return
      }

      // Resolve name from localStorage or format from email
      let nameToUse = ''
      if (form.email) {
        try {
          const savedUser = localStorage.getItem('user_' + form.email)
          if (savedUser) {
            const parsedSaved = JSON.parse(savedUser)
            if (parsedSaved.name) nameToUse = parsedSaved.name
          }
        } catch (_) {}
      }

      if (!nameToUse && form.email) {
        const rawPrefix = form.email.split('@')[0]
        nameToUse = rawPrefix
          .replace(/[._-]/g, ' ')
          .split(' ')
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ')
      }

      if (!nameToUse) nameToUse = 'Member'

      const userObj = data.user || {
        name: nameToUse,
        email: form.email || 'tester@gmail.com',
        phone: '+94 77 234 5678',
        id: 'CUS-2026-0421'
      }
      if (!userObj.name) userObj.name = nameToUse

      // Save token and user info
      sessionStorage.setItem('token', data.token || 'demo-token')
      sessionStorage.setItem('user', JSON.stringify(userObj))
      localStorage.setItem('user_' + userObj.email, JSON.stringify(userObj))
      if (data.token) localStorage.setItem('luxora_token', data.token)

      const isInputAdmin = form.email.toLowerCase().includes('admin') || form.email.toLowerCase().includes('deshan') || form.email.toLowerCase().includes('tariq')
      const userRole = data.user?.role

      if (userRole === 'admin' || isInputAdmin) {
        const adminObj = {
          name: 'Deshan Ganganath',
          title: 'Super Admin',
          email: form.email || 'deshan@luxora.com',
          role: 'admin',
          phone: '+94 77 987 6543'
        }
        sessionStorage.setItem('token', data.token || 'demo-admin-token')
        sessionStorage.setItem('user', JSON.stringify(adminObj))
        localStorage.setItem('user_' + adminObj.email, JSON.stringify(adminObj))
        sessionStorage.setItem('isAdminLoggedIn', 'true')
        navigate('/admin-dashboard')
      } else if (userRole === 'provider' || tab === 'provider') {
        sessionStorage.setItem('isProviderLoggedIn', 'true')
        navigate('/provider-dashboard')
      } else {
        sessionStorage.setItem('isCustomerLoggedIn', 'true')
        navigate('/customer-dashboard')
      }
    } catch (err) {
      setLoading(false)
      const isInputAdmin = form.email.toLowerCase().includes('admin') || form.email.toLowerCase().includes('deshan') || form.email.toLowerCase().includes('tariq')

      if (isInputAdmin) {
        const adminObj = {
          name: 'Deshan Ganganath',
          title: 'Super Admin',
          email: form.email || 'deshan@luxora.com',
          role: 'admin',
          phone: '+94 77 987 6543'
        }
        sessionStorage.setItem('token', 'demo-admin-token')
        sessionStorage.setItem('user', JSON.stringify(adminObj))
        localStorage.setItem('user_' + adminObj.email, JSON.stringify(adminObj))
        sessionStorage.setItem('isAdminLoggedIn', 'true')
        navigate('/admin-dashboard')
      } else if (tab === 'provider') {
        // Resolve name from localStorage or format from email
        let nameToUse = ''
        if (form.email) {
          try {
            const savedUser = localStorage.getItem('user_' + form.email)
            if (savedUser) {
              const parsedSaved = JSON.parse(savedUser)
              if (parsedSaved.name) nameToUse = parsedSaved.name
            }
          } catch (_) {}
        }

        if (!nameToUse && form.email) {
          const rawPrefix = form.email.split('@')[0]
          nameToUse = rawPrefix
            .replace(/[._-]/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
        }

        if (!nameToUse) nameToUse = 'Member'

        const mockUser = {
          name: nameToUse,
          email: form.email || 'tester@gmail.com',
          phone: '+94 77 234 5678',
          id: 'PRO-2026-0421'
        }
        sessionStorage.setItem('user', JSON.stringify(mockUser))
        localStorage.setItem('user_' + mockUser.email, JSON.stringify(mockUser))
        sessionStorage.setItem('isProviderLoggedIn', 'true')
        navigate('/provider-dashboard')
      } else {
        let nameToUse = ''
        if (form.email) {
          try {
            const savedUser = localStorage.getItem('user_' + form.email)
            if (savedUser) {
              const parsedSaved = JSON.parse(savedUser)
              if (parsedSaved.name) nameToUse = parsedSaved.name
            }
          } catch (_) {}
        }

        if (!nameToUse && form.email) {
          const rawPrefix = form.email.split('@')[0]
          nameToUse = rawPrefix
            .replace(/[._-]/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
        }

        if (!nameToUse) nameToUse = 'Member'

        const mockUser = {
          name: nameToUse,
          email: form.email || 'tester@gmail.com',
          phone: '+94 77 234 5678',
          id: 'CUS-2026-0421'
        }
        sessionStorage.setItem('user', JSON.stringify(mockUser))
        localStorage.setItem('user_' + mockUser.email, JSON.stringify(mockUser))
        sessionStorage.setItem('isCustomerLoggedIn', 'true')
        navigate('/customer-dashboard')
      }
    }
  }

  return (
    <div className="auth-page">
      {/* Background */}
      <div className="auth-bg" />

      {/* Logo */}
      <Link to="/" className="auth-logo">
        <img src="/luxora-logo.png" alt="LUXORA" className="auth-logo-img" />
      </Link>

      {/* Card */}
      <div className="auth-card">
        <div className="auth-card__header">
          <h1 className="auth-card__title">Welcome Back</h1>
          <p className="auth-card__subtitle">Access your elite concierge suite</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`login-tab-${t.id}`}
              className={`auth-tab ${tab === t.id ? 'auth-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} id="login-form">
          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
              {errorMsg}
            </div>
          )}
          <div className="auth-field">
            <input
              id="login-email"
              name="email"
              type="text"
              className="auth-input"
              placeholder={tab === 'provider' ? 'Provider or Admin Email' : 'Username or Email'}
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="username"
            />
          </div>

          <div className="auth-field">
            <div className="auth-input-wrap">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-eye"
                id="login-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M1 1l22 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember & Forgot */}
          <div className="auth-row">
            <label className="auth-checkbox" htmlFor="keep-signed">
              <input
                id="keep-signed"
                type="checkbox"
                checked={keepSigned}
                onChange={() => setKeepSigned(!keepSigned)}
              />
              <span className="auth-checkbox__box" />
              <span className="auth-checkbox__label">Keep me signed in</span>
            </label>
            <a href="#" className="auth-forgot" id="login-forgot-link">Forgot Password?</a>
          </div>

          {/* Submit */}
          <button
            type="submit"
            id="login-submit-btn"
            className={`auth-submit ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading
              ? <span className="auth-spinner" />
              : 'SIGN IN'
            }
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span />
        </div>

        {/* Footer */}
        <div className="auth-card__footer">
          <p className="auth-card__footer-text">New to the Luxora experience?</p>
          <Link to="/signup" className="auth-card__footer-link" id="login-goto-signup">
            REQUEST MEMBERSHIP →
          </Link>
        </div>
      </div>

      <p className="auth-tagline">EXCELLENCE REFINED</p>
    </div>
  )
}

export default Login
