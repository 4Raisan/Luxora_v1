import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './Hero.css'

const Hero = () => {
  const navigate = useNavigate()
  const headingRef = useRef(null)
  const subtitleRef = useRef(null)
  const actionsRef = useRef(null)

  useEffect(() => {
    const els = [headingRef.current, subtitleRef.current, actionsRef.current]
    els.forEach((el, i) => {
      if (el) {
        el.style.animationDelay = `${0.3 + i * 0.2}s`
        el.classList.add('animate-fade-up')
      }
    })
  }, [])

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="home" className="hero">
      {/* Background */}
      <div className="hero__bg">
        <div className="hero__overlay" />
      </div>

      {/* Content */}
      <div className="hero__content">
        <div className="hero__badge">
          <span className="hero__badge-dot" />
          Elite Concierge Network
        </div>

        <h1 className="hero__heading" ref={headingRef}>
          The Gold Standard<br />
          <span className="hero__heading-accent">of Modern Living.</span>
        </h1>

        <p className="hero__subtitle" ref={subtitleRef}>
          Bespoke concierge services for the world&apos;s most discerning homeowners.<br />
          Seamless, invisible, and utterly exceptional.
        </p>

        <div className="hero__actions" ref={actionsRef}>
          <button
            className="hero__btn-primary"
            id="hero-begin-btn"
            onClick={() => navigate('/signup')}
          >
            Begin Your Journey
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className="hero__btn-secondary"
            id="hero-plans-btn"
            onClick={() => scrollTo('plans')}
          >
            View Plans
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="hero__scroll">
        <div className="hero__scroll-line" />
        <span>Scroll</span>
      </div>
    </section>
  )
}

export default Hero
