import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api'
import './Auth.css'

const Login = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState('customer')
  const [showPassword, setShowPassword] = useState(false)
  const [keepSigned, setKeepSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [forgotStep, setForgotStep] = useState(1) // 1: Email, 2: New Password
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('')
  const [forgotErrorMsg, setForgotErrorMsg] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  const handleSendResetLink = async (e) => {
    e.preventDefault()
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotErrorMsg('Please enter a valid email address.')
      return
    }
    setForgotLoading(true)
    setForgotErrorMsg('')
    try {
      await apiRequest('/auth/password-reset/request', 'POST', { email: forgotEmail })
      setForgotSuccessMsg('If that account exists, a password reset link has been sent by email.')
      setTimeout(() => setShowForgotModal(false), 3500)
    } catch (error) {
      setForgotErrorMsg(error.message || 'Could not send reset email')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleResetPasswordSubmit = (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      setForgotErrorMsg('Password must be at least 6 characters.')
      return
    }

    try {
      const savedUserStr = localStorage.getItem('user_' + forgotEmail)
      let userObj = savedUserStr ? JSON.parse(savedUserStr) : { email: forgotEmail, name: forgotEmail.split('@')[0] }
      userObj.password = newPassword
      localStorage.setItem('user_' + forgotEmail, JSON.stringify(userObj))
    } catch (_) {}

    setForgotSuccessMsg('Password updated successfully! You can now log in with your new password.')
    setTimeout(() => {
      setShowForgotModal(false)
      setForm(prev => ({ ...prev, email: forgotEmail, password: newPassword }))
      setForgotStep(1)
      setForgotEmail('')
      setNewPassword('')
      setForgotSuccessMsg('')
    }, 2000)
  }

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
      const data = await apiRequest('/auth/login', 'POST', { email: form.email, password: form.password })
      if (!data.token || !data.user?.role) throw new Error('Login response was incomplete')
      const userObj = { ...data.user, ...(data.provider ? { provider: data.provider } : {}) }
      const userRole = String(data.user.role).toLowerCase()
      sessionStorage.setItem('token', data.token)
      sessionStorage.setItem('user', JSON.stringify(userObj))
      if (userRole === 'admin') {
        navigate('/admin-dashboard')
      } else if (userRole === 'provider') {
        navigate('/provider-dashboard')
      } else {
        navigate('/customer-dashboard')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
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
        {/* Upper Right Close Button */}
        <button
          className="auth-card-close-btn"
          onClick={() => navigate('/')}
          aria-label="Close & Return to Home"
          title="Close & Return to Home"
          type="button"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#aaa',
            fontSize: '0.9rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
        >
          ✕
        </button>

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
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(true)
                setForgotStep(1)
                setForgotErrorMsg('')
                setForgotSuccessMsg('')
                if (form.email) setForgotEmail(form.email)
              }}
              className="auth-forgot"
              id="login-forgot-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Forgot Password?
            </button>
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

      {/* ── Forgot Password Modal Overlay ── */}
      {showForgotModal && (
        <div
          className="cd-support-overlay"
          onClick={() => setShowForgotModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div
            className="auth-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px', width: '100%', position: 'relative', margin: 0 }}
          >
            {/* Upper Right Close Button */}
            <button
              className="auth-card-close-btn"
              onClick={() => setShowForgotModal(false)}
              aria-label="Close Modal"
              title="Close Modal"
              type="button"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#aaa',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                zIndex: 10
              }}
            >
              ✕
            </button>

            <div className="auth-card__header">
              <h2 className="auth-card__title" style={{ fontSize: '1.4rem' }}>Reset Password</h2>
              <p className="auth-card__subtitle">Recover access to your Luxora concierge account</p>
            </div>

            {forgotErrorMsg && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                {forgotErrorMsg}
              </div>
            )}

            {forgotSuccessMsg && (
              <div style={{ color: '#22c55e', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem', background: 'rgba(34,197,94,0.1)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.3)', fontWeight: 700 }}>
                {forgotSuccessMsg}
              </div>
            )}

            {forgotStep === 1 && (
              <form onSubmit={handleSendResetLink} className="auth-form" style={{ marginTop: '1rem' }}>
                <div className="auth-field">
                  <label style={{ display: 'block', color: '#888', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.4rem' }}>ACCOUNT EMAIL ADDRESS</label>
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="Enter registered email (e.g. tester@gmail.com)"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className={`auth-submit ${forgotLoading ? 'loading' : ''}`}
                  style={{ marginTop: '1.2rem' }}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'VERIFYING...' : 'SEND RESET CODE →'}
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleResetPasswordSubmit} className="auth-form" style={{ marginTop: '1rem' }}>
                <div style={{ background: 'rgba(201, 168, 76, 0.1)', border: '1px solid rgba(201, 168, 76, 0.3)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.25rem', color: 'var(--gold, #c9a84c)', fontSize: '0.82rem', lineHeight: '1.5' }}>
                  🔑 Reset link verified for <strong>{forgotEmail}</strong>. Please enter your new password below:
                </div>

                <div className="auth-field">
                  <label style={{ display: 'block', color: '#888', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.4rem' }}>NEW PASSWORD</label>
                  <input
                    type="password"
                    className="auth-input"
                    placeholder="Enter new password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  className="auth-submit"
                  style={{ marginTop: '1.2rem' }}
                >
                  CONFIRM NEW PASSWORD
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <p className="auth-tagline">EXCELLENCE REFINED</p>
    </div>
  )
}

export default Login
