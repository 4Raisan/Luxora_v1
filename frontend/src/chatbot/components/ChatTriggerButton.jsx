import React, { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'lx_chatbot_btn_pos'
const MARGIN = 16

export function ChatTriggerButton({ onClick, isOpen, unreadCount = 0 }) {
  const [position, setPosition] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, moved: false })
  const buttonRef = useRef(null)

  // Initialize position from localStorage or default to bottom-left
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    let initX = MARGIN
    let initY = typeof window !== 'undefined' ? window.innerHeight - 80 : 600

    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          initX = Math.min(Math.max(MARGIN, parsed.x), Math.max(MARGIN, window.innerWidth - 200))
          initY = Math.min(Math.max(MARGIN, parsed.y), Math.max(MARGIN, window.innerHeight - 70))
        }
      } catch {
        // Use default
      }
    }
    setPosition({ x: initX, y: initY })
  }, [])

  // Auto-clamp position when window is resized or mobile device is rotated
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev || !buttonRef.current) return prev
        const rect = buttonRef.current.getBoundingClientRect()
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

  const handlePointerDown = (e) => {
    if (!position || !buttonRef.current) return
    if (e.button !== 0 && e.pointerType === 'mouse') return

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      moved: false
    }
    isDraggingRef.current = false

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignore fallback
    }
  }

  const handlePointerMove = (e) => {
    if (dragStartRef.current.startX === 0 && dragStartRef.current.startY === 0) return
    const dx = e.clientX - dragStartRef.current.startX
    const dy = e.clientY - dragStartRef.current.startY

    if (!isDraggingRef.current && Math.hypot(dx, dy) > 5) {
      isDraggingRef.current = true
      setIsDragging(true)
      dragStartRef.current.moved = true
    }

    if (isDraggingRef.current && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const maxX = Math.max(MARGIN, window.innerWidth - rect.width - MARGIN)
      const maxY = Math.max(MARGIN, window.innerHeight - rect.height - MARGIN)
      const newX = Math.min(Math.max(MARGIN, dragStartRef.current.initialX + dx), maxX)
      const newY = Math.min(Math.max(MARGIN, dragStartRef.current.initialY + dy), maxY)

      setPosition({ x: newX, y: newY })
    }
  }

  const handlePointerUp = (e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore
    }

    const wasDragging = isDraggingRef.current
    setIsDragging(false)
    isDraggingRef.current = false

    if (wasDragging) {
      if (position) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
      }
    } else if (!dragStartRef.current.moved) {
      onClick?.()
    }

    dragStartRef.current = { startX: 0, startY: 0, initialX: 0, initialY: 0, moved: false }
  }

  const handlePointerCancel = () => {
    setIsDragging(false)
    isDraggingRef.current = false
    dragStartRef.current = { startX: 0, startY: 0, initialX: 0, initialY: 0, moved: false }
  }

  if (isOpen) return null

  const style = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        bottom: 'auto',
        right: 'auto',
        touchAction: 'none'
      }
    : {
        left: `${MARGIN}px`,
        bottom: '28px',
        touchAction: 'none'
      }

  return (
    <button
      ref={buttonRef}
      className={`lx-chat-trigger lx-pulse-gold ${isDragging ? 'lx-chat-trigger--dragging' : ''}`}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      aria-label="Open Luxora AI Concierge (Drag to reposition)"
      title="Click to chat • Drag to move anywhere"
    >
      <div className="lx-chat-trigger__drag-grip" aria-hidden="true" title="Drag handle">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="2" cy="2" r="1.2" fill="#C9A84C" opacity="0.6"/>
          <circle cx="6" cy="2" r="1.2" fill="#C9A84C" opacity="0.6"/>
          <circle cx="2" cy="7" r="1.2" fill="#C9A84C" opacity="0.6"/>
          <circle cx="6" cy="7" r="1.2" fill="#C9A84C" opacity="0.6"/>
          <circle cx="2" cy="12" r="1.2" fill="#C9A84C" opacity="0.6"/>
          <circle cx="6" cy="12" r="1.2" fill="#C9A84C" opacity="0.6"/>
        </svg>
      </div>

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
