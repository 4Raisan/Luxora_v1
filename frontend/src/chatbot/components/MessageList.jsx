import React, { useEffect, useRef } from 'react'
import MessageItem from './MessageItem'
import TypingIndicator from './TypingIndicator'

export function MessageList({
  messages = [],
  isTyping,
  onSelectAction,
  onSelectCategory,
  onSelectPackage,
  onSubmitSpecialAsk,
  onSendPayload,
  onSendMessage,
  onActionButtonClick
}) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  return (
    <div className="lx-chat-messages" ref={scrollRef}>
      {messages.map((msg, index) => (
        <MessageItem
          key={msg.id || index}
          message={msg}
          onSelectAction={onSelectAction}
          onSelectCategory={onSelectCategory}
          onSelectPackage={onSelectPackage}
          onSubmitSpecialAsk={onSubmitSpecialAsk}
          onSendPayload={onSendPayload}
          onSendMessage={onSendMessage}
          onActionButtonClick={onActionButtonClick}
        />
      ))}

      {isTyping && <TypingIndicator />}
    </div>
  )
}

export default MessageList
