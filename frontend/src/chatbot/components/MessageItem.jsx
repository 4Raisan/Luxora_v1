import React from 'react'
import InlineComponent from './InlineComponent'
import ServiceCarousel from './ServiceCarousel'
import PackageCard from './PackageCard'
import PackageComparison from './PackageComparison'
import SpecialAskCard from './SpecialAskCard'
import EscalationModal from './EscalationModal'
import QuickActions from './QuickActions'

export function MessageItem({
  message,
  onSelectAction,
  onSelectCategory,
  onSelectPackage,
  onSubmitSpecialAsk,
  onSendPayload,
  onSendMessage,
  onActionButtonClick
}) {
  const isBot = message.sender === 'bot' || message.role === 'assistant'

  // Simple parser to format bold, headings, bullets, and linebreaks
  const renderFormattedText = (text) => {
    if (!text) return null
    return text.split('\n').map((line, i) => {
      // Heading lines
      if (line.trim().startsWith('###')) {
        return (
          <h3 key={i} style={{ color: 'var(--lx-chat-gold-light)', fontSize: '0.96rem', margin: '6px 0 3px 0' }}>
            {formatBold(line.replace(/^###\s*/, ''))}
          </h3>
        )
      }
      if (line.trim().startsWith('##')) {
        return (
          <h3 key={i} style={{ color: 'var(--lx-chat-gold-light)', fontSize: '1rem', margin: '8px 0 4px 0' }}>
            {formatBold(line.replace(/^##\s*/, ''))}
          </h3>
        )
      }
      // Bullet point line
      if (line.trim().startsWith('•') || line.trim().startsWith('*') || line.trim().startsWith('-')) {
        const content = line.trim().substring(1).trim()
        return (
          <div key={i} style={{ display: 'flex', gap: '6px', margin: '3px 0' }}>
            <span style={{ color: 'var(--lx-chat-gold)' }}>✦</span>
            <span>{formatBold(content)}</span>
          </div>
        )
      }
      return (
        <p key={i} style={{ margin: line.trim() ? '4px 0' : '6px 0' }}>
          {formatBold(line)}
        </p>
      )
    })
  }

  const formatBold = (str) => {
    if (!str) return ''
    const parts = str.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} style={{ color: '#FFF', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return (
    <div className={`lx-message ${isBot ? 'lx-message--bot' : 'lx-message--user'} lx-anim-msg-in`}>
      {(message.text || message.content) && (
        <div className="lx-message__bubble">
          {renderFormattedText(message.text || message.content)}
        </div>
      )}

      {/* 1. Native Interactive Engine Components */}
      {message.inlineComponent && (
        <div style={{ marginTop: '6px' }}>
          <InlineComponent
            comp={message.inlineComponent}
            onSendPayload={onSendPayload}
            onSendMessage={onSendMessage}
          />
        </div>
      )}

      {/* 2. Action Buttons */}
      {message.actionButtons && message.actionButtons.length > 0 && (
        <div className="in-chat-actions" style={{ marginTop: '8px' }}>
          {message.actionButtons.map((btn, idx) => (
            <button
              key={idx}
              type="button"
              className="btn-secondary"
              onClick={() => onActionButtonClick(btn)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* 3. Fallback Legacy Cards */}
      {message.cardType === 'service_carousel' && (
        <div style={{ marginTop: '6px' }}>
          <ServiceCarousel
            categories={message.cardData}
            onSelectCategory={onSelectCategory}
          />
        </div>
      )}

      {message.cardType === 'package_card' && (
        <div style={{ marginTop: '6px' }}>
          <PackageCard
            pkg={message.cardData}
            onSelect={onSelectPackage}
          />
        </div>
      )}

      {message.cardType === 'package_comparison' && (
        <div style={{ marginTop: '6px' }}>
          <PackageComparison
            packages={message.cardData}
            onSelectPackage={onSelectPackage}
          />
        </div>
      )}

      {message.cardType === 'special_ask' && (
        <div style={{ marginTop: '6px' }}>
          <SpecialAskCard onSubmitSpecialAsk={onSubmitSpecialAsk} />
        </div>
      )}

      {message.cardType === 'escalation' && (
        <div style={{ marginTop: '6px' }}>
          <EscalationModal />
        </div>
      )}

      {message.quickActions && (
        <div style={{ marginTop: '6px' }}>
          <QuickActions items={message.quickActions} onSelect={onSelectAction} />
        </div>
      )}

      <div className="lx-message__meta">
        <span>{message.timestamp || 'Just now'}</span>
      </div>
    </div>
  )
}

export default MessageItem
