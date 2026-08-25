import { useState } from 'react'
import './About.css'

const About = () => {
  const [showVisionModal, setShowVisionModal] = useState(false)

  const pillars = [
    { icon: '◈', title: 'Discretion', desc: 'Absolute privacy and confidentiality in every engagement.' },
    { icon: '◇', title: 'Craftsmanship', desc: 'Every detail executed to the highest possible standard.' },
    { icon: '◉', title: 'Exclusivity', desc: 'An intimate network of the world\'s finest service providers.' },
    { icon: '◆', title: 'Continuity', desc: 'Seamless 24/7 service that anticipates your every need.' },
  ]

  return (
    <section id="about" className="about">
      <div className="about__inner">
        {/* Left Column */}
        <div className="about__left">
          <span className="section-label">Our Story</span>
          <h2 className="about__title">Born from the Belief<br />That Excellence is<br />Non-Negotiable</h2>
          <div className="about__divider" />
          <p className="about__text">
            Luxora was founded with a singular vision: to create the world&apos;s most
            refined estate management and concierge platform. We serve an exclusive clientele
            of homeowners who demand nothing short of perfection.
          </p>
          <p className="about__text">
            Our curated network of approved service providers supports customers across Sri Lanka,
            delivering a consistent Luxora standard wherever you are.
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
          <div className="about__pillars">
            {pillars.map((p) => (
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
              The finest luxury is not what you own, but the life you live within it.
            </p>
            <div className="about__quote-author">— Luxora Founding Charter</div>
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
