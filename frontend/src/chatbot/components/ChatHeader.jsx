import React from 'react'

export function ChatHeader({ onClose, onMinimize, onReset }) {
  return (
    <header className="lx-chat-header">
      <div className="lx-chat-header__brand">
        <div className="lx-chat-header__avatar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="#C9A84C"/>
            <path d="M19 19L20 22L21 19L24 18L21 17L20 14L19 17L16 18L19 19Z" fill="#E8C96B"/>
          </svg>
          <span className="lx-chat-header__status-dot" title="Concierge Online" />
        </div>
        <div className="lx-chat-header__title-group">
          <span className="lx-chat-header__kicker">LUXORA CONCIERGE</span>
          <h3 className="lx-chat-header__title">AI Assistant</h3>
        </div>
      </div>

      <div className="lx-chat-header__actions">
        {onReset && (
          <button
            className="lx-chat-header__btn"
            onClick={onReset}
            aria-label="New Conversation"
            title="New Conversation"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {onMinimize && (
          <button
            className="lx-chat-header__btn"
            onClick={onMinimize}
            aria-label="Minimize Chat"
            title="Minimize"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12H19" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <button
          className="lx-chat-header__btn"
          onClick={onClose}
          aria-label="Close Chat"
          title="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6L18 18" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </header>
  )
}

export default ChatHeader
