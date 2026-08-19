import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api'
import './Auth.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    if (password.length < 6 || password !== confirm) { setError('Passwords must match and be at least 6 characters.'); return }
    try {
      await apiRequest('/auth/password-reset/confirm', 'POST', { token: params.get('reset_token'), password })
      setMessage('Password updated. You can now log in.')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) { setError(err.message) }
  }

  return <div className="auth-page"><div className="auth-card"><h1 className="auth-card__title">Set a new password</h1><p className="auth-card__subtitle">Your Luxora reset link is valid for 15 minutes.</p>{error && <p style={{ color: '#ef4444' }}>{error}</p>}{message && <p style={{ color: '#22c55e' }}>{message}</p>}<form className="auth-form" onSubmit={submit}><input className="auth-input" type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /><input className="auth-input" type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} /><button className="auth-submit" type="submit">Update Password</button></form></div></div>
}
