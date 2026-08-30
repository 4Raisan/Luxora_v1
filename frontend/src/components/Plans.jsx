import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api'
import './Plans.css'

const AutoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 10.8 2 11v5c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </svg>
)

const GardenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22v-9" />
    <path d="M12 13C12 7.5 7.5 3 2 4c0 5.5 4.5 9 10 9z" />
    <path d="M12 9c2.8-3.3 6.7-4 10-4 0 5-3.3 9-10 9" />
  </svg>
)

const PetIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 13c-1.8 0-3.5-.8-3.5-2.5s1.7-2.5 3.5-2.5 3.5.8 3.5 2.5-1.7 2.5-3.5 2.5z" />
    <ellipse cx="6.5" cy="11.5" rx="1.5" ry="2" />
    <ellipse cx="17.5" cy="11.5" rx="1.5" ry="2" />
    <ellipse cx="9" cy="5.5" rx="1.5" ry="2" />
    <ellipse cx="15" cy="5.5" rx="1.5" ry="2" />
    <path d="M12 15c-3 0-5.5 1.5-5.5 4.5h11c0-3-2.5-4.5-5.5-4.5z" />
  </svg>
)

const ComboIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12l4 6-10 12L2 9l4-6z" />
    <path d="M2 9h20" />
    <path d="M10 3l-2 6 4 12 4-12-2-6" />
  </svg>
)

const CrownIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 20h20v2H2v-2zm1-4l3.5-8.5L12 13l5.5-5.5L21 16H3z" />
  </svg>
)

const CATEGORIES = [
  { id: 'auto', label: 'Auto Care', icon: <AutoIcon /> },
  { id: 'garden', label: 'Garden Care', icon: <GardenIcon /> },
  { id: 'pet', label: 'Pet Care', icon: <PetIcon /> },
  { id: 'combo', label: 'Combo Packages', icon: <ComboIcon /> },
]

const PACKAGE_TYPE_BY_CATEGORY = {
  auto: 'Auto Care',
  garden: 'Garden Care',
  pet: 'Pet Care',
  combo: 'Combo Package',
}

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)


const Plans = () => {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('auto')
  // Live catalogue from the backend. No static price fallback: if the API is
  // unreachable we show a neutral unavailable state rather than invented
  // prices that contradict the real plans.
  const [serverPlans, setServerPlans] = useState(null)
  const [plansUnavailable, setPlansUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiRequest('/subscriptions')
      .then((plans) => {
        if (cancelled) return
        if (Array.isArray(plans) && plans.length) setServerPlans(plans)
        else setPlansUnavailable(true)
      })
      .catch(() => { if (!cancelled) setPlansUnavailable(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handleSelectCategory = (e) => {
      if (e.detail) {
        setActiveCategory(e.detail)
      }
    }
    window.addEventListener('select-plan-category', handleSelectCategory)
    return () => window.removeEventListener('select-plan-category', handleSelectCategory)
  }, [])

  const plansForCategory = (categoryId) => {
    if (!serverPlans) return null
    const packageType = PACKAGE_TYPE_BY_CATEGORY[categoryId]
    return serverPlans
      // Package type is the display contract. Entitlements determine which
      // services can be booked after purchase, but must not cause a Combo
      // package to be displayed inside each individual care category.
      .filter((plan) => plan.type === packageType)
      .map((plan) => {
          const ents = plan.entitlements || []
          const coins = ents.reduce((total, entitlement) => total + (Number(entitlement.units) || 0), 0)
          return {
            id: `srv-${plan.id}`,
            serverId: plan.id,
            tier: plan.title,
            price: Number(plan.priceMonthly) || 0,
            coins,
            highlight: Boolean(plan.recommended),
            description: plan.description || '',
            features: Array.isArray(plan.features) ? plan.features : [],
            off: [],
          }
        })
  }

  const currentPlans = plansForCategory(activeCategory) || (plansUnavailable ? [] : null)

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
    } catch {
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

        {/* Cards — live server data; neutral states while loading or when
            the catalogue cannot be reached (never invented prices) */}
        {currentPlans === null ? (
          <div className="plans__grid">
            <div className="plan-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2.5rem 1.5rem', color: '#888' }}>
              Loading live plans…
            </div>
          </div>
        ) : currentPlans.length === 0 ? (
          <div className="plans__grid">
            <div className="plan-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2.5rem 1.5rem', color: '#888' }}>
              Plans are currently unavailable for {CATEGORIES.find(c => c.id === activeCategory)?.label || 'this category'}.
              <br />
              <small>Please check back shortly.</small>
            </div>
          </div>
        ) : (
          <div className="plans__grid">
            {currentPlans.map((plan) => (
              <div
                key={plan.id}
                id={`plan-${plan.id}`}
                className={`plan-card ${plan.highlight ? 'plan-card--featured' : ''}`}
              >
                {plan.highlight && (
                  <div className="plan-card__badge">
                    <CrownIcon />
                    <span>MOST POPULAR</span>
                  </div>
                )}

                <div className="plan-card__header">
                  <p className="plan-card__tier">{plan.tier}</p>
                  <div className="plan-card__price-wrap">
                    <span className="plan-card__currency">LKR</span>
                    <span className="plan-card__amount">{plan.price.toLocaleString()}</span>
                  </div>
                  <p className="plan-card__period">{plan.coins} {plan.coins === 1 ? 'coin' : 'coins'} per month</p>
                  {plan.description && <p className="plan-card__summary">{plan.description}</p>}
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
