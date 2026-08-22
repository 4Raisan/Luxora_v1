import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../services/api'

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

// Always-visible "Continue with Google" option for customer accounts.
// When VITE_GOOGLE_CLIENT_ID is configured this renders the official Google
// Identity Services button; before configuration it renders a matching styled
// button that explains what is missing, instead of silently disappearing.
// The credential Google returns is verified server-side by POST /auth/google
// before any session is issued.
export default function GoogleSignIn({ onSuccess, onError }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const buttonRef = useRef(null)
  const handlers = useRef({ onSuccess, onError })
  handlers.current = { onSuccess, onError }
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!clientId || !buttonRef.current) return undefined
    let cancelled = false
    const loadGoogle = () => new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) return resolve()
      const existing = document.querySelector('script[data-luxora-gsi]')
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in')))
        return
      }
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.dataset.luxoraGsi = '1'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load Google sign-in'))
      document.head.appendChild(script)
    })
    loadGoogle().then(() => {
      if (cancelled || !buttonRef.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const data = await apiRequest('/auth/google', 'POST', { credential: response.credential })
            handlers.current.onSuccess?.(data)
          } catch (error) {
            setNotice(error.message || 'Google sign-in failed')
            handlers.current.onError?.(error.message || 'Google sign-in failed')
          }
        },
      })
      window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large', width: 320, text: 'continue_with', shape: 'pill' })
    }).catch((error) => setNotice(error.message))
    return () => { cancelled = true }
  }, [clientId])

  return (
    <div className="auth-google">
      {clientId
        ? <div ref={buttonRef} />
        : <button type="button" className="auth-google-fallback" onClick={() => setNotice('Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID (backend) and VITE_GOOGLE_CLIENT_ID (frontend) to the same Google OAuth client ID to enable it.')}>
            <GoogleMark /> Continue with Google
          </button>}
      {notice && <p className="auth-google-note" role="status">{notice}</p>}
      <small className="auth-google-caption">For customer accounts — providers sign in with email and password.</small>
    </div>
  )
}
