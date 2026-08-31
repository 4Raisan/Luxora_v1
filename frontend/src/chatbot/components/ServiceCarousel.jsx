import React from 'react'

export function ServiceCarousel({ categories = [], onSelectCategory }) {
  if (!categories || categories.length === 0) return null

  return (
    <div className="lx-service-carousel">
      {categories.map((cat) => (
        <div key={cat.id} className="lx-service-card">
          <div className="lx-service-card__icon">
            {cat.categoryKey === 'auto' && (
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 30l4-12h24l4 12" strokeLinecap="round"/>
                <rect x="6" y="30" width="36" height="8" rx="3"/>
                <circle cx="14" cy="38" r="3"/>
                <circle cx="34" cy="38" r="3"/>
                <path d="M14 24h8M26 24h8" strokeLinecap="round"/>
              </svg>
            )}
            {cat.categoryKey === 'garden' && (
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M24 40V20M24 20C24 20 16 16 12 8c6 0 12 4 12 12zM24 20C24 20 32 16 36 8c-6 0-12 4-12 12z" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 40h20" strokeLinecap="round"/>
              </svg>
            )}
            {cat.categoryKey === 'pet' && (
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="18" cy="12" r="3" fill="currentColor"/>
                <circle cx="30" cy="12" r="3" fill="currentColor"/>
                <circle cx="10" cy="22" r="3" fill="currentColor"/>
                <circle cx="38" cy="22" r="3" fill="currentColor"/>
                <path d="M24 42c-6 0-12-4-12-10 0-3 3-7 7-7h10c4 0 7 4 7 7 0 6-6 10-12 10z" stroke="currentColor" fill="rgba(201,168,76,0.15)"/>
              </svg>
            )}
          </div>
          <h4 className="lx-service-card__title">{cat.name}</h4>
          <p className="lx-service-card__desc">{cat.tagline}</p>
          <button
            className="lx-service-card__btn"
            onClick={() => onSelectCategory(cat)}
          >
            Explore Services →
          </button>
        </div>
      ))}
    </div>
  )
}

export default ServiceCarousel
