import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/provider-register" element={<ProviderRegister />} />
          <Route path="/customer-dashboard" element={<ErrorBoundary><CustomerDashboard /></ErrorBoundary>} />
          <Route path="/admin-dashboard" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
          <Route path="/provider-dashboard" element={<ErrorBoundary><ProviderDashboard /></ErrorBoundary>} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
