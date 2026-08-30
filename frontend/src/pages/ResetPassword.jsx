import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api'
import { ActionButton } from '../components/ui'
import PeekingEyes from '../components/PeekingEyes'
import './Auth.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [isConfirmFocused, setIsConfirmFocused] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 6 || password !== confirm) {
      setError('Passwords must match and be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await apiRequest('/auth/password-reset/confirm', 'POST', { token: params.get('reset_token'), password })
      setMessage('Password updated. You can now log in.')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Set a new password</h1>
        <p className="auth-card__subtitle">Your Luxora reset link is valid for 15 minutes.</p>
        {error && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</p>}
        {message && <p style={{ color: '#22c55e', fontSize: '0.85rem' }}>{message}</p>}
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-field">
            <div className="auth-input-wrap">
              <PeekingEyes
                isActive={isPasswordFocused}
                textLength={password.length}
              />
              <input
                className="auth-input"
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="auth-field">
            <div className="auth-input-wrap">
              <PeekingEyes
                isActive={isConfirmFocused}
                textLength={confirm.length}
              />
              <input
                className="auth-input"
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onFocus={() => setIsConfirmFocused(true)}
                onBlur={() => setIsConfirmFocused(false)}
                required
                minLength={6}
              />
            </div>
          </div>

          <ActionButton className="auth-submit" type="submit" loading={loading} loadingText="Updating password...">
            Update Password
          </ActionButton>
        </form>
      </div>
    </div>
  )
}
