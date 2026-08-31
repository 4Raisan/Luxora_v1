import React from 'react'

export function ChatTriggerButton({ onClick, isOpen, unreadCount = 0 }) {
  if (isOpen) return null

  return (
    <button
      className="lx-chat-trigger lx-pulse-gold"
      onClick={onClick}
      aria-label="Open Luxora AI Concierge"
    >
      <div className="lx-chat-trigger__icon-wrap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="#C9A84C"/>
          <path d="M19 19L20 22L21 19L24 18L21 17L20 14L19 17L16 18L19 19Z" fill="#E8C96B"/>
        </svg>
        <span className="lx-chat-trigger__badge" />
      </div>
      <div className="lx-chat-trigger__text">
        <span className="lx-chat-trigger__brand">LUXORA CONCIERGE</span>
        <span className="lx-chat-trigger__label">AI Assistant</span>
      </div>
    </button>
  )
}

export default ChatTriggerButton
