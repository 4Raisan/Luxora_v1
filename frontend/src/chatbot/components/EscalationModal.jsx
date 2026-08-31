import React from 'react'

export function EscalationModal({ onClose }) {
  return (
    <div style={{
      background: 'linear-gradient(145deg, #202020 0%, #151515 100%)',
      border: '1px solid var(--lx-chat-gold-border)',
      borderRadius: 'var(--lx-chat-radius-card)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--lx-chat-gold)' }}>
          DIRECT CONCIERGE ACCESS
        </span>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem' }}>
            ✕
          </button>
        )}
      </div>

      <h4 style={{ fontFamily: 'var(--lx-chat-font-display)', fontSize: '1.05rem', color: '#FFF', margin: 0 }}>
        Speak with a Luxora Concierge Officer
      </h4>

      <p style={{ fontSize: '0.78rem', color: 'var(--lx-chat-text-muted)', margin: 0 }}>
        Our dedicated desk is available 24/7 to attend to private appointments, bespoke estates, and immediate assistance.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <a
          href="tel:+94112345678"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: 'rgba(201, 168, 76, 0.12)',
            border: '1px solid var(--lx-chat-gold)',
            borderRadius: '8px',
            color: '#FFF',
            textDecoration: 'none',
            fontSize: '0.82rem',
            fontWeight: 600
          }}
        >
          <span>📞</span>
          <div>
            <div>VIP Concierge Hotline</div>
            <small style={{ color: 'var(--lx-chat-gold-light)', fontSize: '0.74rem' }}>+94 11 234 5678</small>
          </div>
        </a>

        <a
          href="https://wa.me/94771000001"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: 'rgba(95, 189, 139, 0.12)',
            border: '1px solid #5FBD8B',
            borderRadius: '8px',
            color: '#FFF',
            textDecoration: 'none',
            fontSize: '0.82rem',
            fontWeight: 600
          }}
        >
          <span>💬</span>
          <div>
            <div>WhatsApp Concierge</div>
            <small style={{ color: '#5FBD8B', fontSize: '0.74rem' }}>+94 77 100 0001</small>
          </div>
        </a>
      </div>
    </div>
  )
}

export default EscalationModal
