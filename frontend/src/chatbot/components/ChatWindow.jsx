import React, { useState, useEffect, useRef } from 'react'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import SuggestedQuestions from './SuggestedQuestions'

const WINDOW_STORAGE_KEY = 'lx_chatbot_window_pos'
const MARGIN = 16

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
  const [position, setPosition] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 })
  const windowRef = useRef(null)

  // Initialize desktop position from localStorage or default to bottom-left
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth <= 640) return
    const saved = localStorage.getItem(WINDOW_STORAGE_KEY)
    let initX = MARGIN
    let initY = Math.max(MARGIN, window.innerHeight - 670)

    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          initX = Math.min(Math.max(MARGIN, parsed.x), Math.max(MARGIN, window.innerWidth - 440))
          initY = Math.min(Math.max(MARGIN, parsed.y), Math.max(MARGIN, window.innerHeight - 670))
        }
      } catch {
        // Use default
      }
    }
    setPosition({ x: initX, y: initY })
  }, [])

  // Auto-clamp position when window is resized
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined' || window.innerWidth <= 640) return
      setPosition((prev) => {
        if (!prev || !windowRef.current) return prev
        const rect = windowRef.current.getBoundingClientRect()
        const maxX = Math.max(MARGIN, window.innerWidth - rect.width - MARGIN)
        const maxY = Math.max(MARGIN, window.innerHeight - rect.height - MARGIN)
        const clampedX = Math.min(Math.max(MARGIN, prev.x), maxX)
        const clampedY = Math.min(Math.max(MARGIN, prev.y), maxY)
        if (clampedX === prev.x && clampedY === prev.y) return prev
        return { x: clampedX, y: clampedY }
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleHeaderPointerDown = (e) => {
    if (typeof window === 'undefined' || window.innerWidth <= 640) return
    if (e.target.closest('button')) return
    if (e.button !== 0 && e.pointerType === 'mouse') return

    const currentPos = position || {
      x: windowRef.current?.getBoundingClientRect().left || MARGIN,
      y: windowRef.current?.getBoundingClientRect().top || Math.max(MARGIN, window.innerHeight - 670)
    }

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentPos.x,
      initialY: currentPos.y
    }
    isDraggingRef.current = false

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignore
    }
  }

  const handleHeaderPointerMove = (e) => {
    if (dragStartRef.current.startX === 0 && dragStartRef.current.startY === 0) return
    const dx = e.clientX - dragStartRef.current.startX
    const dy = e.clientY - dragStartRef.current.startY

    if (!isDraggingRef.current && Math.hypot(dx, dy) > 5) {
      isDraggingRef.current = true
      setIsDragging(true)
    }

    if (isDraggingRef.current && windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect()
      const maxX = Math.max(MARGIN, window.innerWidth - rect.width - MARGIN)
      const maxY = Math.max(MARGIN, window.innerHeight - rect.height - MARGIN)
      const newX = Math.min(Math.max(MARGIN, dragStartRef.current.initialX + dx), maxX)
      const newY = Math.min(Math.max(MARGIN, dragStartRef.current.initialY + dy), maxY)

      setPosition({ x: newX, y: newY })
    }
  }

  const handleHeaderPointerUp = (e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore
    }

    if (isDraggingRef.current && position) {
      localStorage.setItem(WINDOW_STORAGE_KEY, JSON.stringify(position))
    }

    setIsDragging(false)
    isDraggingRef.current = false
    dragStartRef.current = { startX: 0, startY: 0, initialX: 0, initialY: 0 }
  }

  if (!isOpen) return null

  const handleSend = (e) => {
    e.preventDefault()
    if (!inputText.trim()) return
    onSendMessage(inputText.trim())
    setInputText('')
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 640
  const style = position && isDesktop
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        bottom: 'auto',
        right: 'auto'
      }
    : undefined

  return (
    <div
      ref={windowRef}
      className={`lx-chat-window lx-anim-slide-up ${isDragging ? 'lx-chat-window--dragging' : ''}`}
      style={style}
      role="dialog"
      aria-label="Luxora AI Concierge"
    >
      <ChatHeader
        onClose={onClose}
        onMinimize={onMinimize}
        onReset={onReset}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        isDraggable={isDesktop}
      />

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
