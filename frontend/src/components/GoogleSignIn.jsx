import { useEffect, useRef } from 'react'
import { apiRequest } from '../services/api'

// Google Identity Services button. Renders nothing at all when
// VITE_GOOGLE_CLIENT_ID is not configured, so local/dev deployments without
// Google set up keep a clean auth card. The credential Google returns is
// verified server-side by POST /auth/google before any session is issued.
export default function GoogleSignIn({ onSuccess, onError }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const buttonRef = useRef(null)
  const handlers = useRef({ onSuccess, onError })
  handlers.current = { onSuccess, onError }

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
            handlers.current.onError?.(error.message || 'Google sign-in failed')
          }
        },
      })
      window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large', width: 320, text: 'continue_with', shape: 'pill' })
    }).catch((error) => handlers.current.onError?.(error.message))
    return () => { cancelled = true }
  }, [clientId])

  if (!clientId) return null
  return <div className="auth-google" ref={buttonRef} />
}
