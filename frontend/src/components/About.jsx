import { useState } from 'react'
import './About.css'

const About = () => {
  const [showVisionModal, setShowVisionModal] = useState(false)

  const principles = [
    {
      icon: '◈',
      title: 'Discretion',
      desc: 'Your privacy, preferences, and personal spaces are treated with the utmost respect.',
    },
    {
      icon: '◇',
      title: 'Precision',
      desc: 'Every service is thoughtfully coordinated and every detail handled with care.',
    },
    {
      icon: '◉',
      title: 'Trust',
      desc: 'Verified professionals, dependable service, and a standard you can rely on.',
    },
    {
      icon: '◆',
      title: 'Continuity',
      desc: 'Consistent care, seamlessly managed through one refined monthly experience.',
    },
  ]

  return (
    <section id="about" className="about">
      <div className="about__inner">
        {/* Left Column */}
        <div className="about__left">
          <span className="section-label">Our Story</span>
          <h2 className="about__title">A More Refined Way to Live</h2>
          <div className="about__divider" />
          <p className="about__text">
            Luxury is not simply about what surrounds you.
            It is about having the freedom to enjoy it without the burden of managing every detail.
          </p>
          <p className="about__text about__text--highlight">
            <strong>Luxora was created to make exceptional living effortless.</strong>
          </p>
          <p className="about__text">
            From the care of your vehicle and the refinement of your garden to the wellbeing of your pets,
            Luxora brings essential home services together through one seamless concierge experience.
          </p>
          <p className="about__text">
            Our approach is simple: carefully selected professionals, thoughtfully managed services,
            and a consistent standard of care — all coordinated around your lifestyle.
          </p>
          <button
            className="about__cta"
            id="about-our-vision-btn"
            onClick={() => setShowVisionModal(true)}
          >
            Our Vision
            <span>→</span>
          </button>
        </div>

        {/* Right Column */}
        <div className="about__right">
          <h3 className="about__principles-heading">Our Principles</h3>
          <div className="about__pillars">
            {principles.map((p) => (
              <div key={p.title} className="about__pillar">
                <div className="about__pillar-icon">{p.icon}</div>
                <div>
                  <h4 className="about__pillar-title">{p.title}</h4>
                  <p className="about__pillar-desc">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quote */}
          <div className="about__quote">
            <div className="about__quote-mark">&ldquo;</div>
            <p>
              &ldquo;True luxury is not having more to manage. It is having more time to live.&rdquo;
            </p>
            <div className="about__quote-author">— The Luxora Philosophy</div>
          </div>
        </div>
      </div>

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
    </section>
  )
}

export default About
