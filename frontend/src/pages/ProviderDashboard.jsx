import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Calendar from '../components/Calendar'
import { apiRequest } from '../services/api'
import './ProviderDashboard.css'

/* ── SVG Icons ─────────────────────────────────────── */
function GridIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg> }
function CalIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function BriefIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="1.5"/></svg> }
function BellIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function StarIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> }
function GearIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5"/></svg> }
function SearchIcon(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function UserIcon()  { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function LogOutIcon(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function DotsIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg> }
function LinkIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function PlusIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> }

/* ── Helper Functions ───────────────────────────────── */
const formatMobileNumber = (val) => {
  if (!val) return '+94 77 123 4567 (0771234567)'
  let cleaned = String(val).replace(/\D/g, '')
  if (cleaned.startsWith('94')) cleaned = cleaned.slice(2)
  if (cleaned.startsWith('0'))  cleaned = cleaned.slice(1)
  if (!cleaned) return '+94 77 123 4567 (0771234567)'
  const localPart = '0' + cleaned
  const intlPart = '+94 ' + cleaned.slice(0, 2) + ' ' + cleaned.slice(2, 5) + ' ' + cleaned.slice(5, 9)
  return `${intlPart} (${localPart})`
}

/* ── Mock Data ─────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'overview',      icon: <GridIcon />,   label: 'Overview' },
  { id: 'bookings',      icon: <CalIcon />,    label: 'Bookings' },
]

const STATS = [
  { label: 'ACTIVE BOOKINGS', value: '3',          accent: false },
  { label: 'TOTAL EARNING',   value: 'Rs. 125,000', accent: true  },
  { label: 'NEXT SERVICE',    value: '2026.08.14', accent: false },
]

const SERVICES = [
  {
    id: 1,
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',
    status: 'ACTIVE',
    title: 'Automotive Stewardship',
    desc: 'Weekly detailing and mechanical health monitoring for your fleet.',
    next: 'Next: Friday, 10:00 AM',
  },
  {
    id: 2,
    img: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600&q=80',
    status: 'ACTIVE',
    title: 'Architectural Landscaping',
    desc: 'Seasonal curation and nightly maintenance of exterior...',
    next: 'Next: Monday, 08:30 AM',
  },
]

const BOOKINGS = [
  {
    month: 'AUG',
    day: '16',
    title: 'Auto Care – Vehicle Detailing & Health Audit',
    sub: 'Full Interior Detailing & Engine Diagnostics • Member Villa',
    status: 'CONFIRMED',
    color: '#C9A84C',
  },
  {
    month: 'AUG',
    day: '19',
    title: 'Garden Care – Landscaping & Flora Maintenance',
    sub: 'Courtyard Lawn Trimming & Hydroponic Care • Estate Residence',
    status: 'PENDING',
    color: '#eab308',
  },
  {
    month: 'AUG',
    day: '22',
    title: 'Pet Care – Grooming & Veterinary Wellness',
    sub: 'Full Dog Spa & Annual Vaccine Check • Colombo Residence',
    status: 'CONFIRMED',
    color: '#C9A84C',
  },
  {
    month: 'AUG',
    day: '25',
    title: 'Full Home Suite (Combo: Auto + Garden + Pet)',
    sub: 'All-Inclusive Estate Maintenance Package • Luxury Penthouse',
    status: 'CONFIRMED',
    color: '#C9A84C',
  },
]

const NOTIFICATIONS = [
  { icon: '✦', title: 'Service completed', body: 'Automotive detailing at the Residence was finalized by Specialist Marco.', time: '2 HOURS AGO' },
  { icon: '▣', title: 'New invoice available', body: 'Invoice INV-2024-008 for Concierge Services is ready for review.', time: 'YESTERDAY' },
]

const TIMELINE = [
  { dot: '#C9A84C', title: 'Renewal confirmed',  sub: 'Elite Membership active until 2026', date: 'OCT 01' },
  { dot: '#555',    title: 'New property added',  sub: 'Portofino Villa integrated to profile', date: 'SEP 19' },
  { dot: '#555',    title: 'Milestone achieved',  sub: 'One year with Luxora Concierge', date: 'AUG 29' },
]


/* ── Component ─────────────────────────────────────── */
const ProviderDashboard = () => {
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('overview')
  const [search, setSearch] = useState('')

  const [currentProvider, setCurrentProvider] = useState(() => {
    try {
      const u = sessionStorage.getItem('user')
      if (u) {
        const parsed = JSON.parse(u)
        const saved = localStorage.getItem('user_' + (parsed.email || 'guest'))
        if (saved) return JSON.parse(saved)
        return {
          name: parsed.name || 'Provider Partner',
          email: parsed.email || 'provider@gmail.com',
          mobile: parsed.mobile || parsed.phone || '0771234567',
          nicNumber: parsed.nicNumber || '199512345678',
          address: parsed.address || 'No. 42, Marina Boulevard, Colombo 03',
          services: parsed.services || ['Auto Care', 'Garden Care', 'Pet Care']
        }
      }
    } catch (_) {}
    return {
      name: 'Provider Partner',
      email: 'provider@gmail.com',
      mobile: '0771234567',
      nicNumber: '199512345678',
      address: 'No. 42, Marina Boulevard, Colombo 03',
      services: ['Auto Care', 'Garden Care', 'Pet Care']
    }
  })

  const getFormattedNameFromEmailOrName = (name, email) => {
    if (name && name !== 'Provider Partner' && name !== 'Member') return name
    if (email) {
      const rawPrefix = email.split('@')[0]
      const formatted = rawPrefix
        .replace(/[._-]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
      if (formatted) return formatted
    }
    return 'Provider Partner'
  }

  const providerFullName = getFormattedNameFromEmailOrName(currentProvider.name, currentProvider.email)

  const [showProfileDrawer, setShowProfileDrawer] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editProfileForm, setEditProfileForm] = useState({
    name: '',
    mobile: '',
    nicNumber: '',
    address: ''
  })

  const openProfileDrawer = () => {
    setEditProfileForm({
      name: providerFullName,
      mobile: currentProvider.mobile || '0771234567',
      nicNumber: currentProvider.nicNumber || '199512345678',
      address: currentProvider.address || 'No. 42, Marina Boulevard, Colombo 03'
    })
    setIsEditingProfile(false)
    setShowProfileDrawer(true)
  }

  const handleSaveProfile = (e) => {
    e.preventDefault()
    if (editProfileForm.mobile.length !== 10) {
      alert('Mobile number must be exactly 10 digits.')
      return
    }
    if (editProfileForm.nicNumber.length > 12) {
      alert('NIC number cannot exceed 12 characters.')
      return
    }
    const updated = {
      ...currentProvider,
      name: editProfileForm.name,
      mobile: editProfileForm.mobile,
      nicNumber: editProfileForm.nicNumber,
      address: editProfileForm.address
    }
    setCurrentProvider(updated)
    sessionStorage.setItem('user', JSON.stringify(updated))
    localStorage.setItem('user_' + (updated.email || 'guest'), JSON.stringify(updated))
    setIsEditingProfile(false)
  }

  const [settingsForm, setSettingsForm] = useState({
    name: currentProvider.name || 'Provider Partner',
    mobile: currentProvider.mobile || '0771234567',
       town: currentProvider.serviceTowns || currentProvider.town || currentProvider.city || 'Colombo 03',
    services: Array.isArray(currentProvider.services) 
      ? currentProvider.services 
      : (typeof currentProvider.services === 'string' ? currentProvider.services.split(', ').filter(Boolean) : ['Auto Care', 'Garden Care', 'Pet Care'])
  })
  const [verificationStatus, setVerificationStatus] = useState(() => currentProvider.verificationStatus || 'VERIFIED PROVIDER ✓')

  useEffect(() => {
    setSettingsForm({
      name: currentProvider.name || 'Provider Partner',
      mobile: currentProvider.mobile || '0771234567',
       town: currentProvider.serviceTowns || currentProvider.town || currentProvider.city || 'Colombo 03',
      services: Array.isArray(currentProvider.services) 
        ? currentProvider.services 
        : (typeof currentProvider.services === 'string' ? currentProvider.services.split(', ').filter(Boolean) : ['Auto Care', 'Garden Care', 'Pet Care'])
    })
  }, [currentProvider])

  const toggleSettingService = (srv) => {
    setSettingsForm(prev => {
      const exists = prev.services.includes(srv)
      const nextServices = exists 
        ? prev.services.filter(s => s !== srv)
        : [...prev.services, srv]
      return { ...prev, services: nextServices }
    })
  }

  const handleSubmitToVerify = async (e) => {
    e.preventDefault()
    let digits = settingsForm.mobile.replace(/\D/g, '')
    if (digits.length !== 10 && digits.length !== 9) {
      alert('Please enter a valid 10-digit mobile number (e.g. 0771234567).')
      return
    }
    if (settingsForm.services.length === 0) {
      alert('Please select at least one service served.')
      return
    }

    const token = sessionStorage.getItem('token')
    if (token && token !== 'demo-token') {
      try {
        await apiRequest('/provider/service-towns', 'PUT', { service_towns: settingsForm.town }, token)
      } catch (error) {
        alert(error.message || 'Could not save service towns.')
        return
      }
    }

    const updated = {
      ...currentProvider,
      name: settingsForm.name,
      mobile: settingsForm.mobile,
      town: settingsForm.town,
      serviceTowns: settingsForm.town,
      city: settingsForm.town,
      services: settingsForm.services,
      verificationStatus: 'UPDATED & VERIFIED ✓'
    }
    setCurrentProvider(updated)
    localStorage.setItem('luxora_provider_' + currentProvider.email, JSON.stringify(updated))
    setVerificationStatus('UPDATED & VERIFIED ✓')
    alert('Settings & profile credentials updated successfully!')
  }

  const [selectedCalendarDay, setSelectedCalendarDay] = useState(16)
  const [bookingFilter, setBookingFilter] = useState('ALL')

  useEffect(() => {
    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token') return
    apiRequest('/bookings/assigned', 'GET', null, token).then((rows) => {
      setBookingsList(rows.map((booking) => {
        const date = new Date(`${booking.bookingDate}T00:00:00`)
        return {
          apiId: booking.id,
          month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
          day: String(date.getDate()),
          title: booking.service_title || 'Service booking',
          sub: `${booking.customer_name || 'Customer'}${booking.town ? ` • ${booking.town}` : ''}`,
          status: booking.status.toUpperCase(),
          color: booking.status === 'pending' ? '#eab308' : '#4ade80',
          bookingDate: booking.bookingDate,
          bookingTime: booking.bookingTime,
        }
      }))
    }).catch((error) => console.warn('Could not load provider bookings.', error))
  }, [])

  const handleClaimBooking = async (booking) => {
    const token = sessionStorage.getItem('token')
    if (!token || !booking.apiId) return
    try {
      await apiRequest(`/bookings/${booking.apiId}/status`, 'PUT', { status: 'assigned' }, token)
      setBookingsList((items) => items.map((item) => item.apiId === booking.apiId ? { ...item, status: 'ASSIGNED', color: '#4ade80' } : item))
    } catch (error) {
      alert(error.message || 'Could not claim booking.')
    }
  }

  const handleServiceStatus = async (booking, status) => {
    const token = sessionStorage.getItem('token')
    const pin = window.prompt(status === 'in_progress' ? 'Enter the customer start PIN:' : 'Enter the customer completion PIN:')
    if (pin === null || !pin.trim()) return
    try {
      await apiRequest(`/bookings/${booking.apiId}/status`, 'PUT', { status, pin_code: pin.trim() }, token)
      setBookingsList((items) => items.map((item) => item.apiId === booking.apiId ? { ...item, status: status.toUpperCase(), color: status === 'completed' ? '#4ade80' : '#60a5fa' } : item))
    } catch (error) {
      alert(error.message || 'Could not update the booking status.')
    }
  }

  const handleBookingClick = (dayStr) => {
    const d = parseInt(dayStr, 10)
    if (!isNaN(d)) {
      setSelectedCalendarDay(d)
      const el = document.getElementById('cal-widget')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  const [bookingsList, setBookingsList] = useState([
    {
      month: 'AUG',
      day: '16',
      title: 'Auto Care – Vehicle Detailing & Health Audit',
      sub: 'Full Interior Detailing & Engine Diagnostics • Member Villa',
      status: 'CONFIRMED',
      color: '#C9A84C',
    },
    {
      month: 'AUG',
      day: '19',
      title: 'Garden Care – Landscaping & Flora Maintenance',
      sub: 'Courtyard Lawn Trimming & Hydroponic Care • Estate Residence',
      status: 'PENDING',
      color: '#eab308',
    },
    {
      month: 'AUG',
      day: '22',
      title: 'Pet Care – Grooming & Veterinary Wellness',
      sub: 'Full Dog Spa & Annual Vaccine Check • Colombo Residence',
      status: 'CONFIRMED',
      color: '#C9A84C',
    },
    {
      month: 'AUG',
      day: '25',
      title: 'Full Home Suite (Combo: Auto + Garden + Pet)',
      sub: 'All-Inclusive Estate Maintenance Package • Luxury Penthouse',
      status: 'CONFIRMED',
      color: '#C9A84C',
    },
  ])

  const [customRequests, setCustomRequests] = useState([
    {
      id: 'CR-104',
      client: 'Lady Eleanor Vance',
      service: 'Custom Garden Landscaping & Exotic Flora Care',
      date: 'AUG 18, 2026',
      notes: 'Requesting specialized organic fertilizer application and Japanese bonsai pruning for private courtyard.',
      budget: 'Rs. 45,000',
      status: 'NEW REQUEST',
      timeAgo: '10 MINS AGO'
    },
    {
      id: 'CR-105',
      client: 'Sir Arthur Pendelton',
      service: 'Luxury Fleet Detailing & Ceramic Coating',
      date: 'AUG 20, 2026',
      notes: 'Urgent ceramic hydrophobic coating for Rolls Royce Phantom before international gala.',
      budget: 'Rs. 85,000',
      status: 'PENDING REVIEW',
      timeAgo: '1 HOUR AGO'
    }
  ])

  const [notificationsList, setNotificationsList] = useState(NOTIFICATIONS)
  const [showNotifModal, setShowNotifModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const handleAcceptRequest = (id) => {
    const reqToAccept = customRequests.find(r => r.id === id)
    setCustomRequests(prev => prev.map(cr => cr.id === id ? { ...cr, status: 'ACCEPTED ✓' } : cr))

    if (reqToAccept) {
      const dateMatch = reqToAccept.date.match(/(\d+)/)
      const dayStr = dateMatch ? dateMatch[1] : '18'
      const dayNum = parseInt(dayStr, 10)

      const newBooking = {
        month: 'AUG',
        day: dayStr,
        title: reqToAccept.service,
        sub: `Custom Request (${reqToAccept.client}) • ${reqToAccept.budget}`,
        status: 'CONFIRMED',
        color: '#C9A84C'
      }

      setBookingsList(prev => {
        const filtered = prev.filter(b => b.day !== dayStr)
        return [...filtered, newBooking].sort((a, b) => parseInt(a.day, 10) - parseInt(b.day, 10))
      })

      // Auto-add Confirmation Notification
      const newNotif = {
        icon: '📅',
        title: 'New Booking Added & Confirmed',
        body: `Accepted request for ${reqToAccept.service} (${reqToAccept.client}) scheduled on Aug ${dayStr}.`,
        time: 'JUST NOW'
      }
      setNotificationsList(prev => [newNotif, ...prev])

      setSelectedCalendarDay(dayNum)

      setTimeout(() => {
        const el = document.getElementById('cal-widget')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 150)
    }
  }

  const [selectedDetailsBooking, setSelectedDetailsBooking] = useState(null)
  const [bookingToCancel, setBookingToCancel] = useState(null)

  const handleDeclineRequest = (id) => {
    const reqToDecline = customRequests.find(r => r.id === id)
    setCustomRequests(prev => prev.map(cr => cr.id === id ? { ...cr, status: 'DECLINED' } : cr))
    if (reqToDecline) {
      const declineNotif = {
        icon: '❌',
        title: 'Request Declined',
        body: `Custom request for ${reqToDecline.service} (${reqToDecline.client}) was declined.`,
        time: 'JUST NOW'
      }
      setNotificationsList(prev => [declineNotif, ...prev])
    }
  }

  const handleCancelBooking = (bookingObj) => {
    setBookingToCancel(bookingObj)
  }

  const handleConfirmCancel = () => {
    if (bookingToCancel) {
      setBookingsList(prev => prev.map(b => b.day === bookingToCancel.day ? { ...b, status: 'CANCELLED', color: '#ef4444' } : b))

      // Auto-add Cancellation Notification
      const cancelNotif = {
        icon: '⚠️',
        title: 'Booking Cancelled',
        body: `Appointment for ${bookingToCancel.title} (Aug ${bookingToCancel.day}) has been cancelled.`,
        time: 'JUST NOW'
      }
      setNotificationsList(prev => [cancelNotif, ...prev])

      setBookingToCancel(null)
    }
  }

  const handleNavClick = (navId) => {
    setActiveNav(navId)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('isProviderLoggedIn')
    sessionStorage.removeItem('user')
    navigate('/login')
  }

  const filteredBookings = bookingsList.filter(b => {
    if (bookingFilter === 'ALL') return true
    return b.status === bookingFilter
  })

  return (
    <div className="pd">
      {/* ── Sidebar ── */}
      <aside className="pd-sidebar">
        <div className="pd-sidebar__logo">
          <img src="/luxora-logo.png" alt="LUXORA" className="pd-sidebar__logo-img" />
          <span className="pd-sidebar__tier">ELITE MEMBER</span>
        </div>

        <nav className="pd-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              id={`pd-nav-${item.id}`}
              className={`pd-nav__item ${activeNav === item.id ? 'pd-nav__item--active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <span className="pd-nav__icon">{item.icon}</span>
              <span className="pd-nav__label">{item.label}</span>
              {activeNav === item.id && <div className="pd-nav__bar" />}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="pd-main">
        {/* Top Bar */}
        <header className="pd-topbar">
          <div className="pd-topbar__search">
            <SearchIcon />
            <input
              id="pd-search"
              type="text"
              placeholder="Search services, bookings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pd-topbar__input"
            />
          </div>

          <div className="pd-topbar__actions">
            {/* Account Profile Pill */}
            <button
              type="button"
              className="pd-topbar__account-pill"
              id="pd-topbar-profile"
              title="Click to view Provider Profile"
              onClick={openProfileDrawer}
            >
              <div className="pd-topbar__avatar"><UserIcon /></div>
              <div className="pd-topbar__user-info">
                <span className="pd-topbar__user-name">{providerFullName}</span>
                <span className="pd-topbar__user-badge">ELITE PROVIDER</span>
              </div>
            </button>

            <button
              className="pd-topbar__icon-btn"
              id="pd-notif-btn"
              aria-label="Notifications"
              title="Click to view Notifications"
              onClick={() => setShowNotifModal(true)}
              style={{ position: 'relative' }}
            >
              <BellIcon />
              {notificationsList.filter(n => !n.isRead).length > 0 && (
                <span className="pd-topbar__badge">{notificationsList.filter(n => !n.isRead).length}</span>
              )}
            </button>

            <button
              className="pd-topbar__icon-btn"
              id="pd-settings-btn"
              aria-label="Settings"
              title="Click to view Settings"
              onClick={() => setShowSettingsModal(true)}
            >
              <GearIcon />
            </button>



            <button className="pd-topbar__icon-btn" id="pd-logout-btn" aria-label="Log out" title="Log out"
              onClick={handleLogout}>
              <LogOutIcon />
            </button>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="pd-content">
          {activeNav === 'bookings' ? (
            <div className="pd-all-bookings-view" style={{ gridColumn: '1 / -1' }}>
              <div className="pd-section-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <span className="pd-greeting__label">SCHEDULE & APPOINTMENTS</span>
                  <h1 className="pd-section-title" style={{ fontSize: '1.6rem' }}>All Provider Bookings</h1>
                </div>
                <button className="pd-section-link" onClick={() => setActiveNav('overview')}>← Back to Overview</button>
              </div>

              {/* Filter Chips */}
              <div className="pd-bookings-filter-bar">
                <button
                  type="button"
                  className={`pd-filter-btn ${bookingFilter === 'ALL' ? 'pd-filter-btn--active' : ''}`}
                  onClick={() => setBookingFilter('ALL')}
                >
                  ALL BOOKINGS ({bookingsList.length})
                </button>
                <button
                  type="button"
                  className={`pd-filter-btn ${bookingFilter === 'CONFIRMED' ? 'pd-filter-btn--active' : ''}`}
                  onClick={() => setBookingFilter('CONFIRMED')}
                >
                  CONFIRMED ({bookingsList.filter(b => b.status === 'CONFIRMED').length})
                </button>
                <button
                  type="button"
                  className={`pd-filter-btn ${bookingFilter === 'PENDING' ? 'pd-filter-btn--active' : ''}`}
                  onClick={() => setBookingFilter('PENDING')}
                >
                  PENDING ({bookingsList.filter(b => b.status === 'PENDING').length})
                </button>
              </div>

              {/* All Bookings Grid */}
              <div className="pd-all-bookings-grid">
                {filteredBookings.map((b, i) => (
                  <div key={i} className="pd-all-booking-card">
                    <div className="pd-all-booking-header">
                      <div className="pd-booking__date">
                        <span className="pd-booking__month">{b.month}</span>
                        <span className="pd-booking__day">{b.day}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 className="pd-all-booking-title">{b.title}</h3>
                        <p className="pd-all-booking-sub">{b.sub}</p>
                      </div>
                      <span className="pd-booking__status" style={{ borderColor: b.color, color: b.color }}>
                        {b.status}
                      </span>
                    </div>

                    <div className="pd-all-booking-actions">
                      <button
                        type="button"
                        className="pd-cr-btn-accept"
                        onClick={() => {
                          setActiveNav('overview')
                          handleBookingClick(b.day)
                        }}
                      >
                        VIEW ON CALENDAR 📅
                      </button>
                      <button
                        type="button"
                        className="pd-cr-btn-decline"
                        onClick={() => setSelectedDetailsBooking(b)}
                      >
                        VIEW DETAILS
                      </button>
                      {b.status === 'PENDING' && b.apiId && (
                        <button
                          type="button"
                          className="pd-cr-btn-accept"
                          onClick={() => handleClaimBooking(b)}
                        >
                          CLAIM BOOKING
                        </button>
                      )}
                      {b.status === 'ASSIGNED' && b.apiId && (
                        <button type="button" className="pd-cr-btn-accept" onClick={() => handleServiceStatus(b, 'in_progress')}>START WITH PIN</button>
                      )}
                      {b.status === 'IN_PROGRESS' && b.apiId && (
                        <button type="button" className="pd-cr-btn-accept" onClick={() => handleServiceStatus(b, 'completed')}>COMPLETE WITH PIN</button>
                      )}
                      {b.status !== 'CANCELLED' ? (
                        <button
                          type="button"
                          id={`pd-cancel-booking-all-${b.day}`}
                          className="pd-cr-btn-decline pd-btn-cancel-red"
                          onClick={() => handleCancelBooking(b)}
                        >
                          CANCEL BOOKING
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#888', fontStyle: 'italic', padding: '0.4rem 0.8rem', border: '1px solid #333', borderRadius: '6px' }}>
                          CANCELLED
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Left Panel */}
              <div className="pd-panel-left">
                {/* Greeting */}
                <div className="pd-greeting">
                  <div>
                    <p className="pd-greeting__label">DASHBOARD OVERVIEW</p>
                    <h1 className="pd-greeting__title">Welcome back, <span style={{ color: 'var(--gold)' }}>{providerFullName}</span>.</h1>
                  </div>
                </div>

                {/* Stats */}
                <div className="pd-stats">
                  {(() => {
                    const confirmedList = bookingsList.filter(b => b.status === 'CONFIRMED')
                    const nextServiceStr = confirmedList.length > 0 ? `2026.08.${confirmedList[0].day}` : '2026.08.16'
                    return [
                      { label: 'ACTIVE BOOKINGS', value: String(confirmedList.length), accent: false },
                      { label: 'TOTAL EARNING',   value: 'Rs. 125,000', accent: true  },
                      { label: 'NEXT SERVICE',    value: nextServiceStr, accent: false },
                    ]
                  })().map((s) => (
                    <div key={s.label} className="pd-stat">
                      <p className="pd-stat__label">{s.label}</p>
                      <p className={`pd-stat__value ${s.accent ? 'pd-stat__value--gold' : ''}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Upcoming Bookings */}
                <div className="pd-section-header">
                  <h2 className="pd-section-title">Upcoming Bookings</h2>
                  <button className="pd-section-link" id="pd-view-archive-btn" onClick={() => setActiveNav('bookings')}>
                    View All
                  </button>
                </div>
                <div className="pd-bookings">
                  {bookingsList.filter(b => b.status !== 'CANCELLED').map((b, i) => {
                    const dayNum = parseInt(b.day, 10)
                    const isSelected = selectedCalendarDay === dayNum
                    return (
                      <div
                        key={i}
                        className={`pd-booking ${isSelected ? 'pd-booking--selected' : ''}`}
                        id={`pd-booking-${i}`}
                        style={{
                          cursor: 'pointer',
                          borderLeft: isSelected ? `3px solid ${b.color}` : '1px solid #222',
                          background: isSelected ? 'rgba(201, 168, 76, 0.08)' : 'rgba(20, 20, 20, 0.5)',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => handleBookingClick(b.day)}
                      >
                        <div className="pd-booking__date">
                          <span className="pd-booking__month">{b.month}</span>
                          <span className="pd-booking__day">{b.day}</span>
                        </div>
                        <div className="pd-booking__info">
                          <p className="pd-booking__title">{b.title}</p>
                          <p className="pd-booking__sub">{b.sub}</p>
                        </div>
                        <span className="pd-booking__status" style={{ borderColor: b.color, color: b.color }}>
                          {b.status}
                        </span>
                        <button className="pd-booking__dots" aria-label="More options"><DotsIcon /></button>
                      </div>
                    )
                  })}
                </div>

                {/* Custom Requests */}
                <div className="pd-section-header" style={{ marginTop: '2.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h2 className="pd-section-title">Custom Requests</h2>
                    <span className="pd-badge-gold">CLIENT SPECIFIC</span>
                  </div>
                  <button className="pd-section-link" id="pd-custom-req-link">All Requests ({customRequests.length}) →</button>
                </div>
                <div className="pd-custom-requests">
                  {customRequests.map((cr) => (
                    <div key={cr.id} className="pd-cr-card" id={`pd-cr-${cr.id}`}>
                      <div className="pd-cr-header">
                        <div>
                          <span className="pd-cr-client">👤 {cr.client}</span>
                          <h3 className="pd-cr-service">{cr.service}</h3>
                        </div>
                        <span className={`pd-cr-status ${cr.status === 'ACCEPTED ✓' ? 'pd-cr-status--accepted' : cr.status === 'DECLINED' ? 'pd-cr-status--declined' : 'pd-cr-status--new'}`}>
                          {cr.status}
                        </span>
                      </div>

                      <p className="pd-cr-notes">"{cr.notes}"</p>

                      <div className="pd-cr-footer">
                        <div className="pd-cr-meta">
                          <span>📅 {cr.date}</span>
                          <span className="pd-cr-budget">💰 {cr.budget}</span>
                          <small className="pd-cr-time">{cr.timeAgo}</small>
                        </div>

                        {cr.status !== 'ACCEPTED ✓' && cr.status !== 'DECLINED' ? (
                          <div className="pd-cr-actions">
                            <button type="button" className="pd-cr-btn-accept" onClick={() => handleAcceptRequest(cr.id)}>
                              ACCEPT REQUEST
                            </button>
                            <button type="button" className="pd-cr-btn-decline" onClick={() => handleDeclineRequest(cr.id)}>
                              DECLINE
                            </button>
                          </div>
                        ) : (
                          <div className="pd-cr-confirmed" style={{ color: cr.status === 'ACCEPTED ✓' ? '#C9A84C' : '#ef4444' }}>
                            {cr.status === 'ACCEPTED ✓' ? '✓ Request Confirmed & Scheduled' : '✕ Request Declined'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Panel */}
              <div className="pd-panel-right">
                {/* Calendar */}
                <div className="pd-widget">
                  <Calendar bookings={bookingsList.filter(b => b.status !== 'CANCELLED')} selectedDay={selectedCalendarDay} onSelectDay={setSelectedCalendarDay} />
                </div>


              </div>
            </>
          )}
        </div>
      </div>

      {/* ── VIEW APPOINTMENT DETAILS POPUP MODAL ── */}
      {selectedDetailsBooking && (
        <div className="pd-drawer-overlay" onClick={() => setSelectedDetailsBooking(null)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pd-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>📅</span>
                <div>
                  <h3 className="pd-modal__title">{selectedDetailsBooking.title}</h3>
                  <span className="pd-modal__subtitle">APPOINTMENT SPECIFICATIONS</span>
                </div>
              </div>
              <button type="button" className="pd-drawer__close" onClick={() => setSelectedDetailsBooking(null)}>✕</button>
            </div>

            <div className="pd-modal__body">
              <div className="pd-profile-field">
                <label>SCHEDULED DATE & MONTH</label>
                <p style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{selectedDetailsBooking.month} {selectedDetailsBooking.day}, 2026</p>
              </div>

              <div className="pd-profile-field">
                <label>SERVICE SUMMARY & LOCATION</label>
                <p>{selectedDetailsBooking.sub}</p>
              </div>

              <div className="pd-profile-field">
                <label>BOOKING STATUS</label>
                <span className="pd-booking__status" style={{ borderColor: selectedDetailsBooking.color, color: selectedDetailsBooking.color, display: 'inline-block', marginTop: '0.25rem' }}>
                  {selectedDetailsBooking.status}
                </span>
              </div>

              <div className="pd-profile-field">
                <label>SPECIAL INSTRUCTIONS</label>
                <p style={{ fontStyle: 'italic', color: '#aaa' }}>
                  Member requests white-glove service standards, punctual arrival, and advance call 15 minutes prior to site access.
                </p>
              </div>
            </div>

            <div className="pd-modal__footer">
              <button type="button" className="pd-modal-btn-close" onClick={() => setSelectedDetailsBooking(null)}>
                CLOSE WINDOW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCEL BOOKING CONFIRMATION POPUP MODAL ── */}
      {bookingToCancel && (
        <div className="pd-drawer-overlay" onClick={() => setBookingToCancel(null)}>
          <div className="pd-modal pd-modal--danger" onClick={(e) => e.stopPropagation()}>
            <div className="pd-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <div>
                  <h3 className="pd-modal__title" style={{ color: '#ef4444' }}>CANCEL APPOINTMENT</h3>
                  <span className="pd-modal__subtitle">CONFIRM CANCELLATION</span>
                </div>
              </div>
              <button type="button" className="pd-drawer__close" onClick={() => setBookingToCancel(null)}>✕</button>
            </div>

            <div className="pd-modal__body">
              <p style={{ fontSize: '0.92rem', color: '#e0e0e0', marginBottom: '0.5rem', lineHeight: '1.5' }}>
                Are you sure you want to cancel this booking appointment? This action will notify the client and update your schedule.
              </p>

              <div className="pd-modal-cancel-preview">
                <h4 style={{ color: '#fff', fontSize: '0.95rem', margin: '0 0 0.35rem 0' }}>{bookingToCancel.title}</h4>
                <p style={{ color: '#aaa', fontSize: '0.8rem', margin: 0 }}>📅 {bookingToCancel.month} {bookingToCancel.day}, 2026 • {bookingToCancel.sub}</p>
              </div>
            </div>

            <div className="pd-modal__footer">
              <button type="button" className="pd-modal-btn-secondary" onClick={() => setBookingToCancel(null)}>
                KEEP BOOKING
              </button>
              <button type="button" className="pd-modal-btn-danger" onClick={handleConfirmCancel}>
                CONFIRM CANCELLATION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROVIDER PROFILE SLIDE DRAWER ── */}
      {showProfileDrawer && (
        <div className="pd-drawer-overlay" onClick={() => setShowProfileDrawer(false)}>
          <div className="pd-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="pd-drawer__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="pd-drawer__avatar"><UserIcon /></div>
                <div>
                  <h3 className="pd-drawer__title">{providerFullName}</h3>
                  <span className="pd-drawer__badge">VERIFIED PROVIDER</span>
                </div>
              </div>
              <button type="button" className="pd-drawer__close" onClick={() => setShowProfileDrawer(false)}>✕</button>
            </div>

            <div className="pd-drawer__body">
              <div className="pd-profile-field">
                <label>FULL NAME</label>
                <p>{providerFullName}</p>
              </div>

              <div className="pd-profile-field">
                <label>EMAIL ADDRESS</label>
                <p>{currentProvider.email}</p>
              </div>

              <div className="pd-profile-field">
                <label>MOBILE NUMBER</label>
                <p>{formatMobileNumber(currentProvider.mobile || currentProvider.phone || '0771234567')}</p>
              </div>

              <div className="pd-profile-field">
                <label>NIC NUMBER</label>
                <p>{currentProvider.nicNumber || '199512345678'}</p>
              </div>

              <div className="pd-profile-field">
                <label>FULL BUSINESS ADDRESS</label>
                <p>{currentProvider.address || 'No. 42, Marina Boulevard, Colombo 03'}</p>
              </div>

              <div className="pd-profile-field">
                <label>SERVICES OFFERED</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  <span className="pd-service-chip">🚗 Auto Care</span>
                  <span className="pd-service-chip">🌿 Garden Care</span>
                  <span className="pd-service-chip">🐾 Pet Care</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS POPUP MODAL ── */}
      {showNotifModal && (
        <div className="pd-drawer-overlay" onClick={() => setShowNotifModal(false)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid #222', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🔔</span>
                <h3 style={{ color: 'var(--gold)', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Provider Notifications</h3>
              </div>
              <button onClick={() => setShowNotifModal(false)} style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>

            {/* Action Buttons: Mark as Read All & Clear All */}
            {notificationsList.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginBottom: '0.85rem' }}>
                <button
                  onClick={() => setNotificationsList(prev => prev.map(n => ({ ...n, isRead: true })))}
                  style={{ background: 'rgba(201, 168, 76, 0.12)', border: '1px solid var(--gold, #c9a84c)', color: 'var(--gold, #c9a84c)', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  ✓ Mark as Read All
                </button>
                <button
                  onClick={() => setNotificationsList([])}
                  style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  🗑️ Clear All
                </button>
              </div>
            )}

            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notificationsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#888', fontSize: '0.88rem' }}>
                  No notifications at this time.
                </div>
              ) : (
                notificationsList.map((n, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setNotificationsList(prev => prev.map((item, idx) => idx === i ? { ...item, isRead: true } : item))
                    }}
                    style={{
                      background: n.isRead ? '#0e0e11' : '#141414',
                      border: n.isRead ? '1px solid #202020' : '1px solid rgba(201, 168, 76, 0.3)',
                      opacity: n.isRead ? 0.7 : 1,
                      borderRadius: '10px',
                      padding: '0.95rem',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: n.isRead ? '#1a1a1a' : 'rgba(201, 168, 76, 0.15)', color: n.isRead ? '#888' : 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {n.icon || '🔔'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}>{n.title}</span>
                        {!n.isRead && (
                          <span style={{ background: 'var(--gold)', color: '#000', borderRadius: '50%', width: '7px', height: '7px', display: 'inline-block' }} title="Unread" />
                        )}
                      </div>
                      <p style={{ color: '#aaa', fontSize: '0.8rem', margin: '0.25rem 0' }}>{n.body}</p>
                      <small style={{ color: 'var(--gold)', fontSize: '0.7rem', fontWeight: 600 }}>{n.time}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS & PROFILE VERIFICATION POPUP MODAL ── */}
      {showSettingsModal && (
        <div className="pd-drawer-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #222', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⚙️</span>
                <h3 style={{ color: 'var(--gold)', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Provider Settings &amp; Credentials</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>

            <form onSubmit={(e) => { handleSubmitToVerify(e); setShowSettingsModal(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Display Name */}
              <div className="pd-edit-field">
                <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.3rem', display: 'block' }}>DISPLAY NAME *</label>
                <input
                  type="text"
                  required
                  className="pd-edit-input"
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  placeholder="e.g. Marco Vance"
                />
              </div>

              {/* Mobile Number */}
              <div className="pd-edit-field">
                <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.3rem', display: 'block' }}>MOBILE NUMBER (07XXXXXXXX) *</label>
                <input
                  type="tel"
                  required
                  className="pd-edit-input"
                  value={settingsForm.mobile}
                  onChange={(e) => setSettingsForm({ ...settingsForm, mobile: e.target.value })}
                  placeholder="0771234567"
                />
              </div>

              {/* Town / City */}
              <div className="pd-edit-field">
                <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.3rem', display: 'block' }}>TOWNS SERVED (UP TO 10, COMMA-SEPARATED) *</label>
                <input
                  type="text"
                  required
                  className="pd-edit-input"
                  value={settingsForm.town}
                  onChange={(e) => setSettingsForm({ ...settingsForm, town: e.target.value })}
                  placeholder="e.g. Colombo 03, Kandy, Galle"
                />
              </div>

              {/* Services Served */}
              <div className="pd-edit-field">
                <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.35rem', display: 'block' }}>SERVICES SERVED *</label>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  {['Auto Care', 'Garden Care', 'Pet Care'].map((srv) => {
                    const isSelected = settingsForm.services.includes(srv)
                    return (
                      <button
                        key={srv}
                        type="button"
                        onClick={() => toggleSettingService(srv)}
                        style={{
                          background: isSelected ? 'rgba(201, 168, 76, 0.2)' : '#16161a',
                          border: isSelected ? '1px solid var(--gold, #c9a84c)' : '1px solid #333',
                          color: isSelected ? 'var(--gold, #c9a84c)' : '#aaa',
                          padding: '0.5rem 1rem',
                          borderRadius: '20px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}{srv}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  style={{ background: 'transparent', border: '1px solid #444', color: '#ccc', padding: '0.6rem 1.2rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--gold)', border: 'none', color: '#000', padding: '0.6rem 1.4rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  ✓ SAVE SETTINGS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProviderDashboard
