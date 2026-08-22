import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Plans.css'

const CATEGORIES = [
  { id: 'auto', label: 'Auto Care', icon: '🚗' },
  { id: 'garden', label: 'Garden Care', icon: '🌿' },
  { id: 'pet', label: 'Pet Care', icon: '🐾' },
  { id: 'combo', label: 'Combo Packages', icon: '✦' },
]

const TOKEN_NOTES = {
  auto: '1 Auto Token = 1 vehicle service.',
  garden: '1 Garden Token = 1 garden visit.',
  pet: '1 Pet Token = 1 pet service session.',
  combo: 'The same standard service inclusives apply to each category.',
}

const PLANS = {
  auto: [
    {
      id: 'auto-basic',
      tier: 'Basic',
      price: 5000,
      highlight: false,
      summary: '1 token • 1 vehicle service/month',
      features: [
        '1 token',
        '1 vehicle service/month',
        'Exterior wash',
        'Interior vacuum',
        'Basic tire shine',
        'Window cleaning',
      ],
      off: [],
    },
    {
      id: 'auto-standard',
      tier: 'Standard',
      price: 9000,
      highlight: true,
      summary: '2 tokens • 2 vehicle services/month',
      features: [
        '2 tokens',
        '2 vehicle services/month',
        'Exterior wash',
        'Interior vacuum',
        'Basic tire shine',
        'Window cleaning',
      ],
      off: [],
    },
    {
      id: 'auto-premium',
      tier: 'Premium',
      price: 15000,
      highlight: false,
      summary: '4 tokens • 4 vehicle services/month',
      features: [
        '4 tokens',
        '4 vehicle services/month',
        'Exterior wash',
        'Interior vacuum',
        'Basic tire shine',
        'Window cleaning',
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
      summary: '1 token • 1 visit/month (under 10 perches)',
      features: [
        '1 token',
        '1 visit/month',
        'Garden under 10 perches',
        'Lawn mowing',
        'Lawn edging',
        'Basic weeding',
        'Fertilizer application',
        'Basic visual plant health check',
        'Basic pruning',
      ],
      off: [],
    },
    {
      id: 'garden-standard',
      tier: 'Standard',
      price: 14000,
      highlight: true,
      summary: '2 tokens • 2 visits/month (10–20 perches)',
      features: [
        '2 tokens',
        '2 visits/month',
        'Garden 10–20 perches',
        'Lawn mowing',
        'Lawn edging',
        'Basic weeding',
        'Fertilizer application',
        'Basic visual plant health check',
        'Basic pruning',
      ],
      off: [],
    },
    {
      id: 'garden-premium',
      tier: 'Premium',
      price: 24000,
      highlight: false,
      summary: '4 tokens • 4 visits/month (20–30 perches)',
      features: [
        '4 tokens',
        '4 visits/month',
        'Garden over 20 and up to 30 perches',
        'Lawn mowing',
        'Lawn edging',
        'Basic weeding',
        'Fertilizer application',
        'Basic visual plant health check',
        'Basic pruning',
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
      summary: '1 token • 1 session/month (1 pet)',
      features: [
        '1 token',
        '1 session/month',
        '1 pet',
        'Basic spa wash',
        'Blow-dry',
        'Nail trimming',
        'Ear cleaning',
        'Brushing',
        'Coat fluff',
        'Basic flea & tick check',
      ],
      off: [],
    },
    {
      id: 'pet-standard',
      tier: 'Standard',
      price: 11000,
      highlight: true,
      summary: '2 tokens • 2 sessions/month (up to 2 pets)',
      features: [
        '2 tokens',
        '2 sessions/month',
        'Up to 2 pets',
        'Basic spa wash',
        'Blow-dry',
        'Nail trimming',
        'Ear cleaning',
        'Brushing',
        'Coat fluff',
        'Basic flea & tick check',
      ],
      off: [],
    },
    {
      id: 'pet-premium',
      tier: 'Premium',
      price: 18000,
      highlight: false,
      summary: '4 tokens • 4 sessions/month (up to 4 pets)',
      features: [
        '4 tokens',
        '4 sessions/month',
        'Up to 4 pets',
        'Basic spa wash',
        'Blow-dry',
        'Nail trimming',
        'Ear cleaning',
        'Brushing',
        'Coat fluff',
        'Basic flea & tick check',
      ],
      off: [],
    },
  ],
  combo: [
    {
      id: 'combo-home',
      tier: 'Luxora Home',
      price: 20000,
      highlight: false,
      summary: '4 total tokens across Auto, Garden & Pet',
      features: [
        'Auto Care: 2 tokens',
        'Garden Care: 1 token',
        'Pet Care: 1 token',
        'Total: 4 tokens',
        'Standard service inclusives apply',
      ],
      off: [],
    },
    {
      id: 'combo-family',
      tier: 'Luxora Family',
      price: 32000,
      highlight: true,
      summary: '8 total tokens across Auto, Garden & Pet',
      features: [
        'Auto Care: 4 tokens',
        'Garden Care: 2 tokens',
        'Pet Care: 2 tokens',
        'Total: 8 tokens',
        'Standard service inclusives apply',
      ],
      off: [],
    },
    {
      id: 'combo-prestige',
      tier: 'Luxora Prestige',
      price: 40000,
      highlight: false,
      summary: '12 total tokens across Auto, Garden & Pet',
      features: [
        'Auto Care: 4 tokens',
        'Garden Care: 4 tokens',
        'Pet Care: 4 tokens',
        'Total: 12 tokens',
        'Standard service inclusives apply',
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
  const navigate = useNavigate()
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

  const handleGetStarted = (plan) => {
    try {
      const catObj = CATEGORIES.find(c => c.id === activeCategory)
      const fullPlan = { ...plan, categoryLabel: catObj ? catObj.label : 'Auto', cat: activeCategory }
      sessionStorage.setItem('selected_home_plan', JSON.stringify(fullPlan))

      const token = sessionStorage.getItem('token')
      const user = sessionStorage.getItem('user')

      if (token && user) {
        navigate('/customer-dashboard')
      } else {
        navigate('/login')
      }
    } catch (_) {
      navigate('/login')
    }
  }

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
                onClick={() => handleGetStarted(plan)}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>

        {TOKEN_NOTES[activeCategory] && (
          <p className="plans__token-note" style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--gold-400, #d4af37)', fontWeight: '500', fontSize: '0.95rem' }}>
            ✦ {TOKEN_NOTES[activeCategory]}
          </p>
        )}

        <p className="plans__note">
          All prices are in Sri Lankan Rupees (LKR) and include service visits as described.
          Contact us to customise a package for your specific needs.
        </p>
      </div>
    </section>
  )
}

export default Plans
