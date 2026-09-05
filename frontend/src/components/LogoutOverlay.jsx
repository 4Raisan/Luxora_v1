import { useEffect, useRef, useState } from 'react'
import './LogoutOverlay.css'

/**
 * LogoutOverlay — 2-Second Polished Logout Preview for Luxora Portals.
 *
 * Sequence (2000ms total):
 *  - 0–700ms:   "SECURING SESSION" -> Progress fills to 35% with gold spinner
 *  - 700–1400ms: "CLEARING TOKENS" -> Progress fills to 80% with beam scan
 *  - 1400–2000ms: "SESSION CLOSED" -> Progress reaches 100% with success pulse
 *  - 2000ms:     Triggers onComplete() to clear session and navigate to Home Page.
 */
export default function LogoutOverlay({ isOpen, onComplete }) {
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState(1) // 1 | 2 | 3
  // Keep the latest callback in a ref so parent re-renders during the
  // animation cannot restart the progress timer midway through the sequence.
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!isOpen) {
      setProgress(0)
      setStage(1)
      return
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    if (prefersReducedMotion) {
      const timer = setTimeout(() => {
        onCompleteRef.current?.()
      }, 500)
      return () => clearTimeout(timer)
    }

    const startTime = Date.now()
    const DURATION = 2000 // 2 seconds

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const pct = Math.min(100, Math.round((elapsed / DURATION) * 100))
      setProgress(pct)

      if (elapsed >= 1400) {
        setStage(3)
      } else if (elapsed >= 700) {
        setStage(2)
      } else {
        setStage(1)
      }

      if (elapsed >= DURATION) {
        clearInterval(interval)
        onCompleteRef.current?.()
      }
    }, 40)

    return () => clearInterval(interval)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="luxora-logout-overlay" role="alert" aria-live="assertive">
      <div className={`luxora-logout-card ${stage === 3 ? 'luxora-logout-card--success' : ''}`}>
        <div className="luxora-logout-beam" />

        {/* Brand Emblem with Golden Rings */}
        <div className="luxora-logout-emblem">
          <div className="luxora-logout-ring" />
          <div className="luxora-logout-spinner" />
          <img src="/luxora-logo.png" alt="Luxora" className="luxora-logout-logo" />
        </div>

        {/* Dynamic Status Text */}
        <h2 className="luxora-logout-title">
          {stage === 1 && 'Securing Session'}
          {stage === 2 && 'Clearing Tokens'}
          {stage === 3 && 'Session Closed'}
        </h2>

        <p className="luxora-logout-subtitle">
          {stage === 1 && 'Encrypting concierge logs & data'}
          {stage === 2 && 'Revoking authentication access'}
          {stage === 3 && 'Thank you for choosing Luxora'}
        </p>

        {/* Gold Progress Track */}
        <div className="luxora-logout-progress-track">
          <div
            className="luxora-logout-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}