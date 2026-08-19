import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api'
import './Auth.css'
import '../components/Footer.css'

const Signup = () => {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
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
      const data = await apiRequest('/auth/register', 'POST', {
        name: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: 'customer',
      })
      const userData = data.user || {}
      if (!data.token || !userData.email || String(userData.role || '').toUpperCase() !== 'CUSTOMER') {
        throw new Error('The server returned an invalid registration response.')
      }
      setLoading(false)
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

      const userEmail = (userData.email || form.email).toLowerCase()
      localStorage.setItem('activePackages_' + userEmail, JSON.stringify([]))
      localStorage.setItem('luxora_customer_bookings_' + userEmail, JSON.stringify([]))
      localStorage.setItem('custom_requests_' + userEmail, JSON.stringify([]))
      localStorage.setItem('notifications_' + userEmail, JSON.stringify([]))
      localStorage.setItem('history_' + userEmail, JSON.stringify([]))

      sessionStorage.setItem('token', data.token)
      sessionStorage.setItem('user', JSON.stringify(userData))
      sessionStorage.setItem('isFirstTimeSignup', 'true')
      navigate('/customer-dashboard')
    } catch (err) {
      setLoading(false)
      setErrorMsg(err.message || 'Unable to create your account. Please try again.')
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
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTermsModal(true); }}
                className="auth-forgot"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Terms of Service
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPrivacyModal(true); }}
                className="auth-forgot"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Privacy Policy
              </button>
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

      {/* ── Privacy Policy Modal Pop-up Window ── */}
      {showPrivacyModal && (
        <div className="about-modal__backdrop" onClick={() => setShowPrivacyModal(false)}>
          <div className="about-modal__window privacy-modal__window" onClick={(e) => e.stopPropagation()}>
            <button
              className="about-modal__close"
              onClick={() => setShowPrivacyModal(false)}
              aria-label="Close Privacy Window"
            >
              ✕
            </button>
            
            <div className="about-modal__badge">LEGAL</div>
            <h2 className="about-modal__title">Privacy Policy</h2>
            
            <div className="about-modal__content privacy-modal__content">
              <p>
                At Luxora, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our platform and home concierge services.
              </p>

              <h3>1. Information We Collect</h3>
              <p>We collect information to provide better services to our clients, including:</p>
              <ul>
                <li><strong>Personal Information:</strong> Name, email address, phone number, physical address, and payment details provided when creating an account or subscribing to a plan.</li>
                <li><strong>Service Details:</strong> Specific preferences, vehicle details, garden layout information, or pet details required to fulfill your requested concierge services.</li>
                <li><strong>Technical Data:</strong> IP address, browser type, device information, and usage patterns collected automatically when accessing our site.</li>
              </ul>

              <h3>2. How We Use Your Information</h3>
              <p>We use your information for the following purposes:</p>
              <ul>
                <li>To schedule, coordinate, and fulfill subscription services.</li>
                <li>To process payments securely and manage subscription renewals.</li>
                <li>To communicate regarding service updates, appointments, and support inquiries.</li>
                <li>To improve our platform, enhance security, and prevent fraudulent activity.</li>
              </ul>

              <h3>3. How We Share Your Information</h3>
              <p>Luxora respects your privacy. We do not sell or rent your personal data to third parties. We share information only with:</p>
              <ul>
                <li><strong>Service Professionals:</strong> Verified Luxora personnel or assigned service specialists required to perform your requested service.</li>
                <li><strong>Payment Processors:</strong> Secure third-party payment gateways to complete transactions safely.</li>
                <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process.</li>
              </ul>

              <h3>4. Data Security</h3>
              <p>
                We implement industry-standard security measures, including encryption, access controls, and secure servers, to protect your personal information against unauthorized access, loss, or alteration.
              </p>

              <h3>5. Your Privacy Rights</h3>
              <p>You have the right to:</p>
              <ul>
                <li>Access, update, or correct your personal information through your account dashboard.</li>
                <li>Request the deletion of your account and associated data, subject to legal retention obligations.</li>
                <li>Opt out of promotional communications at any time.</li>
              </ul>

              <h3>6. Cookies and Tracking Technologies</h3>
              <p>
                Luxora uses cookies and similar technologies to enhance user experience, analyze website traffic, and remember your preferences. You can manage cookie settings through your web browser.
              </p>

              <h3>7. Changes to This Privacy Policy</h3>
              <p>
                We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. Updates will be posted on this page with an updated effective date.
              </p>
            </div>

            <div className="about-modal__footer">
              <button
                className="about-modal__btn"
                onClick={() => setShowPrivacyModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Terms of Service Modal Pop-up Window ── */}
      {showTermsModal && (
        <div className="about-modal__backdrop" onClick={() => setShowTermsModal(false)}>
          <div className="about-modal__window privacy-modal__window" onClick={(e) => e.stopPropagation()}>
            <button
              className="about-modal__close"
              onClick={() => setShowTermsModal(false)}
              aria-label="Close Terms Window"
            >
              ✕
            </button>
            
            <div className="about-modal__badge">LEGAL</div>
            <h2 className="about-modal__title">Terms of Service</h2>
            
            <div className="about-modal__content privacy-modal__content">
              <p>
                Welcome to Luxora. By accessing or using our website and services, you agree to comply with these Terms of Service. Please read them carefully before using our platform.
              </p>

              <h3>1. Acceptance of Terms</h3>
              <p>
                By creating an account, purchasing a subscription, or using any Luxora service, you agree to be bound by these Terms of Service and our Privacy Policy.
              </p>

              <h3>2. Our Services</h3>
              <p>Luxora provides subscription-based home concierge services, including but not limited to:</p>
              <ul>
                <li>Car Care</li>
                <li>Garden Care</li>
                <li>Pet Care</li>
                <li>Additional home maintenance services offered through our platform</li>
              </ul>
              <p>Service availability may vary depending on your location and subscription plan.</p>

              <h3>3. User Responsibilities</h3>
              <p>As a user, you agree to:</p>
              <ul>
                <li>Provide accurate and up-to-date information.</li>
                <li>Maintain the security of your account credentials.</li>
                <li>Use our services only for lawful purposes.</li>
                <li>Treat our service professionals with respect and professionalism.</li>
              </ul>

              <h3>4. Subscriptions and Payments</h3>
              <ul>
                <li>Subscription fees are charged according to the selected plan.</li>
                <li>Payments must be completed before services are provided.</li>
                <li>Subscription renewals and cancellation policies will be outlined during the subscription process.</li>
                <li>Additional services outside your subscription may incur extra charges.</li>
              </ul>

              <h3>5. Cancellations and Refunds</h3>
              <p>
                Customers may cancel or reschedule services according to Luxora&apos;s cancellation policy. Refund eligibility depends on the type of service, timing of cancellation, and applicable subscription terms.
              </p>

              <h3>6. Service Availability</h3>
              <p>
                While we strive to provide reliable services, Luxora cannot guarantee uninterrupted availability. Services may be delayed or unavailable due to weather, emergencies, technical issues, or circumstances beyond our control.
              </p>

              <h3>7. Limitation of Liability</h3>
              <p>
                Luxora is not liable for indirect, incidental, or consequential damages arising from the use of our website or services. Our liability is limited to the extent permitted by applicable law.
              </p>

              <h3>8. Intellectual Property</h3>
              <p>
                All content on the Luxora website, including text, logos, graphics, images, and software, is the property of Luxora and may not be copied, reproduced, or distributed without prior written permission.
              </p>
            </div>

            <div className="about-modal__footer">
              <button
                className="about-modal__btn"
                onClick={() => setShowTermsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="auth-tagline">EXCELLENCE REFINED</p>
    </div>
  )
}

export default Signup
