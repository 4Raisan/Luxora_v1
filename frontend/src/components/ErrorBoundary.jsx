import { Component } from 'react'

// Catches render errors in child routes so a single broken page shows a
// readable error card instead of a blank white screen.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Route crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: '640px', border: '1px solid rgba(201,168,76,0.4)', borderRadius: '14px', padding: '2rem', background: '#141414' }}>
            <h2 style={{ color: '#c9a84c', marginTop: 0 }}>Something went wrong</h2>
            <p style={{ color: '#aaa' }}>This page hit an unexpected error. Try refreshing, or log in again.</p>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#f87171' }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.assign('/login')}
              style={{ background: '#c9a84c', border: 'none', color: '#000', fontWeight: 800, borderRadius: '8px', padding: '0.6rem 1.2rem', cursor: 'pointer' }}
            >
              Back to Login
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
