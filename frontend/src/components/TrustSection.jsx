import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './TrustSection.css'

const trustPoints = [
  {
    number: '01',
    icon: '✓',
    eyebrow: 'VERIFIED PEOPLE',
    title: 'Provider KYC',
    description: 'Service providers submit identity documents for administrator review. Operational access stays locked until their KYC is approved.',
    detail: 'Identity review before service access',
  },
  {
    number: '02',
    icon: '✦',
    eyebrow: 'PROTECTED ACCESS',
    title: 'Bcrypt Password Hashing',
    description: 'Passwords are protected with bcrypt hashing, so readable passwords are never stored in the Luxora database.',
    detail: 'One-way credential protection',
  },
  {
    number: '03',
    icon: '#',
    eyebrow: 'VERIFIED HANDOVER',
    title: 'Secure Service PINs',
    description: 'Separate Start and Completion PINs verify the important moments of every service before its status can change.',
    detail: 'Customer-controlled confirmation',
  },
]

const TrustCard = ({ point }) => (
  <article className="trust-card">
    <div className="trust-card__top">
      <span className="trust-card__number">{point.number}</span>
      <span className="trust-card__icon" aria-hidden="true">{point.icon}</span>
    </div>
    <p className="trust-card__eyebrow">{point.eyebrow}</p>
    <h3>{point.title}</h3>
    <p className="trust-card__description">{point.description}</p>
    <div className="trust-card__detail"><span />{point.detail}</div>
  </article>
)

const TrustSection = () => {
  const sectionRef = useRef(null)

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const section = sectionRef.current
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const context = gsap.context(() => {
      const cards = gsap.utils.toArray('.trust-card', section)
      const heading = section.querySelector('.trust-section__header')
      const line = section.querySelector('.trust-section__line-progress')

      gsap.set(heading, { opacity: 0, y: 32 })
      gsap.set(cards, {
        opacity: 0,
        rotationX: (index) => index === 1 ? -9 : 7,
        rotationY: (index) => index === 0 ? -24 : index === 2 ? 24 : 0,
        scale: 0.94,
        transformOrigin: '50% 50%',
        y: 72,
        z: -140,
      })
      gsap.set(line, { scaleX: 0, transformOrigin: '0% 50%' })

      const timeline = gsap.timeline({ paused: true })
        .to(heading, { duration: 0.65, ease: 'power2.out', opacity: 1, y: 0 })
        .to(line, { duration: 0.9, ease: 'power2.inOut', scaleX: 1 }, 0.25)
        .to(cards, {
          duration: 1.05,
          ease: 'power3.out',
          opacity: 1,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          stagger: 0.15,
          y: 0,
          z: 0,
        }, 0.38)

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top 72%',
        onEnter: () => timeline.play(),
        onEnterBack: () => timeline.play(),
        onLeaveBack: () => timeline.reverse(),
      })

      return () => {
        trigger.kill()
        timeline.kill()
      }
    }, section)

    return () => context.revert()
  }, [])

  return (
    <section ref={sectionRef} className="trust-section" aria-labelledby="trust-section-title">
      <div className="trust-section__inner">
        <header className="trust-section__header">
          <span className="section-label">How You Can Trust Us</span>
          <h2 id="trust-section-title">Protection at Every <span>Step</span></h2>
          <p>Trust is built into the people, credentials, and confirmations behind every Luxora service.</p>
        </header>

        <div className="trust-section__line" aria-hidden="true"><span className="trust-section__line-progress" /></div>

        <div className="trust-section__grid">
          {trustPoints.map((point) => <TrustCard key={point.number} point={point} />)}
        </div>
      </div>
    </section>
  )
}

export default TrustSection
