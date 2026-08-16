import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Calendar from '../components/Calendar'
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
  { id: 'notifications', icon: <BellIcon />,   label: 'Notifications' },
  { id: 'settings',      icon: <GearIcon />,   label: 'Settings' },
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
    nicNumber: currentProvider.nicNumber || '199512345678',
    address: currentProvider.address || 'No. 42, Marina Boulevard, Colombo 03'
  })
  const [verificationStatus, setVerificationStatus] = useState(() => currentProvider.verificationStatus || 'VERIFIED PROVIDER ✓')

  useEffect(() => {
    setSettingsForm({
      name: currentProvider.name || 'Provider Partner',
      mobile: currentProvider.mobile || '0771234567',
      nicNumber: currentProvider.nicNumber || '199512345678',
      address: currentProvider.address || 'No. 42, Marina Boulevard, Colombo 03'
    })
  }, [currentProvider])

  const handleSubmitToVerify = (e) => {
    e.preventDefault()
    let digits = settingsForm.mobile.replace(/\D/g, '')
    if (digits.length !== 10 && digits.length !== 9) {
      alert('Please enter a valid 10-digit mobile number (e.g. 0771234567).')
      return
    }
    if (settingsForm.nicNumber.length > 12 || settingsForm.nicNumber.length < 9) {
      alert('Please enter a valid NIC number (e.g. 199512345678).')
      return
    }

    const updated = {
      ...currentProvider,
      name: settingsForm.name,
      mobile: settingsForm.mobile,
      nicNumber: settingsForm.nicNumber,
      address: settingsForm.address,
      verificationStatus: 'SUBMITTED FOR VERIFICATION ⏳'
    }

    setCurrentProvider(updated)
    setVerificationStatus('SUBMITTED FOR VERIFICATION ⏳')
    sessionStorage.setItem('user', JSON.stringify(updated))
    localStorage.setItem('user_' + (updated.email || 'guest'), JSON.stringify(updated))
    alert('Your provider account details have been updated and submitted to verify! ⏳')
  }

  const [selectedCalendarDay, setSelectedCalendarDay] = useState(16)
  const [bookingFilter, setBookingFilter] = useState('ALL')

  const handleBookingClick = (dayStr) => {
    const d = parseInt(dayStr, 10)
    if (!isNaN(d)) {
      setSelectedCalendarDay(d)
      const el = document.getElementById('cal-widget')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  const [bookingsList, setBookingsList] = useState([])
  const [realEarnings, setRealEarnings] = useState(null)

  // PIN verification modal for starting / completing real bookings
  const [pinModal, setPinModal] = useState(null) // { realId, action, title }
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinBusy, setPinBusy] = useState(false)

  const STATUS_STYLE = {
    CONFIRMED: '#C9A84C',
    PENDING: '#eab308',
    IN_PROGRESS: '#38bdf8',
    COMPLETED: '#4ade80',
    CANCELLED: '#f87171',
  }

  // Load real assigned bookings from the backend. Falls back to the
  // demo list when the API is unreachable or returns nothing.
  const loadAssignedBookings = async () => {
    const token = sessionStorage.getItem('token')
    if (!token) return
    try {
      const res = await fetch('/api/bookings/assigned', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) return
      const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
      const mapped = data.map((b) => {
        const dateStr = b.bookingDate || b.booking_date || ''
        const mm = parseInt(dateStr.slice(5, 7), 10)
        const statusMap = { assigned: 'CONFIRMED', pending: 'PENDING', in_progress: 'IN_PROGRESS', completed: 'COMPLETED', cancelled: 'CANCELLED' }
        const uiStatus = statusMap[b.status] || 'PENDING'
        return {
          realId: b.booking_id ?? b.id,
          month: MONTHS[mm - 1] || '—',
          day: dateStr.slice(8, 10) || '—',
          title: b.service_title || b.service?.title || 'Luxora Service',
          sub: `${b.customer_name || 'Customer'} • ${b.bookingTime || b.booking_time || ''}`,
          status: uiStatus,
          color: STATUS_STYLE[uiStatus] || '#eab308',
          customerPhone: b.customer_phone,
        }
      })
      setBookingsList(mapped)
    } catch (_) {}
  }

  useEffect(() => {
    loadAssignedBookings()
    const token = sessionStorage.getItem('token')
    if (token) {
      fetch('/api/provider/earnings', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && typeof d.earnings === 'number') setRealEarnings(d.earnings) })
        .catch(() => {})
    }
  }, [])

  const submitPin = async () => {
    if (!pinModal || pinInput.trim().length !== 4) {
      setPinError('Enter the 4-digit PIN the customer showed you.')
      return
    }
    setPinBusy(true)
    setPinError('')
    try {
      const token = sessionStorage.getItem('token')
      const res = await fetch(`/api/bookings/${pinModal.realId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: pinModal.action, pin_code: pinInput.trim() })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPinError(data.error || 'Verification failed.')
      } else {
        setPinModal(null)
        setPinInput('')
        await loadAssignedBookings()
      }
    } catch (_) {
      setPinError('Network error — try again.')
    }
    setPinBusy(false)
  }

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
              onClick={() => handleNavClick('notifications')}
            >
              <BellIcon />
              <span className="pd-topbar__badge">{notificationsList.length}</span>
            </button>
            <button
              className="pd-topbar__icon-btn"
              id="pd-settings-btn"
              aria-label="Settings"
              title="Click to view Settings"
              onClick={() => handleNavClick('settings')}
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
                      {b.realId && b.status === 'CONFIRMED' && (
                        <button
                          type="button"
                          className="pd-cr-btn-accept"
                          onClick={() => { setPinError(''); setPinInput(''); setPinModal({ realId: b.realId, action: 'in_progress', title: b.title }) }}
                        >
                          START SERVICE 🔑
                        </button>
                      )}
                      {b.realId && b.status === 'IN_PROGRESS' && (
                        <button
                          type="button"
                          className="pd-cr-btn-accept"
                          onClick={() => { setPinError(''); setPinInput(''); setPinModal({ realId: b.realId, action: 'completed', title: b.title }) }}
                        >
                          COMPLETE SERVICE ✅
                        </button>
                      )}
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
          ) : activeNav === 'notifications' ? (
            <div className="pd-all-bookings-view" style={{ gridColumn: '1 / -1' }}>
              <div className="pd-section-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <span className="pd-greeting__label">SYSTEM ALERTS & MESSAGES</span>
                  <h1 className="pd-section-title" style={{ fontSize: '1.6rem' }}>Notifications</h1>
                </div>
                <button className="pd-section-link" onClick={() => setActiveNav('overview')}>← Back to Overview</button>
              </div>

              <div className="pd-notifs" style={{ maxWidth: '800px' }}>
                {notificationsList.map((n, i) => (
                  <div key={i} className="pd-notif" style={{ background: '#141414', padding: '1.25rem', borderRadius: '12px', border: '1px solid #222' }}>
                    <div className="pd-notif__icon" style={{ width: '36px', height: '36px', fontSize: '1rem' }}>{n.icon}</div>
                    <div className="pd-notif__body" style={{ flex: 1 }}>
                      <p className="pd-notif__title" style={{ fontSize: '0.95rem' }}>{n.title}</p>
                      <p className="pd-notif__text" style={{ fontSize: '0.85rem', color: '#aaa', margin: '0.35rem 0' }}>{n.body}</p>
                      <p className="pd-notif__time" style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeNav === 'settings' ? (
            <div className="pd-all-bookings-view" style={{ gridColumn: '1 / -1' }}>
              <div className="pd-section-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <span className="pd-greeting__label">PARTNER ACCOUNT MANAGEMENT</span>
                  <h1 className="pd-section-title" style={{ fontSize: '1.6rem' }}>Provider Settings & Verification</h1>
                </div>
                <button className="pd-section-link" onClick={() => setActiveNav('overview')}>← Back to Overview</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
                {/* Account Details Form / Card */}
                <div style={{ background: '#141414', padding: '1.75rem', borderRadius: '16px', border: '1px solid #222' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 700 }}>Provider Partner Profile</h3>
                      <span style={{ fontSize: '0.72rem', color: '#888' }}>Manage official credentials, address, and verification status</span>
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.4rem 0.85rem',
                      borderRadius: '20px',
                      background: verificationStatus.includes('SUBMITTED') ? 'rgba(234, 179, 8, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                      border: `1px solid ${verificationStatus.includes('SUBMITTED') ? '#eab308' : '#4ade80'}`,
                      color: verificationStatus.includes('SUBMITTED') ? '#eab308' : '#4ade80'
                    }}>
                      {verificationStatus}
                    </span>
                  </div>

                  <form onSubmit={handleSubmitToVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="pd-edit-field">
                      <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.4rem', display: 'block' }}>FULL NAME *</label>
                      <input
                        type="text"
                        required
                        className="pd-edit-input"
                        value={settingsForm.name}
                        onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                        placeholder="e.g. Marco Vance"
                      />
                    </div>

                    <div className="pd-edit-field">
                      <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.4rem', display: 'block' }}>EMAIL ADDRESS (READ ONLY)</label>
                      <input
                        type="email"
                        disabled
                        className="pd-edit-input"
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                        value={currentProvider.email}
                      />
                    </div>

                    <div className="pd-edit-field">
                      <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.4rem', display: 'block' }}>MOBILE NUMBER (07XXXXXXXX) *</label>
                      <input
                        type="tel"
                        required
                        className="pd-edit-input"
                        value={settingsForm.mobile}
                        onChange={(e) => setSettingsForm({ ...settingsForm, mobile: e.target.value })}
                        placeholder="0771234567"
                      />
                      <span style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.25rem', display: 'block' }}>
                        Preview: {formatMobileNumber(settingsForm.mobile)}
                      </span>
                    </div>

                    <div className="pd-edit-field">
                      <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.4rem', display: 'block' }}>NATIONAL IDENTITY CARD (NIC) NUMBER *</label>
                      <input
                        type="text"
                        required
                        className="pd-edit-input"
                        value={settingsForm.nicNumber}
                        onChange={(e) => setSettingsForm({ ...settingsForm, nicNumber: e.target.value })}
                        placeholder="199512345678"
                      />
                    </div>

                    <div className="pd-edit-field">
                      <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.4rem', display: 'block' }}>FULL BUSINESS / RESIDENCE ADDRESS *</label>
                      <input
                        type="text"
                        required
                        className="pd-edit-input"
                        value={settingsForm.address}
                        onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                        placeholder="No. 42, Marina Boulevard, Colombo 03"
                      />
                    </div>

                    <div className="pd-edit-field">
                      <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.4rem', display: 'block' }}>SERVICES OFFERED</label>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="pd-service-chip">🚗 Auto Care & Detailing</span>
                        <span className="pd-service-chip">🌿 Garden Curation & Landscaping</span>
                        <span className="pd-service-chip">🐾 Pet Grooming & Spa</span>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <button
                        type="submit"
                        className="pd-btn-save-edit"
                        style={{ width: '100%', padding: '0.85rem', background: 'var(--gold)', color: '#000', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.05em', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        ✓ SUBMIT TO VERIFY
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right side info panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ background: '#141414', padding: '1.25rem', borderRadius: '14px', border: '1px solid #222' }}>
                    <h4 style={{ color: 'var(--gold)', fontSize: '0.85rem', letterSpacing: '0.08em', margin: '0 0 0.5rem 0' }}>VERIFICATION PROCESS</h4>
                    <p style={{ fontSize: '0.78rem', color: '#aaa', lineHeight: '1.5', margin: 0 }}>
                      Submitting updated NIC, mobile, or address credentials places your account in high-priority review. Standard approval takes less than 2 hours.
                    </p>
                  </div>

                  <div style={{ background: '#141414', padding: '1.25rem', borderRadius: '14px', border: '1px solid #222' }}>
                    <h4 style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>PRIVACY & SECURITY</h4>
                    <p style={{ fontSize: '0.78rem', color: '#aaa', lineHeight: '1.5', margin: 0 }}>
                      Your personal identification numbers are encrypted under 256-bit SSL protocols and shared only with assigned estate managers.
                    </p>
                  </div>
                </div>
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
                    const nextServiceStr = confirmedList.length > 0 ? `2026.08.${confirmedList[0].day}` : '—'
                    return [
                      { label: 'ACTIVE BOOKINGS', value: String(confirmedList.length), accent: false },
                      { label: 'TOTAL EARNING',   value: realEarnings != null ? `Rs. ${realEarnings.toLocaleString()}` : 'Rs. —', accent: true },
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

                {/* Notifications */}
                <div className="pd-widget">
                  <h3 className="pd-widget__title">RECENT NOTIFICATIONS</h3>
                  <div className="pd-notifs">
                    {notificationsList.map((n, i) => (
                      <div key={i} className="pd-notif" id={`pd-notif-${i}`}>
                        <div className="pd-notif__icon">{n.icon}</div>
                        <div className="pd-notif__body">
                          <p className="pd-notif__title">{n.title}</p>
                          <p className="pd-notif__text">{n.body}</p>
                          <p className="pd-notif__time">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── VIEW APPOINTMENT DETAILS POPUP MODAL ── */}
      {pinModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => !pinBusy && setPinModal(null)}
        >
          <div
            style={{ background: '#121212', border: '1px solid rgba(201,168,76,0.4)', borderRadius: '14px', padding: '2rem', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ color: 'var(--gold, #C9A84C)', fontSize: '0.72rem', letterSpacing: '0.22em', fontWeight: 700 }}>
              {pinModal.action === 'in_progress' ? 'START SERVICE — CUSTOMER VERIFICATION' : 'COMPLETE SERVICE — CUSTOMER VERIFICATION'}
            </span>
            <h3 style={{ color: '#fff', margin: '0.6rem 0 1rem', fontSize: '1.15rem' }}>{pinModal.title}</h3>
            <p style={{ color: '#999', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              Ask the customer for their 4-digit verification PIN. It is shown in their dashboard booking table.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              disabled={pinBusy}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') submitPin() }}
              placeholder="••••"
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', color: '#fff', fontSize: '1.8rem', letterSpacing: '0.5em', textAlign: 'center', padding: '0.8rem', outline: 'none', marginBottom: '0.8rem' }}
              autoFocus
            />
            {pinError && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: '0 0 0.8rem' }}>{pinError}</p>}
            <div style={{ display: 'flex', gap: '0.7rem', justifyContent: 'flex-end' }}>
              <button type="button" disabled={pinBusy} onClick={() => setPinModal(null)} style={{ background: 'none', border: '1px solid #333', color: '#aaa', borderRadius: '8px', padding: '0.6rem 1.1rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" disabled={pinBusy} onClick={submitPin} style={{ background: 'var(--gold, #C9A84C)', border: 'none', color: '#000', fontWeight: 800, borderRadius: '8px', padding: '0.6rem 1.3rem', cursor: 'pointer' }}>
                {pinBusy ? 'Verifying…' : 'Verify PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}

export default ProviderDashboard
