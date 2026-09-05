import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './HowItWorks.css'

const MOTION = {
  desktopPerspective: 1400,
  desktopDepth: 125,
  mobileDepth: 48,
  desktopStagger: 0.13,
  mobileStagger: 0.48,
  edgeRotation: 92,
  finalRotation: 180,
}

const steps = [
  {
    number: '01',
    category: 'Choose Your Care',
    description: 'Build a care experience around your home and lifestyle.',
    services: ['Auto Care', 'Garden Care', 'Pet Care', 'Combo packages'],
    note: 'Flexible care categories',
    backTitle: 'Create Account',
    backText: 'Sign up securely and access your personal Luxora customer portal.',
  },
  {
    number: '02',
    category: 'Schedule With Ease',
    description: 'Reserve your preferred service in a few clear steps.',
    services: ['Choose a package', 'Select date and time', 'Confirm your address', 'Pay or use credits'],
    note: 'Verified booking confirmation',
    backTitle: 'Purchase a Package',
    backText: 'Choose the care package that matches your needs and complete your secure purchase.',
  },
  {
    number: '03',
    category: 'Start Securely',
    description: 'A verified provider arrives for your confirmed appointment.',
    services: ['Automatic assignment', 'Provider details', 'Before-service photos', 'Secure Start PIN'],
    note: 'Protected service handover',
    backTitle: 'Book Your Service',
    backText: 'Select your service, preferred date and time, and confirm the booking from your portal.',
  },
  {
    number: '04',
    category: 'Review & Complete',
    description: 'Stay informed until the final service confirmation.',
    services: ['Track service status', 'Review after photos', 'Completion PIN', 'Rate your experience'],
    note: 'Complete portal visibility',
    backTitle: 'Enjoy',
    backText: 'Relax while Luxora coordinates your assigned provider and keeps every service detail visible.',
  },
]

export const Card = ({ step }) => (
  <article className="journey-card" aria-label={`${step.number}. ${step.backTitle}`}>
    <div className="journey-card__face journey-card__face--front" aria-hidden="true">
      <img className="journey-card__artwork" src="/luxora-journey-card.jpg" alt="" draggable="false" />
    </div>

    <div className="journey-card__face journey-card__face--back" aria-hidden="true">
      <header className="journey-card__topline">
        <span className="journey-card__logo journey-card__logo--dark">L</span>
        <span className="journey-card__number">{step.number}</span>
      </header>
      <div className="journey-card__back-content">
        <span className="journey-card__back-mark">✦</span>
        <h3>{step.backTitle}</h3>
        <p>{step.backText}</p>
      </div>
      <footer className="journey-card__footer"><span />LUXORA CARE</footer>
    </div>
  </article>
)

export const CardSection = () => {
  const sectionRef = useRef(null)
  const trackRef = useRef(null)

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track) return undefined

    const context = gsap.context(() => {
      const cards = gsap.utils.toArray('.journey-card', section)
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(cards, { clearProps: 'transform' })
        return undefined
      }

      const media = gsap.matchMedia()

      const buildTimeline = ({ mobile }) => {
        const depth = mobile ? MOTION.mobileDepth : MOTION.desktopDepth
        const stagger = mobile ? MOTION.mobileStagger : MOTION.desktopStagger

        gsap.set(cards, {
          force3D: true,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          transformOrigin: '50% 50%',
          x: 0,
          y: 0,
          z: 0,
        })

        const timeline = gsap.timeline({
          defaults: { ease: 'power2.inOut' },
          paused: true,
        })

        // Mobile keeps the card flip animation only. The strip itself is a
        // native swipe surface (overflow-x + scroll-snap on the stage), so
        // cards stay reachable without depending on a one-shot auto-pan
        // whose final position could clip or strand cards.

        cards.forEach((card, index) => {
          const direction = index % 2 === 0 ? 1 : -1
          const start = index * stagger
          timeline
            .to(card, {
              duration: 0.72,
              rotationX: direction * (mobile ? 2.5 : 5),
              rotationY: direction * MOTION.edgeRotation,
              scale: mobile ? 0.975 : 0.95,
              x: direction * (mobile ? 10 : 26),
              y: index % 2 === 0 ? -10 : 12,
              z: depth + index * (mobile ? 4 : 12),
            }, start)
            .to(card, {
              duration: 0.82,
              rotationX: 0,
              rotationY: direction * MOTION.finalRotation,
              scale: 1,
              x: 0,
              y: 0,
              z: mobile ? 0 : (index % 2 === 0 ? -8 : 14),
            }, start + 0.72)
        })

        const trigger = ScrollTrigger.create({
          trigger: section,
          start: 'top 65%',
          onEnter: () => timeline.play(),
          onEnterBack: () => timeline.reverse(),
          onLeaveBack: () => timeline.reverse(),
        })

        return () => {
          trigger.kill()
          timeline.kill()
        }
      }

      media.add('(min-width: 769px)', () => buildTimeline({ mobile: false }))
      media.add('(max-width: 768px)', () => buildTimeline({ mobile: true }))
      return () => media.revert()
    }, section)

    return () => context.revert()
  }, [])

  return (
    <section ref={sectionRef} className="how-it-works" aria-labelledby="how-it-works-title" style={{ '--journey-perspective': `${MOTION.desktopPerspective}px` }}>
      <div className="how-it-works__inner">
        <h2 id="how-it-works-title" className="how-it-works__title">Your Seamless <em>Care Journey</em></h2>
        <p className="how-it-works__intro">From choosing a service to verified completion, every step is designed around your time and peace of mind.</p>

        <div className="how-it-works__timeline" aria-hidden="true">
          <svg className="how-it-works__journey" viewBox="0 0 1200 130" preserveAspectRatio="none" focusable="false">
            <defs>
              <linearGradient id="journey-gold" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#b9964a" /><stop offset="0.32" stopColor="#f4dfaa" />
                <stop offset="0.67" stopColor="#c8a458" /><stop offset="1" stopColor="#edd59b" />
              </linearGradient>
              <filter id="journey-glow" x="-10%" y="-100%" width="120%" height="300%">
                <feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path className="how-it-works__journey-glow" d="M 8 76 C 245 13, 510 28, 720 62 S 1012 108, 1192 46" />
            <path className="how-it-works__journey-path" d="M 8 76 C 245 13, 510 28, 720 62 S 1012 108, 1192 46" />
            <g className="how-it-works__journey-points">
              <circle cx="8" cy="76" r="7" /><circle cx="395" cy="31" r="7" /><circle cx="760" cy="69" r="7" /><circle cx="1192" cy="46" r="7" />
            </g>
          </svg>
        </div>

        <div className="how-it-works__stage">
          <div ref={trackRef} className="how-it-works__steps">
            {steps.map((step) => <Card key={step.number} step={step} />)}
          </div>
        </div>
      </div>
    </section>
  )
}

const HowItWorks = () => <CardSection />

export default HowItWorks
