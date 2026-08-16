import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './ProviderRegister.css'

const steps = [
  { num: '01', label: 'Personal Details' },
  { num: '02', label: 'Business Info' },
  { num: '03', label: 'Services Offered' },
  { num: '04', label: 'Review & Submit' },
]

const UploadBox = ({ label, id, onChange, preview }) => (
  <div className="pr-upload-wrap">
    <p className="pr-upload-label">{label}</p>
    <label htmlFor={id} className="pr-upload-box">
      {preview ? (
        <img src={preview} alt="preview" className="pr-upload-preview" />
      ) : (
        <>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Click to upload image file (JPG, PNG)</span>
        </>
      )}
      <input id={id} type="file" accept="image/png, image/jpeg, image/webp, image/*" style={{ display: 'none' }} onChange={onChange} />
    </label>
  </div>
)

const ProviderRegister = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [otpSent, setOtpSent] = useState(false)
  const [isOtpVerified, setIsOtpVerified] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [form, setForm] = useState({
    fullName: '',
    nicNumber: '',
    mobile: '',
    otp: '',
    nicFront: null,
    nicBack: null,
    nicFrontPreview: null,
    nicBackPreview: null,
    // Step 2
    businessName: '',
    businessType: '',
    city: '',
    address: '',
    website: '',
    // Step 3
    services: [],
  })

  const serviceOptions = [
    'Auto Care', 'Garden Care', 'Pet Care',
  ]

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleNicChange = (e) => {
    const val = e.target.value.slice(0, 12)
    setForm((prev) => ({ ...prev, nicNumber: val }))
  }

  const handleMobileChange = (e) => {
    const numbersOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
    setForm((prev) => ({ ...prev, mobile: numbersOnly }))
  }

  const handleOtpChange = (e) => {
    const numbersOnly = e.target.value.replace(/\D/g, '').slice(0, 4)
    setForm((prev) => ({ ...prev, otp: numbersOnly }))
  }

  const handleFileChange = (field, previewField) => (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file only (JPG, PNG, WEBP).')
      return
    }
    const url = URL.createObjectURL(file)
    setForm((prev) => ({ ...prev, [field]: file, [previewField]: url }))
  }

  const toggleService = (s) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(s)
        ? prev.services.filter((x) => x !== s)
        : [...prev.services, s],
    }))
  }

  const handleSendOtp = () => {
    if (!form.mobile || form.mobile.length !== 10) {
      alert('Please enter a valid 10-digit mobile number before requesting OTP.')
      return
    }
    setOtpSent(true)
    setIsOtpVerified(false)
    setOtpError('')
    if (!form.otp) setForm(prev => ({ ...prev, otp: '1234' }))
  }

  const handleVerifyOtp = () => {
    if (!form.otp || form.otp.length !== 4) {
      setOtpError('Please enter a valid 4-digit OTP code.')
      return
    }
    setIsOtpVerified(true)
    setOtpError('')
  }

  const nextStep = (e) => {
    e.preventDefault()
    if (step === 0) {
      if (form.mobile.length !== 10) {
        alert('Mobile number must be exactly 10 digits.')
        return
      }
      if (!otpSent) {
        alert('Please click SEND OTP to receive your mobile verification code.')
        return
      }
      if (!isOtpVerified) {
        alert('Mobile OTP verification required! Please enter the 4-digit OTP code and click VERIFY OTP before proceeding.')
        return
      }
    }
    if (step === 2) {
      if (form.services.length === 0) {
        alert('Please select at least one service offered (Auto Care, Garden Care, or Pet Care).')
        return
      }
    }
    if (step < steps.length - 1) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const stored = localStorage.getItem('luxora_all_users')
      const existing = stored ? JSON.parse(stored) : []
      const newProvRecord = {
        id: `USR-${String(existing.length + 7).padStart(3, '0')}`,
        name: `${form.firstName} ${form.lastName}`.trim() || 'New Provider',
        email: form.email,
        role: 'Provider',
        registered: new Date().toISOString().split('T')[0],
        category: form.services.join(', ') || 'Concierge'
      }
      localStorage.setItem('luxora_all_users', JSON.stringify([newProvRecord, ...existing]))

      const newProvItem = {
        id: existing.length + 6,
        name: `${form.firstName} ${form.lastName}`.trim() || 'New Provider',
        email: form.email,
        category: form.services.join(', ') || 'Auto Care',
        nic: form.nic || '199512345678',
        kyc_status: 'pending',
        rating: '5.0 / 5.0'
      }
      const storedP = localStorage.getItem('luxora_all_providers')
      const existingP = storedP ? JSON.parse(storedP) : []
      localStorage.setItem('luxora_all_providers', JSON.stringify([newProvItem, ...existingP]))
    } catch (_) {}

    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 2000)
  }

  const progress = ((step) / (steps.length - 1)) * 100

  if (submitted) {
    return (
      <div className="pr-page">
        <div className="pr-bg" />
        <Link to="/" className="pr-logo">
          <img src="/luxora-logo.png" alt="LUXORA" className="pr-logo-img" />
        </Link>
        <div className="pr-success">
          <div className="pr-success__icon">✦</div>
          <h2>Application Submitted!</h2>
          <p>Your provider profile is under review. Our team will verify your credentials and contact you within 3-5 business days.</p>
          <Link to="/" className="pr-success__btn">Return to Home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pr-page">
      {/* Background */}
      <div className="pr-bg" />

      {/* Top Bar */}
      <header className="pr-header">
        <Link to="/" className="pr-logo">
          <img src="/luxora-logo.png" alt="LUXORA" className="pr-logo-img" />
        </Link>
        <div className="pr-header__right">
          <span className="pr-header__tag">PARTNER REGISTRATION</span>
          <button className="pr-header__help" aria-label="Help">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Page Title */}
      <div className="pr-title-wrap">
        <h1 className="pr-title">Join the Elite Provider Network</h1>
        <p className="pr-subtitle">
          Curating the world&apos;s finest services for the world&apos;s most discerning clientele.
          Complete your profile to begin the verification process.
        </p>
      </div>

      {/* Step Progress Bar */}
      <div className="pr-progress-bar">
        {steps.map((s, i) => (
          <div
            key={s.num}
            className={`pr-step-dot ${i <= step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            title={s.label}
          >
            {i < step ? '✓' : s.num}
          </div>
        ))}
        <div className="pr-progress-track">
          <div className="pr-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="pr-card">
        {/* Step Header */}
        <div className="pr-card__step-label">
          <div className="pr-card__step-num">{steps[step].num}</div>
          <h2 className="pr-card__step-title">{steps[step].label}</h2>
        </div>

        {/* ── STEP 0: Personal Details ── */}
        {step === 0 && (
          <form className="pr-form" onSubmit={nextStep} id="pr-step1-form">
            <div className="pr-row">
              <input id="pr-fullname" name="fullName" type="text" className="pr-input"
                placeholder="Full Name" value={form.fullName}
                onChange={handleChange} required />
              <input id="pr-nic" name="nicNumber" type="text" className="pr-input"
                placeholder="NIC Number" value={form.nicNumber}
                onChange={handleNicChange} maxLength={12} required />
            </div>

            <div className="pr-row">
              <UploadBox label="NIC FRONT PHOTO (IMAGE ONLY)" id="nic-front"
                onChange={handleFileChange('nicFront', 'nicFrontPreview')}
                preview={form.nicFrontPreview} />
              <UploadBox label="NIC BACK PHOTO (IMAGE ONLY)" id="nic-back"
                onChange={handleFileChange('nicBack', 'nicBackPreview')}
                preview={form.nicBackPreview} />
            </div>

            <div className="pr-row pr-row--otp">
              <input id="pr-mobile" name="mobile" type="tel" className="pr-input"
                placeholder="Mobile Number" value={form.mobile}
                onChange={(e) => { handleMobileChange(e); setIsOtpVerified(false); setOtpSent(false) }}
                maxLength={10} inputMode="numeric" pattern="[0-9]{10}" title="Please enter a 10-digit mobile number" required />
              <button type="button" id="pr-send-otp-btn"
                className={`pr-otp-btn ${isOtpVerified ? 'pr-otp-btn--sent' : otpSent ? 'pr-otp-btn--sent' : ''}`}
                onClick={handleSendOtp} disabled={isOtpVerified}>
                {isOtpVerified ? 'VERIFIED ✓' : otpSent ? 'RESEND OTP' : 'SEND OTP'}
              </button>
            </div>

            {otpSent && !isOtpVerified && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#111', padding: '0.85rem', borderRadius: '8px', border: '1px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '0.75rem', fontWeight: '600' }}>
                    📱 Enter OTP sent to +94 {form.mobile}
                  </span>
                  <small style={{ color: '#888', fontSize: '0.7rem' }}>Demo OTP: <strong style={{ color: '#fff' }}>1234</strong></small>
                </div>
                <div className="pr-row" style={{ gridTemplateColumns: '1fr auto', gap: '0.6rem' }}>
                  <input id="pr-otp" name="otp" type="text" className="pr-input"
                    placeholder="Enter 4-Digit OTP" value={form.otp}
                    onChange={(e) => { handleOtpChange(e); setOtpError('') }} required maxLength={4} inputMode="numeric" pattern="[0-9]{4}" title="Please enter a 4-digit OTP code" />
                  <button type="button" className="pr-otp-btn" style={{ background: 'var(--gold)', color: '#000', fontWeight: '800' }} onClick={handleVerifyOtp}>
                    VERIFY OTP
                  </button>
                </div>
                {otpError && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>{otpError}</span>}
              </div>
            )}

            {isOtpVerified && (
              <div style={{ background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', padding: '0.7rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ✓ Mobile Number +94 {form.mobile} Verified Successfully
              </div>
            )}

            <div className="pr-actions">
              <div />
              <button type="submit" id="pr-next-1" className="pr-btn-next">
                Next Step →
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 1: Business Info ── */}
        {step === 1 && (
          <form className="pr-form" onSubmit={nextStep} id="pr-step2-form">
            <div className="pr-row">
              <input id="pr-bizname" name="businessName" type="text" className="pr-input"
                placeholder="Business / Company Name" value={form.businessName}
                onChange={handleChange} required />
              <div className="pr-select-wrap">
                <select id="pr-biztype" name="businessType" className="pr-input pr-select"
                  value={form.businessType} onChange={handleChange} required>
                  <option value="" disabled>Business Type</option>
                  <option value="sole">Sole Proprietor</option>
                  <option value="pvt">Private Company</option>
                  <option value="partnership">Partnership</option>
                  <option value="ngo">NGO</option>
                </select>
                <svg className="pr-select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            <div className="pr-row">
              <input id="pr-city" name="city" type="text" className="pr-input"
                placeholder="City / Region" value={form.city}
                onChange={handleChange} required />
              <input id="pr-website" name="website" type="url" className="pr-input"
                placeholder="Website (optional)" value={form.website}
                onChange={handleChange} />
            </div>

            <textarea id="pr-address" name="address" className="pr-input pr-textarea"
              placeholder="Full Business Address" value={form.address}
              onChange={handleChange} rows={3} required />

            <div className="pr-actions">
              <button type="button" className="pr-btn-back" onClick={prevStep}>← Back</button>
              <button type="submit" id="pr-next-2" className="pr-btn-next">Next Step →</button>
            </div>
          </form>
        )}

        {/* ── STEP 2: Services Offered ── */}
        {step === 2 && (
          <form className="pr-form" onSubmit={nextStep} id="pr-step3-form">
            <p className="pr-services-hint">Select all services your business offers:</p>
            <div className="pr-services-grid">
              {serviceOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pr-service-tag ${form.services.includes(s) ? 'selected' : ''}`}
                  onClick={() => toggleService(s)}
                  id={`pr-service-${s.toLowerCase().replace(/\s/g, '-')}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="pr-actions">
              <button type="button" className="pr-btn-back" onClick={prevStep}>← Back</button>
              <button type="submit" id="pr-next-3"
                className="pr-btn-next"
                disabled={form.services.length === 0}>
                Next Step →
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Review & Submit ── */}
        {step === 3 && (
          <form className="pr-form" onSubmit={handleSubmit} id="pr-step4-form">
            <div className="pr-review">
              <div className="pr-review-section">
                <h4>Personal Details</h4>
                <div className="pr-review-row"><span>Name</span><span>{form.fullName || '—'}</span></div>
                <div className="pr-review-row"><span>NIC</span><span>{form.nicNumber || '—'}</span></div>
                <div className="pr-review-row"><span>Mobile</span><span>{form.mobile || '—'}</span></div>
              </div>
              <div className="pr-review-section">
                <h4>Business Info</h4>
                <div className="pr-review-row"><span>Business</span><span>{form.businessName || '—'}</span></div>
                <div className="pr-review-row"><span>Type</span><span>{form.businessType || '—'}</span></div>
                <div className="pr-review-row"><span>City</span><span>{form.city || '—'}</span></div>
              </div>
              <div className="pr-review-section">
                <h4>Services</h4>
                <div className="pr-review-tags">
                  {form.services.length > 0
                    ? form.services.map((s) => <span key={s} className="pr-review-tag">{s}</span>)
                    : <span className="pr-review-empty">None selected</span>}
                </div>
              </div>
            </div>

            <div className="pr-actions">
              <button type="button" className="pr-btn-back" onClick={prevStep}>← Back</button>
              <button type="submit" id="pr-submit-btn"
                className={`pr-btn-next pr-btn-submit ${loading ? 'loading' : ''}`}
                disabled={loading}>
                {loading ? <span className="auth-spinner" /> : 'SUBMIT APPLICATION'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <footer className="pr-footer">
        <span>LUXORA CONCIERGE</span>
        <span>© 2024 LUXORA CONCIERGE. ALL RIGHTS RESERVED.</span>
        <div className="pr-footer__links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
        </div>
      </footer>
    </div>
  )
}

export default ProviderRegister
