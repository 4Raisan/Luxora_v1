import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './CustomerDashboard.css'

/* ── SVG Icons ───────────────────────────────────────── */
const CarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H7c-.7 0-1.3.3-1.8.7C4.3 8.6 3 10 3 10s-2.7.6-4.5 1.1C.7 11.3 0 12.1 0 13v3c0 .6.4 1 1 1h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="7" cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="17" cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

const LeafIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 21a9 9 0 009-9C21 6 15 3 12 3S3 6 3 12a9 9 0 009 9z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 3v18M12 12c4 0 7-3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const PawIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="16" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="7" cy="9" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="17" cy="9" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="4" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="20" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const HelpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const LogOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

const CoinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: '-1px', margin: '0 2px 0 4px' }}>
    <circle cx="12" cy="12" r="9" stroke="var(--gold)" strokeWidth="2.2" fill="rgba(201, 168, 76, 0.2)" />
    <path d="M12 7v10M9 10h6M9 14h6" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

/* ── Mock Data ───────────────────────────────────────── */
const HISTORY_DATA = [
  { id: 1, date: 'Aug 1, 2026', service: 'Auto Care', icon: <CarIcon />, tier: 'Standard ★', ref: 'INV-2026-0081', amount: 'LKR 9,000', status: 'Completed', cat: 'auto' },
  { id: 2, date: 'Jul 15, 2026', service: 'Garden Care', icon: <LeafIcon />, tier: 'Basic', ref: 'INV-2026-0072', amount: 'LKR 7,500', status: 'Completed', cat: 'garden' },
  { id: 3, date: 'Jul 1, 2026', service: 'Auto Care', icon: <CarIcon />, tier: 'Standard ★', ref: 'INV-2026-0071', amount: 'LKR 9,000', status: 'Completed', cat: 'auto' },
  { id: 4, date: 'Jun 20, 2026', service: 'Pet Care', icon: <PawIcon />, tier: 'Premium', ref: 'INV-2026-0063', amount: 'LKR 18,000', status: 'Completed', cat: 'pet' },
  { id: 5, date: 'Jun 1, 2026', service: 'Garden Care', icon: <LeafIcon />, tier: 'Basic', ref: 'INV-2026-0061', amount: 'LKR 7,500', status: 'Completed', cat: 'garden' },
  { id: 6, date: 'May 15, 2026', service: 'Pet Care', icon: <PawIcon />, tier: 'Standard ★', ref: 'INV-2026-0055', amount: 'LKR 11,000', status: 'Completed', cat: 'pet' },
]

