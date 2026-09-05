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
    { label: '💬 Talk to Us', action: 'CONTACT_SUPPORT' },
    { label: '📋 Requested Service', action: 'START_SPECIAL_ASK' }
  ],
  quickReplies: []
})

export function LuxoraChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const sessionIdRef = useRef('session_' + Math.random().toString(36).substring(2, 9))

  const [messages, setMessages] = useState([createInitialGreeting()])
  const [suggestedQuestions, setSuggestedQuestions] = useState([])

  const handleReset = () => {
    sessionIdRef.current = 'session_' + Math.random().toString(36).substring(2, 9)
    const init = createInitialGreeting()
    setMessages([init])
    setSuggestedQuestions([])
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
      case 'REQUESTED_SERVICE':
      case 'REQUESTED_SERVICES':
      case 'START_REQUESTED_SERVICE':
        handleSendMessage('', {
          wizardType: 'SPECIAL_ASK',
          stepAction: 'START',
          category: btn.category || 'Auto Care'
        })
        break
      case 'CONTINUE_BESPOKE': {
        if (btn.requestData) {
          sessionStorage.setItem('pendingBespokeRequest', JSON.stringify(btn.requestData))
        }
        const token = sessionStorage.getItem('token')
        const user = JSON.parse(sessionStorage.getItem('user') || '{}')
        if (!token || user?.role?.toLowerCase() !== 'customer') {
          sessionStorage.setItem('loginRedirect', '/customer-dashboard?openBespoke=true')
          window.location.href = '/login?role=customer'
        } else {
          window.location.href = '/customer-dashboard?openBespoke=true'
        }
        break
      }
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
      case 'START_BOOKING':
      case 'CONFIRM_BOOKING': {
        const categoryKey = btn.category || sessionStorage.getItem('selectedCategory') || 'auto'
        sessionStorage.setItem('selectedCategory', categoryKey)
        sessionStorage.setItem('loginRedirect', '/book-service')

        const token = sessionStorage.getItem('token')
        const user = JSON.parse(sessionStorage.getItem('user') || '{}')
        if (!token || user?.role?.toLowerCase() !== 'customer') {
          window.location.href = '/login?role=customer'
        } else {
          window.location.href = '/book-service'
        }
        break
      }
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
      case 'CHECK_BALANCE': {
        const token = sessionStorage.getItem('token')
        const user = JSON.parse(sessionStorage.getItem('user') || '{}')
        if (!token || user?.role?.toLowerCase() !== 'customer') {
          sessionStorage.setItem('loginRedirect', '/customer-dashboard')
          window.location.href = '/login?role=customer'
        } else {
          window.location.href = '/customer-dashboard'
        }
        break
      }
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
    const pkgTitle = pkg?.title || pkg?.name || 'Selected Package'
    const categoryKey = pkg?.categoryKey || (pkgTitle.toLowerCase().includes('auto') ? 'auto' : pkgTitle.toLowerCase().includes('garden') ? 'garden' : pkgTitle.toLowerCase().includes('pet') ? 'pet' : 'auto')
    if (pkg?.planId !== undefined && pkg?.planId !== null) {
      sessionStorage.setItem('selectedPlanId', String(pkg.planId))
    } else {
      sessionStorage.removeItem('selectedPlanId')
    }
    sessionStorage.setItem('selectedCategory', categoryKey)
    sessionStorage.setItem('selectedPlanName', pkgTitle)
    sessionStorage.setItem('loginRedirect', '/book-service')

    const token = sessionStorage.getItem('token')
    const user = JSON.parse(sessionStorage.getItem('user') || '{}')
    if (!token || user?.role?.toLowerCase() !== 'customer') {
      window.location.href = '/login?role=customer'
    } else {
      window.location.href = '/book-service'
    }
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
