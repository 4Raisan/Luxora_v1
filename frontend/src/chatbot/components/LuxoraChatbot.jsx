import React, { useState, useRef } from 'react'
import { apiRequest } from '../../services/api'
import ChatTriggerButton from './ChatTriggerButton'
import ChatWindow from './ChatWindow'
import '../styles/chatbot-tokens.css'
import '../styles/chatbot-animations.css'
import '../styles/chatbot-components.css'
import '../styles/chatbot-theme.css'

const createInitialGreeting = () => ({
  id: 'greeting-' + Date.now(),
  sender: 'bot',
  role: 'assistant',
  text: 'Hello! I am your **Luxora Concierge AI Assistant**.\n\nWhat service would you like to explore?',
  actionButtons: [
    { label: '🚗 Auto Care', action: 'SELECT_AUTO' },
    { label: '🌿 Garden Care', action: 'SELECT_GARDEN' },
    { label: '🐾 Pet Care', action: 'SELECT_PET' },
    { label: '🎯 Find the Right Package', action: 'START_SIZING' },
    { label: '💬 Talk to Us', action: 'CONTACT_SUPPORT' }
  ],
  quickReplies: [
    '🚗 Auto Care',
    '🌿 Garden Care',
    '🐾 Pet Care',
    'Find the right package for my home'
  ]
})

