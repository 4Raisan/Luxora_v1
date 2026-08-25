import { Navigate } from 'react-router-dom'

// UX-only route guard. The backend remains the single authorization authority:
// every API call still carries the JWT and is re-checked server-side (role,
// account status and KYC). This guard only stops obviously-unauthenticated or
// wrong-role visitors from landing on a portal page by typing its URL.
const HOME_BY_ROLE = { CUSTOMER: '/customer-dashboard', PROVIDER: '/provider-dashboard', ADMIN: '/admin-dashboard' }

function readSession() {
  try {
    const token = sessionStorage.getItem('token')
    if (!token) return null
    const user = JSON.parse(sessionStorage.getItem('user') || 'null')
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      return null
    }
    return { token, role: user?.role || payload.role, name: user?.name }
  } catch {
    return null
  }
}

export default function RequireAuth({ allow, children }) {
  const session = readSession()
  if (!session) return <Navigate to="/login" replace />
  if (allow && !allow.includes(session.role)) return <Navigate to={HOME_BY_ROLE[session.role] || '/login'} replace />
  return children
}
