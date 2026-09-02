import './HowItWorks.css'

const steps = [
  {
    number: '01',
    title: 'Choose Your Care',
    description: 'Explore Auto Care, Garden Care, Pet Care, or a tailored combination that fits your home and lifestyle.',
    note: 'Flexible care categories',
  },
  {
    number: '02',
    title: 'Schedule With Ease',
    description: 'Select a convenient date and time, then confirm your booking with your package credit or secure payment.',
    note: 'Verified booking confirmation',
  },
  {
    number: '03',
    title: 'Start With Your PIN',
    description: 'Your assigned provider arrives ready to work. Share your secure Start PIN only when the service begins.',
    note: 'Secure service handover',
  },
  {
    number: '04',
    title: 'Review & Manage Everything',
    description: 'Review service photos and updates in your portal. Confirm completion with your PIN when you are satisfied.',
    note: 'Complete visibility in your portal',
  },
]

const HowItWorks = () => (
  <section className="how-it-works" aria-labelledby="how-it-works-title">
    <div className="how-it-works__inner">
      <h2 id="how-it-works-title" className="how-it-works__title">Your Seamless <em>Care Journey</em></h2>
      <p className="how-it-works__intro">From choosing a service to verified completion, every step is designed around your time and peace of mind.</p>

      <div className="how-it-works__timeline" aria-hidden="true">
        <svg className="how-it-works__journey" viewBox="0 0 1200 130" preserveAspectRatio="none" focusable="false">
          <defs>
            <linearGradient id="journey-gold" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#b9964a" />
              <stop offset="0.32" stopColor="#f4dfaa" />
              <stop offset="0.67" stopColor="#c8a458" />
              <stop offset="1" stopColor="#edd59b" />
            </linearGradient>
            <filter id="journey-glow" x="-10%" y="-100%" width="120%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path className="how-it-works__journey-glow" d="M 8 76 C 245 13, 510 28, 720 62 S 1012 108, 1192 46" />
          <path className="how-it-works__journey-path" d="M 8 76 C 245 13, 510 28, 720 62 S 1012 108, 1192 46" />
          <g className="how-it-works__journey-points">
            <circle cx="8" cy="76" r="7" /><circle cx="395" cy="31" r="7" /><circle cx="760" cy="69" r="7" /><circle cx="1192" cy="46" r="7" />
          </g>
        </svg>
      </div>

      <div className="how-it-works__steps">
        {steps.map((step, index) => (
          <article key={step.number} className={`how-it-works__step ${index === 2 ? 'how-it-works__step--featured' : ''}`}>
            <div className="how-it-works__step-meta">
              <span className="how-it-works__number">{step.number}</span>
            </div>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <div className="how-it-works__note"><span>•</span>{step.note}</div>
          </article>
        ))}
      </div>
    </div>
  </section>
)

export default HowItWorks
