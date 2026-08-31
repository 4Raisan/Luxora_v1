import React, { useState } from 'react'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import SuggestedQuestions from './SuggestedQuestions'

export function ChatWindow({
  isOpen,
  onClose,
  onMinimize,
  onReset,
  messages,
  isTyping,
  suggestedQuestions,
  onSendMessage,
  onSelectAction,
  onSelectCategory,
  onSelectPackage,
  onSubmitSpecialAsk,
  onSendPayload,
  onActionButtonClick
}) {
  const [inputText, setInputText] = useState('')

  if (!isOpen) return null

  const handleSend = (e) => {
    e.preventDefault()
    if (!inputText.trim()) return
    onSendMessage(inputText.trim())
    setInputText('')
  }

  return (
    <div className="lx-chat-window lx-anim-slide-up" role="dialog" aria-label="Luxora AI Concierge">
      <ChatHeader onClose={onClose} onMinimize={onMinimize} onReset={onReset} />

      <MessageList
        messages={messages}
        isTyping={isTyping}
        onSelectAction={onSelectAction}
        onSelectCategory={onSelectCategory}
        onSelectPackage={onSelectPackage}
        onSubmitSpecialAsk={onSubmitSpecialAsk}
        onSendPayload={onSendPayload}
        onSendMessage={onSendMessage}
        onActionButtonClick={onActionButtonClick}
      />

      <div className="lx-chat-input-area">
        {suggestedQuestions && suggestedQuestions.length > 0 && (
          <SuggestedQuestions
            questions={suggestedQuestions}
            onSelect={(q) => onSendMessage(q)}
          />
        )}

        <form className="lx-chat-form" onSubmit={handleSend}>
          <input
            type="text"
            className="lx-chat-input"
            placeholder="Inquire about packages, bookings, services…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button
            type="submit"
            className="lx-chat-send-btn"
            disabled={!inputText.trim()}
            aria-label="Send message"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatWindow
