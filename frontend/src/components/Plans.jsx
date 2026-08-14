import { useState, useEffect } from 'react'
import './Plans.css'

const CATEGORIES = [
  { id: 'auto', label: 'Auto Care', icon: '🚗' },
  { id: 'garden', label: 'Garden Care', icon: '🌿' },
  { id: 'pet', label: 'Pet Care', icon: '🐾' },
]

const PLANS = {
  auto: [
    {
      id: 'auto-basic',
      tier: 'Basic',
      price: 5000,
      highlight: false,
      summary: '2 wash + vacuum sessions per month',
      features: [
        '2 wash + vacuum sessions/month',
        'Exterior wash & interior vacuum',
        'Dashboard wipe',
        'Basic tire shine',
        'Window cleaning',
      ],
      off: [
        'Interior deep vacuum',
        'Full wax & polish',
        'Priority scheduling',
      ],
    },
    {
      id: 'auto-standard',
      tier: 'Standard',
      price: 9000,
      highlight: true,
      summary: '4 wash + vacuum sessions per month (weekly)',
      features: [
        '4 wash + vacuum sessions/month (weekly)',
        'Interior deep vacuum',
        'Seat and mat cleaning',
        'Exterior hand wash & wheel cleaning',
        'Basic wax (once per month)',
      ],
      off: [
        'Full interior detailing',
        'Priority scheduling',
      ],
    },
    {
      id: 'auto-premium',
      tier: 'Premium',
      price: 15000,
      highlight: false,
      summary: '6 sessions/month with full detailing',
      features: [
        '6 wash + vacuum sessions/month (~1.5×/week)',
        'Full interior detailing (seats, carpets, trunk)',
        'Leather care (if applicable)',
        'Exterior wash, wax & polish',
        'Tire and rim deep clean',
        'Priority scheduling & flexible time slots',
      ],
      off: [],
    },
  ],
  garden: [
    {
      id: 'garden-basic',
      tier: 'Basic',
      price: 7500,
      highlight: false,
      summary: '2 visits/month for small gardens (<10 perches)',
      features: [
        '2 visits/month',
        'Small gardens (<10 perches / <250 m²)',
        'Lawn mowing & edging',
        'Leaf sweeping',
        'Basic plant watering',
        'Visual plant health check',
      ],
      off: [
        'Fertilizer application',
        'Pest & disease monitoring',
        'Hedge shaping & flowerbed care',
      ],
    },
    {
      id: 'garden-standard',
      tier: 'Standard',
      price: 14000,
      highlight: true,
      summary: '4 visits/month (weekly) for medium gardens',
      features: [
        '4 visits/month (weekly)',
        'Medium gardens (10–20 perches / 250–500 m²)',
        'Lawn mowing, edging & weeding',
        'Scheduled watering',
        'Fertilizer application (once/month)',
        'Basic plant health care & pruning',
      ],
      off: [
        'Aeration',
        'Pest & disease monitoring',
        'Flowerbed care',
      ],
    },
    {
      id: 'garden-premium',
      tier: 'Premium',
      price: 25000,
      highlight: false,
      summary: '6–8 visits/month for large gardens (>20 perches)',
      features: [
        '6–8 visits/month (1.5–2×/week)',
        'Large gardens (>20 perches / >500 m²)',
        'Full lawn care: mowing, edging, aeration',
        'Structured watering plan & fertilizing',
        'Pest & disease monitoring',
        'Trimming, hedge shaping & flowerbed care',
      ],
      off: [],
    },
  ],
  pet: [
    {
      id: 'pet-basic',
      tier: 'Basic',
      price: 6000,
      highlight: false,
      summary: '2 pet bathing sessions per month',
      features: [
        '2 pet bathing sessions/month',
        'Dogs or cats',
        'Basic grooming: brushing',
        'Nail trimming',
        'Ear cleaning',
      ],
      off: [
        'Pet walking',
        'Coat & skin check',
        'Fish tank cleaning',
        'Priority scheduling',
      ],
    },
    {
      id: 'pet-standard',
      tier: 'Standard',
      price: 11000,
      highlight: true,
      summary: '4 pet care sessions per month (weekly)',
      features: [
        '4 pet care sessions/month (weekly)',
        'Bathing + full grooming each visit',
        'Dog walking (30 min/visit)',
        'Basic coat & skin check each session',
      ],
      off: [
        'Teeth brushing',
        'Fish tank cleaning',
        'Priority scheduling',
      ],
    },
    {
      id: 'pet-premium',
      tier: 'Premium',
      price: 18000,
      highlight: false,
      summary: '6–8 sessions/month with full care package',
      features: [
        '6–8 pet care sessions/month (1.5–2×/week)',
        'Full grooming: bath, blow-dry, brushing',
        'Nail, ears & teeth brushing (if tolerated)',
        'Dog walking (45 min/visit) or play sessions',
        'Fish tank cleaning & water quality testing (1×/month)',
        'Priority scheduling & dedicated caregiver',
      ],
      off: [],
    },
  ],
}

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)


const Plans = () => {
  const [activeCategory, setActiveCategory] = useState('auto')

  useEffect(() => {
    const handleSelectCategory = (e) => {
      if (e.detail) {
        setActiveCategory(e.detail)
      }
    }
    window.addEventListener('select-plan-category', handleSelectCategory)
    return () => window.removeEventListener('select-plan-category', handleSelectCategory)
  }, [])

  const currentPlans = PLANS[activeCategory]

  return (
    <section id="plans" className="plans">
      <div className="plans__inner">

        {/* Header */}
        <div className="plans__header">
          <span className="section-label">Our Packages</span>
          <h2 className="plans__title">Plans &amp; Pricing</h2>
          <p className="plans__subtitle">
            Choose from our curated service packages — transparent pricing,
            no hidden fees, and the full Luxora standard of care.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="plans__tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              id={`plans-tab-${cat.id}`}
              className={`plans__tab ${activeCategory === cat.id ? 'plans__tab--active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="plans__tab-icon">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="plans__grid">
          {currentPlans.map((plan) => (
            <div
              key={plan.id}
              id={`plan-${plan.id}`}
              className={`plan-card ${plan.highlight ? 'plan-card--featured' : ''}`}
            >
              {plan.highlight && (
                <div className="plan-card__badge">MOST POPULAR</div>
              )}

              <div className="plan-card__header">
                <p className="plan-card__tier">{plan.tier}</p>
                <div className="plan-card__price-wrap">
                  <span className="plan-card__currency">LKR</span>
                  <span className="plan-card__amount">{plan.price.toLocaleString()}</span>
                </div>
                <p className="plan-card__period">per month</p>
                <p className="plan-card__summary">{plan.summary}</p>
              </div>

              <div className="plan-card__divider" />

              <ul className="plan-card__features">
                {plan.features.map((f, i) => (
                  <li key={i} className="plan-card__feature plan-card__feature--on">
                    <span className="plan-card__check plan-card__check--on"><CheckIcon /></span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className="plan-card__cta"
                id={`plan-${plan.id}-btn`}
                onClick={() => document.getElementById('membership')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>

        <p className="plans__note">
          All prices are in Sri Lankan Rupees (LKR) and include service visits as described.
          Contact us to customise a package for your specific needs.
        </p>
      </div>
    </section>
  )
}

export default Plans
