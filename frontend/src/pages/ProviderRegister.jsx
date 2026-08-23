import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api'
import { generateProviderPDF } from '../utils/pdfGenerator'
import './ProviderRegister.css'

const steps = [
  { num: '01', label: 'Personal Details' },
  { num: '02', label: 'Business Info' },
  { num: '03', label: 'Services Offered' },
  { num: '04', label: 'Review & Submit' },
]

const formatSriLankanMobile = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  return /^07\d{8}$/.test(digits) ? `+94${digits.slice(1)}` : ''
}

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
      <input id={id} type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={onChange} />
    </label>
  </div>
)

const ProviderRegister = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [otpSent, setOtpSent] = useState(false)
  const [isOtpVerified, setIsOtpVerified] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    passwordConfirm: '',
    nicNumber: '',
    mobile: '',
    otp: '',
    nicFront: null,
    nicBack: null,
    nicFrontPreview: null,
    nicBackPreview: null,
    selfie: null,
    selfiePreview: null,
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

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          const maxWidth = 600

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.6))
        }
        img.onerror = () => resolve(event.target.result)
        img.src = event.target.result
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = (field, previewField) => async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file only (JPG, PNG, WEBP).')
      return
    }
    const compressedUrl = await compressImage(file)
    setForm((prev) => ({ ...prev, [field]: file, [previewField]: compressedUrl }))
  }

  const toggleService = (s) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(s)
        ? prev.services.filter((x) => x !== s)
        : [...prev.services, s],
    }))
  }

  const handleSendOtp = async () => {
    if (!/^07\d{8}$/.test(form.mobile)) {
      alert('Enter a valid Sri Lankan mobile number starting with 07.')
      return
    }
    try {
      await apiRequest('/auth/register/phone/send', 'POST', { phone: form.mobile })
      setOtpSent(true)
      setIsOtpVerified(false)
      setPhoneVerificationToken('')
      setOtpError('')
    } catch (error) { setOtpError(error.message || 'Could not send OTP.') }
  }

  const handleVerifyOtp = async () => {
    if (!form.otp || form.otp.length !== 4) {
      setOtpError('Please enter a valid 4-digit OTP code.')
      return
    }
    try {
      const result = await apiRequest('/auth/register/phone/verify', 'POST', { phone: form.mobile, code: form.otp })
      setPhoneVerificationToken(result.verification_token)
      setIsOtpVerified(true)
      setOtpError('')
    } catch (error) { setOtpError(error.message || 'OTP verification failed.') }
  }

  const nextStep = (e) => {
    e.preventDefault()
    if (step === 0) {
      if (!/^07\d{8}$/.test(form.mobile)) {
        alert('Enter a valid Sri Lankan mobile number starting with 07.')
        return
      }
      if (form.password.length < 6) {
        alert('Password must be at least 6 characters.')
        return
      }
      if (form.password !== form.passwordConfirm) {
        alert('Passwords do not match.')
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

  const [lastApplication, setLastApplication] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 6 || form.password !== form.passwordConfirm) {
      setSubmitError('Password must be at least 6 characters and match the confirmation.')
      return
    }
    setLoading(true)
    setSubmitError('')
    try {
      const appRecord = {
        id: 'PENDING',
        fullName: form.fullName,
        email: form.email,
        phone: form.mobile,
        nic: form.nicNumber,
        businessName: form.businessName || form.fullName + ' Services',
        businessType: form.businessType || 'Independent Provider',
        city: form.city || 'Colombo 03',
        address: form.address || 'Specified on file',
        services: form.services,
        nicFrontPreview: form.nicFrontPreview,
        nicBackPreview: form.nicBackPreview,
        selfiePreview: form.selfiePreview,
        hasNicFront: !!form.nicFrontPreview,
        hasNicBack: !!form.nicBackPreview,
        hasSelfie: !!form.selfiePreview,
        submittedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        status: 'PENDING APPROVAL'
      }

      setLastApplication(appRecord)

      const registration = await apiRequest('/auth/register', 'POST', {
          name: form.fullName,
          email: form.email,
          password: form.password,
          phone: form.mobile,
          role: 'provider',
          nic: form.nicNumber,
          category: form.services[0],
          service_towns: form.city,
          phone_verification_token: phoneVerificationToken,
        })
      const uploadDocument = async (file, documentType) => {
        if (!file) return
        const payload = new FormData()
        payload.append('document_type', documentType)
        payload.append('documents', file)
        await apiRequest('/provider/kyc-documents', 'POST', payload, registration.token)
      }
      await uploadDocument(form.nicFront, 'NIC')
      await uploadDocument(form.nicBack, 'NIC')
      await uploadDocument(form.selfie, 'SELFIE')

      setSubmitted(true)
    } catch (error) {
      setSubmitError(error.message || 'Could not submit your provider application.')
    } finally {
      setLoading(false)
    }
  }

  const progress = ((step) / (steps.length - 1)) * 100

  if (submitted) {
    return (
      <div className="pr-page">
        <div className="pr-bg" />
        <Link to="/" className="pr-logo">
          <img src="/luxora-logo.png" alt="LUXORA" className="pr-logo-img" />
        </Link>
        <div className="pr-success" style={{ position: 'relative' }}>
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
          <div className="pr-success__icon">✦</div>
          <h2>Application Submitted!</h2>
          <p>Your provider profile is under review. Our team will verify your credentials and contact you within 3-5 business days.</p>
          
          <div style={{ margin: '1.25rem 0' }}>
            <button
              onClick={() => {
                if (lastApplication) {
                  generateProviderPDF(lastApplication).save()
                } else {
                  generateProviderPDF(form).save()
                }
              }}
              style={{
                background: 'rgba(201, 168, 76, 0.15)',
                border: '1px solid var(--gold, #c9a84c)',
                color: 'var(--gold, #c9a84c)',
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              📄 DOWNLOAD APPLICATION SUMMARY (PDF)
            </button>
          </div>

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
              <input id="pr-email" name="email" type="email" className="pr-input"
                placeholder="Email Address" value={form.email}
                onChange={handleChange} required />
            </div>

            <div className="pr-row">
              <input id="pr-password" name="password" type="password" className="pr-input"
                placeholder="Password (min 6 characters)" value={form.password}
                onChange={handleChange} minLength={6} maxLength={72}
                autoComplete="new-password" required />
              <input id="pr-password-confirm" name="passwordConfirm" type="password" className="pr-input"
                placeholder="Confirm Password" value={form.passwordConfirm}
                onChange={handleChange} maxLength={72}
                autoComplete="new-password" required />
            </div>

            <div className="pr-row">
              <UploadBox label="NIC FRONT PHOTO (IMAGE ONLY)" id="nic-front"
                onChange={handleFileChange('nicFront', 'nicFrontPreview')}
                preview={form.nicFrontPreview} />
              <UploadBox label="NIC BACK PHOTO (IMAGE ONLY)" id="nic-back"
                onChange={handleFileChange('nicBack', 'nicBackPreview')}
                preview={form.nicBackPreview} />
            </div>

            <div className="pr-row" style={{ marginTop: '0.5rem' }}>
              <UploadBox label="PROVIDER SELFIE PHOTO (IMAGE ONLY)" id="provider-selfie"
                onChange={handleFileChange('selfie', 'selfiePreview')}
                preview={form.selfiePreview} />
            </div>

            <div className="pr-row pr-row--otp">
              <input id="pr-mobile" name="mobile" type="tel" className="pr-input"
                placeholder="0771575701" value={form.mobile}
                onChange={(e) => { handleMobileChange(e); setIsOtpVerified(false); setOtpSent(false) }}
                maxLength={10} inputMode="numeric" pattern="07[0-9]{8}" title="Enter a 10-digit Sri Lankan mobile number starting with 07" required />
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
                    📱 Enter OTP sent to {formatSriLankanMobile(form.mobile)}
                  </span>
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
                ✓ Mobile Number {formatSriLankanMobile(form.mobile)} Verified Successfully
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
            <div className="pr-row" style={{ gridTemplateColumns: '1fr' }}>
              <input id="pr-bizname" name="businessName" type="text" className="pr-input"
                placeholder="Full Registered Business / Company Name" value={form.businessName}
                onChange={handleChange} style={{ width: '100%' }} required />
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
            {submitError && <p style={{ color: '#ef4444', margin: 0, fontSize: '0.85rem' }}>{submitError}</p>}
            <div className="pr-review">
              <div className="pr-review-section">
                <h4>Personal Details</h4>
                <div className="pr-review-row"><span>Name</span><span>{form.fullName || '—'}</span></div>
                <div className="pr-review-row"><span>NIC</span><span>{form.nicNumber || '—'}</span></div>
                <div className="pr-review-row"><span>Mobile</span><span>{form.mobile || '—'}</span></div>
                <div className="pr-review-row"><span>Selfie Photo</span><span>{form.selfiePreview ? '✓ Uploaded' : 'Not Uploaded'}</span></div>
              </div>
              <div className="pr-review-section">
                <h4>Business Info</h4>
                <div className="pr-review-row"><span>Business</span><span>{form.businessName || '—'}</span></div>
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
