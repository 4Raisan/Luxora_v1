import React from 'react'

export function QuickActions({ items = [], onSelect }) {
  if (!items || items.length === 0) return null

  return (
    <div className="lx-quick-actions">
      {items.map((item) => (
        <button
          key={item.id}
          className="lx-quick-pill"
          onClick={() => onSelect(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default QuickActions
