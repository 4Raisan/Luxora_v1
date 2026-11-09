import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useScrollReveal from '../hooks/useScrollReveal'
import './FinalCTA.css'

const FinalCTA = () => {
  const navigate = useNavigate()
  const sectionRef = useRef(null)
  useScrollReveal(sectionRef, { stagger: 0.12, y: 30 })

  const scrollToPlans = () => {
    const el = document.getElementById('plans')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="final-cta" ref={sectionRef} aria-labelledby="final-cta-title">
      <div className="final-cta__inner">
        <span className="section-label" data-reveal>Begin Today</span>
        <h2 id="final-cta-title" className="final-cta__title" data-reveal>
          Exceptional Living,<br />Effortlessly Managed.
        </h2>
        <p className="final-cta__subtitle" data-reveal>
          Join Luxora and let verified professionals care for your vehicle,
          garden, and companions — all through one refined subscription.
        </p>
        <div className="final-cta__actions" data-reveal>
          <button className="final-cta__btn-primary" onClick={() => navigate('/signup')}>
            Begin Your Journey
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="final-cta__btn-secondary" onClick={scrollToPlans}>
            Explore Plans
          </button>
        </div>
      </div>
    </section>
  )
}

export default FinalCTA