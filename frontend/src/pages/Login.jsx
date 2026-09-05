import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api'
import { ActionButton } from '../components/ui'
import GoogleSignIn from '../components/GoogleSignIn'
import './Auth.css'

const Login = () => {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [keepSigned, setKeepSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginStage, setLoginStage] = useState('idle') // 'idle' | 'authenticating' | 'verifying' | 'success'
  const [form, setForm] = useState({ email: '', password: '' })

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
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

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const [errorMsg, setErrorMsg] = useState('')

  const completeLogin = (data) => {
    if (!data.token || !data.user?.role) throw new Error('Login response was incomplete')
    const userObj = { ...data.user, ...(data.provider ? { provider: data.provider } : {}) }
    const userRole = String(data.user.role).toLowerCase()
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(userObj))
    if (userRole === 'admin') navigate('/admin-dashboard')
    else if (userRole === 'provider') navigate('/provider-dashboard')
    else {
      const redirect = sessionStorage.getItem('loginRedirect')
      if (redirect) {
        sessionStorage.removeItem('loginRedirect')
        navigate(redirect)
      } else {
        navigate('/customer-dashboard')
      }
    }
  }

  // 1-second polished login transition before navigating to destination dashboard
  const executeLoginTransition = async (authPromise) => {
    setLoading(true)
    setErrorMsg('')
    setLoginStage('authenticating')
    const startTime = Date.now()
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    try {
      // 1. Perform actual real backend authentication
      const data = await authPromise

      if (prefersReducedMotion) {
        completeLogin(data)
        return
      }

      // 2. Stage 2 (Verifying credentials): at ~350ms
      const elapsed1 = Date.now() - startTime
      if (elapsed1 < 350) {
        await new Promise((r) => setTimeout(r, 350 - elapsed1))
      }
      setLoginStage('verifying')

      // 3. Stage 3 (Access Granted / Success): at ~700ms
      const elapsed2 = Date.now() - startTime
      if (elapsed2 < 700) {
        await new Promise((r) => setTimeout(r, 700 - elapsed2))
      }
      setLoginStage('success')

      // 4. Stage 4 (Smooth redirect): at exactly 1000ms minimum
      const elapsed3 = Date.now() - startTime
      if (elapsed3 < 1000) {
        await new Promise((r) => setTimeout(r, 1000 - elapsed3))
      }

      completeLogin(data)
    } catch (err) {
      setLoading(false)
      setLoginStage('idle')
      setErrorMsg(err.message || 'Unable to sign in.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    await executeLoginTransition(apiRequest('/auth/login', 'POST', { email: form.email, password: form.password }))
  }

  const handleGoogle = async (data) => {
    if (loading) return
    await executeLoginTransition(Promise.resolve(data))
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
      <div className={`auth-card ${loading ? 'auth-card--loading' : ''} ${loginStage === 'success' ? 'auth-card--success' : ''}`}>
        {/* Visual Progress Laser Beam */}
        {loading && <div className="auth-card__beam" />}
        {/* Subtle Shimmer Light Sweep */}
        {loading && <div className="auth-card__shimmer" />}

        {/* Upper Right Close Button */}
        <button
          className="auth-card-close-btn"
          onClick={() => !loading && navigate('/')}
          disabled={loading}
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
            cursor: loading ? 'not-allowed' : 'pointer',
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

        {/* Customer booking redirect notification banner */}
        {(sessionStorage.getItem('loginRedirect') === '/book-service'
          || sessionStorage.getItem('loginRedirect')?.startsWith('/customer-dashboard')
          || window.location.search.includes('role=customer')) && (
          <div style={{
            background: 'rgba(201, 168, 76, 0.12)',
            border: '1px solid rgba(201, 168, 76, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            textAlign: 'center',
            fontSize: '0.84rem',
            color: '#f3e8c8'
          }}>
            <strong style={{ color: '#C9A84C', display: 'block', marginBottom: '2px', letterSpacing: '0.04em' }}>
              ✦ CUSTOMER SIGN-IN
            </strong>
            {sessionStorage.getItem('selectedPlanName') ? (
              <span>Sign in to complete your reservation for <strong>{sessionStorage.getItem('selectedPlanName')}</strong></span>
            ) : (
              <span>Sign in as a customer to reserve your concierge service</span>
            )}
          </div>
        )}

        {/* Form — one unified sign-in. Your account's role decides the portal. */}
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
              placeholder="Email or username"
              value={form.email}
              onChange={handleChange}
              disabled={loading}
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
                disabled={loading}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-eye"
                id="login-toggle-password"
                disabled={loading}
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
                disabled={loading}
                onChange={() => setKeepSigned(!keepSigned)}
              />
              <span className="auth-checkbox__box" />
              <span className="auth-checkbox__label">Keep me signed in</span>
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setShowForgotModal(true)
                setForgotErrorMsg('')
                setForgotSuccessMsg('')
                if (form.email) setForgotEmail(form.email)
              }}
              className="auth-forgot"
              id="login-forgot-link"
              style={{ background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', padding: 0 }}
            >
              Forgot Password?
            </button>
          </div>

          {/* Submit Button with 1-Second Visual State Sequence */}
          <button
            type="submit"
            id="login-submit-btn"
            className={`auth-submit ${loading ? 'auth-submit--loading' : ''} ${loginStage === 'verifying' ? 'auth-submit--verifying' : ''} ${loginStage === 'success' ? 'auth-submit--success' : ''}`}
            disabled={loading}
            aria-busy={loading}
          >
            {loginStage === 'authenticating' && (
              <>
                <span className="auth-submit__spinner" />
                <span>AUTHENTICATING...</span>
              </>
            )}
            {loginStage === 'verifying' && (
              <>
                <span className="auth-submit__spinner" />
                <span>VERIFYING CONCIERGE ACCESS...</span>
              </>
            )}
            {loginStage === 'success' && (
              <>
                <span className="auth-submit__check">✓</span>
                <span>ACCESS GRANTED</span>
              </>
            )}
            {loginStage === 'idle' && <span>SIGN IN</span>}
          </button>
        </form>

        {/* Google sign-in for customer accounts */}
        <div className="auth-or"><span>or</span></div>
        <GoogleSignIn onSuccess={handleGoogle} onError={() => {}} />

        {/* Divider */}
        <div className="auth-divider">
          <span />
        </div>

        {/* Footer */}
        <div className="auth-card__footer">
          <p className="auth-card__footer-text">New to the Luxora experience?</p>
          <Link to="/signup" className="auth-card__footer-link" id="login-goto-signup">
            CREATE AN ACCOUNT →
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

                <ActionButton
                  type="submit"
                  className="auth-submit"
                  style={{ marginTop: '1.2rem' }}
                  loading={forgotLoading}
                  loadingText="Sending reset link..."
                >
                  SEND RESET LINK →
                </ActionButton>
            </form>
          </div>
        </div>
      )}

      <p className="auth-tagline">EXCELLENCE REFINED</p>
    </div>
  )
}

export default Login
