import React from 'react'

export function PackageCard({ pkg, onSelect }) {
  if (!pkg) return null

  return (
    <div className={`lx-package-card ${pkg.recommended ? 'lx-package-card--highlight' : ''}`}>
      {pkg.badge && (
        <span className="lx-package-card__badge">{pkg.badge}</span>
      )}

      <div>
        <h4 className="lx-package-card__tier">{pkg.title}</h4>
        <div className="lx-package-card__price-wrap" style={{ marginTop: '4px' }}>
          <span className="lx-package-card__currency">{pkg.currency || 'LKR'}</span>
          <span className="lx-package-card__amount">{(pkg.priceMonthly || 0).toLocaleString()}</span>
          <span className="lx-package-card__period">/ month</span>
        </div>
      </div>

      <div className="lx-package-card__coins">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#C9A84C"/>
          <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fill="#121212">L</text>
        </svg>
        <span>{pkg.totalCoins} {pkg.totalCoins === 1 ? 'Coin' : 'Coins'} included / mo</span>
      </div>

      <ul className="lx-package-card__features">
        {(pkg.features || []).map((feat, idx) => (
          <li key={idx} className="lx-package-card__feature-item">
            <span className="lx-package-card__check">✓</span>
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      <button
        className="lx-package-card__cta"
        onClick={() => {
          const pkgTitle = pkg.title || pkg.name || 'Selected Package'
          const categoryKey = pkg.categoryKey || (pkgTitle.toLowerCase().includes('auto') ? 'auto' : pkgTitle.toLowerCase().includes('garden') ? 'garden' : pkgTitle.toLowerCase().includes('pet') ? 'pet' : 'auto')
          sessionStorage.setItem('selectedCategory', categoryKey)
          sessionStorage.setItem('selectedPlanName', pkgTitle)
          sessionStorage.setItem('loginRedirect', '/book-service')

          const token = sessionStorage.getItem('token')
          const user = JSON.parse(sessionStorage.getItem('user') || '{}')
          if (!token || user?.role?.toLowerCase() !== 'customer') {
            window.location.href = '/login?role=customer'
          } else {
            window.location.href = '/book-service'
          }
          onSelect?.(pkg)
        }}
      >
        ✦ Select & Book Package →
      </button>
    </div>
  )
}

export default PackageCard
