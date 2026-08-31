import React from 'react'
import PackageCard from './PackageCard'

export function PackageComparison({ packages = [], onSelectPackage }) {
  if (!packages || packages.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--lx-chat-gold)', fontWeight: 700, letterSpacing: '0.08em' }}>
        CURATED MEMBERSHIP PACKAGES
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onSelect={onSelectPackage} />
        ))}
      </div>
    </div>
  )
}

export default PackageComparison
