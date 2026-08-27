import { useState } from 'react'
import './Footer.css'

const Footer = () => {
  const year = new Date().getFullYear()
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [showVisionModal, setShowVisionModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showMembershipTermsModal, setShowMembershipTermsModal] = useState(false)
  const [showCookieModal, setShowCookieModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)

  const columns = [
    {
      heading: 'Services',
      links: ['Auto Care', 'Garden Care', 'Pet Care', 'Combo Packages'],
    },
    {
      heading: 'Company',
      links: ['About Us', 'Our Vision', 'Office', 'Contact'],
    },
    {
      heading: 'Legal',
      links: ['Privacy Policy', 'Terms of Service', 'Membership T&Cs', 'Cookie Policy'],
    },
  ]

  const handleLinkClick = (e, link) => {
    if (link === 'Office') {
      return
    }

    const scrollToPlans = () => {
      const el = document.getElementById('plans')
      if (el) {
        const navOffset = 80
        const elementPosition = el.getBoundingClientRect().top
        const offsetPosition = elementPosition + window.pageYOffset - navOffset
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        })
      }
    }

    if (link === 'Auto Care') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('select-plan-category', { detail: 'auto' }))
      scrollToPlans()
    } else if (link === 'Garden Care') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('select-plan-category', { detail: 'garden' }))
      scrollToPlans()
    } else if (link === 'Pet Care' || link === 'Pet Wellness') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('select-plan-category', { detail: 'pet' }))
      scrollToPlans()
    } else if (link === 'Combo Packages' || link === 'Combo') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('select-plan-category', { detail: 'combo' }))
      scrollToPlans()
    } else if (link === 'About Us') {
      e.preventDefault()
      setShowAboutModal(true)
    } else if (link === 'Our Vision') {
      e.preventDefault()
      setShowVisionModal(true)
    } else if (link === 'Contact' || link === 'Contacts') {
      e.preventDefault()
      setShowContactModal(true)
    } else if (link === 'Privacy Policy' || link === 'Privacy') {
      e.preventDefault()
      setShowPrivacyModal(true)
    } else if (link === 'Terms of Service' || link === 'Terms') {
      e.preventDefault()
      setShowTermsModal(true)
    } else if (link === 'Membership T&Cs') {
      e.preventDefault()
      setShowMembershipTermsModal(true)
    } else if (link === 'Cookie Policy' || link === 'Cookies') {
      e.preventDefault()
      setShowCookieModal(true)
    }
  }

  return (
    <footer className="footer" id="contact">
      <div className="footer__inner">
        {/* Top */}
        <div className="footer__top">
          {/* Brand */}
          <div className="footer__brand">
            <div className="footer__logo">
              <img src="/luxora-logo.png" alt="LUXORA" className="footer__logo-img" />
            </div>
            <p className="footer__tagline">
              The definitive platform for elite estate management and personal concierge excellence.
            </p>
            <div className="footer__socials">
              <a href="#" className="footer__social" id="footer-social-share" aria-label="Share">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </a>
              <a href="#" className="footer__social" id="footer-social-rss" aria-label="RSS Feed">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="5" cy="19" r="1" fill="currentColor"/>
                </svg>
              </a>
              <a href="#" className="footer__social" id="footer-social-linkedin" aria-label="LinkedIn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 10v7M7 7v.01M11 17v-3.5a2.5 2.5 0 015 0V17M11 10v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Columns */}
          {columns.map((col) => (
            <div key={col.heading} className="footer__col">
              <h4 className="footer__col-heading">{col.heading.toUpperCase()}</h4>
              <ul className="footer__col-links">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href={link === 'Office' ? 'https://maps.app.goo.gl/jZdwk72amn72NpRp8' : '#'}
                      target={link === 'Office' ? '_blank' : undefined}
                      rel={link === 'Office' ? 'noopener noreferrer' : undefined}
                      className="footer__link"
                      id={`footer-${link.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      onClick={(e) => handleLinkClick(e, link)}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="footer__divider" />

        {/* Bottom */}
        <div className="footer__bottom">
          <p className="footer__copy">
            © {year} LUXORA Concierge. All rights reserved.
          </p>
          <div className="footer__bottom-links">
            <a href="#" className="footer__bottom-link" onClick={(e) => handleLinkClick(e, 'Privacy')}>Privacy</a>
            <span className="footer__dot">·</span>
            <a href="#" className="footer__bottom-link" onClick={(e) => handleLinkClick(e, 'Terms')}>Terms</a>
            <span className="footer__dot">·</span>
            <a href="#" className="footer__bottom-link" onClick={(e) => handleLinkClick(e, 'Cookies')}>Cookies</a>
          </div>
        </div>
      </div>

      {/* About Us Modal Pop-up Window */}
      {showAboutModal && (
        <div className="about-modal__backdrop" onClick={() => setShowAboutModal(false)}>
          <div className="about-modal__window" onClick={(e) => e.stopPropagation()}>
            <button
              className="about-modal__close"
              onClick={() => setShowAboutModal(false)}
              aria-label="Close About Window"
            >
              ✕
            </button>
            
            <div className="about-modal__badge">ABOUT US</div>
            <h2 className="about-modal__title">Welcome to Luxora</h2>
            
            <div className="about-modal__content">
              <p>
                At Luxora, we make home care simple, convenient, and reliable. Our subscription-based concierge platform connects homeowners with trusted professionals for essential home maintenance services.
              </p>
              <p>
                Whether it&apos;s keeping your car spotless, maintaining a beautiful garden, or ensuring your pets receive quality care, Luxora helps you manage everything in one place.
              </p>
              <p>
                We are committed to delivering high-quality service, saving you time, and providing peace of mind through flexible subscription plans designed for modern lifestyles.
              </p>
            </div>

            <div className="about-modal__footer">
              <button
                className="about-modal__btn"
                onClick={() => setShowAboutModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Our Vision Modal Pop-up Window */}
      {showVisionModal && (
        <div className="about-modal__backdrop" onClick={() => setShowVisionModal(false)}>
          <div className="about-modal__window vision-modal__window" onClick={(e) => e.stopPropagation()}>
            <button
              className="about-modal__close"
              onClick={() => setShowVisionModal(false)}
              aria-label="Close Vision Window"
            >
              ✕
            </button>
            
            <div className="about-modal__badge">OUR VISION</div>
            <h2 className="about-modal__title">Excellence Refined</h2>
            
            <div className="vision-modal__quote-wrap">
              <span className="vision-modal__quote-mark">“</span>
              <p className="vision-modal__quote">
                To become Sri Lanka&apos;s most trusted home concierge platform, delivering premium, convenient, and reliable home services that simplify everyday living.
              </p>
            </div>

            <div className="about-modal__footer">
              <button
                className="about-modal__btn"
                onClick={() => setShowVisionModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Us Modal Pop-up Window */}
      {showContactModal && (
        <div className="about-modal__backdrop" onClick={() => setShowContactModal(false)}>
          <div className="about-modal__window contact-modal__window" onClick={(e) => e.stopPropagation()}>
            <button
              className="about-modal__close"
              onClick={() => setShowContactModal(false)}
              aria-label="Close Contact Window"
            >
              ✕
            </button>
            
            <div className="about-modal__badge">GET IN TOUCH</div>
            <h2 className="about-modal__title">Contact Us</h2>
            
            <div className="contact-modal__list">
              <div className="contact-modal__item">
                <div className="contact-modal__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="contact-modal__details">
                  <span className="contact-modal__label">Email Address</span>
                  <a href="mailto:Luxora123@gmail.com" className="contact-modal__val">Luxora123@gmail.com</a>
                </div>
              </div>

              <div className="contact-modal__item">
                <div className="contact-modal__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="contact-modal__details">
                  <span className="contact-modal__label">Phone No</span>
                  <a href="tel:0112345689" className="contact-modal__val">0112345689</a>
                </div>
              </div>

              <div className="contact-modal__item">
                <div className="contact-modal__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3V2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="contact-modal__details">
                  <span className="contact-modal__label">Facebook</span>
                  <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="contact-modal__val">Luxora Kollow</a>
                </div>
              </div>
            </div>

            <div className="about-modal__footer">
              <button
                className="about-modal__btn"
                onClick={() => setShowContactModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal Pop-up Window */}
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
                At Luxora, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our website and services.
              </p>

              <h3>1. Information We Collect</h3>
              <p>We may collect the following information:</p>
              <ul>
                <li>Full name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Home address (for service delivery)</li>
                <li>Payment information (processed securely through our payment providers)</li>
                <li>Account and subscription details</li>
                <li>Website usage information, such as pages visited and device information</li>
              </ul>

              <h3>2. How We Use Your Information</h3>
              <p>We use your information to:</p>
              <ul>
                <li>Provide and manage our services</li>
                <li>Process subscriptions and payments</li>
                <li>Schedule and deliver home services</li>
                <li>Respond to customer inquiries</li>
                <li>Improve our website and customer experience</li>
                <li>Send service updates and important notifications</li>
              </ul>

              <h3>3. Information Sharing</h3>
              <p>Luxora does not sell your personal information. We may share your information only with:</p>
              <ul>
                <li>Verified service providers assigned to your booking</li>
                <li>Trusted payment processing partners</li>
                <li>Legal authorities when required by applicable law</li>
              </ul>

              <h3>4. Data Security</h3>
              <p>
                We implement appropriate technical and organizational measures to protect your personal information from unauthorized access, loss, misuse, or disclosure.
              </p>

              <h3>5. Cookies</h3>
              <p>
                Our website may use cookies to improve your browsing experience, remember your preferences, and analyze website performance. You can manage cookie preferences through your browser settings.
              </p>

              <h3>6. Your Rights</h3>
              <p>You have the right to:</p>
              <ul>
                <li>Access your personal information</li>
                <li>Request corrections to inaccurate information</li>
                <li>Request deletion of your account and personal data (subject to legal requirements)</li>
                <li>Opt out of marketing communications at any time</li>
              </ul>

              <h3>7. Third-Party Services</h3>
              <p>
                Our website may contain links to third-party websites or use third-party services such as payment gateways. Their privacy practices are governed by their own privacy policies.
              </p>

              <h3>8. Changes to This Privacy Policy</h3>
              <p>
                We may update this Privacy Policy from time to time. Any changes will be posted on this page along with the updated effective date.
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

      {/* Terms of Service Modal Pop-up Window */}
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

              <h3>9. Account Suspension or Termination</h3>
              <p>
                Luxora reserves the right to suspend or terminate accounts that violate these Terms of Service, engage in fraudulent activities, or misuse the platform.
              </p>

              <h3>10. Changes to These Terms</h3>
              <p>
                We may update these Terms of Service from time to time. Updated versions will be published on this page with the revised effective date.
              </p>

              <h3>11. Governing Law</h3>
              <p>
                These Terms of Service are governed by the laws of Sri Lanka. Any disputes arising from these terms shall be subject to the jurisdiction of the courts of Sri Lanka.
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

      {/* Membership Terms & Conditions Modal Pop-up Window */}
      {showMembershipTermsModal && (
        <div className="about-modal__backdrop" onClick={() => setShowMembershipTermsModal(false)}>
          <div className="about-modal__window privacy-modal__window" onClick={(e) => e.stopPropagation()}>
            <button
              className="about-modal__close"
              onClick={() => setShowMembershipTermsModal(false)}
              aria-label="Close Membership Terms Window"
            >
              ✕
            </button>
            
            <div className="about-modal__badge">LEGAL</div>
            <h2 className="about-modal__title">Membership Terms &amp; Conditions</h2>
            
            <div className="about-modal__content privacy-modal__content">
              <ul>
                <li>Membership is available to registered users aged 18 or above.</li>
                <li>Subscription fees must be paid to access membership benefits.</li>
                <li>Benefits are available only while your membership is active.</li>
                <li>Unused services cannot be transferred or exchanged for cash.</li>
                <li>Additional services outside your plan may incur extra charges.</li>
                <li>You may cancel your membership at any time; cancellation takes effect according to your billing cycle.</li>
                <li>Luxora reserves the right to modify membership plans, pricing, or benefits with prior notice.</li>
                <li>Misuse of membership benefits may result in suspension or termination of your account.</li>
                <li>By subscribing, you agree to Luxora&apos;s Terms of Service and Privacy Policy.</li>
              </ul>
            </div>

            <div className="about-modal__footer">
              <button
                className="about-modal__btn"
                onClick={() => setShowMembershipTermsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cookie Policy Modal Pop-up Window */}
      {showCookieModal && (
        <div className="about-modal__backdrop" onClick={() => setShowCookieModal(false)}>
          <div className="about-modal__window privacy-modal__window" onClick={(e) => e.stopPropagation()}>
            <button
              className="about-modal__close"
              onClick={() => setShowCookieModal(false)}
              aria-label="Close Cookie Policy Window"
            >
              ✕
            </button>
            
            <div className="about-modal__badge">LEGAL</div>
            <h2 className="about-modal__title">Cookie Policy</h2>
            
            <div className="about-modal__content privacy-modal__content">
              <p>
                Luxora uses cookies and similar technologies to improve your browsing experience, understand how users interact with our website, and provide better services.
              </p>

              <h3>1. What Are Cookies?</h3>
              <p>
                Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences and improve functionality.
              </p>

              <h3>2. How We Use Cookies</h3>
              <p>Luxora uses cookies to:</p>
              <ul>
                <li>Improve website performance and user experience.</li>
                <li>Remember user preferences and settings.</li>
                <li>Analyze website traffic and usage.</li>
                <li>Support security and account functionality.</li>
              </ul>

              <h3>3. Managing Cookies</h3>
              <p>
                You can control or disable cookies through your browser settings. However, disabling cookies may affect some website features.
              </p>

              <h3>4. Third-Party Cookies</h3>
              <p>
                We may use trusted third-party services that place cookies for analytics, payment processing, or improving service performance.
              </p>

              <h3>5. Updates to This Policy</h3>
              <p>
                Luxora may update this Cookie Policy from time to time. Any changes will be posted on this page.
              </p>
            </div>

            <div className="about-modal__footer">
              <button
                className="about-modal__btn"
                onClick={() => setShowCookieModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  )
}

export default Footer
