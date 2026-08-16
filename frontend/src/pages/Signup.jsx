import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Auth.css'

const Signup = () => {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  })

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handlePhoneChange = (e) => {
    const numbersOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
    setForm((prev) => ({ ...prev, phone: numbersOnly }))
  }

  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setErrorMsg('Passwords do not match.')
      return
    }
    if (form.phone && form.phone.length !== 10) {
      setErrorMsg('Phone number must be exactly 10 digits.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.fullName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          role: 'customer',
        }),
      })
      const data = await res.json()
      setLoading(false)

      if (!res.ok) {
        setErrorMsg(data.error || 'Registration failed. Please try again.')
        return
      }

      const userData = data.user || {}
      userData.name = data.user?.name || form.fullName || 'New Customer'
      userData.email = data.user?.email || form.email
      userData.phone = data.user?.phone || form.phone

      // Save newly registered user into luxora_all_users for Admin User Management
      try {
        const stored = localStorage.getItem('luxora_all_users')
        const existing = stored ? JSON.parse(stored) : []
        const newUserRecord = {
          id: `USR-${String(existing.length + 7).padStart(3, '0')}`,
          name: userData.name || form.fullName || 'New Customer',
          email: userData.email || form.email,
          role: 'Customer',
          registered: new Date().toISOString().split('T')[0],
          plan: 'Single Auto Elite'
        }
        localStorage.setItem('luxora_all_users', JSON.stringify([newUserRecord, ...existing]))
      } catch (_) {}

      sessionStorage.setItem('token', data.token || 'demo-token')
      sessionStorage.setItem('user', JSON.stringify(userData))
      sessionStorage.setItem('isCustomerLoggedIn', 'true')
      sessionStorage.setItem('isFirstTimeSignup', 'true')
      navigate('/customer-dashboard')
    } catch (err) {
      setLoading(false)
      // Save user to luxora_all_users for Admin User Management even in fallback mode
      try {
        const stored = localStorage.getItem('luxora_all_users')
        const existing = stored ? JSON.parse(stored) : []
        const newUserRecord = {
          id: `USR-${String(existing.length + 7).padStart(3, '0')}`,
          name: form.fullName || 'New Customer',
          email: form.email,
          role: 'Customer',
          registered: new Date().toISOString().split('T')[0],
          plan: 'Single Auto Elite'
        }
        localStorage.setItem('luxora_all_users', JSON.stringify([newUserRecord, ...existing]))
      } catch (_) {}

      // Demo / fallback mode if backend API is not responding
      sessionStorage.setItem('isCustomerLoggedIn', 'true')
      sessionStorage.setItem('isFirstTimeSignup', 'true')
      sessionStorage.setItem('user', JSON.stringify({
        name: form.fullName || 'New Customer',
        email: form.email,
        phone: form.phone
      }))
      navigate('/customer-dashboard')
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
      <div className="auth-card auth-card--wide">
        <div className="auth-card__header">
          <h1 className="auth-card__title">Create Account</h1>
          <p className="auth-card__subtitle">Join the Luxora elite concierge network</p>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} id="signup-form">
          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
              {errorMsg}
            </div>
          )}
          {/* Row: Name + Phone */}
          <div className="auth-form-row">
            <div className="auth-field">
              <input
                id="signup-fullname"
                name="fullName"
                type="text"
                className="auth-input"
                placeholder="Full Name"
                value={form.fullName}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </div>
            <div className="auth-field">
              <input
                id="signup-phone"
                name="phone"
                type="tel"
                className="auth-input"
                placeholder="Phone Number"
                value={form.phone}
                onChange={handlePhoneChange}
                maxLength={10}
                inputMode="numeric"
                pattern="[0-9]{10}"
                title="Please enter a 10-digit phone number"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="auth-field">
            <input
              id="signup-email"
              name="email"
              type="email"
              className="auth-input"
              placeholder="Email Address"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="auth-field">
            <div className="auth-input-wrap">
              <input
                id="signup-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-eye"
                id="signup-toggle-password"
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

          {/* Confirm Password */}
          <div className="auth-field">
            <div className="auth-input-wrap">
              <input
                id="signup-confirm"
                name="confirm"
                type={showConfirm ? 'text' : 'password'}
                className="auth-input"
                placeholder="Confirm Password"
                value={form.confirm}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-eye"
                id="signup-toggle-confirm"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirm ? (
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

          {/* Terms */}
          <label className="auth-checkbox auth-checkbox--terms" htmlFor="agree-terms">
            <input
              id="agree-terms"
              type="checkbox"
              checked={agreed}
              onChange={() => setAgreed(!agreed)}
              required
            />
            <span className="auth-checkbox__box" />
            <span className="auth-checkbox__label">
              I agree to the{' '}
              <a href="#" className="auth-forgot">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="auth-forgot">Privacy Policy</a>
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            id="signup-submit-btn"
            className={`auth-submit ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading
              ? <span className="auth-spinner" />
              : 'CREATE ACCOUNT'
            }
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider"><span /></div>

        {/* Footer */}
        <div className="auth-card__footer">
          <p className="auth-card__footer-text">Already have an account?</p>
          <Link to="/login" className="auth-card__footer-link" id="signup-goto-login">
            SIGN IN →
          </Link>
        </div>
      </div>

      <p className="auth-tagline">EXCELLENCE REFINED</p>
    </div>
  )
}

export default Signup