export function LuxoraChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const sessionIdRef = useRef('session_' + Math.random().toString(36).substring(2, 9))

  const [messages, setMessages] = useState([createInitialGreeting()])
  const [suggestedQuestions, setSuggestedQuestions] = useState([
    '🚗 Auto Care',
    '🌿 Garden Care',
    '🐾 Pet Care',
    'Find the right package for my home'
  ])

  const handleReset = () => {
    sessionIdRef.current = 'session_' + Math.random().toString(36).substring(2, 9)
    const init = createInitialGreeting()
    setMessages([init])
    setSuggestedQuestions(init.quickReplies)
    setIsTyping(false)
  }

  const handleSendMessage = async (text, structuredPayload = null) => {
    if (text) {
      const userMsg = {
        id: `user-${Date.now()}`,
        sender: 'user',
        role: 'user',
        text,
        timestamp: 'Just now'
      }
      setMessages((prev) => [...prev, userMsg])
    }

    setIsTyping(true)
    setSuggestedQuestions([])

    try {
      const authToken = sessionStorage.getItem('token') || null
      const serverRes = await apiRequest(
        '/chat',
        'POST',
        {
          message: text || '',
          sessionId: sessionIdRef.current,
          structuredPayload: structuredPayload || null
        },
        authToken
      )

      setIsTyping(false)

      if (serverRes && (serverRes.text || serverRes.content)) {
        const botMsg = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          role: 'assistant',
          text: serverRes.text || serverRes.content,
          actionButtons: serverRes.actionButtons || null,
          inlineComponent: serverRes.inlineComponent || null,
          timestamp: 'Just now'
        }
        setMessages((prev) => [...prev, botMsg])

        if (serverRes.quickReplies && serverRes.quickReplies.length > 0) {
          setSuggestedQuestions(serverRes.quickReplies)
        }
      } else if (serverRes && serverRes.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            role: 'assistant',
            text: `⚠️ ${serverRes.error}`,
            timestamp: 'Just now'
          }
        ])
      }
    } catch {
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          role: 'assistant',
          text: '⚠️ Connection error. Please ensure the Luxora server is running.',
          timestamp: 'Just now'
        }
      ])
    }
  }

  const handleSendPayload = (payload) => {
    handleSendMessage('', payload)
  }

  const handleActionButtonClick = (btn) => {
    switch (btn.action) {
      case 'SELECT_AUTO':
        handleSendMessage('Auto Care')
        break
      case 'SELECT_GARDEN':
        handleSendMessage('Garden Care')
        break
      case 'SELECT_PET':
        handleSendMessage('Pet Care')
        break
      case 'VIEW_AUTO_PACKAGES':
        handleSendMessage('View Auto Packages')
        break
      case 'VIEW_GARDEN_PACKAGES':
        handleSendMessage('View Garden Packages')
        break
      case 'VIEW_PET_PACKAGES':
        handleSendMessage('View Pet Packages')
        break
      case 'START_SPECIAL_ASK':
      case 'START_CUSTOM_PACKAGE_REQUEST':
        handleSendMessage('', {
          wizardType: 'SPECIAL_ASK',
          stepAction: 'START',
          category: btn.category || 'GARDEN_CARE',
          scope: btn.scope || btn.quantity || ''
        })
        break
      case 'START_SPECIAL_ASK_AUTO':
      case 'START_CUSTOM_REQUEST_AUTO':
        handleSendMessage('', {
          wizardType: 'SPECIAL_ASK',
          stepAction: 'START',
          category: 'AUTO_CARE'
        })
        break
      case 'START_SPECIAL_ASK_GARDEN':
      case 'START_CUSTOM_REQUEST_GARDEN':
        handleSendMessage('', {
          wizardType: 'SPECIAL_ASK',
          stepAction: 'START',
          category: 'GARDEN_CARE'
        })
        break
      case 'START_SPECIAL_ASK_PET':
      case 'START_CUSTOM_REQUEST_PET':
        handleSendMessage('', {
          wizardType: 'SPECIAL_ASK',
          stepAction: 'START',
          category: 'PET_CARE'
        })
        break
      case 'SELECT_AUTO':
        handleSendMessage('Auto Care')
        break
      case 'SELECT_GARDEN':
        handleSendMessage('Garden Care')
        break
      case 'SELECT_PET':
        handleSendMessage('Pet Care')
        break
      case 'START_BOOKING':
      case 'CONFIRM_BOOKING':
        if (!sessionStorage.getItem('token')) {
          sessionStorage.setItem('loginRedirect', '/book-service')
          window.location.href = '/login'
        } else {
          window.location.href = '/book-service'
        }
        break
      case 'SHOW_CATEGORIES':
      case 'SHOW_MAIN_MENU':
        handleSendMessage('Main Menu')
        break
      case 'START_SIZING':
        handleSendMessage('Find the right package for my home')
        break
      case 'CONTACT_SUPPORT':
        handleSendMessage('I want to talk to a person')
        break
      case 'REPORT_NO_SHOW':
        handleSendMessage('My provider has not arrived and is 40 minutes late')
        break
      case 'VIEW_DASHBOARD':
      case 'CHECK_BALANCE':
        if (!sessionStorage.getItem('token')) {
          sessionStorage.setItem('loginRedirect', '/customer-dashboard')
          window.location.href = '/login'
        } else {
          window.location.href = '/customer-dashboard'
        }
        break
      case 'NEW_CONVERSATION':
        handleReset()
        break
      default:
        handleSendMessage(btn.label)
        break
    }
  }

  const handleSelectAction = (actionItem) => {
    handleSendMessage(actionItem.label || actionItem.action)
  }

  const handleSelectCategory = (cat) => {
    handleSendMessage(`Tell me more about ${cat.name}`)
  }

  const handleSelectPackage = (pkg) => {
    handleSendMessage(`Tell me more about ${pkg.title || pkg.name}`)
  }

  return (
    <>
      <ChatTriggerButton
        isOpen={isOpen}
        onClick={() => setIsOpen(true)}
      />

      <ChatWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onMinimize={() => setIsOpen(false)}
        onReset={handleReset}
        messages={messages}
        isTyping={isTyping}
        suggestedQuestions={suggestedQuestions}
        onSendMessage={(text) => handleSendMessage(text)}
        onSelectAction={handleSelectAction}
        onSelectCategory={handleSelectCategory}
        onSelectPackage={handleSelectPackage}
        onSendPayload={handleSendPayload}
        onActionButtonClick={handleActionButtonClick}
      />
    </>
  )
}

export default LuxoraChatbot
