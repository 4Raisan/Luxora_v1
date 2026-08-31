import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Stats from './components/Stats'
import Services from './components/Services'
import Plans from './components/Plans'
import About from './components/About'
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
import RequireAuth from './components/RequireAuth'
import CursorGlow from './components/CursorGlow'
import { LuxoraChatbot } from './chatbot/components/LuxoraChatbot'
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
    </main>
    <Footer />
  </>
)

function App() {
  return (
    <BrowserRouter>
      <CursorGlow />
      <div className="app">
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
        <LuxoraChatbot />
      </div>
    </BrowserRouter>
  )
}

export default App
