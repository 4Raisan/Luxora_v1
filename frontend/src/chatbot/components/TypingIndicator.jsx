import React from 'react'

export function TypingIndicator() {
  return (
    <div className="lx-message lx-message--bot lx-anim-msg-in">
      <div className="lx-typing-indicator">
        <span className="lx-typing-dot" />
        <span className="lx-typing-dot" />
        <span className="lx-typing-dot" />
      </div>
    </div>
  )
}

export default TypingIndicator
