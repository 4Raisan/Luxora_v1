import { useState } from 'react'
import './Membership.css'

const Membership = () => {
  const [form, setForm] = useState({
    fullName: '',
    estateLocation: '',
    email: '',
    interest: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 1800)
  }

  return (
    <section id="membership" className="membership">
      <div className="membership__inner">
        {/* Left Info */}
        <div className="membership__info">
          <span className="section-label">Exclusive Access</span>
          <h2 className="membership__title">Inquire for<br />Membership</h2>
          <p className="membership__desc">
            Admittance to the Luxora network is by application only.
            Speak with a curator to begin the process.
          </p>

          <div className="membership__contacts">
            <a href="tel:+18005896721" className="membership__contact-item" id="contact-phone">
              <div className="membership__contact-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span>+1 (800) LUX-ORA-1</span>
            </a>

            <a href="mailto:curate@luxora.com" className="membership__contact-item" id="contact-email">
              <div className="membership__contact-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span>curate@luxora.com</span>
            </a>
          </div>


        </div>

        {/* Right Form */}
        <div className="membership__form-wrap">
          {submitted ? (
            <div className="membership__success">
              <div className="membership__success-icon">✦</div>
              <h3>Application Received</h3>
              <p>A curator will be in touch within 24 hours to discuss your membership. Welcome to the Luxora circle.</p>
              <button className="membership__success-btn" onClick={() => setSubmitted(false)}>
                Submit Another
              </button>
            </div>
          ) : (
            <form className="membership__form" onSubmit={handleSubmit} id="membership-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fullName" className="form-label">FULL NAME</label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    className="form-input"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="estateLocation" className="form-label">ESTATE LOCATION</label>
                  <input
                    id="estateLocation"
                    name="estateLocation"
                    type="text"
                    className="form-input"
                    value={form.estateLocation}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">EMAIL ADDRESS</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="interest" className="form-label">PRIMARY INTEREST SERVICES</label>
                <div className="form-select-wrap">
                  <select
                    id="interest"
                    name="interest"
                    className="form-select"
                    value={form.interest}
                    onChange={handleChange}
                    required
                  >
                    <option value="" disabled>Select a service...</option>
                    <option value="auto">Auto Care</option>
                    <option value="garden">Garden Care</option>
                    <option value="pet">Pet Wellness</option>
                  </select>
                  <svg className="form-select-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="message" className="form-label">MESSAGE</label>
                <textarea
                  id="message"
                  name="message"
                  className="form-textarea"
                  rows={4}
                  value={form.message}
                  onChange={handleChange}
                />
              </div>

              <button
                type="submit"
                id="submit-application-btn"
                className={`form-submit ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading ? (
                  <span className="form-submit__spinner" />
                ) : (
                  'SUBMIT APPLICATION'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

export default Membership
