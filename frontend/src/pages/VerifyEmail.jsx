import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api'
import { ActionButton } from '../components/ui'
import './Auth.css'

// V2 Slice 6 — email verification landing page. The emailed link lands here
// with a one-time token; the page also doubles as the resend entry point when
// the token is missing, expired, or invalid.
export default function VerifyEmail() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = (params.get('token') || '').trim()

  const [status, setStatus] = useState(token ? 'verifying' : 'no-token') // verifying | success | invalid | no-token
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  // The token is one-time use: fire the verification request exactly once per
  // token, even when React StrictMode double-invokes this effect in dev. The
  // fire-once ref is the only guard — a per-effect cancelled flag would
  // suppress the completion state of the single real request.
  const attemptedRef = useRef('')

  useEffect(() => {
    if (!token) return undefined
    if (attemptedRef.current === token) return undefined
    attemptedRef.current = token
    const run = async () => {
      try {
        await apiRequest('/auth/verify-email', 'POST', { token })
        setStatus('success')
        setTimeout(() => navigate('/login'), 2500)
      } catch (err) {
        setStatus('invalid')
      }
    }
    run()
    return undefined
  }, [token, navigate])

  const resend = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!email.trim()) {
      setError('Enter the email address you registered with.')
      return
    }
    setResending(true)
    try {
      const result = await apiRequest('/auth/resend-verification', 'POST', { email: email.trim() })
      setMessage(result.message || 'If that account exists and is unverified, a verification email has been sent.')
      setResent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Email verification</h1>

        {status === 'verifying' && (
          <>
            <p className="auth-card__subtitle">Verifying your email address…</p>
            <ActionButton className="auth-submit" loading loadingText="Verifying...">
              Verify email
            </ActionButton>
          </>
        )}

        {status === 'success' && (
          <>
            <p className="auth-card__subtitle" style={{ color: '#22c55e' }}>Your email address has been verified. Redirecting you to sign in…</p>
            <ActionButton className="auth-submit" onClick={() => navigate('/login')}>
              Go to sign in
            </ActionButton>
          </>
        )}

        {(status === 'invalid' || status === 'no-token') && (
          <>
            <p className="auth-card__subtitle">
              {status === 'invalid'
                ? 'This verification link is invalid, was already used, or has expired (links are valid for 24 hours).'
                : 'Enter your registered email address and we will send a verification link (valid for 24 hours).'}
            </p>
            {!resent ? (
              <form className="auth-form" onSubmit={resend}>
                {error && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</p>}
                <div className="auth-field">
                  <input
                    className="auth-input"
                    type="email"
                    placeholder="Registered email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <ActionButton className="auth-submit" type="submit" loading={resending} loadingText="Sending...">
                  Resend verification email
                </ActionButton>
              </form>
            ) : (
              <>
                {message && <p style={{ color: '#22c55e', fontSize: '0.85rem' }}>{message}</p>}
                <ActionButton className="auth-submit" onClick={() => navigate('/login')}>
                  Go to sign in
                </ActionButton>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
