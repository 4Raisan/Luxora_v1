import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './Services.css'

const services = [
  {
    id: 'auto-care',
    categoryKey: 'auto',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 30l4-12h24l4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <rect x="6" y="30" width="36" height="8" rx="3" stroke="currentColor" strokeWidth="2"/>
        <circle cx="14" cy="38" r="3" stroke="currentColor" strokeWidth="2"/>
        <circle cx="34" cy="38" r="3" stroke="currentColor" strokeWidth="2"/>
        <path d="M14 24h8M26 24h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Auto Care',
    description: 'Professional vehicle cleaning and care delivered at your convenience.',
    features: ['Exterior Wash', 'Interior Vacuum', 'Tire & Window Care'],
  },
  {
    id: 'garden-care',
    categoryKey: 'garden',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 40V20M24 20C24 20 16 16 12 8c6 0 12 4 12 12zM24 20C24 20 32 16 36 8c-6 0-12 4-12 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 40h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M24 28C24 28 18 26 16 20c4 0 8 3 8 8zM24 28C24 28 30 26 32 20c-4 0-8 3-8 8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Garden Care',
    description: 'Reliable garden maintenance to keep your outdoor spaces clean and healthy.',
    features: ['Lawn Mowing & Edging', 'Weeding & Pruning', 'Fertilizing & Plant Health Checks'],
  },
  {
    id: 'pet-care',
    categoryKey: 'pet',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 12a4 4 0 100-8 4 4 0 000 8zM30 12a4 4 0 100-8 4 4 0 000 8zM10 22a4 4 0 100-8 4 4 0 000 8zM38 22a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2"/>
        <path d="M24 44c-7 0-14-5-14-12 0-4 4-8 8-8h12c4 0 8 4 8 8 0 7-7 12-14 12z" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    title: 'Pet Care',
    description: 'Convenient grooming and hygiene services to keep your pets clean and comfortable.',
    features: ['Spa Wash & Blow-Dry', 'Nail & Ear Care', 'Brushing & Flea/Tick Check'],
  },
  {
    id: 'combo-packages',
    categoryKey: 'combo',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 4l4.5 9.5 10.5 1.5-7.5 7.3 1.8 10.2L24 27.8l-9.3 4.7 1.8-10.2L9 15l10.5-1.5L24 4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 40h28M16 44h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="8" cy="10" r="2" fill="currentColor"/>
        <circle cx="40" cy="10" r="2" fill="currentColor"/>
      </svg>
    ),
    title: 'Combo Packages',
    description: 'All-inclusive multi-service bundles combining auto, garden, and pet care for total estate convenience.',
    features: ['Auto, Garden & Pet Bundles', 'Shared Monthly Service Tokens', 'Exclusive Multi-Care Value'],
  },
]

const Services = () => {
  const navigate = useNavigate()
  const cardsRef = useRef([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )
    cardsRef.current.forEach((el) => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  const handleOpenSignup = () => {
    navigate('/signup')
  }

  return (
    <section id="services" className="services">
      <div className="services__inner">
        {/* Header */}
        <div className="services__header">
          <span className="section-label">What We Offer</span>
          <h2 className="services__title">Uncompromising Excellence<br />in Every Detail</h2>
          <p className="services__subtitle">
            From estate management to personal concierge, every service is meticulously
            crafted to exceed the expectations of the world&apos;s most discerning clients.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="services__grid">
          {services.map((service, i) => (
            <div
              key={service.id}
              id={service.id}
              className="service-card"
              ref={(el) => (cardsRef.current[i] = el)}
              style={{ transitionDelay: `${i * 0.07}s` }}
              onClick={handleOpenSignup}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleOpenSignup()
                }
              }}
              aria-label={`Sign up for ${service.title}`}
            >
              <div className="service-card__icon">{service.icon}</div>
              <h3 className="service-card__title">{service.title}</h3>
              <p className="service-card__desc">{service.description}</p>
              <ul className="service-card__features">
                {service.features.map((f) => (
                  <li key={f}>
                    <span className="service-card__check">✦</span> {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="service-card__cta"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenSignup()
                }}
              >
                Get Started →
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Services