const CustomerDashboard = () => {
  const navigate = useNavigate()

  const getUserEmail = () => {
    try {
      const u = sessionStorage.getItem('user')
      if (u) return JSON.parse(u).email || 'tester@gmail.com'
    } catch (_) {}
    return 'tester@gmail.com'
  }

  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'booking' | 'history'
  const [bookingType, setBookingType] = useState('combo') // 'combo' | 'single'
  const [historyFilter, setHistoryFilter] = useState('all') // 'all' | 'auto' | 'garden' | 'pet'
  const [showProfileDrawer, setShowProfileDrawer] = useState(false)

  const [showAddressModal, setShowAddressModal] = useState(false)
  const [addressForm, setAddressForm] = useState({
    street: '',
    city: '',
    district: 'Western'
  })
  const [userAddress, setUserAddress] = useState(() => {
    try {
      const u = sessionStorage.getItem('user')
      const email = u ? JSON.parse(u).email : 'guest'
      const saved = localStorage.getItem('userAddress_' + email) || sessionStorage.getItem('userAddress')
      if (saved) return JSON.parse(saved)
    } catch (_) {}
    return { street: '45 Marine Drive', city: 'Colombo 03', district: 'Western Province' }
  })

  // Dynamic Active Packages & Booking Confirmation State
  const [activePackages, setActivePackages] = useState(() => {
    try {
      const u = sessionStorage.getItem('user')
      const email = u ? JSON.parse(u).email : 'guest'
      const saved = localStorage.getItem('activePackages_' + email) || sessionStorage.getItem('activePackages')
      if (saved) return JSON.parse(saved)
    } catch (_) {}
    return [
      { id: 1, title: 'Auto Care', tier: 'Standard Plan ★', price: 'LKR 9,000', period: '/month', cat: 'auto' },
      { id: 2, title: 'Garden Care', tier: 'Basic Plan', price: 'LKR 7,500', period: '/month', cat: 'garden' }
    ]
  })

  const [selectedPackageToBook, setSelectedPackageToBook] = useState(null)
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState('')

  const calculateServiceTokens = (packages) => {
    let auto = 0
    let garden = 0
    let pet = 0

    packages.forEach((pkg) => {
      const tierLower = (pkg.tier || '').toLowerCase()
      const titleLower = (pkg.title || '').toLowerCase()

      let tokenVal = 1 // default Basic = 1 token
      if (tierLower.includes('standard')) tokenVal = 3
      else if (tierLower.includes('premium')) tokenVal = 6
      else if (tierLower.includes('basic')) tokenVal = 1

      if (titleLower.includes('full home suite')) {
        auto += 3
        garden += 3
        pet += 3
      } else if (titleLower.includes('auto & garden')) {
        auto += 3
        garden += 3
      } else if (titleLower.includes('auto & pet')) {
        auto += 3
        pet += 3
      } else if (titleLower.includes('garden & pet')) {
        garden += 3
        pet += 3
      } else if (pkg.cat === 'auto' || titleLower.includes('auto')) {
        auto += tokenVal
      } else if (pkg.cat === 'garden' || titleLower.includes('garden')) {
        garden += tokenVal
      } else if (pkg.cat === 'pet' || titleLower.includes('pet')) {
        pet += tokenVal
      }
    })

    return { auto, garden, pet }
  }

  const tokens = calculateServiceTokens(activePackages)

  const getRenewalDate = (pkg) => {
    const base = pkg && pkg.purchasedAt ? pkg.purchasedAt : Date.now()
    const expiry = new Date(base + 30 * 24 * 60 * 60 * 1000)
    const yyyy = expiry.getFullYear()
    const mm = String(expiry.getMonth() + 1).padStart(2, '0')
    const dd = String(expiry.getDate()).padStart(2, '0')
    return `${yyyy}.${mm}.${dd}`
  }

  // Manage Active Package & Cancellation State
  const [selectedActivePackageToManage, setSelectedActivePackageToManage] = useState(null)
  const [showCancelConfirmStep, setShowCancelConfirmStep] = useState(false)
  const [bookingBillingType, setBookingBillingType] = useState('auto_renew') // 'auto_renew' | 'one_time'
  const [selectedReceiptItem, setSelectedReceiptItem] = useState(null)

  // Admin Panel Subscription Linkage State
  const [adminSubscriptions, setAdminSubscriptions] = useState(() => {
    try {
      const stored = localStorage.getItem('luxora_subscriptions')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length >= 9) return parsed
      }
    } catch (_) {}
    return [
      {
        id: 'SUB-001',
        title: 'Auto Care - Basic',
        type: 'Single Package',
        cat: 'Auto Care',
        tier: 'Basic',
        visits: '1 visit',
        tokens: 1,
        price: 5000,
        subscribers: 142,
        popular: false,
        inclusives: ['1 visit / month', 'Exterior foam wash & wheel shine', 'Interior vacuuming', '1 Service Token (×1)']
      },
      {
        id: 'SUB-002',
        title: 'Auto Care - Standard ★',
        type: 'Single Package',
        cat: 'Auto Care',
        tier: 'Standard ★',
        visits: '2 visits',
        tokens: 3,
        price: 9000,
        subscribers: 428,
        popular: true,
        inclusives: ['2 visits / month', 'Full vehicle wash & wax', 'Interior deep clean & leather conditioning', '3 Service Tokens (×3)', 'Priority booking slot']
      },
      {
        id: 'SUB-003',
        title: 'Auto Care - Premium',
        type: 'Single Package',
        cat: 'Auto Care',
        tier: 'Premium',
        visits: 'Unlimited',
        tokens: 6,
        price: 15000,
        subscribers: 215,
        popular: false,
        inclusives: ['Unlimited visits / month', 'Ceramic windshield & paint protection', 'Engine bay detailing & tire gloss', '6 Service Tokens (×6)', 'VIP emergency dispatch']
      },
      {
        id: 'SUB-004',
        title: 'Garden Care - Basic',
        type: 'Single Package',
        cat: 'Garden Care',
        tier: 'Basic',
        visits: '1 visit',
        tokens: 1,
        price: 7500,
        subscribers: 98,
        popular: false,
        inclusives: ['1 visit / month', 'Lawn mowing & edging', 'Weed removal & basic pruning', '1 Service Token (×1)']
      },
      {
        id: 'SUB-005',
        title: 'Garden Care - Standard ★',
        type: 'Single Package',
        cat: 'Garden Care',
        tier: 'Standard ★',
        visits: '2 visits',
        tokens: 3,
        price: 14000,
        subscribers: 382,
        popular: true,
        inclusives: ['2 visits / month', 'Precision lawn care & bush sculpting', 'Organic fertilizer & soil treatment', '3 Service Tokens (×3)', 'Seasonal planting advice']
      },
      {
        id: 'SUB-006',
        title: 'Garden Care - Premium',
        type: 'Single Package',
        cat: 'Garden Care',
        tier: 'Premium',
        visits: 'Unlimited',
        tokens: 6,
        price: 25000,
        subscribers: 175,
        popular: false,
        inclusives: ['Unlimited visits / month', 'Full landscape maintenance & irrigation check', 'Pest control & tree pruning', '6 Service Tokens (×6)', 'Dedicated gardener']
      },
      {
        id: 'SUB-007',
        title: 'Pet Care - Basic',
        type: 'Single Package',
        cat: 'Pet Care',
        tier: 'Basic',
        visits: '1 visit',
        tokens: 1,
        price: 6000,
        subscribers: 85,
        popular: false,
        inclusives: ['1 visit / month', 'Basic pet bath & coat brushing', 'Nail trimming & ear cleaning', '1 Service Token (×1)']
      },
      {
        id: 'SUB-008',
        title: 'Pet Care - Standard ★',
        type: 'Single Package',
        cat: 'Pet Care',
        tier: 'Standard ★',
        visits: '2 visits',
        tokens: 3,
        price: 11000,
        subscribers: 290,
        popular: true,
        inclusives: ['2 visits / month', 'Full spa grooming, bath & blow dry', 'Flea & tick preventative treatment', '3 Service Tokens (×3)', 'Annual vet checkup voucher']
      },
      {
        id: 'SUB-009',
        title: 'Pet Care - Premium',
        type: 'Single Package',
        cat: 'Pet Care',
        tier: 'Premium',
        visits: 'Unlimited',
        tokens: 6,
        price: 18000,
        subscribers: 160,
        popular: false,
        inclusives: ['Unlimited visits / month', 'Styling grooming, teeth cleaning & coat shine', '24/7 emergency pet transportation', '6 Service Tokens (×6)', 'Nutritional plan']
      },
      {
        id: 'SUB-010',
        title: 'Combo Package: Dual Auto + Garden Elite',
        type: 'Combo Package',
        cat: 'Auto + Garden',
        price: 24000,
        subscribers: 310,
        inclusives: ['Complete Auto Care & Garden Care features', '15% Bundle savings discount applied', 'Dedicated VIP estate manager']
      },
      {
        id: 'SUB-011',
        title: 'Combo Package: Tri-Combo Luxury Suite',
        type: 'Combo Package',
        cat: 'Auto + Garden + Pet',
        price: 32000,
        subscribers: 282,
        inclusives: ['All Auto, Garden & Pet Care benefits included', '24/7 VIP priority emergency dispatch', 'Free quarterly high-pressure driveway wash']
      }
    ]
  })

  useEffect(() => {
    const syncSubscriptions = () => {
      try {
        const stored = localStorage.getItem('luxora_subscriptions')
        if (stored) {
          setAdminSubscriptions(JSON.parse(stored))
        }
      } catch (_) {}
    }

    syncSubscriptions()
    window.addEventListener('storage', syncSubscriptions)
    window.addEventListener('luxora_subscriptions_updated', syncSubscriptions)
    const interval = setInterval(syncSubscriptions, 1000)
    return () => {
      window.removeEventListener('storage', syncSubscriptions)
      window.removeEventListener('luxora_subscriptions_updated', syncSubscriptions)
      clearInterval(interval)
    }
  }, [activeTab, bookingType])

  // Customer Active Bookings Chart State
  const [showAllActiveBookings, setShowAllActiveBookings] = useState(false)
  const [customerActiveBookings, setCustomerActiveBookings] = useState(() => {
    try {
      const stored = localStorage.getItem('luxora_customer_bookings')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (_) {}
    return [
      { id: 'B-011', service: 'Auto Care', date: '2026-08-17', time: '10:30 AM', pin: '8942', status: 'CONFIRMED', providerName: 'Nimal Silva', providerRole: 'Auto Detailing Lead' },
      { id: 'B-012', service: 'Garden Care', date: '2026-08-17', time: '02:00 PM', pin: '3157', status: 'CONFIRMED', providerName: 'Kamal Perera', providerRole: 'Garden & Turf Specialist' },
      { id: 'B-013', service: 'Pet Care', date: '2026-08-18', time: '11:00 AM', pin: '6409', status: 'CONFIRMED', providerName: 'Sunil Fernando', providerRole: 'Pet Spa Specialist' },
      { id: 'B-014', service: 'Dual Auto + Garden', date: '2026-08-19', time: '09:30 AM', pin: '7281', status: 'CONFIRMED', providerName: 'Marco Vance', providerRole: 'Senior Concierge' }
    ]
  })

  useEffect(() => {
    const syncActiveBookings = () => {
      try {
        const stored = localStorage.getItem('luxora_customer_bookings')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) setCustomerActiveBookings(parsed)
        }
      } catch (_) {}
    }
    syncActiveBookings()
    window.addEventListener('storage', syncActiveBookings)
    window.addEventListener('luxora_bookings_updated', syncActiveBookings)
    const interval = setInterval(syncActiveBookings, 1000)
    return () => {
      window.removeEventListener('storage', syncActiveBookings)
      window.removeEventListener('luxora_bookings_updated', syncActiveBookings)
      clearInterval(interval)
    }
  }, [])

  const checkIsPinUnlocked = (bookingDate, bookingTime) => {
    try {
      if (!bookingDate || !bookingTime) return true
      const now = new Date()
      const [hoursStr, minutesStrAmPm] = bookingTime.split(':')
      if (!minutesStrAmPm) return true
      const [minutesStr, ampm] = minutesStrAmPm.trim().split(' ')
      let hours = parseInt(hoursStr, 10)
      const minutes = parseInt(minutesStr, 10)
      if (ampm === 'PM' && hours < 12) hours += 12
      if (ampm === 'AM' && hours === 12) hours = 0

      const bookingDt = new Date(`${bookingDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
      const diffMs = bookingDt.getTime() - now.getTime()
      const diffMinutes = diffMs / (1000 * 60)

      // PIN unlocks if session is within 30 minutes of booking (or if booking is today/due/past)
      return diffMinutes <= 30
    } catch (_) {
      return true
    }
  }

  // Service Booking State
  const [serviceBookingForm, setServiceBookingForm] = useState({
    packageId: '',
    date: new Date().toISOString().split('T')[0],
    hour: '10',
    minute: '30',
    ampm: 'AM'
  })
  const [serviceBookingConfirmation, setServiceBookingConfirmation] = useState(null)

  const handleConfirmServiceBooking = () => {
    if (!serviceBookingForm.packageId) {
      alert('Please select an active package to book a session.')
      return
    }

    const selectedPkg = activePackages.find(p => String(p.id) === String(serviceBookingForm.packageId))
    if (!selectedPkg) return

    const selectedTimeFormatted = `${serviceBookingForm.hour}:${serviceBookingForm.minute} ${serviceBookingForm.ampm}`
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString()

    const stored = localStorage.getItem('luxora_customer_bookings')
    const existing = stored ? JSON.parse(stored) : []
    const newB = {
      id: `B-${String(existing.length + 11).padStart(3, '0')}`,
      customer: (currentUser && currentUser.name) ? currentUser.name : 'Ashan Perera',
      service: selectedPkg.title,
      status: 'CONFIRMED',
      color: '#4ade80',
      date: serviceBookingForm.date,
      time: selectedTimeFormatted,
      amount: selectedPkg.price || 'LKR 9,000',
      pin: randomPin,
      providerName: 'Nimal Silva',
      providerRole: 'Lead Care Specialist'
    }

    try {
      localStorage.setItem('luxora_customer_bookings', JSON.stringify([newB, ...existing]))
      window.dispatchEvent(new Event('luxora_bookings_updated'))
    } catch (_) {}

    addNotification({
      title: '📅 Service Session Booked',
      message: `Your session for ${selectedPkg.title} has been confirmed for ${serviceBookingForm.date} at ${selectedTimeFormatted}.`,
      category: selectedPkg.cat || 'system'
    })

    addHistoryRecord({
      service: selectedPkg.title,
      tier: 'Service Session',
      amount: selectedPkg.price || 'LKR 9,000',
      status: 'Completed',
      cat: selectedPkg.cat || 'system'
    })

    setServiceBookingConfirmation(newB)
    alert(`🎉 Service Session Confirmed for ${selectedPkg.title} on ${serviceBookingForm.date} at ${selectedTimeFormatted}!`)
  }

  // Custom Request State
  const [showCustomRequestModal, setShowCustomRequestModal] = useState(false)
  const [customRequests, setCustomRequests] = useState(() => {
    const email = getUserEmail()
    try {
      const stored = localStorage.getItem('custom_requests_' + email)
      if (stored) return JSON.parse(stored)
    } catch (_) {}
    return [
      {
        id: 'REQ-001',
        title: 'Specialized Villa Deep Marble Polishing',
        category: 'Home & Estate Care',
        date: '2026-08-20',
        time: '10:00 AM',
        notes: 'High-gloss diamond pad restoration for ground floor living area.',
        status: 'Under Concierge Review'
      }
    ]
  })

  const [customForm, setCustomForm] = useState({ title: '', category: 'Home & Estate Care', date: '', time: '10:00 AM', notes: '' })

  const handleCustomRequestSubmit = (e) => {
    e.preventDefault()
    if (!customForm.title || !customForm.notes) {
      alert('Please fill out Subject Title and Requirements.')
      return
    }

    const email = getUserEmail()
    const newReq = {
      id: `REQ-${String(customRequests.length + 1).padStart(3, '0')}`,
      title: customForm.title,
      category: customForm.category,
      date: customForm.date || new Date().toISOString().split('T')[0],
      time: customForm.time || '10:00 AM',
      notes: customForm.notes,
      status: 'Under Concierge Review'
    }

    const updated = [newReq, ...customRequests]
    setCustomRequests(updated)
    try { localStorage.setItem('custom_requests_' + email, JSON.stringify(updated)) } catch (_) {}

    addHistoryRecord({
      service: `Custom Request: ${customForm.title}`,
      tier: 'Custom Request',
      ref: newReq.id,
      amount: 'Quotation Pending',
      status: 'In Review',
      cat: 'system'
    })

    addNotification({
      title: 'Custom Request Submitted',
      message: `Your request "${customForm.title}" (${newReq.id}) has been submitted to Concierge Desk.`,
      category: 'system'
    })

    alert(`Custom Request "${customForm.title}" submitted successfully! A Luxora Concierge Specialist will contact you shortly.`)
    setShowCustomRequestModal(false)
    setCustomForm({ title: '', category: 'Home & Estate Care', date: '', time: '10:00 AM', notes: '' })
  }

  const handleCancelSubscription = (pkgId) => {
    const u = sessionStorage.getItem('user')
    const email = u ? JSON.parse(u).email : 'guest'

    const cancelledPkg = activePackages.find(p => p.id === pkgId)
    const updated = activePackages.filter(p => p.id !== pkgId)
    setActivePackages(updated)
    localStorage.setItem('activePackages_' + email, JSON.stringify(updated))
    sessionStorage.setItem('activePackages', JSON.stringify(updated))

    if (cancelledPkg) {
      addNotification({
        title: '⚠️ Subscription Cancelled',
        message: `Your ${cancelledPkg.title} (${cancelledPkg.tier || 'Standard'}) subscription has been cancelled. Concierge access remains active until ${getRenewalDate(cancelledPkg)}.`,
        category: cancelledPkg.cat || 'system'
      })

      addHistoryRecord({
        service: cancelledPkg.title,
        tier: `${cancelledPkg.tier || 'Standard Plan'} (Cancelled)`,
        amount: 'LKR 0',
        status: 'Cancelled',
        cat: cancelledPkg.cat || 'system'
      })
    }

    setSelectedActivePackageToManage(null)
    setShowCancelConfirmStep(false)
    setBookingSuccessMsg(`⚠️ Subscription for ${cancelledPkg?.title || 'package'} has been cancelled.`)
    setTimeout(() => setBookingSuccessMsg(''), 3500)
  }

  const handleConfirmBooking = (pkg) => {
    const u = sessionStorage.getItem('user')
    const email = u ? JSON.parse(u).email : 'guest'

    const newPkg = {
      id: Date.now(),
      title: pkg.title,
      tier: pkg.tier || 'Gold Tier',
      price: pkg.price,
      period: bookingBillingType === 'one_time' ? '/30 days' : '/month',
      cat: pkg.cat || 'system',
      purchasedAt: Date.now(),
      billingType: bookingBillingType
    }

    const updated = [...activePackages, newPkg]
    setActivePackages(updated)
    localStorage.setItem('activePackages_' + email, JSON.stringify(updated))
    sessionStorage.setItem('activePackages', JSON.stringify(updated))

    const planLabel = bookingBillingType === 'one_time' ? 'One-Time Pass (30 Days)' : 'Monthly Auto-Renewal'
    addNotification({
      title: bookingBillingType === 'one_time' ? '⚡ One-Time Pass Added' : '🎉 Auto-Renewal Subscribed',
      message: `You have successfully added ${pkg.title} (${pkg.tier || 'Standard'}) as a ${planLabel}. Expiry/Renewal date: ${getRenewalDate(newPkg)}.`,
      category: pkg.cat || 'system'
    })

    addHistoryRecord({
      service: pkg.title,
      tier: `${pkg.tier || 'Standard Plan'} (${bookingBillingType === 'one_time' ? 'One-Time' : 'Auto-renew'})`,
      amount: pkg.price || 'LKR 9,000',
      status: 'Completed',
      cat: pkg.cat || 'system'
    })

    try {
      const stored = localStorage.getItem('luxora_customer_bookings')
      const existing = stored ? JSON.parse(stored) : []
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const realDate = `${yyyy}-${mm}-${dd}`
      const realTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })

      const newB = {
        id: `B-${String(existing.length + 11).padStart(3, '0')}`,
        customer: (currentUser && currentUser.name) ? currentUser.name : 'Ashan Perera',
        service: pkg.title,
        status: 'CONFIRMED',
        color: '#4ade80',
        date: realDate,
        time: realTime,
        amount: pkg.price || 'LKR 12,000'
      }
      localStorage.setItem('luxora_customer_bookings', JSON.stringify([newB, ...existing]))
      window.dispatchEvent(new Event('luxora_bookings_updated'))
    } catch (_) {}

    // Send API booking request if token is present
    const token = sessionStorage.getItem('token')
    if (token) {
      fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          service_id: pkg.service_id || 1,
          booking_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          booking_time: '10:00 AM',
          special_notes: `Subscribed package: ${pkg.title} (${pkg.tier || 'Standard'})`
        })
      }).catch(() => {})
    }

    setSelectedPackageToBook(null)
    setBookingSuccessMsg(`🎉 Successfully subscribed to ${pkg.title}!`)
    setTimeout(() => {
      setBookingSuccessMsg('')
      setActiveTab('overview')
    }, 1500)
  }

  // Support Modal State
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [supportCategory, setSupportCategory] = useState('General Inquiry')
  const [supportMessage, setSupportMessage] = useState('')
  const [supportSentSuccess, setSupportSentSuccess] = useState(false)
  const [supportRefNum, setSupportRefNum] = useState('')

  const handleSendSupportMessage = async (e) => {
    e.preventDefault()
    if (!supportMessage.trim()) return

    const ref = 'SUP-2026-' + Math.floor(1000 + Math.random() * 9000)
    setSupportRefNum(ref)
    setSupportSentSuccess(true)

    const token = sessionStorage.getItem('token')
    if (token) {
      try {
        await fetch('/api/complaints', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            subject: supportCategory,
            description: supportMessage
          })
        })
      } catch (_) {}
    }

    setTimeout(() => {
      setSupportSentSuccess(false)
      setSupportMessage('')
      setShowSupportModal(false)
    }, 2800)
  }



  // Dynamic History Data State
  const [historyData, setHistoryData] = useState(() => {
    const email = getUserEmail()
    const saved = localStorage.getItem('history_' + email)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (_) {}
    }
    const defaultHistory = [
      { id: 1, date: 'Aug 1, 2026', service: 'Auto Care', tier: 'Standard Plan ★', ref: 'INV-2026-0081', amount: 'LKR 9,000', status: 'Completed', cat: 'auto' },
      { id: 2, date: 'Jul 15, 2026', service: 'Garden Care', tier: 'Basic Plan', ref: 'INV-2026-0072', amount: 'LKR 7,500', status: 'Completed', cat: 'garden' },
      { id: 3, date: 'Jul 1, 2026', service: 'Auto Care', tier: 'Standard Plan ★', ref: 'INV-2026-0071', amount: 'LKR 9,000', status: 'Completed', cat: 'auto' },
      { id: 4, date: 'Jun 20, 2026', service: 'Pet Care', tier: 'Premium Plan', ref: 'INV-2026-0063', amount: 'LKR 18,000', status: 'Completed', cat: 'pet' }
    ]
    localStorage.setItem('history_' + email, JSON.stringify(defaultHistory))
    return defaultHistory
  })

  const addHistoryRecord = (rec) => {
    const email = getUserEmail()
    const now = new Date()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
    const randomRef = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`

    const newRecord = {
      id: Date.now(),
      date: dateStr,
      service: rec.service || 'Service Subscription',
      tier: rec.tier || 'Standard',
      ref: rec.ref || randomRef,
      amount: rec.amount || 'LKR 9,000',
      status: rec.status || 'Completed',
      cat: rec.cat || 'system'
    }

    setHistoryData((prev) => {
      const updated = [newRecord, ...prev]
      localStorage.setItem('history_' + email, JSON.stringify(updated))
      return updated
    })
  }

  // Notification Drawer State
  const [showNotifDrawer, setShowNotifDrawer] = useState(false)
  const [notifications, setNotifications] = useState(() => {
    const email = getUserEmail()
    const saved = localStorage.getItem('notifications_' + email)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (_) {}
    }
    const defaultNotifs = [
      {
        id: 1,
        title: 'Booking Confirmed',
        message: 'Your Auto Care Premium session is confirmed for tomorrow at 10:00 AM.',
        time: '10 mins ago',
        unread: true,
        category: 'auto'
      },
      {
        id: 2,
        title: 'Concierge Specialist Assigned',
        message: 'Senior Specialist Kamal Perera has been assigned to your Garden Care package.',
        time: '1 hour ago',
        unread: true,
        category: 'garden'
      }
    ]
    localStorage.setItem('notifications_' + email, JSON.stringify(defaultNotifs))
    return defaultNotifs
  })

  const addNotification = (notif) => {
    const email = getUserEmail()
    const newNotif = {
      id: Date.now(),
      title: notif.title,
      message: notif.message,
      time: 'Just now',
      unread: true,
      category: notif.category || 'system'
    }
    setNotifications((prev) => {
      const updated = [newNotif, ...prev]
      localStorage.setItem('notifications_' + email, JSON.stringify(updated))
      return updated
    })
  }

  const unreadCount = notifications.filter(n => n.unread).length

  const markAllNotifsRead = () => {
    const email = getUserEmail()
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, unread: false }))
      localStorage.setItem('notifications_' + email, JSON.stringify(updated))
      return updated
    })
  }

  const markNotifAsRead = (id) => {
    const email = getUserEmail()
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, unread: false } : n)
      localStorage.setItem('notifications_' + email, JSON.stringify(updated))
      return updated
    })
  }

  const dismissNotification = (id) => {
    const email = getUserEmail()
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id)
      localStorage.setItem('notifications_' + email, JSON.stringify(updated))
      return updated
    })
  }

  // Current User State & LocalStorage Sync
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = sessionStorage.getItem('user')
      if (u) {
        const parsed = JSON.parse(u)
        const saved = localStorage.getItem('user_' + (parsed.email || 'guest'))
        if (saved) return JSON.parse(saved)
        return {
          name: parsed.name || 'Ashan Perera',
          email: parsed.email || 'ashan.perera@gmail.com',
          phone: parsed.phone || '+94 77 234 5678',
          id: parsed.id ? `CUS-2026-0${parsed.id}` : 'CUS-2026-0421'
        }
      }
    } catch (_) {}
    return {
      name: 'Ashan Perera',
      email: 'ashan.perera@gmail.com',
      phone: '+94 77 234 5678',
      id: 'CUS-2026-0421'
    }
  })

  const userKey = currentUser.email || 'guest'

  useEffect(() => {
    const isAuth = sessionStorage.getItem('isCustomerLoggedIn')
    if (isAuth !== 'true') {
      navigate('/login', { replace: true })
      return
    }

    const u = sessionStorage.getItem('user')
    const key = u ? (JSON.parse(u).email || 'guest') : 'guest'

    const isFirstSignup = sessionStorage.getItem('isFirstTimeSignup') === 'true'
    const hasAlreadySetup = localStorage.getItem('hasSetupAddress_' + key) === 'true'

    if (isFirstSignup && !hasAlreadySetup) {
      setShowAddressModal(true)
    }
  }, [navigate])

  const handleSaveAddress = (e) => {
    e.preventDefault()
    if (!addressForm.street || !addressForm.city) return
    const newAddr = {
      street: addressForm.street,
      city: addressForm.city,
      district: addressForm.district || 'Western'
    }
    setUserAddress(newAddr)
    localStorage.setItem('userAddress_' + userKey, JSON.stringify(newAddr))
    localStorage.setItem('hasSetupAddress_' + userKey, 'true')
    sessionStorage.removeItem('isFirstTimeSignup')
    setShowAddressModal(false)
  }

  const isGoldMember = activePackages.some((pkg) => {
    const tierLower = (pkg.tier || '').toLowerCase()
    const titleLower = (pkg.title || '').toLowerCase()
    return tierLower.includes('premium') || titleLower.includes('premium') || titleLower.includes('full home suite')
  })

  const firstName = currentUser.name.trim().split(' ')[0] || 'Ashan'
  const initials = currentUser.name.trim().split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AP'

  const totalTokensSum = (tokens.auto || 0) + (tokens.garden || 0) + (tokens.pet || 0)

  const totalMonthlySpend = activePackages.reduce((sum, pkg) => {
    const num = parseInt((pkg.price || '').replace(/[^0-9]/g, '')) || 0
    return sum + num
  }, 0)

  const filteredHistory = historyFilter === 'all'
    ? historyData
    : historyData.filter((item) => item.cat === historyFilter)

  const totalHistorySpent = historyData.reduce((acc, item) => {
    const num = parseInt((item.amount || '').replace(/[^0-9]/g, '')) || 0
    return acc + num
  }, 0)

  const formattedTotalSpent = `LKR ${totalHistorySpent.toLocaleString()}`
  const avgPerMonth = `LKR ${Math.round(totalHistorySpent / Math.max(1, historyData.length)).toLocaleString()}`

  const handleLogout = () => {
    sessionStorage.removeItem('isCustomerLoggedIn')
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="cd-page">
      {/* ── Top Header ── */}
      <header className="cd-header">
        <div className="cd-header__inner">
          <div className="cd-header__left">
            <Link to="/" className="cd-logo-link">
              <img src="/luxora-logo.png" alt="LUXORA" className="cd-logo-img" />
            </Link>
            <span className="cd-portal-badge">CUSTOMER PORTAL</span>
          </div>

          {/* Top Nav Tabs */}
          <nav className="cd-nav">
            <button
              className={`cd-nav__tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Booking
            </button>
            <button
              className={`cd-nav__tab ${activeTab === 'booking' ? 'active' : ''}`}
              onClick={() => setActiveTab('booking')}
            >
              Subscription Plans
            </button>
            <button
              className={`cd-nav__tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
          </nav>

          {/* Header Right Actions */}
          <div className="cd-header__right">
            {/* Notification Bell */}
            <button
              className="cd-btn-notif"
              onClick={() => setShowNotifDrawer(true)}
              aria-label="Open Notifications"
              title="Notifications"
            >
              <BellIcon />
              {unreadCount > 0 && <span className="cd-notif-badge">{unreadCount}</span>}
            </button>

            {/* Help & Support Button */}
            <button
              className="cd-btn-support"
              onClick={() => setShowSupportModal(true)}
              title="Help & Support"
            >
              <HelpIcon /> Support
            </button>

            {/* User Profile Info */}
            <div
              className={`cd-user-info ${isGoldMember ? 'cd-user-pill--gold' : ''}`}
              onClick={() => setShowProfileDrawer(true)}
              role="button"
              tabIndex={0}
              title="View My Profile"
            >
              <div className="cd-user-details">
                <span className="cd-user-name">{currentUser.name}</span>
                {isGoldMember ? (
                  <span className="cd-gold-member-badge" title="Exclusive Gold Member">👑 GOLD MEMBER</span>
                ) : (
                  <span className="cd-user-id">{currentUser.id}</span>
                )}
              </div>
              <div className={`cd-avatar ${isGoldMember ? 'gold-avatar' : ''}`}>{initials}</div>
            </div>

            <button className="cd-btn-logout" title="Log out" onClick={handleLogout}>
              <LogOutIcon />
            </button>
          </div>
        </div>
      </header>

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="cd-tab-content animate-fade-in">
          {/* Welcome Banner */}
          <section className="cd-hero">
            <div className="cd-hero__overlay" />
            <div className="cd-hero__inner">
              {isGoldMember ? (
                <span className="cd-hero__gold-tag animate-pulse">👑 LUXORA GOLD MEMBER ★</span>
              ) : (
                <span className="cd-hero__member-tag">MEMBER SINCE MARCH 2024</span>
              )}
              <h1 className="cd-hero__title">
                Welcome back, <span className="gold-accent">{firstName}</span>
              </h1>

              {/* Service Counter Pills */}
              <div className="cd-pills-bar">
                <div className="cd-pill" title="Auto Care Active Subscriptions">
                  <CarIcon />
                  <span>Auto Care <CoinIcon /> <strong>×{tokens.auto}</strong></span>
                </div>
                <div className="cd-pill-divider" />
                <div className="cd-pill" title="Garden Care Active Subscriptions">
                  <LeafIcon />
                  <span>Garden Care <CoinIcon /> <strong>×{tokens.garden}</strong></span>
                </div>
                <div className="cd-pill-divider" />
                <div className="cd-pill" title="Pet Care Active Subscriptions">
                  <PawIcon />
                  <span>Pet Care <CoinIcon /> <strong>×{tokens.pet}</strong></span>
                </div>
              </div>
            </div>
          </section>

          {/* Active Packages */}
          <div className="cd-main-container">
            <section className="cd-section">
              <h3 className="cd-section-label">ACTIVE PACKAGES ({activePackages.length})</h3>
              {bookingSuccessMsg && (
                <div className="cd-booking-success-toast animate-fade-in">
                  {bookingSuccessMsg}
                </div>
              )}
              <div className="cd-packages-grid">
                {activePackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="cd-package-card cd-active-pkg-clickable animate-fade-in"
                    onClick={() => { setSelectedActivePackageToManage(pkg); setShowCancelConfirmStep(false) }}
                    role="button"
                    tabIndex={0}
                    title="Click to manage or cancel subscription"
                  >
                    <div className="cd-package-card__icon">
                      {pkg.cat === 'auto' && <CarIcon />}
                      {pkg.cat === 'garden' && <LeafIcon />}
                      {pkg.cat === 'pet' && <PawIcon />}
                      {pkg.cat === 'system' && <ShieldIcon />}
                    </div>
                    <div className="cd-package-card__info">
                      <h4 className="cd-package-card__title">{pkg.title}</h4>
                      <p className="cd-package-card__tier">{pkg.tier}</p>
                    </div>
                    <div className="cd-package-card__price">
                      <span className="cd-price-amount">{pkg.price}</span>
                      <span className="cd-price-period">{pkg.period || '/month'}</span>
                    </div>
                  </div>
                ))}

                <button className="cd-package-card cd-package-card--add" onClick={() => setActiveTab('booking')}>
                  <span>+ Add a Package &rsaquo;</span>
                </button>
              </div>
            </section>

            {/* ── SERVICE BOOKING LUXURY MODULE ── */}
            <section
              className="cd-section animate-fade-in"
              style={{
                background: 'linear-gradient(145deg, #121214 0%, #1a1a1f 100%)',
                border: '1px solid rgba(201, 168, 76, 0.35)',
                borderRadius: '20px',
                padding: '2rem',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Background ambient glow */}
              <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(201, 168, 76, 0.12)', border: '1px solid rgba(201, 168, 76, 0.3)', padding: '0.25rem 0.75rem', borderRadius: '20px', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em' }}>⚡ CONCIERGE SCHEDULER</span>
                  </div>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    SERVICE SESSION BOOKING
                  </h3>
                  <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                    Schedule a service dispatch directly from your active packages with exact date &amp; time breakdown
                  </p>
                </div>
              </div>

              {/* ── STEP 1: SELECT YOUR ACTIVE PACKAGE (Visual Cards Displayed All at Once) ── */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                  <span style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontSize: '0.75rem', fontWeight: 900, width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                  <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em' }}>SELECT AN ACTIVE PACKAGE:</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  {activePackages.map(pkg => {
                    const isSelected = String(serviceBookingForm.packageId) === String(pkg.id)
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => setServiceBookingForm(prev => ({ ...prev, packageId: pkg.id }))}
                        role="button"
                        tabIndex={0}
                        style={{
                          background: isSelected ? 'rgba(201, 168, 76, 0.12)' : '#161619',
                          border: isSelected ? '2px solid var(--gold, #c9a84c)' : '1px solid #2a2a30',
                          borderRadius: '14px',
                          padding: '1.1rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                          boxShadow: isSelected ? '0 0 20px rgba(201, 168, 76, 0.2)' : 'none'
                        }}
                      >
                        {isSelected && (
                          <span style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--gold, #c9a84c)', color: '#000', fontSize: '0.65rem', fontWeight: 900, padding: '0.2rem 0.5rem', borderRadius: '12px' }}>
                            ✓ SELECTED
                          </span>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div style={{ background: isSelected ? 'var(--gold, #c9a84c)' : '#222', color: isSelected ? '#000' : 'var(--gold, #c9a84c)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {pkg.cat === 'auto' && <CarIcon />}
                            {pkg.cat === 'garden' && <LeafIcon />}
                            {pkg.cat === 'pet' && <PawIcon />}
                            {pkg.cat === 'system' && <ShieldIcon />}
                          </div>
                          <div>
                            <h4 style={{ color: '#fff', margin: '0 0 0.25rem 0', fontSize: '1.05rem', fontWeight: 800 }}>{pkg.title}</h4>
                            <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              🗓 Renewal Date: {getRenewalDate(pkg)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── STEP 2 & 3: DATE & TIME SELECTION ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>
                {/* Step 2 Card */}
                <div style={{ background: '#18181c', border: '1px solid #2a2a30', borderRadius: '14px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <span style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontSize: '0.7rem', fontWeight: 900, width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                    <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.05em' }}>CALENDAR DATE</span>
                  </div>
                  <input
                    type="date"
                    value={serviceBookingForm.date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setServiceBookingForm(prev => ({ ...prev, date: e.target.value }))}
                    style={{
                      width: '100%',
                      background: '#0d0d0f',
                      color: '#fff',
                      border: '1px solid #333',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Step 3 Card: Broken down into Hours, Minutes, and AM/PM */}
                <div style={{ background: '#18181c', border: '1px solid #2a2a30', borderRadius: '14px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <span style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontSize: '0.7rem', fontWeight: 900, width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                    <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.05em' }}>TIME (HOURS, MIN, AM/PM)</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                    {/* Hours */}
                    <div>
                      <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 700, marginBottom: '0.2rem' }}>HOUR</label>
                      <select
                        value={serviceBookingForm.hour}
                        onChange={(e) => setServiceBookingForm(prev => ({ ...prev, hour: e.target.value }))}
                        style={{ width: '100%', background: '#0d0d0f', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.3rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center', outline: 'none', cursor: 'pointer' }}
                      >
                        {['01','02','03','04','05','06','07','08','09','10','11','12'].map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Minutes */}
                    <div>
                      <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 700, marginBottom: '0.2rem' }}>MIN</label>
                      <select
                        value={serviceBookingForm.minute}
                        onChange={(e) => setServiceBookingForm(prev => ({ ...prev, minute: e.target.value }))}
                        style={{ width: '100%', background: '#0d0d0f', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.3rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center', outline: 'none', cursor: 'pointer' }}
                      >
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* AM/PM */}
                    <div>
                      <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 700, marginBottom: '0.2rem' }}>PERIOD</label>
                      <select
                        value={serviceBookingForm.ampm}
                        onChange={(e) => setServiceBookingForm(prev => ({ ...prev, ampm: e.target.value }))}
                        style={{ width: '100%', background: '#0d0d0f', color: 'var(--gold, #c9a84c)', border: '1px solid var(--gold, #c9a84c)', padding: '0.65rem 0.3rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 900, textAlign: 'center', outline: 'none', cursor: 'pointer' }}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleConfirmServiceBooking}
                  style={{
                    background: 'linear-gradient(135deg, #d4af37 0%, #aa7c11 100%)',
                    color: '#000',
                    border: 'none',
                    padding: '0.9rem 2.2rem',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(201, 168, 76, 0.35)'
                  }}
                >
                  CONFIRM &amp; BOOK SERVICE SESSION ✨
                </button>
              </div>

              {/* Booking Confirmation Card / Tab */}
              {serviceBookingConfirmation && (
                <div
                  style={{
                    marginTop: '1.75rem',
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(201, 168, 76, 0.1) 100%)',
                    border: '1px solid var(--gold, #c9a84c)',
                    borderRadius: '14px',
                    padding: '1.5rem',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1.25rem',
                    boxShadow: '0 0 30px rgba(201, 168, 76, 0.15)'
                  }}
                  className="animate-fade-in"
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                      <span style={{ background: '#22c55e', color: '#000', fontSize: '0.72rem', fontWeight: 900, padding: '0.25rem 0.65rem', borderRadius: '6px', letterSpacing: '0.05em' }}>
                        ✓ CONFIRMED BOOKING TAB
                      </span>
                      <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.85rem', fontWeight: 800 }}>{serviceBookingConfirmation.id}</span>
                    </div>
                    <h4 style={{ color: '#fff', margin: '0 0 0.35rem 0', fontSize: '1.2rem', fontWeight: 800 }}>{serviceBookingConfirmation.service}</h4>
                    <p style={{ color: '#ccc', fontSize: '0.85rem', margin: 0 }}>
                      Scheduled Date: <strong style={{ color: '#fff' }}>{serviceBookingConfirmation.date}</strong> · Time Slot: <strong style={{ color: 'var(--gold, #c9a84c)' }}>{serviceBookingConfirmation.time}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => setServiceBookingConfirmation(null)}
                    style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Dismiss Confirmation ✕
                  </button>
                </div>
              )}
            </section>

            {/* ── ACTIVE BOOKINGS CHART / TABLE ── */}
            <section className="cd-section animate-fade-in" style={{ marginTop: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 className="cd-section-label" style={{ margin: 0, color: 'var(--gold, #c9a84c)' }}>ACTIVE BOOKINGS</h3>
                  <p style={{ color: '#aaa', fontSize: '0.82rem', margin: '0.2rem 0 0 0' }}>Real-time active bookings chart with auto-generated security PINs (unlocks 30 mins before booking)</p>
                </div>
                <button
                  className="cd-btn-view-receipt"
                  onClick={() => setShowAllActiveBookings(prev => !prev)}
                  style={{ background: 'transparent', border: '1px solid var(--gold, #c9a84c)', color: 'var(--gold, #c9a84c)', padding: '0.45rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', borderRadius: '8px' }}
                >
                  {showAllActiveBookings ? 'Show Less ‹' : 'View All ›'}
                </button>
              </div>

              <div className="cd-table-wrap" style={{ background: '#141414', border: '1px solid #282828', borderRadius: '16px', overflow: 'hidden' }}>
                <table className="cd-table" style={{ margin: 0 }}>
                  <thead>
                    <tr style={{ background: '#18181c', borderBottom: '1px solid #282828' }}>
                      <th style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.75rem', padding: '0.85rem 1rem' }}>BOOKING ID</th>
                      <th style={{ fontSize: '0.75rem', padding: '0.85rem 1rem' }}>PACKAGE</th>
                      <th style={{ fontSize: '0.75rem', padding: '0.85rem 1rem' }}>PROVIDER PROFILE</th>
                      <th style={{ fontSize: '0.75rem', padding: '0.85rem 1rem' }}>DATE &amp; TIME</th>
                      <th style={{ fontSize: '0.75rem', padding: '0.85rem 1rem' }}>SECURITY PIN (30m)</th>
                      <th style={{ fontSize: '0.75rem', padding: '0.85rem 1rem' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllActiveBookings ? customerActiveBookings : customerActiveBookings.slice(0, 10)).map((b) => {
                      const pinUnlocked = checkIsPinUnlocked(b.date, b.time)
                      return (
                        <tr key={b.id} style={{ borderBottom: '1px solid #202020' }}>
                          <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800, fontSize: '0.85rem' }}>{b.id}</td>
                          <td style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }}>{b.service}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--gold, #c9a84c)', color: '#000', fontWeight: 800, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {(b.providerName || 'Nimal Silva')[0]}
                              </div>
                              <div>
                                <span style={{ color: '#eee', fontSize: '0.82rem', fontWeight: 700, display: 'block' }}>{b.providerName || 'Nimal Silva'}</span>
                                <small style={{ color: '#888', fontSize: '0.72rem' }}>{b.providerRole || 'Certified Specialist'}</small>
                              </div>
                            </div>
                          </td>
                          <td style={{ color: '#ccc', fontSize: '0.82rem' }}>
                            <div>{b.date}</div>
                            <small style={{ color: 'var(--gold, #c9a84c)', fontWeight: 700 }}>{b.time}</small>
                          </td>
                          <td>
                            {pinUnlocked ? (
                              <span style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', fontSize: '0.85rem', fontWeight: 900, padding: '0.3rem 0.65rem', borderRadius: '6px', letterSpacing: '0.1em' }}>
                                🔑 {b.pin || '4892'}
                              </span>
                            ) : (
                              <span style={{ background: '#1c1c1c', border: '1px solid #333', color: '#888', fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.6rem', borderRadius: '6px' }} title="PIN auto-unlocks 30 minutes before your scheduled booking slot">
                                🔒 Unlocks 30m before
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="cd-status-tag cd-status-tag--completed" style={{ background: 'rgba(201, 168, 76, 0.12)', color: 'var(--gold, #c9a84c)', border: '1px solid rgba(201, 168, 76, 0.3)', fontWeight: 800 }}>
                              {b.status || 'CONFIRMED'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Custom Service Request Module ── */}
            <section className="cd-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 className="cd-section-label" style={{ margin: 0, color: 'var(--gold, #c9a84c)' }}>CUSTOM REQUESTS ({customRequests.length})</h3>
                  <p style={{ color: '#aaa', fontSize: '0.82rem', margin: '0.2rem 0 0 0' }}>Request specialized estate care, bespoke valet, or tailored concierge services</p>
                </div>
                <button
                  className="cd-btn-view-receipt"
                  onClick={() => setShowCustomRequestModal(true)}
                  style={{ background: 'var(--gold, #c9a84c)', color: '#000', border: 'none', fontWeight: 800, padding: '0.6rem 1.25rem', fontSize: '0.82rem' }}
                >
                  + Submit Custom Request
                </button>
              </div>

              {customRequests.length === 0 ? (
                <div style={{ background: '#141414', border: '1px dashed rgba(201, 168, 76, 0.3)', borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
                  <p style={{ color: '#bbb', fontSize: '0.88rem', margin: '0 0 1rem 0' }}>Need a specialized service not covered by standard packages? Submit a custom request for personalized concierge pricing.</p>
                  <button
                    className="cd-btn-view-receipt"
                    onClick={() => setShowCustomRequestModal(true)}
                    style={{ background: 'transparent', border: '1px solid var(--gold, #c9a84c)', color: 'var(--gold, #c9a84c)', padding: '0.5rem 1.2rem' }}
                  >
                    + Create Custom Request
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                  {customRequests.map((req) => (
                    <div key={req.id} style={{ background: '#141414', border: '1px solid rgba(201, 168, 76, 0.25)', borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.75rem', fontWeight: 800 }}>{req.id}</span>
                          <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <h4 style={{ color: '#fff', fontSize: '1.05rem', margin: '0 0 0.4rem 0', fontWeight: 700 }}>{req.title}</h4>
                        <p style={{ color: '#aaa', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>{req.notes}</p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#777', fontSize: '0.75rem', borderTop: '1px solid #222', paddingTop: '0.65rem', marginTop: '0.25rem' }}>
                        <span>Category: <strong style={{ color: '#ddd' }}>{req.category}</strong></span>
                        <span>Date: <strong style={{ color: '#ddd' }}>{req.date}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Monthly Summary */}
            <section className="cd-section">
              <h3 className="cd-section-label">MONTHLY SUMMARY</h3>
              <div className="cd-summary-grid">
                <div className="cd-summary-card">
                  <span className="cd-summary-card__label">Monthly Spend</span>
                  <div className="cd-summary-card__val">
                    LKR {totalMonthlySpend.toLocaleString()}
                  </div>
                  <span className="cd-summary-card__sub">{activePackages.length} active plan{activePackages.length === 1 ? '' : 's'}</span>
                </div>

                <div className="cd-summary-card">
                  <span className="cd-summary-card__label">Sessions This Month</span>
                  <div className="cd-summary-card__val">{totalTokensSum}</div>
                  <span className="cd-summary-card__sub">Sum of Service Tokens ({tokens.auto} + {tokens.garden} + {tokens.pet})</span>
                </div>

                <div className="cd-summary-card">
                  <span className="cd-summary-card__label">Next Renewal</span>
                  <div className="cd-summary-card__val cd-summary-card__val--gold">
                    {activePackages.length > 0 ? getRenewalDate(activePackages[0]) : 'N/A'}
                  </div>
                  <span className="cd-summary-card__sub">30-day renewal period</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ── TAB 2: BOOKING ── */}
      {activeTab === 'booking' && (
        <div className="cd-tab-content cd-main-container animate-fade-in">
          <div className="cd-page-header">
            <h1 className="cd-page-title">Subscription Plans</h1>
            <p className="cd-page-subtitle">Choose your preferred service and tier</p>
          </div>

          {/* Recommended Banner */}
          <div className="cd-recom-banner">
            <div className="cd-recom-badge">★</div>
            <div className="cd-recom-info">
              <h4>Recommended for you</h4>
              <p>Based on your usage, the Auto &amp; Garden combo saves you 5% monthly vs individual plans.</p>
            </div>
            <button className="cd-recom-btn" onClick={() => setBookingType('combo')}>View combo &rsaquo;</button>
          </div>

          {/* Single / Combo Toggle */}
          <div className="cd-toggle-bar">
            <button
              className={`cd-toggle-btn ${bookingType === 'combo' ? 'active' : ''}`}
              onClick={() => setBookingType('combo')}
            >
              Combo Packages
            </button>
            <button
              className={`cd-toggle-btn ${bookingType === 'single' ? 'active' : ''}`}
              onClick={() => setBookingType('single')}
            >
              Single Packages
            </button>
          </div>

          {/* ── Single Packages Grid ── */}
          {bookingType === 'single' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              {adminSubscriptions
                .filter(s => s.type === 'Single Package')
                .map((s) => (
                  <div
                    key={s.id}
                    className="cd-combo-card animate-fade-in"
                    onClick={() => setSelectedPackageToBook({
                      title: s.title.replace('Single Package: ', ''),
                      tier: 'Single Package Plan ★',
                      price: `LKR ${Number(s.price).toLocaleString()}`,
                      cat: (s.cat || 'auto').toLowerCase().includes('garden') ? 'garden' : (s.cat || '').toLowerCase().includes('pet') ? 'pet' : 'auto',
                      service_id: 1
                    })}
                    role="button"
                    tabIndex={0}
                    title={`Click to book ${s.title}`}
                    style={{ background: '#141414', border: '1px solid #282828', borderRadius: '14px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem', cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span className="cd-popular-badge" style={{ position: 'static', background: 'rgba(201, 168, 76, 0.15)', color: 'var(--gold, #c9a84c)', border: '1px solid rgba(201, 168, 76, 0.3)' }}>
                          {(s.cat || 'SINGLE CARE').toUpperCase()}
                        </span>
                        <span style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600 }}>{s.id}</span>
                      </div>

                      <h3 style={{ color: '#fff', fontSize: '1.25rem', margin: '0 0 0.5rem 0', fontWeight: 800 }}>
                        {s.title.replace('Single Package: ', '')}
                      </h3>

                      <div style={{ color: 'var(--gold, #c9a84c)', fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>
                        LKR {Number(s.price).toLocaleString()} <small style={{ fontSize: '0.8rem', color: '#888', fontWeight: 400 }}>/mo</small>
                      </div>

                      <div style={{ borderTop: '1px solid #222', paddingTop: '0.85rem' }}>
                        <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>INCLUDED CONCIERGE SERVICES:</span>
                        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#ccc', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {Array.isArray(s.inclusives) ? s.inclusives.map((inc, i) => (
                            <li key={i} style={{ color: '#bbb' }}>{inc}</li>
                          )) : <li style={{ color: '#bbb' }}>{s.inclusives}</li>}
                        </ul>
                      </div>
                    </div>

                    <button className="cd-combo-book-btn" style={{ width: '100%', marginTop: '0.5rem' }}>
                      Book Single Package &rsaquo;
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* ── Combo Packages Grid ── */}
          {bookingType === 'combo' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              {adminSubscriptions
                .filter(s => s.type === 'Combo Package')
                .map((s) => (
                  <div
                    key={s.id}
                    className="cd-combo-card animate-fade-in"
                    onClick={() => setSelectedPackageToBook({
                      title: s.title.replace('Combo Package: ', ''),
                      tier: 'VIP Combo Suite Plan 👑',
                      price: `LKR ${Number(s.price).toLocaleString()}`,
                      cat: 'system',
                      service_id: 1
                    })}
                    role="button"
                    tabIndex={0}
                    title={`Click to book ${s.title}`}
                    style={{ background: '#161616', border: '1px solid var(--gold, #c9a84c)', borderRadius: '16px', padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.25rem', boxShadow: '0 0 25px rgba(201, 168, 76, 0.1)', cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span className="cd-combo-badge" style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontWeight: 800 }}>
                          👑 VIP BUNDLE (-15%)
                        </span>
                        <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.78rem', fontWeight: 700 }}>{s.id}</span>
                      </div>

                      <h3 style={{ color: '#fff', fontSize: '1.35rem', margin: '0 0 0.5rem 0', fontWeight: 800 }}>
                        {s.title.replace('Combo Package: ', '')}
                      </h3>
                      <p style={{ color: '#aaa', fontSize: '0.82rem', margin: '0 0 1rem 0' }}>Comprehensive multi-service estate suite with VIP priority dispatch</p>

                      <div style={{ color: 'var(--gold, #c9a84c)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '1.1rem' }}>
                        LKR {Number(s.price).toLocaleString()} <small style={{ fontSize: '0.85rem', color: '#888', fontWeight: 400 }}>/mo</small>
                      </div>

                      <div style={{ borderTop: '1px solid #282828', paddingTop: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--gold, #c9a84c)', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '0.6rem' }}>EXCLUSIVE COMBO INCLUSIVES:</span>
                        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#eee', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          {Array.isArray(s.inclusives) ? s.inclusives.map((inc, i) => (
                            <li key={i} style={{ color: '#ddd' }}>{inc}</li>
                          )) : <li style={{ color: '#ddd' }}>{s.inclusives}</li>}
                        </ul>
                      </div>
                    </div>

                    <button className="cd-combo-book-btn" style={{ width: '100%', marginTop: '0.5rem', background: 'var(--gold, #c9a84c)', color: '#000', fontWeight: 800, padding: '0.75rem 1rem' }}>
                      Subscribe VIP Combo Package &rsaquo;
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: HISTORY ── */}
      {activeTab === 'history' && (
        <div className="cd-tab-content cd-main-container animate-fade-in">
          <div className="cd-page-header">
            <h1 className="cd-page-title">Booking &amp; Transaction History</h1>
            <p className="cd-page-subtitle">Real-time log of your concierge packages, renewals, and payments</p>
          </div>

          {/* Top Summary Cards */}
          <div className="cd-history-summary">
            <div className="cd-hstat-card">
              <div className="cd-hstat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M23 6l-9.5 9.5-5-5L1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17 6h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <span className="cd-hstat-label">Total Spent</span>
                <div className="cd-hstat-val">{formattedTotalSpent}</div>
              </div>
            </div>

            <div className="cd-hstat-card">
              <div className="cd-hstat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <span className="cd-hstat-label">Total Transactions</span>
                <div className="cd-hstat-val">{historyData.length}</div>
              </div>
            </div>

            <div className="cd-hstat-card">
              <div className="cd-hstat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 20v-6M6 20V10M18 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <span className="cd-hstat-label">Avg. Transaction</span>
                <div className="cd-hstat-val">{avgPerMonth}</div>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="cd-filter-pills">
            <button
              className={`cd-filter-pill ${historyFilter === 'all' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('all')}
            >
              All Services ({historyData.length})
            </button>
            <button
              className={`cd-filter-pill ${historyFilter === 'auto' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('auto')}
            >
              Auto Care ({historyData.filter(h => h.cat === 'auto').length})
            </button>
            <button
              className={`cd-filter-pill ${historyFilter === 'garden' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('garden')}
            >
              Garden Care ({historyData.filter(h => h.cat === 'garden').length})
            </button>
            <button
              className={`cd-filter-pill ${historyFilter === 'pet' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('pet')}
            >
              Pet Care ({historyData.filter(h => h.cat === 'pet').length})
            </button>
          </div>

          {/* History Table */}
          <div className="cd-table-wrap">
            <table className="cd-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>SERVICE / PACKAGE</th>
                  <th>TIER / PLAN</th>
                  <th>INVOICE REF</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td className="cd-cell-date">{item.date}</td>
                    <td className="cd-cell-service">
                      <span className="cd-service-badge">
                        {item.cat === 'auto' && <CarIcon />}
                        {item.cat === 'garden' && <LeafIcon />}
                        {item.cat === 'pet' && <PawIcon />}
                        {item.cat === 'system' && <ShieldIcon />}
                        {item.service}
                      </span>
                    </td>
                    <td className="cd-cell-tier">{item.tier}</td>
                    <td className="cd-cell-ref">{item.ref}</td>
                    <td className="cd-cell-amount">{item.amount}</td>
                    <td>
                      <span className={`cd-status-tag ${item.status === 'Cancelled' ? 'cd-status-tag--cancelled' : 'cd-status-tag--completed'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {item.status === 'Completed' ? (
                        <button className="cd-btn-view-receipt" onClick={() => setSelectedReceiptItem(item)}>
                          Receipt 🧾
                        </button>
                      ) : (
                        <span style={{ color: '#666', fontSize: '0.78rem' }}>N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── My Profile Slide Drawer ── */}
      {showProfileDrawer && (
        <div className="cd-drawer-overlay" onClick={() => setShowProfileDrawer(false)}>
          <div className="cd-drawer-window" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="cd-drawer-header">
              <span className="cd-drawer-title">MY PROFILE</span>
              <button
                className="cd-drawer-close"
                onClick={() => setShowProfileDrawer(false)}
                aria-label="Close Profile"
              >
                ✕
              </button>
            </div>

            {/* Profile Avatar Box */}
            <div className="cd-profile-hero">
              <div className={`cd-profile-avatar-lg ${isGoldMember ? 'gold-avatar' : ''}`}>{initials}</div>
              <h2 className="cd-profile-name">{currentUser.name}</h2>
              {isGoldMember ? (
                <span className="cd-hero__gold-tag" style={{ marginTop: '0.35rem' }}>👑 LUXORA GOLD MEMBER ★</span>
              ) : (
                <span className="cd-profile-badge">STANDARD MEMBER</span>
              )}
              <span className="cd-profile-id">{currentUser.id}</span>
            </div>

            <div className="cd-profile-section-divider" />

            {/* Contact Information */}
            <div className="cd-profile-section">
              <h4 className="cd-profile-sublabel">CONTACT INFORMATION</h4>
              
              <div className="cd-contact-item">
                <div className="cd-contact-icon-box"><MailIcon /></div>
                <div className="cd-contact-text">
                  <span className="cd-contact-field">EMAIL</span>
                  <span className="cd-contact-val">{currentUser.email}</span>
                </div>
              </div>

              <div className="cd-contact-item">
                <div className="cd-contact-icon-box"><PhoneIcon /></div>
                <div className="cd-contact-text">
                  <span className="cd-contact-field">MOBILE</span>
                  <span className="cd-contact-val">{currentUser.phone}</span>
                </div>
              </div>

              <div className="cd-contact-item">
                <div className="cd-contact-icon-box"><MapPinIcon /></div>
                <div className="cd-contact-text">
                  <span className="cd-contact-field">DELIVERY ADDRESS</span>
                  <span className="cd-contact-val">
                    {userAddress.street}<br />
                    {userAddress.city}{userAddress.district ? `, ${userAddress.district}` : ''}
                  </span>
                </div>
              </div>

              <button
                className="cd-btn-support"
                style={{ width: '100%', marginTop: '0.85rem', justifyContent: 'center' }}
                onClick={() => { setShowProfileDrawer(false); setShowAddressModal(true) }}
              >
                ✏️ Edit Delivery Address
              </button>
            </div>

            <div className="cd-profile-section-divider" />

            {/* Member Details */}
            <div className="cd-profile-section">
              <h4 className="cd-profile-sublabel">MEMBERSHIP SUMMARY</h4>
              
              <div className="cd-md-row">
                <span className="cd-md-label">Member since</span>
                <span className="cd-md-val">March 2024</span>
              </div>

              <div className="cd-md-row">
                <span className="cd-md-label">Active packages</span>
                <span className="cd-md-val">{activePackages.length} Active</span>
              </div>

              <div className="cd-md-row">
                <span className="cd-md-label">Member tier</span>
                <span className={`cd-md-val ${isGoldMember ? 'cd-md-val--gold' : ''}`}>
                  {isGoldMember ? '👑 Gold Member' : 'Standard Member'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── First-Time Login Address Setup Modal Popup ── */}
      {showAddressModal && (
        <div className="cd-address-overlay">
          <div className="cd-address-modal animate-fade-in">
            <div className="cd-address-modal__header">
              <div className="cd-address-icon-box"><MapPinIcon /></div>
              <h2 className="cd-address-modal__title">Service Delivery Address</h2>
              <p className="cd-address-modal__subtitle">Welcome to Luxora! Please specify your primary residence for seamless concierge service delivery.</p>
            </div>

            <form onSubmit={handleSaveAddress} className="cd-address-form">
              <div className="cd-address-field">
                <label htmlFor="addr-street">Street Address &amp; House / Villa No.</label>
                <input
                  id="addr-street"
                  type="text"
                  placeholder="e.g. 45 Marine Drive"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, street: e.target.value }))}
                  required
                  autoFocus
                />
              </div>

              <div className="cd-address-row">
                <div className="cd-address-field">
                  <label htmlFor="addr-city">City / Area</label>
                  <input
                    id="addr-city"
                    type="text"
                    placeholder="e.g. Colombo 03"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                    required
                  />
                </div>

                <div className="cd-address-field">
                  <label htmlFor="addr-district">Province</label>
                  <select
                    id="addr-district"
                    className="cd-address-select"
                    value={addressForm.district}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, district: e.target.value }))}
                    required
                  >
                    <option value="Western">Western</option>
                    <option value="Central">Central</option>
                    <option value="Southern">Southern</option>
                    <option value="Northern">Northern</option>
                    <option value="Eastern">Eastern</option>
                    <option value="North Western">North Western</option>
                    <option value="North Central">North Central</option>
                    <option value="Uva">Uva</option>
                    <option value="Sabaragamuwa">Sabaragamuwa</option>
                  </select>
                </div>
              </div>

              <div className="cd-address-actions">
                <button type="submit" className="cd-address-save-btn">
                  SAVE TO PROFILE &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Concierge Support Message Modal Popup ── */}
      {showSupportModal && (
        <div className="cd-support-overlay" onClick={() => setShowSupportModal(false)}>
          <div className="cd-support-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="cd-support-modal__header">
              <div className="cd-support-icon-box"><HelpIcon /></div>
              <h2 className="cd-support-modal__title">Concierge Support</h2>
              <p className="cd-support-modal__subtitle">Direct line to Luxora VIP Help Desk &amp; Member Assistance</p>
              <button
                className="cd-support-modal__close"
                onClick={() => setShowSupportModal(false)}
                aria-label="Close Support"
              >
                ✕
              </button>
            </div>

            {supportSentSuccess ? (
              <div className="cd-support-success animate-fade-in">
                <div className="cd-support-success-badge">✓</div>
                <h3>Message Sent Successfully!</h3>
                <p>Our VIP Concierge Specialist will contact you shortly.</p>
                <span className="cd-support-ref">Reference ID: <strong>{supportRefNum}</strong></span>
              </div>
            ) : (
              <form onSubmit={handleSendSupportMessage} className="cd-support-form">
                <div className="cd-support-field">
                  <label htmlFor="sup-category">Inquiry Category</label>
                  <select
                    id="sup-category"
                    className="cd-support-select"
                    value={supportCategory}
                    onChange={(e) => setSupportCategory(e.target.value)}
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Booking Assistance">Booking Assistance</option>
                    <option value="Service Quality & Feedback">Service Quality &amp; Feedback</option>
                    <option value="Billing & Subscription">Billing &amp; Subscription</option>
                    <option value="Emergency Request">Emergency Concierge Request</option>
                  </select>
                </div>

                <div className="cd-support-field">
                  <label htmlFor="sup-message">Your Message</label>
                  <textarea
                    id="sup-message"
                    className="cd-support-textarea"
                    rows="5"
                    placeholder="Describe how our VIP Concierge team can assist you..."
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="cd-support-actions">
                  <button type="submit" className="cd-support-send-btn">
                    SEND MESSAGE &rarr;
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Notifications Slide Drawer Panel ── */}
      {showNotifDrawer && (
        <div className="cd-drawer-overlay" onClick={() => setShowNotifDrawer(false)}>
          <div className="cd-drawer-window cd-notif-drawer animate-slide-left" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="cd-drawer-header">
              <div className="cd-notif-header-title">
                <span className="cd-drawer-title">NOTIFICATIONS</span>
                {unreadCount > 0 && <span className="cd-notif-unread-tag">{unreadCount} NEW</span>}
              </div>
              <div className="cd-notif-header-actions">
                {unreadCount > 0 && (
                  <button className="cd-notif-mark-read-btn" onClick={markAllNotifsRead}>
                    Mark all read
                  </button>
                )}
                <button
                  className="cd-drawer-close"
                  onClick={() => setShowNotifDrawer(false)}
                  aria-label="Close Notifications"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="cd-notif-list">
              {notifications.length === 0 ? (
                <div className="cd-notif-empty">
                  <div className="cd-notif-empty-icon"><BellIcon /></div>
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((item) => (
                  <div key={item.id} className={`cd-notif-item ${item.unread ? 'cd-notif-item--unread' : ''}`} onClick={() => markNotifAsRead(item.id)}>
                    <div className="cd-notif-item__left">
                      <div className={`cd-notif-icon cd-notif-icon--${item.category}`}>
                        {item.category === 'auto' && <CarIcon />}
                        {item.category === 'garden' && <LeafIcon />}
                        {item.category === 'system' && <ShieldIcon />}
                      </div>
                    </div>
                    <div className="cd-notif-item__content">
                      <div className="cd-notif-item__top">
                        <h4 className="cd-notif-item__title">{item.title}</h4>
                        <span className="cd-notif-item__time">{item.time}</span>
                      </div>
                      <p className="cd-notif-item__msg">{item.message}</p>
                    </div>
                    <button
                      className="cd-notif-item__dismiss"
                      onClick={() => dismissNotification(item.id)}
                      title="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Booking Checkout Confirmation Modal ── */}
      {selectedPackageToBook && (
        <div className="cd-support-overlay" onClick={() => setSelectedPackageToBook(null)}>
          <div className="cd-support-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="cd-support-modal__header">
              <div className="cd-support-icon-box"><ShieldIcon /></div>
              <h2 className="cd-support-modal__title">Confirm Package Booking</h2>
              <p className="cd-support-modal__subtitle">Add {selectedPackageToBook.title} to your active subscriptions</p>
              <button
                className="cd-support-modal__close"
                onClick={() => setSelectedPackageToBook(null)}
                aria-label="Close Modal"
              >
                ✕
              </button>
            </div>

            {/* Interactive Billing Type Selector */}
            <div className="cd-billing-option-selector">
              <label className="cd-billing-selector-label">SELECT BILLING TYPE:</label>
              <div className="cd-billing-option-grid">
                <div
                  className={`cd-billing-option-card ${bookingBillingType === 'auto_renew' ? 'active' : ''}`}
                  onClick={() => setBookingBillingType('auto_renew')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="cd-billing-option-radio">
                    <span className={`cd-radio-circle ${bookingBillingType === 'auto_renew' ? 'selected' : ''}`} />
                  </div>
                  <div className="cd-billing-option-info">
                    <strong>🔄 Auto-Renewal (Monthly)</strong>
                    <p>Renews every 30 days automatically ({getRenewalDate(null)}). Cancel anytime.</p>
                  </div>
                </div>

                <div
                  className={`cd-billing-option-card ${bookingBillingType === 'one_time' ? 'active' : ''}`}
                  onClick={() => setBookingBillingType('one_time')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="cd-billing-option-radio">
                    <span className={`cd-radio-circle ${bookingBillingType === 'one_time' ? 'selected' : ''}`} />
                  </div>
                  <div className="cd-billing-option-info">
                    <strong>⚡ One-Time Pass (30 Days)</strong>
                    <p>Single 30-day service pass. Automatically expires on {getRenewalDate(null)} with no recurring charges.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="cd-book-confirm-details" style={{ marginTop: '1rem' }}>
              <div className="cd-book-confirm-row">
                <span>Selected Package:</span>
                <strong>{selectedPackageToBook.title}</strong>
              </div>
              <div className="cd-book-confirm-row">
                <span>Subscription Tier:</span>
                <span className="gold-accent">{selectedPackageToBook.tier}</span>
              </div>
              <div className="cd-book-confirm-row">
                <span>Selected Billing Option:</span>
                <span className="gold-accent" style={{ fontWeight: '700' }}>
                  {bookingBillingType === 'auto_renew' ? '🔄 Monthly Auto-Renewal' : '⚡ One-Time Pass (30 Days)'}
                </span>
              </div>
              <div className="cd-book-confirm-row">
                <span>Price:</span>
                <strong className="cd-confirm-price">
                  {selectedPackageToBook.price} {bookingBillingType === 'one_time' ? '/ 30 days' : '/ month'}
                </strong>
              </div>
              <div className="cd-book-confirm-row">
                <span>Delivery Address:</span>
                <small>{userAddress.street}, {userAddress.city}, {userAddress.district}</small>
              </div>
              <div className="cd-book-confirm-row">
                <span>{bookingBillingType === 'auto_renew' ? 'Next Renewal Date:' : 'Expiry Date:'}</span>
                <small className="gold-accent">{getRenewalDate(null)}</small>
              </div>
            </div>

            <div className="cd-support-actions" style={{ marginTop: '1.5rem' }}>
              <button
                className="cd-support-send-btn"
                onClick={() => handleConfirmBooking(selectedPackageToBook)}
              >
                {bookingBillingType === 'auto_renew' ? 'CONFIRM & SUBSCRIBE (AUTO-RENEW) →' : 'CONFIRM & GET ONE-TIME PASS →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Package Details & Cancellation Modal ── */}
      {selectedActivePackageToManage && (
        <div className="cd-support-overlay" onClick={() => { setSelectedActivePackageToManage(null); setShowCancelConfirmStep(false) }}>
          <div className="cd-support-modal cd-manage-pkg-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="cd-support-modal__header">
              <div className="cd-support-icon-box">
                {selectedActivePackageToManage.cat === 'auto' && <CarIcon />}
                {selectedActivePackageToManage.cat === 'garden' && <LeafIcon />}
                {selectedActivePackageToManage.cat === 'pet' && <PawIcon />}
                {selectedActivePackageToManage.cat === 'system' && <ShieldIcon />}
              </div>
              <h2 className="cd-support-modal__title">{selectedActivePackageToManage.title}</h2>
              <p className="cd-support-modal__subtitle">{selectedActivePackageToManage.tier}</p>
              <button
                className="cd-support-modal__close"
                onClick={() => { setSelectedActivePackageToManage(null); setShowCancelConfirmStep(false) }}
                aria-label="Close Modal"
              >
                ✕
              </button>
            </div>

            {!showCancelConfirmStep ? (
              <>
                <div className="cd-book-confirm-details">
                  <div className="cd-book-confirm-row">
                    <span>Plan Status:</span>
                    <span className="cd-status-badge-active">● Active (Auto-renews)</span>
                  </div>
                  <div className="cd-book-confirm-row">
                    <span>Monthly Rate:</span>
                    <strong className="cd-confirm-price">{selectedActivePackageToManage.price} / mo</strong>
                  </div>
                  <div className="cd-book-confirm-row">
                    <span>Service Address:</span>
                    <small>{userAddress.street}, {userAddress.city}, {userAddress.district}</small>
                  </div>
                  <div className="cd-book-confirm-row">
                    <span>Renewal Date (30 Days):</span>
                    <small className="gold-accent">{getRenewalDate(selectedActivePackageToManage)}</small>
                  </div>
                </div>

                <div className="cd-pkg-features-list">
                  <h5>PACKAGE INCLUSIONS:</h5>
                  <ul>
                    <li>✓ Professional concierge service delivery</li>
                    <li>✓ Eco-friendly premium products &amp; equipment</li>
                    <li>✓ 24/7 Priority support hotline</li>
                    <li>✓ Verified background-checked specialist</li>
                  </ul>
                </div>

                <div className="cd-manage-modal-actions">
                  <button
                    className="cd-btn-cancel-sub"
                    onClick={() => setShowCancelConfirmStep(true)}
                  >
                    Cancel Subscription
                  </button>
                  <button
                    className="cd-support-send-btn"
                    style={{ flex: 1 }}
                    onClick={() => setSelectedActivePackageToManage(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div className="cd-cancel-confirm-box animate-fade-in">
                <div className="cd-cancel-warning-icon">⚠️</div>
                <h4 className="cd-cancel-warning-title">Cancel {selectedActivePackageToManage.title}?</h4>
                <p className="cd-cancel-warning-text">
                  Are you sure you want to cancel this subscription? Please review the official cancellation policy below:
                </p>

                {/* Official Cancellation Policy Rules */}
                <div className="cd-cancel-policy-box">
                  <h5 className="cd-policy-box-title">📋 CANCELLATION &amp; REFUND POLICY</h5>
                  <div className="cd-policy-tier">
                    <span className="cd-policy-dot green">●</span>
                    <div>
                      <strong>&gt;24 Hours Before:</strong>
                      <p>100% Free Cancellation.</p>
                    </div>
                  </div>

                  <div className="cd-policy-tier">
                    <span className="cd-policy-dot yellow">●</span>
                    <div>
                      <strong>12–24 Hours Before:</strong>
                      <p>Free cancellation (provider-specific non-refundable costs may be deducted).</p>
                    </div>
                  </div>

                  <div className="cd-policy-tier">
                    <span className="cd-policy-dot orange">●</span>
                    <div>
                      <strong>&lt;12 Hours Before:</strong>
                      <p>A 10% cancellation fee of booking value applies.</p>
                    </div>
                  </div>

                  <div className="cd-policy-tier">
                    <span className="cd-policy-dot red">●</span>
                    <div>
                      <strong>Provider Arrived / Service Started:</strong>
                      <p>Cancellation is not permitted; applicable service charge retained.</p>
                    </div>
                  </div>
                </div>

                <div className="cd-manage-modal-actions" style={{ marginTop: '1.25rem' }}>
                  <button
                    className="cd-btn-confirm-cancel-final"
                    onClick={() => handleCancelSubscription(selectedActivePackageToManage.id)}
                  >
                    CONFIRM CANCELLATION
                  </button>
                  <button
                    className="cd-btn-keep-sub"
                    onClick={() => setShowCancelConfirmStep(false)}
                  >
                    Keep My Subscription
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Official Luxora Tax Invoice / Receipt Modal Popup ── */}
      {selectedReceiptItem && (
        <div className="cd-support-overlay" onClick={() => setSelectedReceiptItem(null)}>
          <div className="cd-support-modal cd-receipt-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="cd-support-modal__header">
              <div className="cd-support-icon-box"><ShieldIcon /></div>
              <h2 className="cd-support-modal__title">TAX INVOICE &amp; RECEIPT</h2>
              <p className="cd-support-modal__subtitle">Official Payment Confirmation &bull; Luxora Concierge</p>
              <button
                className="cd-support-modal__close"
                onClick={() => setSelectedReceiptItem(null)}
                aria-label="Close Receipt"
              >
                ✕
              </button>
            </div>

            <div className="cd-receipt-body" style={{ marginTop: '1rem', textAlignment: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#141414', padding: '0.85rem 1.1rem', borderRadius: '10px', border: '1px solid #282828' }}>
                <div>
                  <strong style={{ color: 'var(--gold)', fontSize: '0.9rem', display: 'block' }}>LUXORA HOME CONCIERGE</strong>
                  <small style={{ color: '#888', fontSize: '0.75rem' }}>Colombo, Sri Lanka</small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ color: '#fff', fontSize: '0.85rem', display: 'block' }}>{selectedReceiptItem.ref}</strong>
                  <small style={{ color: '#888', fontSize: '0.75rem' }}>{selectedReceiptItem.date}</small>
                </div>
              </div>

              <div className="cd-book-confirm-details" style={{ marginTop: '1rem' }}>
                <div className="cd-book-confirm-row">
                  <span>Customer Name:</span>
                  <strong>{currentUser.name}</strong>
                </div>
                <div className="cd-book-confirm-row">
                  <span>Email Address:</span>
                  <small>{currentUser.email}</small>
                </div>
                <div className="cd-book-confirm-row">
                  <span>Service Package:</span>
                  <strong className="gold-accent">{selectedReceiptItem.service}</strong>
                </div>
                <div className="cd-book-confirm-row">
                  <span>Subscription Plan / Tier:</span>
                  <span>{selectedReceiptItem.tier}</span>
                </div>
                <div className="cd-book-confirm-row">
                  <span>Delivery Address:</span>
                  <small>{userAddress.street}, {userAddress.city}, {userAddress.district}</small>
                </div>
                <div className="cd-book-confirm-row">
                  <span>Status:</span>
                  <span className={`cd-status-tag ${selectedReceiptItem.status === 'Cancelled' ? 'cd-status-tag--cancelled' : 'cd-status-tag--completed'}`}>
                    {selectedReceiptItem.status}
                  </span>
                </div>
                <div className="cd-book-confirm-row" style={{ borderTop: '1px dashed #333', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                  <span>Total Amount Paid:</span>
                  <strong className="cd-confirm-price">{selectedReceiptItem.amount}</strong>
                </div>
              </div>
            </div>

            <div className="cd-support-actions" style={{ marginTop: '1.25rem', gap: '0.75rem' }}>
              <button className="cd-support-send-btn" onClick={() => window.print()}>
                🖨️ PRINT RECEIPT
              </button>
              <button className="cd-btn-keep-sub" onClick={() => setSelectedReceiptItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit Custom Service Request Modal ── */}
      {showCustomRequestModal && (
        <div className="cd-drawer-overlay animate-fade-in" onClick={() => setShowCustomRequestModal(false)}>
          <div
            className="cd-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '520px', background: '#121212', border: '1px solid rgba(201, 168, 76, 0.3)', borderRadius: '16px', padding: '1.75rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em' }}>BESPOKE CONCIERGE</span>
                <h3 style={{ color: '#fff', fontSize: '1.25rem', margin: '0.2rem 0 0 0', fontWeight: 800 }}>Submit Custom Service Request</h3>
              </div>
              <button
                className="cd-drawer-close"
                onClick={() => setShowCustomRequestModal(false)}
                style={{ background: '#1e1e1e', border: '1px solid #333', color: '#aaa', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCustomRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>SERVICE SUBJECT / TITLE</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Villa Marble Floor Polishing & Restoration"
                  value={customForm.title}
                  onChange={(e) => setCustomForm({ ...customForm, title: e.target.value })}
                  style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>CATEGORY</label>
                  <select
                    value={customForm.category}
                    onChange={(e) => setCustomForm({ ...customForm, category: e.target.value })}
                    style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <option value="Home & Estate Care">Home & Estate Care</option>
                    <option value="Auto Care">Auto Care</option>
                    <option value="Garden Care">Garden Care</option>
                    <option value="Pet Care">Pet Care</option>
                    <option value="VIP Concierge">VIP Concierge</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>PREFERRED DATE</label>
                  <input
                    type="date"
                    value={customForm.date}
                    onChange={(e) => setCustomForm({ ...customForm, date: e.target.value })}
                    style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>SPECIAL REQUIREMENTS & DETAILS</label>
                <textarea
                  rows="4"
                  required
                  placeholder="Describe your custom service requirements, estate dimensions, specialized instructions, or urgency..."
                  value={customForm.notes}
                  onChange={(e) => setCustomForm({ ...customForm, notes: e.target.value })}
                  style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCustomRequestModal(false)}
                  style={{ background: 'transparent', border: '1px solid #333', color: '#aaa', padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--gold, #c9a84c)', border: 'none', color: '#000', padding: '0.6rem 1.4rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800 }}
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerDashboard
