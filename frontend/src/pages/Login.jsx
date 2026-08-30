import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api'
import { ActionButton } from '../components/ui'
import GoogleSignIn from '../components/GoogleSignIn'
import PeekingEyes from '../components/PeekingEyes'
import './Auth.css'

const Login = () => {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [keepSigned, setKeepSigned] = useState(false)
  const [loading, setLoading] = useState(false)
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

  const [errorMsg, setErrorMsg] = useState('')
  const [runawayOffset, setRunawayOffset] = useState({ x: 0, y: 0 })
  const [runawayCount, setRunawayCount] = useState(0)
  const submitWrapRef = useRef(null)
  const [wrapDims, setWrapDims] = useState({ width: 380, height: 54 })

  useEffect(() => {
    const updateDims = () => {
      if (submitWrapRef.current) {
        setWrapDims({
          width: submitWrapRef.current.offsetWidth || 380,
          height: submitWrapRef.current.offsetHeight || 54,
        })
      }
    }
    updateDims()
    window.addEventListener('resize', updateDims)
    return () => window.removeEventListener('resize', updateDims)
  }, [])

  const isFormIncomplete = !form.email.trim() || !form.password.trim()
  const isDisplaced = runawayOffset.x !== 0 || runawayOffset.y !== 0

  const handleButtonRunaway = (e) => {
    if (!isFormIncomplete || !submitWrapRef.current) {
      if (isDisplaced) setRunawayOffset({ x: 0, y: 0 })
      return
    }

    const rect = submitWrapRef.current.getBoundingClientRect()
    const anchorCenterX = rect.left + rect.width / 2
    const anchorCenterY = rect.top + rect.height / 2

    const clientX = e?.clientX ?? e?.touches?.[0]?.clientX
    const clientY = e?.clientY ?? e?.touches?.[0]?.clientY

    if (clientX === undefined || clientY === undefined) {
      const fallback = [{ x: -110, y: -20 }, { x: 110, y: -20 }, { x: -90, y: 20 }, { x: 90, y: 20 }]
      setRunawayOffset(fallback[runawayCount % fallback.length])
      setRunawayCount((prev) => prev + 1)
      return
    }

    // Compute inverse vector from mouse cursor towards opposite direction
    const currentBtnX = anchorCenterX + runawayOffset.x
    const currentBtnY = anchorCenterY + runawayOffset.y

    const dx = currentBtnX - clientX
    const dy = currentBtnY - clientY
    const dist = Math.hypot(dx, dy) || 1

    // Inverse repulsion force
    const pushForce = 125
    const normX = dx / dist
    const normY = dy / dist

    const maxX = 125
    const maxY = 28

    const targetX = Math.max(-maxX, Math.min(maxX, normX * pushForce))
    const targetY = Math.max(-maxY, Math.min(maxY, normY * pushForce))

    setRunawayOffset({
      x: Math.round(targetX),
      y: Math.round(targetY),
    })
    setRunawayCount((prev) => prev + 1)
  }

  const handleResetPosition = () => {
    if (isDisplaced) {
      setRunawayOffset({ x: 0, y: 0 })
    }
  }

  const handleChange = (e) => {
    const nextForm = { ...form, [e.target.name]: e.target.value }
    setForm(nextForm)
    if (nextForm.email.trim() && nextForm.password.trim()) {
      setRunawayOffset({ x: 0, y: 0 })
    }
  }

  // Shared session handling for password and Google sign-in: the backend owns
  // the role, so both paths route identically after authentication.
  const completeLogin = (data) => {
    if (!data.token || !data.user?.role) throw new Error('Login response was incomplete')
    const userObj = { ...data.user, ...(data.provider ? { provider: data.provider } : {}) }
    const userRole = String(data.user.role).toLowerCase()
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(userObj))
    if (userRole === 'admin') navigate('/admin-dashboard')
    else if (userRole === 'provider') navigate('/provider-dashboard')
    else navigate('/customer-dashboard')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    try {
      completeLogin(await apiRequest('/auth/login', 'POST', { email: form.email, password: form.password }))
    } catch (err) {
      setErrorMsg(err.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = (data) => {
    try { completeLogin(data) } catch (err) { setErrorMsg(err.message) }
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
              required
              autoComplete="username"
            />
          </div>

          <div className="auth-field">
            <div className="auth-input-wrap">
              <PeekingEyes
                isActive={isPasswordFocused}
                textLength={form.password.length}
                isPasswordVisible={showPassword}
              />
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
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

          {/* Submit Container with Dynamic Golden Wire & Range Auto-Reset */}
          {(() => {
            const startX = wrapDims.width / 2
            const startY = wrapDims.height / 2
            const endX = startX + runawayOffset.x
            const endY = startY + runawayOffset.y
            const dist = Math.hypot(runawayOffset.x, runawayOffset.y)
            const midX = (startX + endX) / 2
            const midY = (startY + endY) / 2
            const cpX = midX - runawayOffset.y * 0.3
            const cpY = midY + dist * 0.35 + 8

            return (
              <div
                className="auth-submit-zone"
                onMouseMove={handleButtonRunaway}
                onMouseEnter={handleButtonRunaway}
                onMouseLeave={handleResetPosition}
              >
                <div
                  ref={submitWrapRef}
                  className={`auth-submit-wrap ${isDisplaced ? 'is-displaced' : ''}`}
                  onMouseMove={handleButtonRunaway}
                  onMouseEnter={handleButtonRunaway}
                >
                  {/* Dock Slot Placeholder where button normally rests */}
                  {isDisplaced && (
                    <div className="auth-submit-dock" aria-hidden="true">
                      <div className="auth-submit-dock-glow" />
                      <span className="auth-submit-dock-text">
                        <span className="auth-submit-dock-spark">✦</span> LUXORA SECURITY ANCHOR <span className="auth-submit-dock-spark">✦</span>
                      </span>
                    </div>
                  )}

                  {/* Dynamic Connecting Twisted Rope SVG */}
                  {isDisplaced && (
                    <svg
                      className="auth-tether-wire"
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: '-60px',
                        left: '-80px',
                        width: `${wrapDims.width + 160}px`,
                        height: `${wrapDims.height + 120}px`,
                        pointerEvents: 'none',
                        overflow: 'visible',
                        zIndex: 1,
                      }}
                    >
                      <defs>
                        {/* 24k Luxury Gold Gradients */}
                        <linearGradient id="ropeGoldCore" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#7a5518" />
                          <stop offset="20%" stopColor="#cda54b" />
                          <stop offset="45%" stopColor="#fae7a5" />
                          <stop offset="70%" stopColor="#c59838" />
                          <stop offset="100%" stopColor="#6e4912" />
                        </linearGradient>

                        <linearGradient id="ropeBraidHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#fff8db" stopOpacity="0.95" />
                          <stop offset="50%" stopColor="#f7e199" stopOpacity="1" />
                          <stop offset="100%" stopColor="#d8ab46" stopOpacity="0.9" />
                        </linearGradient>

                        <linearGradient id="brassBezelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#eed285" />
                          <stop offset="50%" stopColor="#9e7323" />
                          <stop offset="100%" stopColor="#fae29c" />
                        </linearGradient>

                        {/* Ambient Gold Aura */}
                        <filter id="goldAura" x="-40%" y="-40%" width="180%" height="180%">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>

                        {/* Deep Physics Drop Shadow */}
                        <filter id="ropeDeepShadow" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#000000" floodOpacity="0.85" />
                        </filter>
                      </defs>

                      {/* 1. Deep realistic ground shadow */}
                      <path
                        d={`M ${startX + 80} ${startY + 60} Q ${cpX + 80} ${cpY + 60} ${endX + 80} ${endY + 60}`}
                        fill="none"
                        stroke="#050505"
                        strokeWidth="9"
                        strokeLinecap="round"
                        filter="url(#ropeDeepShadow)"
                      />

                      {/* 2. Ambient golden aura glow */}
                      <path
                        d={`M ${startX + 80} ${startY + 60} Q ${cpX + 80} ${cpY + 60} ${endX + 80} ${endY + 60}`}
                        fill="none"
                        stroke="rgba(201, 168, 76, 0.3)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        filter="url(#goldAura)"
                      />

                      {/* 3. Main thick braided rope body */}
                      <path
                        d={`M ${startX + 80} ${startY + 60} Q ${cpX + 80} ${cpY + 60} ${endX + 80} ${endY + 60}`}
                        fill="none"
                        stroke="url(#ropeGoldCore)"
                        strokeWidth="6.5"
                        strokeLinecap="round"
                      />

                      {/* 4. Deep intertwined helical rope grooves */}
                      <path
                        d={`M ${startX + 80} ${startY + 60} Q ${cpX + 80} ${cpY + 60} ${endX + 80} ${endY + 60}`}
                        fill="none"
                        stroke="#3d2605"
                        strokeWidth="3.8"
                        strokeDasharray="9 7"
                        strokeDashoffset="0"
                        strokeLinecap="round"
                      />

                      {/* 5. Bright braided gold filament strand */}
                      <path
                        d={`M ${startX + 80} ${startY + 60} Q ${cpX + 80} ${cpY + 60} ${endX + 80} ${endY + 60}`}
                        fill="none"
                        stroke="url(#ropeBraidHighlight)"
                        strokeWidth="3.2"
                        strokeDasharray="8 8"
                        strokeDashoffset="8"
                        strokeLinecap="round"
                      />

                      {/* 6. Pure silk/metallic specular threads */}
                      <path
                        d={`M ${startX + 80} ${startY + 60} Q ${cpX + 80} ${cpY + 60} ${endX + 80} ${endY + 60}`}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                        strokeDasharray="2 14"
                        strokeDashoffset="11"
                        strokeLinecap="round"
                        strokeOpacity="0.9"
                      />

                      {/* ── Dock Anchor: Beveled Brass Grommet & Luxury Shackle ── */}
                      <g transform={`translate(${startX + 80}, ${startY + 60})`}>
                        {/* Outer Glow Halo */}
                        <circle cx="0" cy="0" r="14" fill="rgba(201, 168, 76, 0.15)" />
                        {/* Polished Brass Bezel */}
                        <circle cx="0" cy="0" r="11" fill="#141414" stroke="url(#brassBezelGrad)" strokeWidth="3" />
                        <circle cx="0" cy="0" r="6" fill="#38260b" stroke="#f6d365" strokeWidth="1.2" />
                        {/* Center Diamond Pin */}
                        <polygon points="0,-3 3,0 0,3 -3,0" fill="#fff" />
                        {/* Shackle Crimp Collar */}
                        <rect x="-5" y="-6" width="10" height="12" rx="3.5" fill="#8f6520" stroke="#f6d365" strokeWidth="1" />
                      </g>

                      {/* ── Button Terminal: Gold Carabiner Clasp & Rivet ── */}
                      <g transform={`translate(${endX + 80}, ${endY + 60})`}>
                        {/* Outer Pulse Halo */}
                        <circle cx="0" cy="0" r="13" fill="rgba(201, 168, 76, 0.2)" />
                        {/* Gold Clasp Terminal */}
                        <circle cx="0" cy="0" r="9.5" fill="url(#brassBezelGrad)" stroke="#fff" strokeWidth="1.5" />
                        <circle cx="0" cy="0" r="5" fill="#2b1a05" />
                        <circle cx="0" cy="0" r="2.5" fill="#fff" />
                        {/* Shackle Hook Bar */}
                        <path d="M-6 0h12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                      </g>
                    </svg>
                  )}

                  <ActionButton
                    type="submit"
                    id="login-submit-btn"
                    className={`auth-submit ${isFormIncomplete ? 'auth-submit--runaway' : ''}`}
                    loading={loading}
                    loadingText="Signing in..."
                    style={{
                      transform: `translate(${runawayOffset.x}px, ${runawayOffset.y}px)`,
                      zIndex: 2,
                    }}
                    onMouseMove={handleButtonRunaway}
                    onMouseEnter={handleButtonRunaway}
                    onTouchStart={handleButtonRunaway}
                    onTouchMove={handleButtonRunaway}
                  >
                    SIGN IN
                  </ActionButton>
                </div>
              </div>
            )
          })()}
        </form>

        {/* Google sign-in for customer accounts */}
        <div className="auth-or"><span>or</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', alignItems: 'center' }}>
          <GoogleSignIn onSuccess={handleGoogle} onError={() => {}} />
        </div>

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
