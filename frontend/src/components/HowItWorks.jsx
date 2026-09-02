import './HowItWorks.css'

const steps = [
  {
    number: '01',
    stage: 'STAGE 01 // SELECT',
    title: 'Choose Your Care',
    description: 'Explore Auto Care, Garden Care, Pet Care, or a tailored combination that fits your home and lifestyle.',
    note: 'Flexible care categories',
  },
  {
    number: '02',
    stage: 'STAGE 02 // BOOK',
    title: 'Schedule With Ease',
    description: 'Select a convenient date and time, then confirm your booking with your package credit or secure payment.',
    note: 'Verified booking confirmation',
  },
  {
    number: '03',
    stage: 'STAGE 03 // SERVICE',
    title: 'Start With Your PIN',
    description: 'Your assigned provider arrives ready to work. Share your secure Start PIN only when the service begins.',
    note: 'Secure service handover',
  },
  {
    number: '04',
    stage: 'STAGE 04 // COMPLETE',
    title: 'Review & Manage Everything',
    description: 'Review service photos and updates in your portal. Confirm completion with your PIN when you are satisfied.',
    note: 'Complete visibility in your portal',
  },
]

const HowItWorks = () => (
  <section className="how-it-works" aria-labelledby="how-it-works-title">
    <div className="how-it-works__inner">
      <p className="how-it-works__eyebrow"><span>◆</span> SCENE 06 // HOW LUXORA WORKS</p>
      <h2 id="how-it-works-title" className="how-it-works__title">Your Seamless <em>Care Journey</em></h2>
      <p className="how-it-works__intro">From choosing a service to verified completion, every step is designed around your time and peace of mind.</p>

      <div className="how-it-works__timeline" aria-hidden="true">
        <span className="how-it-works__line" />
        {steps.map((step) => <span key={step.number} className="how-it-works__point" />)}
      </div>

      <div className="how-it-works__steps">
        {steps.map((step, index) => (
          <article key={step.number} className={`how-it-works__step ${index === 2 ? 'how-it-works__step--featured' : ''}`}>
            <div className="how-it-works__step-meta">
              <span className="how-it-works__number">{step.number}</span>
              <span>{step.stage}</span>
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
