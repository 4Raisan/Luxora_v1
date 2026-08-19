import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Stats from './components/Stats'
import Services from './components/Services'
import Plans from './components/Plans'
import About from './components/About'
import Membership from './components/Membership'
import Footer from './components/Footer'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ProviderRegister from './pages/ProviderRegister'
import ProviderDashboard from './pages/ProviderDashboard'
import CustomerDashboard from './pages/CustomerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import BookService from './pages/BookService'
import Reviews from './pages/Reviews'
import ResetPassword from './pages/ResetPassword'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

// Main landing page layout
const HomePage = () => (

  <>
    <Navbar />
    <main>
      <Hero />
      <Stats />
      <Services />
      <Plans />
      <About />
      <Membership />
    </main>
    <Footer />
  </>
)

function RequireRole({ role, children }) {
  const location = useLocation()
  let user = null

  try {
    user = JSON.parse(sessionStorage.getItem('user') || 'null')
  } catch (_) {
    user = null
  }

  const token = sessionStorage.getItem('token')
  const actualRole = String(user?.role || '').toUpperCase()
  const hasValidSession = Boolean(token) && token !== 'demo-token' && token !== 'demo-admin-token'

  if (!hasValidSession || actualRole !== role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

function App() {

  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/provider-register" element={<ProviderRegister />} />
          <Route path="/customer-dashboard" element={<RequireRole role="CUSTOMER"><ErrorBoundary><CustomerDashboard /></ErrorBoundary></RequireRole>} />
          <Route path="/admin-dashboard" element={<RequireRole role="ADMIN"><ErrorBoundary><AdminDashboard /></ErrorBoundary></RequireRole>} />
          <Route path="/provider-dashboard" element={<RequireRole role="PROVIDER"><ErrorBoundary><ProviderDashboard /></ErrorBoundary></RequireRole>} />
          <Route path="/book-service" element={<RequireRole role="CUSTOMER"><ErrorBoundary><BookService /></ErrorBoundary></RequireRole>} />
          <Route path="/reviews" element={<RequireRole role="CUSTOMER"><ErrorBoundary><Reviews /></ErrorBoundary></RequireRole>} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
