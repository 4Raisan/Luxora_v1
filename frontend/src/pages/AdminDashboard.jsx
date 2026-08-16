import { useState, useEffect } from 'react'
import { apiRequest } from '../services/api'
import './AdminDashboard.css'

/* ── Clean Vector SVG Icons (No Emojis) ── */
const Icons = {
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
  ),
  Building: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></svg>
  ),
  Approvals: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
  ),
  Subscriptions: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
  ),
  Bookings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg>
  ),
  Complaints: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>
  ),
  Promotions: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
  ),
  Support: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18v-6a9 9 0 0118 0v6M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>
  ),
  Reports: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
  ),
  Revenue: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
  ),
  Hourglass: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22M7 2v4.172a2 2 0 00.586 1.414L12 12l4.414-4.414A2 2 0 0017 6.172V2"/></svg>
  ),
  Gift: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 010-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 010 5"/></svg>
  )
}

export default function AdminDashboard() {
  const [adminUser] = useState(() => {
    try {
      const u = sessionStorage.getItem('user')
      if (u) {
        const parsed = JSON.parse(u)
        if (parsed.name) return parsed
      }
    } catch (_) {}
    return { name: 'Deshan Ganganath', title: 'Super Admin', email: 'deshan@luxora.com' }
  })

  const [activeNav, setActiveNav] = useState('dashboard')
  const [bookingDateFilter, setBookingDateFilter] = useState('')
  const [showNotifModal, setShowNotifModal] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [showAddProviderModal, setShowAddProviderModal] = useState(false)
  const [showAdminProfileModal, setShowAdminProfileModal] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', role: 'Customer', planOrCategory: 'Single Auto Elite' })
  const [newProviderForm, setNewProviderForm] = useState({ name: '', email: '', category: 'Auto Care', nic: '199512345678' })

  const [subscriptions, setSubscriptions] = useState(() => {
    try {
      const stored = localStorage.getItem('luxora_subscriptions')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length >= 9) {
          return parsed
        }
      }
    } catch (_) {}
    const defaultSubs = [
      // ── Auto Care Single Packages ──
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

      // ── Garden Care Single Packages ──
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

      // ── Pet Care Single Packages ──
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

      // ── Combo Packages ──
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
    try { localStorage.setItem('luxora_subscriptions', JSON.stringify(defaultSubs)) } catch (_) {}
    return defaultSubs
  })

  const [subFilter, setSubFilter] = useState('ALL')
  const [showSubModal, setShowSubModal] = useState(false)
  const [editingSub, setEditingSub] = useState(null)
  const [subForm, setSubForm] = useState({ title: '', type: 'Single Package', cat: 'Auto Care', price: '', inclusives: '' })

  const handleOpenAddSub = () => {
    setEditingSub(null)
    setSubForm({ title: '', type: 'Single Package', cat: 'Auto Care', price: '', inclusives: '' })
    setShowSubModal(true)
  }

  const handleOpenEditSub = (sub) => {
    setEditingSub(sub)
    setSubForm({
      title: sub.title,
      type: sub.type,
      cat: sub.cat,
      price: sub.price,
      inclusives: Array.isArray(sub.inclusives) ? sub.inclusives.join(', ') : sub.inclusives
    })
    setShowSubModal(true)
  }

  const handleSaveSub = (e) => {
    e.preventDefault()
    if (!subForm.title || !subForm.price) {
      alert('Please fill out Title and Price.')
      return
    }

    const inclusivesArr = typeof subForm.inclusives === 'string'
      ? subForm.inclusives.split(',').map(s => s.trim()).filter(Boolean)
      : subForm.inclusives

    const categoryVal = subForm.type === 'Combo Package' ? 'Combo Suite' : (subForm.cat || 'Auto Care')

    let updated = []
    if (editingSub) {
      updated = subscriptions.map(s => s.id === editingSub.id ? {
        ...s,
        title: subForm.title,
        type: subForm.type,
        cat: categoryVal,
        price: Number(subForm.price),
        inclusives: inclusivesArr
      } : s)
      setSubscriptions(updated)
      alert(`Package "${subForm.title}" updated successfully!`)
    } else {
      const newSub = {
        id: `SUB-${String(subscriptions.length + 1).padStart(3, '0')}`,
        title: subForm.title,
        type: subForm.type,
        cat: categoryVal,
        price: Number(subForm.price),
        subscribers: 0,
        inclusives: inclusivesArr
      }
      updated = [newSub, ...subscriptions]
      setSubscriptions(updated)
      alert(`New Package "${subForm.title}" created successfully!`)
    }

    try {
      localStorage.setItem('luxora_subscriptions', JSON.stringify(updated))
      window.dispatchEvent(new Event('luxora_subscriptions_updated'))
    } catch (_) {}

    setShowSubModal(false)
    setEditingSub(null)
    setSubForm({ title: '', type: 'Single Package', cat: 'Auto Care', price: '', inclusives: '' })
  }

  const handleDeleteSub = (subId) => {
    if (!window.confirm('Are you sure you want to delete this subscription package?')) return
    const updated = subscriptions.filter(s => s.id !== subId)
    setSubscriptions(updated)
    try {
      localStorage.setItem('luxora_subscriptions', JSON.stringify(updated))
      window.dispatchEvent(new Event('luxora_subscriptions_updated'))
    } catch (_) {}
  }



  const [notifList, setNotifList] = useState([
    { id: 1, title: 'New Booking Confirmed', desc: 'Sofia Marin booked Deep Cleaning (B-001)', time: '5 mins ago', unread: true },
    { id: 2, title: 'Provider KYC Submitted', desc: 'Nimal Silva uploaded verification documents', time: '12 mins ago', unread: true },
    { id: 3, title: 'Subscription Auto-Renewed', desc: 'Kasun Kalhara renewed Combo Luxury Suite', time: '1 hr ago', unread: true },
    { id: 4, title: 'New Complaint Filed', desc: 'Marcus Webb reported delay on C-001', time: '2 hrs ago', unread: true },
    { id: 5, title: 'Promotion Campaign Deployed', desc: 'LUXORA2026 discount code deployed', time: '3 hrs ago', unread: true },
    { id: 6, title: 'Support Ticket Created', desc: 'Sofia Marin filed TK-101 inquiry', time: '4 hrs ago', unread: true },
    { id: 7, title: 'Service Completed', desc: 'Lawn Mowing completed for Priya Nair (B-003)', time: '5 hrs ago', unread: true },
  ])
  const [stats, setStats] = useState({ totalUsers: 12841, totalProviders: 1092, totalBookings: 4230, totalRevenue: 81400 })
  const [providers, setProviders] = useState([])
  const [bookings, setBookings] = useState([])
  const [complaints, setComplaints] = useState([])
  const [promotions, setPromotions] = useState([])
  const [users, setUsers] = useState([])
  const [supportTickets, setSupportTickets] = useState([])
  const [token] = useState(localStorage.getItem('luxora_token') || sessionStorage.getItem('token') || '')

  const [newPromo, setNewPromo] = useState({ title: '', code: '', discount: '', targetPackage: 'All Packages' })

  const handleAddProviderSubmit = (e) => {
    e.preventDefault()
    if (!newProviderForm.name || !newProviderForm.email) {
      alert('Please enter Provider Name and Email.')
      return
    }

    const createdProv = {
      id: providers.length + 1,
      name: newProviderForm.name,
      email: newProviderForm.email,
      category: newProviderForm.category || 'Auto Care',
      nic: newProviderForm.nic || '199512345678',
      kyc_status: 'approved',
      rating: '5.0 / 5.0'
    }

    try {
      const storedP = localStorage.getItem('luxora_all_providers')
      const existingP = storedP ? JSON.parse(storedP) : []
      localStorage.setItem('luxora_all_providers', JSON.stringify([createdProv, ...existingP]))
    } catch (_) {}

    // Also add to User Management as Provider role
    const createdUserRecord = {
      id: `USR-${String(users.length + 1).padStart(3, '0')}`,
      name: newProviderForm.name,
      email: newProviderForm.email,
      role: 'Provider',
      registered: new Date().toISOString().split('T')[0],
      category: newProviderForm.category || 'Auto Care'
    }

    try {
      const storedU = localStorage.getItem('luxora_all_users')
      const existingU = storedU ? JSON.parse(storedU) : []
      localStorage.setItem('luxora_all_users', JSON.stringify([createdUserRecord, ...existingU]))
    } catch (_) {}

    setProviders([createdProv, ...providers])
    setUsers([createdUserRecord, ...users])
    setNewProviderForm({ name: '', email: '', category: 'Auto Care', nic: '199512345678' })
    setShowAddProviderModal(false)
    alert(`Provider ${createdProv.name} added to Providers Directory successfully!`)
  }

  const handleAddUserSubmit = (e) => {
    e.preventDefault()
    if (!newUserForm.name || !newUserForm.email) {
      alert('Please enter Name and Email.')
      return
    }

    const createdRecord = {
      id: `USR-${String(users.length + 1).padStart(3, '0')}`,
      name: newUserForm.name,
      email: newUserForm.email,
      role: newUserForm.role,
      registered: new Date().toISOString().split('T')[0],
      plan: newUserForm.role === 'Customer' ? (newUserForm.planOrCategory || 'Single Auto Elite') : undefined,
      category: newUserForm.role === 'Provider' ? (newUserForm.planOrCategory || 'Auto Care') : undefined
    }

    try {
      const stored = localStorage.getItem('luxora_all_users')
      const existing = stored ? JSON.parse(stored) : []
      localStorage.setItem('luxora_all_users', JSON.stringify([createdRecord, ...existing]))
    } catch (_) {}

    setUsers([createdRecord, ...users])

    // If role is Provider, automatically assign to Providers Directory module as well!
    if (newUserForm.role === 'Provider') {
      const newProvItem = {
        id: providers.length + 1,
        name: newUserForm.name,
        email: newUserForm.email,
        category: newUserForm.planOrCategory || 'Auto Care',
        nic: '199512345678',
        kyc_status: 'pending',
        rating: '5.0 / 5.0'
      }
      try {
        const storedP = localStorage.getItem('luxora_all_providers')
        const existingP = storedP ? JSON.parse(storedP) : []
        localStorage.setItem('luxora_all_providers', JSON.stringify([newProvItem, ...existingP]))
      } catch (_) {}
      setProviders([newProvItem, ...providers])
    }

    setNewUserForm({ name: '', email: '', role: 'Customer', planOrCategory: 'Single Auto Elite' })
    setShowAddUserModal(false)
    alert(`User ${createdRecord.name} added successfully! ${newUserForm.role === 'Provider' ? 'Also assigned to Providers Directory.' : ''}`)
  }

  useEffect(() => {
    loadAll()
  }, [token])

  useEffect(() => {
    const syncCustomerBookings = () => {
      try {
        const stored = localStorage.getItem('luxora_customer_bookings')
        if (stored) {
          const customB = JSON.parse(stored)
          if (Array.isArray(customB)) {
            const default10Bookings = [
              { id: 'B-001', customer: 'Sofia Marin', service: 'Deep Cleaning & Sanitization', status: 'CONFIRMED', color: '#4ade80', date: '2026-08-16', time: '09:00 AM', amount: 'LKR 8,500' },
              { id: 'B-002', customer: 'Marcus Webb', service: 'Full Auto Detailing & Polish', status: 'IN PROGRESS', color: '#60a5fa', date: '2026-08-16', time: '10:30 AM', amount: 'LKR 12,500' },
              { id: 'B-003', customer: 'Priya Nair', service: 'Precision Lawn Mowing', status: 'COMPLETED', color: '#c9a84c', date: '2026-08-15', time: '02:00 PM', amount: 'LKR 4,500' },
              { id: 'B-004', customer: 'James Okafor', service: 'Electrical & Wiring Check', status: 'CANCELLED', color: '#ef4444', date: '2026-08-15', time: '04:00 PM', amount: 'LKR 6,000' },
              { id: 'B-005', customer: 'Kasun Kalhara', service: 'Tri-Combo Luxury Estate Suite', status: 'CONFIRMED', color: '#4ade80', date: '2026-08-14', time: '11:00 AM', amount: 'LKR 32,000' },
              { id: 'B-006', customer: 'Ashan Perera', service: 'Auto Foam Wash & Wheel Shine', status: 'COMPLETED', color: '#c9a84c', date: '2026-08-14', time: '01:30 PM', amount: 'LKR 4,500' },
              { id: 'B-007', customer: 'Dilshan Senanayake', service: 'Pet Spa Grooming & Bathing', status: 'CONFIRMED', color: '#4ade80', date: '2026-08-13', time: '03:15 PM', amount: 'LKR 5,000' },
              { id: 'B-008', customer: 'Marco Vance', service: 'Landscape Bed Redesign', status: 'IN PROGRESS', color: '#60a5fa', date: '2026-08-12', time: '08:45 AM', amount: 'LKR 15,000' },
              { id: 'B-009', customer: 'Nimal Silva', service: 'Aquarium Water Quality & Filter', status: 'COMPLETED', color: '#c9a84c', date: '2026-08-11', time: '12:00 PM', amount: 'LKR 6,000' },
              { id: 'B-010', customer: 'Kamal Perera', service: 'Organic Fertilizer Application', status: 'CONFIRMED', color: '#4ade80', date: '2026-08-10', time: '05:00 PM', amount: 'LKR 4,000' },
            ]
            const existingIds = new Set(customB.map(b => b.id))
            const combined = [...customB]
            default10Bookings.forEach(d => {
              if (!existingIds.has(d.id)) combined.push(d)
            })
            setBookings(combined)
          }
        }
      } catch (_) {}
    }

    syncCustomerBookings()
    window.addEventListener('storage', syncCustomerBookings)
    window.addEventListener('luxora_bookings_updated', syncCustomerBookings)
    const interval = setInterval(syncCustomerBookings, 1000)
    return () => {
      window.removeEventListener('storage', syncCustomerBookings)
      window.removeEventListener('luxora_bookings_updated', syncCustomerBookings)
      clearInterval(interval)
    }
  }, [])

  const loadAll = async () => {
    try {
      const activeTok = token || sessionStorage.getItem('token')
      const [s, p, b, c, pr] = await Promise.all([
        apiRequest('/admin/stats', 'GET', null, activeTok),
        apiRequest('/admin/providers', 'GET', null, activeTok),
        apiRequest('/admin/bookings', 'GET', null, activeTok),
        apiRequest('/admin/complaints', 'GET', null, activeTok),
        apiRequest('/promotions', 'GET', null, activeTok),
      ])
      // Normalize real API data into the flat shapes this UI renders.
      // The API returns nested/relational objects (e.g. booking.service is an
      // object) which crash React if rendered directly.
      const STATUS_COLORS = { PENDING: '#eab308', ASSIGNED: '#4ade80', CONFIRMED: '#4ade80', IN_PROGRESS: '#60a5fa', COMPLETED: '#c9a84c', CANCELLED: '#ef4444' }
      const normBookings = (Array.isArray(b) ? b : []).map((x) => ({
        id: x.id,
        customer: x.customer_name || x.customer_email || 'Customer',
        service: (typeof x.service === 'string' ? x.service : x.service?.title) || x.service_title || 'Service',
        date: x.bookingDate || x.booking_date || '',
        time: x.bookingTime || x.booking_time || '',
        amount: 'LKR ' + Number(x.totalPrice ?? x.total_price ?? 0).toLocaleString(),
        status: String(x.status || '').toUpperCase(),
        color: STATUS_COLORS[String(x.status || '').toUpperCase()] || '#888',
        raw: x,
      }))
      const normComplaints = (Array.isArray(c) ? c : []).map((x) => ({
        id: x.id,
        from: x.customer_name || x.customer_email || 'Customer',
        subject: x.subject,
        description: x.description,
        date: (x.createdAt || '').slice(0, 10),
        status: String(x.status || '').toUpperCase(),
        raw: x,
      }))
      const normProviders = (Array.isArray(p) ? p : []).map((x) => ({
        id: x.id,
        name: x.name || x.email,
        email: x.email,
        category: x.category,
        nic: x.nic || '—',
        kyc_status: x.kyc_status || x.kycStatus || 'pending',
        availability: x.availability_status || x.availabilityStatus || '—',
        earnings: x.earnings,
        raw: x,
      }))
      const normPromotions = (Array.isArray(pr) ? pr : []).map((x) => ({
        id: x.id,
        title: x.title,
        code: x.code || '—',
        discount: (x.discount_percent ?? x.discountPct ?? 0) + '%',
        active: x.is_active ?? x.active ?? true,
        raw: x,
      }))
      setStats(s); setProviders(normProviders); setBookings(normBookings); setComplaints(normComplaints); setPromotions(normPromotions)
    } catch (err) {
      // Fallback data matching Figma design specifications (No emojis)
      setStats({ totalUsers: 12841, totalProviders: 1092, totalBookings: 4230, totalRevenue: 81400 })
      
      let customUsers = []
      try {
        const storedU = localStorage.getItem('luxora_all_users')
        if (storedU) customUsers = JSON.parse(storedU)
      } catch (_) {}

      const defaultUsersList = [
        { id: 'USR-001', name: 'Sofia Marin', email: 'sofia@luxora.com', role: 'Customer', registered: '2026-01-12', plan: 'Combo Luxury Suite' },
        { id: 'USR-002', name: 'Marcus Webb', email: 'marcus@luxora.com', role: 'Customer', registered: '2026-02-05', plan: 'Single Auto Elite' },
        { id: 'USR-003', name: 'Priya Nair', email: 'priya@luxora.com', role: 'Customer', registered: '2026-02-18', plan: 'Single Garden Oasis' },
        { id: 'USR-004', name: 'James Okafor', email: 'james@luxora.com', role: 'Customer', registered: '2026-03-01', plan: 'Combo Luxury Suite' },
        { id: 'USR-005', name: 'Kamal Perera', email: 'kamal@luxora.com', role: 'Provider', registered: '2026-01-02', category: 'Garden Care' },
        { id: 'USR-006', name: 'Nimal Silva', email: 'nimal@luxora.com', role: 'Provider', registered: '2026-01-15', category: 'Auto Care' },
      ]

      setUsers([...customUsers, ...defaultUsersList])

      let customProviders = []
      try {
        const storedP = localStorage.getItem('luxora_all_providers')
        if (storedP) customProviders = JSON.parse(storedP)
      } catch (_) {}

      const defaultProvidersList = [
        { id: 1, name: 'Kamal Perera', email: 'kamal@luxora.com', category: 'Garden Care', nic: '198812345678', kyc_status: 'approved', rating: '4.9 / 5.0' },
        { id: 2, name: 'Nimal Silva', email: 'nimal@luxora.com', category: 'Auto Care', nic: '199287654321', kyc_status: 'pending', rating: '4.8 / 5.0' },
        { id: 3, name: 'Sunil Fernando', email: 'sunil@luxora.com', category: 'Pet Care', nic: '199045678912', kyc_status: 'pending', rating: '5.0 / 5.0' },
        { id: 4, name: 'Marco Vance', email: 'marco@luxora.com', category: 'Auto Care', nic: '199512345678', kyc_status: 'approved', rating: '4.9 / 5.0' },
        { id: 5, name: 'Ashan Silva', email: 'ashan@luxora.com', category: 'Garden Care', nic: '199456789012', kyc_status: 'pending', rating: '4.7 / 5.0' }
      ]

      setProviders([...customProviders, ...defaultProvidersList])

      let customBookings = []
      try {
        const stored = localStorage.getItem('luxora_customer_bookings')
        if (stored) customBookings = JSON.parse(stored)
      } catch (_) {}

      const default10Bookings = [
        { id: 'B-001', customer: 'Sofia Marin', service: 'Deep Cleaning & Sanitization', status: 'CONFIRMED', color: '#4ade80', date: '2026-08-16', time: '09:00 AM', amount: 'LKR 8,500' },
        { id: 'B-002', customer: 'Marcus Webb', service: 'Full Auto Detailing & Polish', status: 'IN PROGRESS', color: '#60a5fa', date: '2026-08-16', time: '10:30 AM', amount: 'LKR 12,500' },
        { id: 'B-003', customer: 'Priya Nair', service: 'Precision Lawn Mowing', status: 'COMPLETED', color: '#c9a84c', date: '2026-08-15', time: '02:00 PM', amount: 'LKR 4,500' },
        { id: 'B-004', customer: 'James Okafor', service: 'Electrical & Wiring Check', status: 'CANCELLED', color: '#ef4444', date: '2026-08-15', time: '04:00 PM', amount: 'LKR 6,000' },
        { id: 'B-005', customer: 'Kasun Kalhara', service: 'Tri-Combo Luxury Estate Suite', status: 'CONFIRMED', color: '#4ade80', date: '2026-08-14', time: '11:00 AM', amount: 'LKR 32,000' },
        { id: 'B-006', customer: 'Ashan Perera', service: 'Auto Foam Wash & Wheel Shine', status: 'COMPLETED', color: '#c9a84c', date: '2026-08-14', time: '01:30 PM', amount: 'LKR 4,500' },
        { id: 'B-007', customer: 'Dilshan Senanayake', service: 'Pet Spa Grooming & Bathing', status: 'CONFIRMED', color: '#4ade80', date: '2026-08-13', time: '03:15 PM', amount: 'LKR 5,000' },
        { id: 'B-008', customer: 'Marco Vance', service: 'Landscape Bed Redesign', status: 'IN PROGRESS', color: '#60a5fa', date: '2026-08-12', time: '08:45 AM', amount: 'LKR 15,000' },
        { id: 'B-009', customer: 'Nimal Silva', service: 'Aquarium Water Quality & Filter', status: 'COMPLETED', color: '#c9a84c', date: '2026-08-11', time: '12:00 PM', amount: 'LKR 6,000' },
        { id: 'B-010', customer: 'Kamal Perera', service: 'Organic Fertilizer Application', status: 'CONFIRMED', color: '#4ade80', date: '2026-08-10', time: '05:00 PM', amount: 'LKR 4,000' },
      ]

      setBookings([...customBookings, ...default10Bookings])
      setComplaints([
        { id: 'C-001', from: 'Marcus Webb', priority: 'HIGH', status: 'OPEN', statusBg: '#991b1b', priorityColor: '#ef4444', detail: 'Provider delay on arrival' },
        { id: 'C-002', from: 'Priya Nair', priority: 'MEDIUM', status: 'INVESTIGATING', statusBg: '#1e3a8a', priorityColor: '#eab308', detail: 'Clarification on lawn treatment' },
        { id: 'C-003', from: 'Sofia Marin', priority: 'HIGH', status: 'RESOLVED', statusBg: '#854d0e', priorityColor: '#ef4444', detail: 'Followed up and satisfied' },
        { id: 'C-004', from: 'James Okafor', priority: 'LOW', status: 'RESOLVED', statusBg: '#854d0e', priorityColor: '#60a5fa', detail: 'Refund inquiry processed' }
      ])
      setPromotions([
        { id: 'PR-001', code: 'LUXORA2026', title: '20% Off First Concierge Service', discount: '20%', targetPackage: 'All Packages', status: 'ACTIVE' },
        { id: 'PR-002', code: 'SUMMERVIP', title: 'Complimentary Detailing Upgrade', discount: '15%', targetPackage: 'Single Package: Auto Elite Care', status: 'ACTIVE' },
        { id: 'PR-003', code: 'ESTATE50', title: '50% Off Garden Maintenance', discount: '50%', targetPackage: 'Single Package: Garden Oasis Sanctuary', status: 'ACTIVE' }
      ])
      setSupportTickets([
        { id: 'TK-101', customer: 'Sofia Marin', issue: 'Billing inquiry regarding combo tier', priority: 'High', status: 'In Review' },
        { id: 'TK-102', customer: 'Marcus Webb', issue: 'Rescheduling weekend detailing', priority: 'Normal', status: 'Open' },
        { id: 'TK-103', customer: 'Priya Nair', issue: 'Requesting additional fertilizer treatment', priority: 'Low', status: 'Resolved' },
      ])
    }
  }

  const handleKyc = async (id, status) => {
    try { await apiRequest(`/admin/providers/${id}/kyc`, 'PUT', { status }, token) } catch (_) {}

    setProviders(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, kyc_status: status } : p)
      try {
        localStorage.setItem('luxora_all_providers', JSON.stringify(updated))
      } catch (_) {}
      return updated
    })

    const target = providers.find(p => p.id === id)
    if (target) {
      setUsers(prev => {
        const updatedUsers = prev.map(u => u.email === target.email ? { ...u, role: 'Provider', category: target.category } : u)
        try {
          localStorage.setItem('luxora_all_users', JSON.stringify(updatedUsers))
        } catch (_) {}
        return updatedUsers
      })
      alert(`✅ Provider ${target.name} has been ${status.toUpperCase()}! They are now fully active in the Providers Directory.`)
    }
  }

  const handleComplaintStatus = (id, newStatus) => {
    const bgMap = { 'OPEN': '#991b1b', 'INVESTIGATING': '#1e3a8a', 'RESOLVED': '#854d0e' }
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: newStatus, statusBg: bgMap[newStatus] || '#854d0e' } : c))
  }

  const handleAddPromo = (e) => {
    e.preventDefault()
    if (!newPromo.code || !newPromo.title) return
    const p = {
      id: `PR-00${promotions.length + 1}`,
      code: newPromo.code.toUpperCase(),
      title: newPromo.title,
      discount: newPromo.discount || '15%',
      targetPackage: newPromo.targetPackage || 'All Packages',
      status: 'ACTIVE'
    }
    setPromotions([p, ...promotions])
    setNewPromo({ title: '', code: '', discount: '', targetPackage: 'All Packages' })
  }

  const handleRemovePromo = (id) => {
    setPromotions(prev => prev.filter(p => p.id !== id))
  }

  const handleSignOut = () => {
    sessionStorage.clear()
    localStorage.removeItem('luxora_token')
    window.location.href = '/'
  }

  const handleResetDashboard = () => {
    setStats({ totalUsers: 0, totalProviders: 0, totalBookings: 0, totalRevenue: 0 })
    setBookings([])
    setComplaints([])
    setNotifList([])
    setProviders([])
    setUsers([])
    setPromotions([])
    setSupportTickets([])
    alert('All dashboard values have been reset to 0!')
  }

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { id: 'users', label: 'User Management', icon: Icons.Users },
    { id: 'providers', label: 'Providers', icon: Icons.Building },
    { id: 'approvals', label: 'Approvals', icon: Icons.Approvals },
    { id: 'subscriptions', label: 'Subscriptions', icon: Icons.Subscriptions },
    { id: 'bookings', label: 'Bookings', icon: Icons.Bookings },
    { id: 'complaints', label: 'Complaints', icon: Icons.Complaints },
    { id: 'promotions', label: 'Promotions', icon: Icons.Promotions },
    { id: 'support', label: 'Support', icon: Icons.Support },
    { id: 'reports', label: 'Reports & Analysis', icon: Icons.Reports },
  ]

  return (
    <div className="ad-wrapper">
      {/* ── Sidebar ── */}
      <aside className="ad-sidebar">
        <div className="ad-sidebar__logo">
          <img src="/luxora-logo.png" alt="LUXORA" className="ad-logo-img" />
        </div>

        <nav className="ad-nav">
          {NAV_ITEMS.map((item) => {
            const IconComp = item.icon
            return (
              <button
                key={item.id}
                className={`ad-nav__item ${activeNav === item.id ? 'ad-nav__item--active' : ''}`}
                onClick={() => setActiveNav(item.id)}
              >
                <span className="ad-nav__icon"><IconComp /></span>
                <span className="ad-nav__label">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* ── Main Workspace ── */}
      <main className="ad-main">
        {/* Top Header */}
        <header className="ad-topbar">
          <span className="ad-topbar__eyebrow">DASHBOARD</span>
          
          <div className="ad-topbar__actions">
            <button className="ad-topbar__notif-btn" aria-label="Notifications" onClick={() => setShowNotifModal(true)}>
              <Icons.Bell />
              {notifList.length > 0 && <span className="ad-notif-count">{notifList.length}</span>}
            </button>

            <div
              className="ad-user-pill"
              onClick={() => setShowAdminProfileModal(true)}
              style={{ cursor: 'pointer' }}
              title="Click to view Administrator Profile Details"
            >
              <div className="ad-user-avatar">
                {(adminUser.name || 'Deshan Ganganath').charAt(0)}
              </div>
              <div className="ad-user-info">
                <span className="ad-user-name">{adminUser.name || 'Deshan Ganganath'}</span>
                <span className="ad-user-role">Super Admin <span className="ad-user-dot">●</span></span>
              </div>
            </div>



            <button className="ad-logout-btn" onClick={handleSignOut} title="Sign Out">
              Sign Out
            </button>
          </div>
        </header>

        {/* Workspace Content */}
        <div className="ad-content">
          {activeNav === 'dashboard' && (
            <>
              {/* Hero Banner */}
              <div className="ad-hero">
                <div className="ad-hero__overlay" />
                <div className="ad-hero__content">
                  <p className="ad-hero__eyebrow">WELCOME BACK, {(adminUser.name || 'TARIQ HASSAN').toUpperCase()}</p>
                  <h1 className="ad-hero__title">Platform Overview</h1>
                  <p className="ad-hero__sub">August 15, 2026 · All systems operational</p>
                </div>
              </div>

              {/* Metrics Grid Row 1 & Row 2 */}
              <div className="ad-metrics-grid">
                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">TOTAL USERS</span>
                    <span className="ad-metric-icon"><Icons.Users /></span>
                  </div>
                  <h2 className="ad-metric-val">{(stats.totalUsers ?? 0).toLocaleString()}</h2>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">ACTIVE PROVIDERS</span>
                    <span className="ad-metric-icon"><Icons.Building /></span>
                  </div>
                  <h2 className="ad-metric-val">{(stats.totalProviders ?? 0).toLocaleString()}</h2>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">BOOKINGS MTD</span>
                    <span className="ad-metric-icon"><Icons.Bookings /></span>
                  </div>
                  <h2 className="ad-metric-val">{(stats.totalBookings ?? 0).toLocaleString()}</h2>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">REVENUE MTD</span>
                    <span className="ad-metric-icon"><Icons.Revenue /></span>
                  </div>
                  <h2 className="ad-metric-val">LKR {(Number(stats.totalRevenue ?? 0)).toLocaleString()}</h2>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">OPEN COMPLAINTS</span>
                    <span className="ad-metric-icon" style={{ color: '#eab308' }}><Icons.Complaints /></span>
                  </div>
                  <h2 className="ad-metric-val" style={{ color: '#fff' }}>{stats.openComplaints ?? 0}</h2>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">SUPPORT TICKETS</span>
                    <span className="ad-metric-icon"><Icons.Support /></span>
                  </div>
                  <h2 className="ad-metric-val">{complaints.length}</h2>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">PENDING APPROVALS</span>
                    <span className="ad-metric-icon"><Icons.Hourglass /></span>
                  </div>
                  <h2 className="ad-metric-val">{providers.filter(p => (p.kyc_status || '').toLowerCase() === 'pending').length}</h2>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">ACTIVE PROMOS</span>
                    <span className="ad-metric-icon"><Icons.Gift /></span>
                  </div>
                  <h2 className="ad-metric-val">{promotions.filter(x => x.active).length}</h2>
                </div>
              </div>

              {/* Lower Section: Tables Grid */}
              <div className="ad-tables-grid">
                {/* Recent Bookings Table (Top 10 Linked Customer Bookings) */}
                <div className="ad-table-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <h3 className="ad-table-title" style={{ margin: 0 }}>RECENT CUSTOMER BOOKINGS (10 RECENT)</h3>
                    <button className="ad-reset-btn" onClick={() => setActiveNav('bookings')} style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem' }}>View All Bookings →</button>
                  </div>
                  <table className="ad-data-table">
                    <thead>
                      <tr>
                        <th>BOOKING ID</th>
                        <th>CUSTOMER</th>
                        <th>SERVICE</th>
                        <th>DATE & TIME</th>
                        <th>AMOUNT</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.slice(0, 10).map((b) => (
                        <tr key={b.id}>
                          <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{b.id}</td>
                          <td style={{ color: '#fff', fontWeight: 600 }}>{b.customer}</td>
                          <td style={{ color: '#ccc' }}>{b.service}</td>
                          <td style={{ color: '#888', fontSize: '0.8rem' }}>{b.date} · {b.time || '10:00 AM'}</td>
                          <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{b.amount || 'LKR 8,500'}</td>
                          <td>
                            <span className="ad-badge-status" style={{ borderColor: b.color, color: b.color }}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Active Complaints Table */}
                <div className="ad-table-card">
                  <h3 className="ad-table-title">ACTIVE COMPLAINTS</h3>
                  <table className="ad-data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>FROM</th>
                        <th>PRIORITY</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complaints.map((c) => (
                        <tr key={c.id}>
                          <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{c.id}</td>
                          <td style={{ color: '#fff' }}>{c.from}</td>
                          <td>
                            <span className="ad-badge-priority" style={{ borderColor: c.priorityColor, color: c.priorityColor }}>
                              {c.priority}
                            </span>
                          </td>
                          <td>
                            <span className="ad-badge-fill" style={{ background: c.statusBg, color: '#fff' }}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeNav === 'users' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 className="ad-table-title" style={{ margin: 0 }}>USER MANAGEMENT DIRECTORY ({users.length})</h3>
                <button
                  className="ad-reset-btn"
                  onClick={() => setShowAddUserModal(true)}
                  style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontWeight: 700, border: 'none', padding: '0.5rem 1rem' }}
                >
                  + Add New User (Manual)
                </button>
              </div>
              <table className="ad-data-table">
                <thead>
                  <tr>
                    <th>USER ID</th>
                    <th>NAME</th>
                    <th>EMAIL</th>
                    <th>ROLE</th>
                    <th>REGISTERED</th>
                    <th>SUBSCRIPTION / CATEGORY</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{u.id}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{u.name}</td>
                      <td style={{ color: '#ccc' }}>{u.email}</td>
                      <td>
                        <span className="ad-badge-fill" style={{ background: u.role === 'Admin' ? '#991b1b' : u.role === 'Provider' ? '#1e3a8a' : '#14532d', color: '#fff' }}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ color: '#888', fontSize: '0.8rem' }}>{u.registered || '2026-08-16'}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 500 }}>{u.plan || u.category || 'Standard'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeNav === 'providers' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 className="ad-table-title" style={{ margin: 0 }}>SERVICE PROVIDERS DIRECTORY ({providers.length})</h3>
                <button
                  className="ad-reset-btn"
                  onClick={() => setShowAddProviderModal(true)}
                  style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontWeight: 700, border: 'none', padding: '0.5rem 1rem' }}
                >
                  + Add New Provider
                </button>
              </div>
              <table className="ad-data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>NAME</th>
                    <th>EMAIL</th>
                    <th>CATEGORY</th>
                    <th>NIC NUMBER</th>
                    <th>RATING</th>
                    <th>KYC STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--gold)' }}>PRO-00{p.id}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ color: '#aaa' }}>{p.email}</td>
                      <td style={{ color: '#ccc' }}>{p.category}</td>
                      <td>{p.nic || 'N/A'}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{p.rating || '4.8 / 5.0'}</td>
                      <td>
                        <span className="ad-badge-status" style={{
                          borderColor: p.kyc_status === 'approved' ? '#4ade80' : '#eab308',
                          color: p.kyc_status === 'approved' ? '#4ade80' : '#eab308'
                        }}>
                          {p.kyc_status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeNav === 'approvals' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">PENDING PROVIDER KYC APPROVALS</h3>
              <table className="ad-data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>NAME</th>
                    <th>EMAIL</th>
                    <th>CATEGORY</th>
                    <th>NIC DOCUMENT</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--gold)' }}>PRO-00{p.id}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ color: '#aaa' }}>{p.email}</td>
                      <td style={{ color: '#ccc' }}>{p.category}</td>
                      <td style={{ fontFamily: 'monospace' }}>{p.nic || '199287654321'}</td>
                      <td>
                        <span className="ad-badge-status" style={{
                          borderColor: p.kyc_status === 'approved' ? '#4ade80' : '#eab308',
                          color: p.kyc_status === 'approved' ? '#4ade80' : '#eab308'
                        }}>
                          {p.kyc_status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {p.kyc_status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="ad-btn-approve" onClick={() => handleKyc(p.id, 'approved')}>Approve</button>
                            <button className="ad-btn-reject" onClick={() => handleKyc(p.id, 'rejected')}>Reject</button>
                          </div>
                        ) : (
                          <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 700 }}>Verified</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeNav === 'subscriptions' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 className="ad-table-title" style={{ margin: 0 }}>ESTATE SUBSCRIPTION TIERS & INCLUSIVES</h3>
                  <p style={{ color: '#888', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>Manage single & combo packages, pricing, and service inclusives</p>
                </div>
                <button
                  className="ad-reset-btn"
                  onClick={handleOpenAddSub}
                  style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontWeight: 700, border: 'none', padding: '0.5rem 1rem' }}
                >
                  + Add Package
                </button>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {['ALL', 'Single Package', 'Combo Package'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSubFilter(f)}
                    style={{
                      background: subFilter === f ? 'var(--gold, #c9a84c)' : '#181818',
                      color: subFilter === f ? '#000' : '#aaa',
                      border: '1px solid #333',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Grid of Subscription Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {subscriptions
                  .filter(s => subFilter === 'ALL' || s.type === subFilter)
                  .map((s) => (
                    <div
                      key={s.id}
                      style={{
                        background: '#161616',
                        padding: '1.5rem',
                        borderRadius: '12px',
                        border: s.type === 'Combo Package' ? '1px solid var(--gold, #c9a84c)' : '1px solid #282828',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        boxShadow: s.type === 'Combo Package' ? '0 0 20px rgba(201, 168, 76, 0.08)' : 'none'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{
                            background: s.type === 'Combo Package' ? 'rgba(201, 168, 76, 0.15)' : '#222',
                            color: 'var(--gold, #c9a84c)',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            letterSpacing: '0.08em'
                          }}>
                            {s.type.toUpperCase()} · {s.cat.toUpperCase()}
                          </span>
                          <span style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600 }}>{s.id}</span>
                        </div>

                        <h3 style={{ color: '#fff', fontSize: '1.25rem', margin: '0.5rem 0 0.25rem 0', fontWeight: 800 }}>{s.title}</h3>
                        <p style={{ color: 'var(--gold, #c9a84c)', fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
                          LKR {Number(s.price).toLocaleString()} <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 400 }}>/ mo</span>
                        </p>
                        <p style={{ color: '#777', fontSize: '0.78rem', margin: '0.25rem 0 0.75rem 0' }}>Active Subscribers: <strong style={{ color: '#fff' }}>{s.subscribers}</strong></p>

                        <div style={{ borderTop: '1px solid #252525', paddingTop: '0.75rem' }}>
                          <span style={{ fontSize: '0.72rem', color: '#aaa', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>PACKAGE INCLUSIVES:</span>
                          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#ccc', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {Array.isArray(s.inclusives) ? s.inclusives.map((inc, i) => (
                              <li key={i} style={{ color: '#bbb' }}>{inc}</li>
                            )) : <li style={{ color: '#bbb' }}>{s.inclusives}</li>}
                          </ul>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button
                          className="ad-reset-btn"
                          onClick={() => handleOpenEditSub(s)}
                          style={{ flex: 1, textAlign: 'center' }}
                        >
                          Edit Pricing & Inclusives
                        </button>
                        <button
                          className="ad-btn-reject"
                          onClick={() => handleDeleteSub(s.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            padding: '0.5rem 0.85rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          title="Remove this subscription plan"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeNav === 'bookings' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 className="ad-table-title" style={{ margin: 0 }}>ALL PLATFORM BOOKINGS</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: 600 }}>Filter by Date:</label>
                  <input
                    type="date"
                    className="ad-date-input"
                    value={bookingDateFilter}
                    onChange={(e) => setBookingDateFilter(e.target.value)}
                    style={{ background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem' }}
                  />
                  {bookingDateFilter && (
                    <button
                      className="ad-reset-btn"
                      onClick={() => setBookingDateFilter('')}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                    >
                      Clear Date Filter
                    </button>
                  )}
                </div>
              </div>

              <table className="ad-data-table">
                <thead>
                  <tr>
                    <th>BOOKING ID</th>
                    <th>CUSTOMER</th>
                    <th>SERVICE</th>
                    <th>DATE & TIME</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {(bookingDateFilter ? bookings.filter(b => b.date === bookingDateFilter) : bookings).map((b) => (
                    <tr key={b.id}>
                      <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{b.id}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{b.customer}</td>
                      <td style={{ color: '#ccc' }}>{b.service}</td>
                      <td style={{ color: '#888', fontSize: '0.8rem' }}>{b.date} · {b.time || '10:00 AM'}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{b.amount || 'LKR 8,500'}</td>
                      <td>
                        <span className="ad-badge-status" style={{ borderColor: b.color || '#4ade80', color: b.color || '#4ade80' }}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeNav === 'complaints' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">COMPLAINTS DESK & AUDIT LOG</h3>
              <table className="ad-data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>FROM</th>
                    <th>ISSUE DETAIL</th>
                    <th>PRIORITY</th>
                    <th>STATUS</th>
                    <th>STATUS OVERRIDE</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((c) => (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{c.id}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{c.from}</td>
                      <td style={{ color: '#aaa' }}>{c.detail || 'Service follow up'}</td>
                      <td>
                        <span className="ad-badge-priority" style={{ borderColor: c.priorityColor, color: c.priorityColor }}>
                          {c.priority}
                        </span>
                      </td>
                      <td>
                        <span className="ad-badge-fill" style={{ background: c.statusBg, color: '#fff' }}>
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <select
                          style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}
                          value={c.status}
                          onChange={(e) => handleComplaintStatus(c.id, e.target.value)}
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="INVESTIGATING">INVESTIGATING</option>
                          <option value="RESOLVED">RESOLVED</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeNav === 'promotions' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">ACTIVE PROMOTION CAMPAIGNS</h3>

              <form onSubmit={handleAddPromo} style={{ background: '#161616', padding: '1.25rem', borderRadius: '12px', border: '1px solid #282828', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    required
                    placeholder="Promo Title (e.g. VIP Concierge Upgrade)"
                    value={newPromo.title}
                    onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })}
                    style={{ flex: '2 1 220px', background: '#0a0a0a', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Promo Code (e.g. LUXORA2026)"
                    value={newPromo.code}
                    onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value })}
                    style={{ flex: '1 1 140px', background: '#0a0a0a', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', textTransform: 'uppercase' }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Discount (e.g. 20%)"
                    value={newPromo.discount}
                    onChange={(e) => setNewPromo({ ...newPromo, discount: e.target.value })}
                    style={{ flex: '1 1 110px', background: '#0a0a0a', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                  <button type="submit" className="ad-btn-approve" style={{ padding: '0.65rem 1.5rem', whiteSpace: 'nowrap', fontWeight: 700 }}>+ Deploy Promo</button>
                </div>

                <div style={{ borderTop: '1px solid #252525', paddingTop: '0.85rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--gold, #c9a84c)', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                    SELECT APPLICABLE SUBSCRIPTION PACKAGE:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setNewPromo({ ...newPromo, targetPackage: 'All Packages' })}
                      style={{
                        background: newPromo.targetPackage === 'All Packages' ? 'var(--gold, #c9a84c)' : '#222',
                        color: newPromo.targetPackage === 'All Packages' ? '#000' : '#ccc',
                        border: newPromo.targetPackage === 'All Packages' ? '1px solid var(--gold, #c9a84c)' : '1px solid #333',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      🌐 All Packages
                    </button>
                    {subscriptions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setNewPromo({ ...newPromo, targetPackage: s.title })}
                        style={{
                          background: newPromo.targetPackage === s.title ? 'var(--gold, #c9a84c)' : '#222',
                          color: newPromo.targetPackage === s.title ? '#000' : '#ccc',
                          border: newPromo.targetPackage === s.title ? '1px solid var(--gold, #c9a84c)' : '1px solid #333',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '20px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {s.type === 'Combo Package' ? '👑' : '⭐'} {s.title.replace('Single Package: ', '').replace('Combo Package: ', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              <table className="ad-data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>PROMO CODE</th>
                    <th>TITLE</th>
                    <th>DISCOUNT</th>
                    <th>APPLICABLE PACKAGE</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((p) => (
                    <tr key={p.id}>
                      <td style={{ color: '#888' }}>{p.id}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: 'monospace' }}>{p.code}</td>
                      <td style={{ color: '#fff' }}>{p.title}</td>
                      <td style={{ color: '#4ade80', fontWeight: 700 }}>{p.discount}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 600, fontSize: '0.82rem' }}>{p.targetPackage || 'All Packages'}</td>
                      <td>
                        <span className="ad-badge-status" style={{ borderColor: '#4ade80', color: '#4ade80' }}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="ad-btn-reject"
                          onClick={() => handleRemovePromo(p.id)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeNav === 'support' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">VIP CONCIERGE SUPPORT TICKETS</h3>
              <table className="ad-data-table">
                <thead>
                  <tr>
                    <th>TICKET ID</th>
                    <th>CLIENT</th>
                    <th>CONCIERGE INQUIRY</th>
                    <th>PRIORITY</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {supportTickets.map((t) => (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{t.id}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{t.customer}</td>
                      <td style={{ color: '#ccc' }}>{t.issue}</td>
                      <td>
                        <span className="ad-badge-priority" style={{ borderColor: t.priority === 'High' ? '#ef4444' : '#60a5fa', color: t.priority === 'High' ? '#ef4444' : '#60a5fa' }}>
                          {t.priority.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="ad-badge-status" style={{ borderColor: '#eab308', color: '#eab308' }}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeNav === 'reports' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">PERFORMANCE REPORTS & REVENUE ANALYSIS</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={{ background: '#161616', padding: '1.5rem', borderRadius: '10px', border: '1px solid #282828' }}>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.5rem 0' }}>Monthly System Metrics</h4>
                  <p style={{ color: '#888', fontSize: '0.82rem' }}>Total Active Users: 12,841 MTD</p>
                  <p style={{ color: '#888', fontSize: '0.82rem' }}>Provider Retention Rate: Verified</p>
                  <p style={{ color: '#888', fontSize: '0.82rem' }}>Booking Completion Status: Active</p>
                </div>
                <div style={{ background: '#161616', padding: '1.5rem', borderRadius: '10px', border: '1px solid #282828' }}>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.5rem 0' }}>Financial Summary</h4>
                  <p style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 800 }}>LKR 81,400 Revenue MTD</p>
                  <p style={{ color: '#888', fontSize: '0.85rem' }}>Current Billing Cycle</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Centered Notification Popup Modal ── */}
      {showNotifModal && (
        <div className="ad-notif-overlay" onClick={() => setShowNotifModal(false)}>
          <div className="ad-notif-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ad-notif-modal__header">
              <div>
                <span className="ad-notif-modal__eyebrow">SYSTEM NOTIFICATIONS</span>
                <h3 className="ad-notif-modal__title">Activity Feed ({notifList.length})</h3>
              </div>
              <button className="ad-notif-modal__close" onClick={() => setShowNotifModal(false)}>✕</button>
            </div>

            <div className="ad-notif-modal__list">
              {notifList.length === 0 ? (
                <p className="ad-notif-empty">No unread notifications.</p>
              ) : (
                notifList.map((n) => (
                  <div key={n.id} className={`ad-notif-card ${n.unread ? 'unread' : ''}`}>
                    <div className="ad-notif-card__top">
                      <span className="ad-notif-card__title">{n.title}</span>
                      <span className="ad-notif-card__time">{n.time}</span>
                    </div>
                    <p className="ad-notif-card__desc">{n.desc}</p>
                  </div>
                ))
              )}
            </div>

            <div className="ad-notif-modal__footer">
              <button className="ad-notif-clear-btn" onClick={() => setNotifList([])}>Clear All Notifications</button>
              <button className="ad-notif-close-btn" onClick={() => setShowNotifModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add User Manual Popup Modal ── */}
      {showAddUserModal && (
        <div className="ad-notif-overlay" onClick={() => setShowAddUserModal(false)}>
          <div className="ad-notif-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="ad-notif-modal__header">
              <div>
                <span className="ad-notif-modal__eyebrow">ADMIN DIRECTORY</span>
                <h3 className="ad-notif-modal__title">Add New User (Manual)</h3>
              </div>
              <button className="ad-notif-modal__close" onClick={() => setShowAddUserModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>FULL NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ruwan Jayasinghe"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ruwan@luxora.com"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>ROLE</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <option value="Customer">Customer</option>
                    <option value="Provider">Provider</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>PLAN / CATEGORY</label>
                  <input
                    type="text"
                    placeholder="e.g. Single Auto Elite"
                    value={newUserForm.planOrCategory}
                    onChange={(e) => setNewUserForm({ ...newUserForm, planOrCategory: e.target.value })}
                    style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div className="ad-notif-modal__footer" style={{ marginTop: '0.75rem' }}>
                <button type="button" className="ad-notif-clear-btn" onClick={() => setShowAddUserModal(false)}>Cancel</button>
                <button type="submit" className="ad-notif-close-btn">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Provider Manual Popup Modal ── */}
      {showAddProviderModal && (
        <div className="ad-notif-overlay" onClick={() => setShowAddProviderModal(false)}>
          <div className="ad-notif-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="ad-notif-modal__header">
              <div>
                <span className="ad-notif-modal__eyebrow">PROVIDERS DIRECTORY</span>
                <h3 className="ad-notif-modal__title">Add New Service Provider</h3>
              </div>
              <button className="ad-notif-modal__close" onClick={() => setShowAddProviderModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddProviderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>PROVIDER NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kasun Fernando"
                  value={newProviderForm.name}
                  onChange={(e) => setNewProviderForm({ ...newProviderForm, name: e.target.value })}
                  style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. kasun@luxora.com"
                  value={newProviderForm.email}
                  onChange={(e) => setNewProviderForm({ ...newProviderForm, email: e.target.value })}
                  style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>SERVICE CATEGORY</label>
                  <select
                    value={newProviderForm.category}
                    onChange={(e) => setNewProviderForm({ ...newProviderForm, category: e.target.value })}
                    style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <option value="Auto Care">Auto Care</option>
                    <option value="Garden Care">Garden Care</option>
                    <option value="Pet Care">Pet Care</option>
                    <option value="Concierge">Concierge</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>NIC NUMBER</label>
                  <input
                    type="text"
                    placeholder="e.g. 199512345678"
                    value={newProviderForm.nic}
                    onChange={(e) => setNewProviderForm({ ...newProviderForm, nic: e.target.value })}
                    style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div className="ad-notif-modal__footer" style={{ marginTop: '0.75rem' }}>
                <button type="button" className="ad-notif-clear-btn" onClick={() => setShowAddProviderModal(false)}>Cancel</button>
                <button type="submit" className="ad-notif-close-btn">Add Provider</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add / Edit Subscription Package Modal ── */}
      {showSubModal && (
        <div className="ad-notif-overlay" onClick={() => setShowSubModal(false)}>
          <div className="ad-notif-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="ad-notif-modal__header">
              <div>
                <span className="ad-notif-modal__eyebrow">ESTATE TIERS</span>
                <h3 className="ad-notif-modal__title">{editingSub ? 'Edit Package & Inclusives' : 'Create Subscription Package'}</h3>
              </div>
              <button className="ad-notif-modal__close" onClick={() => setShowSubModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveSub} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>PACKAGE TITLE</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tri-Combo Luxury Suite"
                  value={subForm.title}
                  onChange={(e) => setSubForm({ ...subForm, title: e.target.value })}
                  style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: subForm.type === 'Combo Package' ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>TIER TYPE</label>
                  <select
                    value={subForm.type}
                    onChange={(e) => setSubForm({ ...subForm, type: e.target.value })}
                    style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <option value="Single Package">Single Package</option>
                    <option value="Combo Package">Combo Package</option>
                  </select>
                </div>

                {subForm.type !== 'Combo Package' && (
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>SERVICE CATEGORY</label>
                    <select
                      value={subForm.cat || 'Auto Care'}
                      onChange={(e) => setSubForm({ ...subForm, cat: e.target.value })}
                      style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                      <option value="Auto Care">Auto Care</option>
                      <option value="Garden Care">Garden Care</option>
                      <option value="Pet Care">Pet Care</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>MONTHLY PRICE (LKR)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 32000"
                  value={subForm.price}
                  onChange={(e) => setSubForm({ ...subForm, price: e.target.value })}
                  style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>PACKAGE INCLUSIVES (Comma Separated)</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Bi-weekly foam wash, Interior vacuuming, 24/7 priority emergency dispatch"
                  value={subForm.inclusives}
                  onChange={(e) => setSubForm({ ...subForm, inclusives: e.target.value })}
                  style={{ width: '100%', background: '#181818', color: '#fff', border: '1px solid #333', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              <div className="ad-notif-modal__footer" style={{ marginTop: '0.75rem' }}>
                <button type="button" className="ad-notif-clear-btn" onClick={() => setShowSubModal(false)}>Cancel</button>
                <button type="submit" className="ad-notif-close-btn">{editingSub ? 'Save Changes' : 'Create Package'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Administrator Profile Modal ── */}
      {showAdminProfileModal && (
        <div className="ad-notif-overlay" onClick={() => setShowAdminProfileModal(false)}>
          <div className="ad-notif-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="ad-notif-modal__header">
              <div>
                <span className="ad-notif-modal__eyebrow">SUPER ADMIN PROFILE</span>
                <h3 className="ad-notif-modal__title">Administrator Details</h3>
              </div>
              <button className="ad-notif-modal__close" onClick={() => setShowAdminProfileModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem', background: '#161616', borderRadius: '12px', border: '1px solid var(--gold, #c9a84c)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--gold, #c9a84c)', color: '#000', fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(adminUser.name || 'Deshan Ganganath').charAt(0)}
              </div>
              <div>
                <h4 style={{ color: '#fff', fontSize: '1.15rem', margin: 0, fontWeight: 800 }}>{adminUser.name || 'Deshan Ganganath'}</h4>
                <p style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.82rem', margin: '0.15rem 0 0 0', fontWeight: 700 }}>Super Admin (Full Platform Access)</p>
                <span style={{ color: '#4ade80', fontSize: '0.72rem', fontWeight: 600, display: 'block', marginTop: '0.25rem' }}>● Active Security Session</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
              <div style={{ background: '#181818', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #282828' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, display: 'block' }}>EMAIL ADDRESS</span>
                <span style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600 }}>{adminUser.email || 'deshan@luxora.com'}</span>
              </div>

              <div style={{ background: '#181818', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #282828' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, display: 'block' }}>PHONE NUMBER</span>
                <span style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600 }}>{adminUser.phone || '+94 77 987 6543'}</span>
              </div>

              <div style={{ background: '#181818', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #282828' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, display: 'block' }}>PLATFORM PERMISSIONS</span>
                <span style={{ color: '#4ade80', fontSize: '0.82rem', fontWeight: 700 }}>Full Read/Write Access across all 10 Modules</span>
              </div>
            </div>

            <div className="ad-notif-modal__footer" style={{ marginTop: '0.75rem' }}>
              <button type="button" className="ad-notif-clear-btn" onClick={handleSignOut}>Sign Out</button>
              <button type="button" className="ad-notif-close-btn" onClick={() => setShowAdminProfileModal(false)}>Close Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
