import React from 'react'

export function BookingStatusCard({ booking }) {
  if (!booking) return null

  return (
    <div style={{
      background: 'linear-gradient(145deg, #1C1C1C 0%, #131313 100%)',
      border: '1px solid var(--lx-chat-gold-border)',
      borderRadius: 'var(--lx-chat-radius-card)',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--lx-chat-gold)' }}>
          BOOKING CONFIRMATION
        </span>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 800,
          padding: '2px 8px',
          borderRadius: '999px',
          background: 'rgba(95, 189, 139, 0.15)',
          color: '#5FBD8B',
          border: '1px solid rgba(95, 189, 139, 0.3)'
        }}>
          CONFIRMED
        </span>
      </div>

      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFF' }}>
        {booking.serviceName || 'Wash + Vacuum'}
      </div>

      <div style={{ fontSize: '0.78rem', color: 'var(--lx-chat-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div><strong>Date & Time:</strong> {booking.scheduledTime || 'Tomorrow, 10:30 AM'}</div>
        <div><strong>Location:</strong> {booking.address || 'Colombo 07 - Cinnamon Gardens'}</div>
        <div><strong>Specialist:</strong> Verified KYC Concierge Specialist</div>
      </div>

      <div style={{
        marginTop: '4px',
        padding: '6px 10px',
        background: 'rgba(201, 168, 76, 0.08)',
        borderRadius: '8px',
        fontSize: '0.74rem',
        color: 'var(--lx-chat-gold-light)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span>🪙 1 Service Coin applied</span>
      </div>
    </div>
  )
}

export default BookingStatusCard
