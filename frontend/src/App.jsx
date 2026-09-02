import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Stats from './components/Stats'
import Services from './components/Services'
import Plans from './components/Plans'
import About from './components/About'
import HowItWorks from './components/HowItWorks'
import Footer from './components/Footer'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ErrorBoundary from './components/ErrorBoundary'
import RequireAuth from './components/RequireAuth'
import CursorGlow from './components/CursorGlow'
import { LuxoraChatbot } from './chatbot/components/LuxoraChatbot'
import './App.css'

const ProviderRegister = lazy(() => import('./pages/ProviderRegister'))
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const ProviderDashboard = lazy(() => import('./pages/ProviderDashboard'))
const BookService = lazy(() => import('./pages/BookService'))
const Reviews = lazy(() => import('./pages/Reviews'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

const PageLoader = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(201,168,76,0.2)', borderTop: '3px solid #c9a84c', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
  </div>
)

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
      <HowItWorks />
    </main>
    <Footer />
  </>
)

function App() {
  return (
    <BrowserRouter>
      <CursorGlow />
      <div className="app">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/provider-register" element={<ProviderRegister />} />
            <Route path="/customer-dashboard" element={<RequireAuth allow={['CUSTOMER']}><ErrorBoundary><CustomerDashboard /></ErrorBoundary></RequireAuth>} />
            <Route path="/admin-dashboard" element={<RequireAuth allow={['ADMIN']}><ErrorBoundary><AdminDashboard /></ErrorBoundary></RequireAuth>} />
            <Route path="/provider-dashboard" element={<RequireAuth allow={['PROVIDER']}><ErrorBoundary><ProviderDashboard /></ErrorBoundary></RequireAuth>} />
            <Route path="/book-service" element={<RequireAuth allow={['CUSTOMER']}><ErrorBoundary><BookService /></ErrorBoundary></RequireAuth>} />
            <Route path="/reviews" element={<RequireAuth allow={['CUSTOMER']}><ErrorBoundary><Reviews /></ErrorBoundary></RequireAuth>} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </Suspense>
        <LuxoraChatbot />
      </div>
    </BrowserRouter>
  )
}

export default App
