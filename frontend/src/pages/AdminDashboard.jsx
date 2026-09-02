import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE, apiRequest } from '../services/api'
import { ActionButton } from '../components/ui'
import LogoutOverlay from '../components/LogoutOverlay'
import './AdminDashboard.css'

/* Admin control center — backup visual language (ad- design system),
   wired end-to-end to the live backend. Every section renders real data
   only: no seeded catalogues, no sample analytics, no local caches. */

const Icons = {
  Dashboard: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>),
  Users: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M16 4.5a3.5 3.5 0 010 7M18 20c0-2.2-.9-3.9-2.4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Building: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Approvals: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Subscriptions: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M3 10h18" stroke="currentColor" strokeWidth="1.8"/><path d="M7 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Bookings: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  CancellationRequests: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4v5c0 4.7-3.1 7.9-8 9-4.9-1.1-8-4.3-8-9V7l8-4z" stroke="currentColor" strokeWidth="1.8"/><path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Complaints: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 3l9.5 16.5H2.5L12 3z" stroke="currentColor" strokeWidth="1.8"/><path d="M12 10v4M12 17.2v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Promotions: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M20 12l-8-8H4v8l8 8 8-8z" stroke="currentColor" strokeWidth="1.8"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/></svg>),
  Support: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 13a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.8"/><rect x="2.5" y="13" width="4" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.8"/><rect x="17.5" y="13" width="4" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.8"/><path d="M19.5 19a3.5 3.5 0 01-3.5 3h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Reports: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Operations: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Bell: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" stroke="currentColor" strokeWidth="1.8"/><path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8"/></svg>),
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
  { id: 'users', label: 'User Management', icon: Icons.Users },
  { id: 'providers', label: 'Providers', icon: Icons.Building },
  { id: 'approvals', label: 'Approvals', icon: Icons.Approvals },
  { id: 'subscriptions', label: 'Packages', icon: Icons.Subscriptions },
  { id: 'session_payouts', label: 'Session Payouts', icon: Icons.Subscriptions },
  { id: 'bookings', label: 'Bookings', icon: Icons.Bookings },
  { id: 'cancellation_requests', label: 'Cancellation Requests', icon: Icons.CancellationRequests },
  { id: 'complaints', label: 'Complaints', icon: Icons.Complaints },
  { id: 'support', label: 'Support Desk', icon: Icons.Support },
  { id: 'promotions', label: 'Promotions', icon: Icons.Promotions },
  { id: 'reports', label: 'Reports & Analysis', icon: Icons.Reports },
  { id: 'operations', label: 'Operations', icon: Icons.Operations },
]

const fmtMoney = (v) => 'LKR ' + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
const bookingCareLabel = (booking) => booking?.category_name || booking?.service_title || '—'
const cancellationRequestBookingId = (ticket) => {
  const match = String(ticket?.subject || '').match(/^Booking #(\d+) cancellation request$/i)
  return match ? Number(match[1]) : null
}
const statusColor = (s) => ({
  completed: '#4ade80', confirmed: '#4ade80', approved: '#4ade80', active: '#4ade80', resolved: '#4ade80', refunded: '#4ade80',
  pending: '#eab308', in_review: '#60a5fa', requested: '#eab308', assigned: '#60a5fa', in_progress: '#60a5fa',
  cancelled: '#ef4444', rejected: '#ef4444', closed: '#888', expired: '#888',
}[String(s || '').toLowerCase()] || '#888')

const StatBadge = ({ value }) => (
  <span className="ad-badge-status" style={{ color: statusColor(value), borderColor: statusColor(value) + '66', background: statusColor(value) + '14', textTransform: 'capitalize' }}>
    {String(value || '—').replace(/_/g, ' ')}
  </span>
)

const CARE_SETS = [
  { label: 'Auto Care', names: ['Auto Care'], icon: '🚗', accent: '#60a5fa', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.18)', hint: '— vehicle wash, detailing, interior' },
  { label: 'Garden Care', names: ['Garden Care'], icon: '🌿', accent: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.18)', hint: '— lawn, plants, landscape' },
  { label: 'Pet Care', names: ['Pet Care'], icon: '🐾', accent: '#f472b6', bg: 'rgba(244,114,182,0.06)', border: 'rgba(244,114,182,0.18)', hint: '— grooming, walking, aquarium' },
]

const goldBtn = { background: 'var(--gold, #c9a84c)', color: '#000', border: 'none', padding: '0.6rem 1.1rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }
const ghostBtn = { background: 'transparent', color: '#ccc', border: '1px solid #333', padding: '0.6rem 1.1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }
const redBtn = { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)', padding: '0.6rem 1.1rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }
const fieldStyle = { width: '100%', background: '#101012', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#eee', padding: '0.6rem 0.8rem', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' }

const Modal = ({ title, eyebrow = 'LUXORA ADMIN', onClose, children, footer }) => (
  <div className="ad-notif-overlay" onClick={onClose}>
    <div className="ad-notif-modal" onClick={(e) => e.stopPropagation()}>
      <div className="ad-notif-modal__header">
        <span className="ad-notif-modal__eyebrow">{eyebrow}</span>
        <h3 className="ad-notif-modal__title">{title}</h3>
        <button className="ad-notif-modal__close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      {children}
      {footer && <div className="ad-notif-modal__footer">{footer}</div>}
    </div>
  </div>
)

const MetricCard = ({ label, value, icon }) => (
  <div className="ad-metric-card">
    <div className="ad-metric-top">
      <span className="ad-metric-label">{label}</span>
      <span className="ad-metric-icon">{icon}</span>
    </div>
    <div className="ad-metric-val">{value}</div>
  </div>
)

const CATEGORY_NAMES_BY_PACKAGE_TYPE = Object.fromEntries(
  CARE_SETS.map((set) => [set.label, set.names])
)

const AdminDashboard = () => {
  const navigate = useNavigate()
  const [adminUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('user') || '{}') } catch { return {} }
  })
  const [activeNav, setActiveNav] = useState('dashboard')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  /* Server data — empty until loaded; no seeded fallbacks. */
  const [stats, setStats] = useState(null)
  const [providers, setProviders] = useState([])
  const [users, setUsers] = useState([])
  const [bookings, setBookings] = useState([])
  const [complaints, setComplaints] = useState([])
  const [supportTickets, setSupportTickets] = useState([])
  const [plans, setPlans] = useState([])
  const [categories, setCategories] = useState([])
  const [promotions, setPromotions] = useState([])
  const [notifications, setNotifications] = useState([])
  const [reports, setReports] = useState(null)
  const [scheduling, setScheduling] = useState(null)
  const [schedulingForbidden, setSchedulingForbidden] = useState(false)
  const [sessionPayouts, setSessionPayouts] = useState([])

  /* UI state */
  const [showNotifModal, setShowNotifModal] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userRoleView, setUserRoleView] = useState('CUSTOMER')
  const [providerDetail, setProviderDetail] = useState(null)
  const [kycDecision, setKycDecision] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [complaintOpen, setComplaintOpen] = useState(null)
  const [complaintNote, setComplaintNote] = useState('')
  const [ticketOpen, setTicketOpen] = useState(null)
  const [ticketResponse, setTicketResponse] = useState('')
  const [bookingEdit, setBookingEdit] = useState(null)
  const [planEditor, setPlanEditor] = useState(null)
  const [planDetails, setPlanDetails] = useState(null)
  const [confirmPlanRemoval, setConfirmPlanRemoval] = useState(false)
  const [promotionRemoval, setPromotionRemoval] = useState(null)
  const [promoForm, setPromoForm] = useState({ title: '', description: '', code: '', discount_pct: '', starts_at: '', ends_at: '', plan_ids: [] })
  const [reportRange, setReportRange] = useState({ from: '', to: '' })
  const [payoutEdits, setPayoutEdits] = useState({})
  const activePromotionPlans = plans.filter((plan) => plan.active)
  const cancellationRequests = supportTickets.filter((ticket) => cancellationRequestBookingId(ticket))
  const pendingCancellationRequests = cancellationRequests.filter((ticket) => ['OPEN', 'IN_PROGRESS'].includes(String(ticket.status || '').toUpperCase()))
  const generalSupportTickets = supportTickets.filter((ticket) => !cancellationRequestBookingId(ticket))

  const token = sessionStorage.getItem('token')

  const loadAll = useCallback(async () => {
    if (!token) return
    setLoadError('')
    try {
      const [s, p, b, c, t, subs, cats, promos, notes, u, payoutRows] = await Promise.all([
        apiRequest('/admin/stats', 'GET', null, token),
        apiRequest('/admin/providers', 'GET', null, token),
        apiRequest('/admin/bookings', 'GET', null, token),
        apiRequest('/admin/complaints', 'GET', null, token),
        apiRequest('/support', 'GET', null, token),
        apiRequest('/admin/subscriptions', 'GET', null, token),
        apiRequest('/categories', 'GET', null, token),
        apiRequest('/promotions/all', 'GET', null, token),
        apiRequest('/notifications', 'GET', null, token),
        apiRequest('/admin/users', 'GET', null, token),
        apiRequest('/admin/session-payouts', 'GET', null, token),
      ])
      setStats(s)
      setProviders(Array.isArray(p) ? p : [])
      setBookings(Array.isArray(b) ? b : [])
      setComplaints(Array.isArray(c) ? c : [])
      setSupportTickets(Array.isArray(t) ? t : [])
      setPlans(Array.isArray(subs) ? subs.map((plan) => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : [],
      })) : [])
      setCategories(Array.isArray(cats) ? cats : [])
      setPromotions(Array.isArray(promos) ? promos : [])
      setNotifications(Array.isArray(notes) ? notes : [])
      setUsers(Array.isArray(u) ? u : [])
      setSessionPayouts(Array.isArray(payoutRows) ? payoutRows : [])
    } catch (err) {
      setLoadError(err.message || 'Could not load admin data. Please refresh.')
    }
  }, [token])

  const loadScheduling = useCallback(async () => {
    if (!token) return
    try {
      const settings = await apiRequest('/admin/settings/scheduling', 'GET', null, token)
      setScheduling(settings)
      setSchedulingForbidden(false)
    } catch {
      setSchedulingForbidden(true)
    }
  }, [token])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { loadScheduling() }, [loadScheduling])

  const loadReports = async () => {
    const qs = [reportRange.from && `from=${reportRange.from}`, reportRange.to && `to=${reportRange.to}`].filter(Boolean).join('&')
    try { setReports(await apiRequest('/admin/reports' + (qs ? '?' + qs : ''), 'GET', null, token)) }
    catch (err) { alert(err.message || 'Could not load reports.') }
  }

  useEffect(() => { if (activeNav === 'reports' && !reports) loadReports() // eslint-disable-line
  }, [activeNav]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Actions (all server-side) */
  const runAction = async (fn, doneMsg) => {
    setBusy(true)
    try {
      await fn()
      await loadAll()
      if (doneMsg) alert(doneMsg)
    } catch (err) {
      alert(err.message || 'Action failed.')
    } finally { setBusy(false) }
  }

  const toggleUserActive = (user) => runAction(async () => {
    await apiRequest(`/admin/users/${user.id}`, 'PUT', { active: !user.active }, token)
  }, `User ${user.active ? 'deactivated' : 'activated'}.`)

  const decideKyc = () => {
    const { provider, mode } = kycDecision || {}
    if (!provider) return
    if (mode === 'reject' && rejectReason.trim().length < 3) { alert('Rejection reason must be at least 3 characters.'); return }
    runAction(async () => {
      await apiRequest(`/admin/providers/${provider.id}/kyc`, 'PUT', {
        status: mode === 'approve' ? 'approved' : 'rejected',
        ...(mode === 'reject' ? { rejection_reason: rejectReason.trim() } : {}),
      }, token)
      setKycDecision(null); setRejectReason('')
    }, `KYC ${mode === 'approve' ? 'approved' : 'rejected'}.`)
  }

  const openProviderDetail = async (id) => {
    try { setProviderDetail(await apiRequest(`/admin/providers/${id}`, 'GET', null, token)) }
    catch (err) { alert(err.message || 'Could not load provider.') }
  }

  // KYC documents require the session token — fetch as an authenticated
  // blob and open the object URL in a new tab.
  const openKycDoc = async (document) => {
    try {
      const response = await fetch(`${API_BASE}/uploads/kyc/${document.id}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('Could not retrieve document')
      const url = URL.createObjectURL(await response.blob())
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) { alert(err.message || 'Could not open document.') }
  }

  const saveBookingEdit = () => {
    const ed = bookingEdit
    if (!ed) return
    const body = {}
    if (ed.status) body.status = ed.status
    if (ed.provider_id) body.provider_id = Number(ed.provider_id)
    if (!Object.keys(body).length) { setBookingEdit(null); return }
    runAction(async () => {
      await apiRequest(`/admin/bookings/${ed.booking.id}`, 'PUT', body, token)
      setBookingEdit(null)
    }, `Booking #${ed.booking.id} updated.`)
  }

  const saveComplaint = (status) => runAction(async () => {
    await apiRequest(`/admin/complaints/${complaintOpen.id}`, 'PUT', { status, admin_note: complaintNote.trim() || undefined }, token)
    setComplaintOpen(null); setComplaintNote('')
  }, `Complaint marked ${status.replace(/_/g, ' ')}.`)

  const saveTicket = (status) => runAction(async () => {
    await apiRequest(`/support/${ticketOpen.id}`, 'PUT', { status, admin_response: ticketResponse.trim() || undefined }, token)
    setTicketOpen(null); setTicketResponse('')
  }, 'Ticket updated.')

  const openCancellationBooking = (ticket) => {
    const bookingId = cancellationRequestBookingId(ticket)
    const booking = bookings.find((item) => Number(item.id) === bookingId)
    if (!booking) { alert('The related booking is no longer available.'); return }
    setTicketOpen(null)
    setActiveNav('bookings')
    setBookingEdit({ booking, status: '', provider_id: '' })
  }

  const savePlan = () => {
    const ed = planEditor || {}
    const price = Number(ed.price)
    if (!ed.title?.trim() || !Number.isFinite(price) || price <= 0) { alert('Title and a positive price are required.'); return }
    const entitlements = Object.entries(ed.entitlements || {})
      .map(([category_id, units]) => ({ category_id: Number(category_id), units: Number(units) }))
      .filter((e) => e.category_id && Number.isInteger(e.units) && e.units >= 1)
    const allowedCategoryNames = CATEGORY_NAMES_BY_PACKAGE_TYPE[ed.type]
    if (allowedCategoryNames) {
      const allowedCategoryIds = new Set(categories
        .filter((category) => allowedCategoryNames.includes(category.name))
        .map((category) => category.id))
      if (entitlements.length !== 1 || !allowedCategoryIds.has(entitlements[0]?.category_id)) {
        alert(`${ed.type} packages must include coins for that category only.`)
        return
      }
    }
    const displayOrderVal = parseInt(ed.displayOrder, 10)
    const body = {
      title: ed.title.trim(), type: ed.type || 'Auto Care', price_monthly: price, duration_days: 30,
      description: (ed.description || '').trim(), recommended: Boolean(ed.recommended),
      features: (ed.features || []).map((feature) => String(feature).trim()).filter(Boolean), entitlements,
      display_order: Number.isInteger(displayOrderVal) && displayOrderVal >= 0 ? displayOrderVal : 0,
    }
    runAction(async () => {
      if (ed.id) await apiRequest(`/admin/subscriptions/${ed.id}`, 'PUT', body, token)
      else await apiRequest('/admin/subscriptions', 'POST', body, token)
      setPlanEditor(null)
    }, 'Package saved.')
  }

  const togglePlanActive = (plan) => runAction(async () => {
    await apiRequest(`/admin/subscriptions/${plan.id}`, 'PUT', { active: !plan.active }, token)
  }, `Package ${plan.active ? 'disabled' : 'enabled'}.`)

  const openPlanEditor = (plan) => {
    setPlanDetails(null)
    setConfirmPlanRemoval(false)
    setPlanEditor({
      id: plan.id, title: plan.title, type: ['Auto Care', 'Garden Care', 'Pet Care', 'Combo Package'].includes(plan.type) ? plan.type : 'Auto Care', price: String(Number(plan.priceMonthly)), duration: plan.durationDays || 30, description: plan.description || '', recommended: Boolean(plan.recommended), active: plan.active,
      displayOrder: plan.displayOrder !== undefined && plan.displayOrder !== null ? plan.displayOrder : plan.id,
      features: Array.isArray(plan.features) ? plan.features : [],
      entitlements: Object.fromEntries((plan.entitlements || []).map((entitlement) => [entitlement.categoryId, entitlement.units])),
    })
  }

  const removePlan = (plan) => runAction(async () => {
    await apiRequest(`/admin/subscriptions/${plan.id}`, 'DELETE', null, token)
    setPlanDetails(null)
    setConfirmPlanRemoval(false)
  }, 'Package removed.')

  const createPromotion = () => {
    const pct = Number(promoForm.discount_pct)
    if (!promoForm.title.trim() || !Number.isFinite(pct) || pct < 0 || pct > 100) { alert('Title and a 0-100 discount % are required.'); return }
    runAction(async () => {
      await apiRequest('/promotions', 'POST', {
        title: promoForm.title.trim(), description: promoForm.description.trim(), code: promoForm.code.trim() || undefined, discount_pct: pct,
        starts_at: promoForm.starts_at || undefined, ends_at: promoForm.ends_at || undefined, plan_ids: promoForm.plan_ids,
      }, token)
      setPromoForm({ title: '', description: '', code: '', discount_pct: '', starts_at: '', ends_at: '', plan_ids: [] })
    }, 'Promotion created.')
  }

  const togglePromotion = (promo) => runAction(async () => {
    await apiRequest(`/promotions/${promo.id}`, 'PUT', { active: !promo.active }, token)
  }, 'Promotion updated.')

  const removePromotion = (promo) => runAction(async () => {
    await apiRequest(`/promotions/${promo.id}`, 'DELETE', null, token)
    setPromotionRemoval(null)
  }, 'Promotion removed.')

  const togglePromotionPackage = (planId) => setPromoForm((current) => ({
    ...current,
    plan_ids: current.plan_ids.includes(planId)
      ? current.plan_ids.filter((id) => id !== planId)
      : [...current.plan_ids, planId],
  }))

  const saveScheduling = () => {
    const cooldown = Number(scheduling?.autoAssignmentCooldownHours)
    const start = Number(scheduling?.autoAssignmentStartHour)
    const end = Number(scheduling?.autoAssignmentEndHour)
    if (![cooldown, start, end].every(Number.isInteger) || cooldown < 1 || cooldown > 24 || start < 0 || end > 23 || start > end) {
      alert('Use cooldown 1-24 hours and valid start/end hours (0-23).'); return
    }
    runAction(async () => {
      await apiRequest('/admin/settings/scheduling', 'PUT', {
        auto_assignment_cooldown_hours: cooldown, auto_assignment_start_hour: start, auto_assignment_end_hour: end,
      }, token)
    }, 'Scheduling window saved.')
  }

  const restoreScheduling = () => runAction(async () => {
    const s = await apiRequest('/admin/settings/scheduling/restore-defaults', 'POST', null, token)
    setScheduling(s)
  }, 'Defaults restored.')

  const saveSessionPayout = (service) => {
    const providerEarning = Number(payoutEdits[service.category_id] ?? service.provider_earning)
    if (!Number.isFinite(providerEarning) || providerEarning < 0) { alert('Enter a valid payout amount.'); return }
    runAction(async () => {
      await apiRequest(`/admin/session-payouts/${service.category_id}`, 'PUT', { provider_earning: providerEarning }, token)
      setPayoutEdits((current) => { const next = { ...current }; delete next[service.category_id]; return next })
    }, 'Session payout saved.')
  }

  const markNotifRead = async (id) => {
    try {
      await apiRequest(`/notifications/${id}/read`, 'PUT', null, token)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    } catch {}
  }
  const markAllNotifsRead = async () => {
    try {
      await apiRequest('/notifications/read-all', 'PUT', null, token)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {}
  }

  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleSignOut = () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
  }

  const finalizeSignOut = () => {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    navigate('/')
  }

  /* Derived views */
  const unreadNotifs = notifications.filter((n) => !n.read)
  const pendingKyc = providers.filter((p) => p.kyc_status === 'pending')
  const approvedProviders = providers.filter((p) => p.kyc_status === 'approved')
  const filteredUsers = users.filter((u) => {
    const roleOk = (u.role || '').toUpperCase() === userRoleView
    const q = userSearch.trim().toLowerCase()
    const searchOk = !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    return roleOk && searchOk
  })

  return (
    <div className="ad-wrapper">
      {/* 2-Second Polished Logout Overlay */}
      <LogoutOverlay isOpen={isLoggingOut} onComplete={finalizeSignOut} />

      {/* Sidebar */}
      <aside className="ad-sidebar">
        <div className="ad-sidebar__logo">
          <img src="/luxora-logo.png" alt="LUXORA" className="ad-logo-img" />
        </div>
        <nav className="ad-nav">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} className={`ad-nav__item ${activeNav === item.id ? 'ad-nav__item--active' : ''}`} onClick={() => setActiveNav(item.id)}>
              <span className="ad-nav__icon"><item.icon /></span>
              <span className="ad-nav__label">{item.label}</span>
              {item.id === 'cancellation_requests' && pendingCancellationRequests.length > 0 && <span className="ad-nav__badge">{pendingCancellationRequests.length}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="ad-main">
        <header className="ad-topbar">
          <span className="ad-topbar__eyebrow">ADMIN CONTROL CENTER</span>
          <div className="ad-topbar__actions">
            <button className="ad-topbar__notif-btn" aria-label="Notifications" onClick={() => setShowNotifModal(true)}>
              <Icons.Bell />
              {unreadNotifs.length > 0 && <span className="ad-notif-count">{unreadNotifs.length}</span>}
            </button>
            <div className="ad-user-pill" title="Administrator">
              <div className="ad-user-avatar">{(adminUser.name || 'A').charAt(0)}</div>
              <div className="ad-user-info">
                <span className="ad-user-name">{adminUser.name || 'Administrator'}</span>
                <span className="ad-user-role">Admin <span className="ad-user-dot">●</span></span>
              </div>
            </div>
            <button className="ad-logout-btn" onClick={handleSignOut} disabled={isLoggingOut} title="Sign Out">Sign Out</button>
          </div>
        </header>

        <div className="ad-content">
          {loadError && (
            <div style={{ padding: '0.8rem 1rem', marginBottom: '1rem', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: '10px', fontSize: '0.82rem' }}>
              {loadError}
            </div>
          )}

          {/* DASHBOARD */}
          {activeNav === 'dashboard' && (
            <>
              <div className="ad-metrics-grid">
                <MetricCard label="TOTAL CUSTOMERS" value={stats ? stats.totalUsers.toLocaleString() : '—'} icon={<Icons.Users />} />
                <MetricCard label="APPROVED PROVIDERS" value={stats ? stats.totalProviders.toLocaleString() : '—'} icon={<Icons.Building />} />
                <MetricCard label="TOTAL BOOKINGS" value={stats ? stats.totalBookings.toLocaleString() : '—'} icon={<Icons.Bookings />} />
                <MetricCard label="REVENUE (COMPLETED)" value={stats ? fmtMoney(stats.totalRevenue) : '—'} icon={<Icons.Reports />} />
                <MetricCard label="PENDING KYC" value={stats ? stats.pendingProviders.toLocaleString() : '—'} icon={<Icons.Approvals />} />
                <MetricCard label="ACTIVE SUBSCRIPTIONS" value={stats ? stats.activeSubscriptions.toLocaleString() : '—'} icon={<Icons.Subscriptions />} />
                <MetricCard label="OPEN COMPLAINTS" value={stats ? stats.openComplaints.toLocaleString() : '—'} icon={<Icons.Complaints />} />
                <MetricCard label="AVG RATING" value={stats ? `${Number(stats.averageRating || 0).toFixed(1)} (${stats.ratingCount || 0})` : '—'} icon={<Icons.Promotions />} />
              </div>
              <div className="ad-tables-grid">
                <div className="ad-table-card">
                  <h3 className="ad-table-title">RECENT BOOKINGS</h3>
                  <table className="ad-data-table">
                    <thead><tr><th>ID</th><th>CUSTOMER</th><th>SERVICE</th><th>STATUS</th><th>DATE</th></tr></thead>
                    <tbody>
                      {bookings.slice(0, 6).map((b) => (
                        <tr key={b.id}>
                          <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>#{b.id}</td>
                          <td>{b.customer_name || '—'}</td>
                          <td>{bookingCareLabel(b)}</td>
                          <td><StatBadge value={b.status} /></td>
                          <td>{b.bookingDate} {b.bookingTime || ''}</td>
                        </tr>
                      ))}
                      {bookings.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No bookings yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="ad-table-card">
                  <h3 className="ad-table-title">PENDING KYC APPROVALS</h3>
                  <table className="ad-data-table">
                    <thead><tr><th>PROVIDER</th><th>CATEGORY</th><th>ACTION</th></tr></thead>
                    <tbody>
                      {pendingKyc.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{p.category || '—'}</td>
                          <td><button style={goldBtn} onClick={() => setKycDecision({ provider: p, mode: 'approve' })}>Review</button></td>
                        </tr>
                      ))}
                      {pendingKyc.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No pending KYC requests.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* USERS */}
          {activeNav === 'users' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">USER MANAGEMENT DIRECTORY</h3>
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {['CUSTOMER', 'PROVIDER', 'ADMIN'].map((role) => (
                  <button key={role} onClick={() => setUserRoleView(role)} style={{
                    background: userRoleView === role ? 'var(--gold, #c9a84c)' : '#181818',
                    color: userRoleView === role ? '#000' : '#ddd',
                    border: '1px solid ' + (userRoleView === role ? 'var(--gold, #c9a84c)' : '#333'),
                    borderRadius: '7px', padding: '0.5rem 0.9rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{role}S ({users.filter((u) => (u.role || '').toUpperCase() === role).length})</button>
                ))}
                <input style={{ ...fieldStyle, maxWidth: '260px', marginLeft: 'auto' }} placeholder="Search name or email…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
              </div>
              <table className="ad-data-table">
                <thead><tr><th>ID</th><th>NAME</th><th>EMAIL</th><th>TOWN</th><th>ACTIVE PLAN</th><th>JOINED</th><th>STATUS</th><th>ACTION</th></tr></thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>#{u.id}</td>
                      <td>{u.name}</td>
                      <td style={{ color: '#999' }}>{u.email}</td>
                      <td>{u.town || '—'}</td>
                      <td>{u.subscriptions?.[0]?.plan?.title || '—'}</td>
                      <td>{fmtDate(u.createdAt)}</td>
                      <td><StatBadge value={u.active ? 'active' : 'closed'} /></td>
                      <td>
                        <button style={u.active ? redBtn : goldBtn} disabled={busy} onClick={() => toggleUserActive(u)}>
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No users match.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* PROVIDERS */}
          {activeNav === 'providers' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">PROVIDER NETWORK</h3>
              <table className="ad-data-table">
                <thead><tr><th>ID</th><th>NAME</th><th>CATEGORY</th><th>TOWNS</th><th>EARNINGS</th><th>KYC</th><th>AVAILABILITY</th><th>ACTION</th></tr></thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>#{p.id}</td>
                      <td>{p.name}</td>
                      <td>{p.category || '—'}</td>
                      <td style={{ maxWidth: '220px' }}>{(p.service_towns || []).join(', ') || '—'}</td>
                      <td>{fmtMoney(p.earnings)}</td>
                      <td><StatBadge value={p.kyc_status} /></td>
                      <td><StatBadge value={p.availability_status === 'available' ? 'active' : 'closed'} /></td>
                      <td><button style={ghostBtn} onClick={() => openProviderDetail(p.id)}>View</button></td>
                    </tr>
                  ))}
                  {providers.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No providers registered.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* APPROVALS */}
          {activeNav === 'approvals' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">KYC APPROVAL QUEUE ({pendingKyc.length})</h3>
              <table className="ad-data-table">
                <thead><tr><th>ID</th><th>NAME</th><th>EMAIL</th><th>CATEGORY</th><th>ACTION</th></tr></thead>
                <tbody>
                  {pendingKyc.map((p) => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>#{p.id}</td>
                      <td>{p.name}</td>
                      <td style={{ color: '#999' }}>{p.email}</td>
                      <td>{p.category || '—'}</td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="ad-btn-approve" style={goldBtn} disabled={busy} onClick={() => setKycDecision({ provider: p, mode: 'approve' })}>Approve</button>
                        <button className="ad-btn-reject" style={redBtn} disabled={busy} onClick={() => setKycDecision({ provider: p, mode: 'reject' })}>Reject</button>
                        <button style={ghostBtn} onClick={() => openProviderDetail(p.id)}>Documents</button>
                      </td>
                    </tr>
                  ))}
                  {pendingKyc.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>Queue is clear — no pending KYC.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* PACKAGES */}
          {activeNav === 'subscriptions' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h3 className="ad-table-title">SUBSCRIPTION PACKAGES</h3>
                <button style={goldBtn} onClick={() => setPlanEditor({ title: '', type: 'Auto Care', price: '', duration: 30, displayOrder: '', description: '', features: [], recommended: false, active: true, entitlements: {} })}>+ New Package</button>
              </div>
              <table className="ad-data-table">
                <thead><tr><th># (ORDER)</th><th>TITLE</th><th>TYPE</th><th>PRICE</th><th>COINS</th><th>RECOMMENDED</th><th>SUBSCRIBERS</th><th>STATUS</th><th>ACTION</th></tr></thead>
                <tbody>
                  {plans
                    .slice()
                    .sort((a, b) => {
                      const typeComp = String(a.type || '').localeCompare(String(b.type || ''))
                      if (typeComp !== 0) return typeComp
                      const orderA = a.displayOrder !== undefined && a.displayOrder !== null && a.displayOrder > 0 ? Number(a.displayOrder) : Number(a.id)
                      const orderB = b.displayOrder !== undefined && b.displayOrder !== null && b.displayOrder > 0 ? Number(b.displayOrder) : Number(b.id)
                      return (orderA - orderB) || (Number(a.id) - Number(b.id))
                    })
                    .map((p) => (
                    <tr key={p.id} onClick={() => { setPlanDetails(p); setConfirmPlanRemoval(false) }} style={{ cursor: 'pointer' }} title="View package details">
                      <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>#{p.displayOrder || p.id}</span>
                          <small style={{ color: '#666', fontSize: '0.68rem' }}>(ID:{p.id})</small>
                        </div>
                      </td>
                      <td>{p.title}</td>
                      <td>{p.type || '—'}</td>
                      <td>{fmtMoney(p.priceMonthly)} <small style={{ color: '#777' }}>/ {p.durationDays || 30}d</small></td>
                      <td style={{ maxWidth: '260px' }}>{(p.entitlements || []).map((e) => `${e.category?.name || e.categoryId}: ${e.units}`).join(' · ') || '—'}</td>
                      <td>{p.recommended ? 'Yes' : '—'}</td>
                      <td>{p._count?.userSubscriptions ?? 0}</td>
                      <td><StatBadge value={p.active ? 'active' : 'closed'} /></td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button style={ghostBtn} onClick={(event) => { event.stopPropagation(); openPlanEditor(p) }}>Edit</button>
                        <button style={p.active ? redBtn : goldBtn} disabled={busy} onClick={(event) => { event.stopPropagation(); togglePlanActive(p) }}>{p.active ? 'Disable' : 'Enable'}</button>
                      </td>
                    </tr>
                  ))}
                  {plans.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No packages defined.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* BOOKINGS */}
          {activeNav === 'bookings' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">ALL BOOKINGS ({bookings.length})</h3>
              <table className="ad-data-table">
                <thead><tr><th>ID</th><th>CUSTOMER</th><th>SERVICE</th><th>PROVIDER</th><th>SCHEDULE</th><th>VALUE</th><th>STATUS</th><th>ACTION</th></tr></thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>#{b.id}</td>
                      <td>{b.customer_name || '—'}</td>
                      <td>{bookingCareLabel(b)}</td>
                      <td>{b.provider_name || 'Unassigned'}</td>
                      <td>{b.bookingDate} {b.bookingTime || ''}</td>
                      <td>{fmtMoney(b.total_price)}</td>
                      <td><StatBadge value={b.status} /></td>
                      <td><button style={ghostBtn} onClick={() => setBookingEdit({ booking: b, status: '', provider_id: '' })}>Manage</button></td>
                    </tr>
                  ))}
                  {bookings.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No bookings.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* PROVIDER CANCELLATION REQUESTS */}
          {activeNav === 'cancellation_requests' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">PROVIDER CANCELLATION REQUESTS ({pendingCancellationRequests.length} PENDING)</h3>
              <p style={{ margin: '-0.65rem 0 1.15rem', color: '#888', fontSize: '0.8rem' }}>Providers cannot cancel bookings themselves. Review the reason, then manage the related booking using the existing validated booking controls.</p>
              <table className="ad-data-table">
                <thead><tr><th>REQUEST</th><th>BOOKING</th><th>PROVIDER</th><th>REASON</th><th>SUBMITTED</th><th>STATUS</th><th>ACTION</th></tr></thead>
                <tbody>
                  {cancellationRequests.map((ticket) => {
                    const bookingId = cancellationRequestBookingId(ticket)
                    const booking = bookings.find((item) => Number(item.id) === bookingId)
                    const reason = String(ticket.message || '').split('\n').find((line) => line.startsWith('Reason:'))?.replace('Reason:', '').trim() || ticket.message
                    return (
                      <tr key={ticket.id}>
                        <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>#{ticket.id}</td>
                        <td>#{bookingId}<small style={{ display: 'block', color: '#777' }}>{booking?.service_title || 'Booking unavailable'}</small></td>
                        <td>{ticket.user?.name || 'Provider'}</td>
                        <td style={{ maxWidth: '260px' }}>{reason}</td>
                        <td>{fmtDateTime(ticket.createdAt)}</td>
                        <td><StatBadge value={ticket.status} /></td>
                        <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button style={ghostBtn} onClick={() => { setTicketOpen(ticket); setTicketResponse(ticket.adminResponse || '') }}>Review Request</button>
                          <button style={goldBtn} disabled={!booking} onClick={() => openCancellationBooking(ticket)}>Manage Booking</button>
                        </td>
                      </tr>
                    )
                  })}
                  {cancellationRequests.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No provider cancellation requests.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* COMPLAINTS */}
          {activeNav === 'complaints' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">CUSTOMER COMPLAINTS ({complaints.length})</h3>
              <table className="ad-data-table">
                <thead><tr><th>ID</th><th>CUSTOMER</th><th>SUBJECT</th><th>SERVICE</th><th>FILED</th><th>STATUS</th><th>ACTION</th></tr></thead>
                <tbody>
                  {complaints.map((c) => (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>#{c.id}</td>
                      <td>{c.customer_name || '—'}</td>
                      <td style={{ maxWidth: '220px' }}>{c.subject}</td>
                      <td>{bookingCareLabel(c)}</td>
                      <td>{fmtDateTime(c.createdAt)}</td>
                      <td><StatBadge value={c.status} /></td>
                      <td><button style={ghostBtn} onClick={() => { setComplaintOpen(c); setComplaintNote(c.adminNote || '') }}>Review</button></td>
                    </tr>
                  ))}
                  {complaints.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No complaints filed.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* SUPPORT DESK */}
          {activeNav === 'support' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">SUPPORT TICKETS ({generalSupportTickets.length})</h3>
              <table className="ad-data-table">
                <thead><tr><th>ID</th><th>MEMBER</th><th>SUBJECT</th><th>PRIORITY</th><th>UPDATED</th><th>STATUS</th><th>ACTION</th></tr></thead>
                <tbody>
                  {generalSupportTickets.map((t) => (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>#{t.id}</td>
                      <td>{t.user?.name || '—'}</td>
                      <td style={{ maxWidth: '240px' }}>{t.subject}</td>
                      <td><span className="ad-badge-priority">{t.priority}</span></td>
                      <td>{fmtDateTime(t.updatedAt)}</td>
                      <td><StatBadge value={t.status} /></td>
                      <td><button style={ghostBtn} onClick={() => { setTicketOpen(t); setTicketResponse(t.adminResponse || '') }}>Respond</button></td>
                    </tr>
                  ))}
                  {generalSupportTickets.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No support tickets.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* PROMOTIONS */}
          {activeNav === 'promotions' && (
            <>
              <div className="ad-table-card" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
                <h3 className="ad-table-title">CREATE PROMOTION</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <input style={fieldStyle} placeholder="Title" value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })} />
                  <input style={fieldStyle} placeholder="Code (optional)" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })} />
                  <input style={fieldStyle} type="number" min="0" max="100" placeholder="Discount %" value={promoForm.discount_pct} onChange={(e) => setPromoForm({ ...promoForm, discount_pct: e.target.value })} />
                  <input style={fieldStyle} placeholder="Description" value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} />
                  <label style={{ color: '#aaa', fontSize: '0.78rem' }}>Starts <input style={{ ...fieldStyle, marginTop: '0.35rem' }} type="datetime-local" value={promoForm.starts_at} onChange={(e) => setPromoForm({ ...promoForm, starts_at: e.target.value })} /></label>
                  <label style={{ color: '#aaa', fontSize: '0.78rem' }}>Ends <input style={{ ...fieldStyle, marginTop: '0.35rem' }} type="datetime-local" value={promoForm.ends_at} onChange={(e) => setPromoForm({ ...promoForm, ends_at: e.target.value })} /></label>
                  <button style={goldBtn} disabled={busy} onClick={createPromotion}>Deploy Promotion</button>
                </div>
                <div style={{ marginTop: '1rem', borderTop: '1px solid #282828', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <div>
                      <strong style={{ display: 'block', color: '#eee', fontSize: '0.86rem' }}>Choose discounted packages</strong>
                      <small style={{ display: 'block', color: '#999', marginTop: '0.25rem' }}>
                        {promoForm.plan_ids.length ? `${promoForm.plan_ids.length} package${promoForm.plan_ids.length === 1 ? '' : 's'} selected for this promotion.` : 'No package selected — this discount will apply to all active packages.'}
                      </small>
                    </div>
                    {activePromotionPlans.length > 0 && <div style={{ display: 'flex', gap: '0.45rem' }}>
                      <button type="button" style={{ ...ghostBtn, padding: '0.38rem 0.65rem', fontSize: '0.7rem' }} onClick={() => setPromoForm({ ...promoForm, plan_ids: activePromotionPlans.map((plan) => plan.id) })}>Select all</button>
                      <button type="button" style={{ ...ghostBtn, padding: '0.38rem 0.65rem', fontSize: '0.7rem' }} onClick={() => setPromoForm({ ...promoForm, plan_ids: [] })}>All packages</button>
                    </div>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.65rem' }}>
                    {activePromotionPlans.map((plan) => {
                      const selected = promoForm.plan_ids.includes(plan.id)
                      return <label key={plan.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.8rem', border: `1px solid ${selected ? 'rgba(201,168,76,0.7)' : '#30302f'}`, background: selected ? 'rgba(201,168,76,0.10)' : '#121212', borderRadius: '9px', color: '#ddd', cursor: 'pointer', transition: 'border-color .2s ease, background .2s ease' }}>
                        <input type="checkbox" checked={selected} onChange={() => togglePromotionPackage(plan.id)} style={{ width: '16px', height: '16px', accentColor: 'var(--gold, #c9a84c)', flexShrink: 0 }} />
                        <span style={{ minWidth: 0 }}>
                          <strong style={{ display: 'block', color: selected ? '#f3d87e' : '#eee', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.title}</strong>
                          <small style={{ display: 'block', color: '#888', marginTop: '0.2rem', fontSize: '0.7rem' }}>{plan.type || 'Care package'} · {fmtMoney(plan.priceMonthly)} / month</small>
                        </span>
                      </label>
                    })}
                    {activePromotionPlans.length === 0 && <div style={{ padding: '1rem', border: '1px dashed #3a3a38', borderRadius: '9px', color: '#999', fontSize: '0.8rem' }}>There are no active packages yet. Create or activate a package before making a package-specific promotion.</div>}
                  </div>
                </div>
              </div>
              <div className="ad-table-card">
                <h3 className="ad-table-title">ALL CAMPAIGNS ({promotions.length})</h3>
                <table className="ad-data-table">
                  <thead><tr><th>ID</th><th>TITLE</th><th>PACKAGES</th><th>CODE</th><th>DISCOUNT</th><th>WINDOW</th><th>STATUS</th><th>ACTION</th></tr></thead>
                  <tbody>
                    {promotions.map((p) => (
                      <tr key={p.id}>
                        <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>#{p.id}</td>
                        <td>{p.title}</td>
                        <td style={{ maxWidth: '180px', fontSize: '0.75rem' }}>{p.packages?.length ? p.packages.map((plan) => plan.title).join(', ') : 'All active packages'}</td>
                        <td>{p.code || '—'}</td>
                        <td>{p.discountPct}%</td>
                        <td>{fmtDate(p.startsAt)} → {fmtDate(p.endsAt)}</td>
                        <td><StatBadge value={p.active ? 'active' : 'closed'} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <button style={ghostBtn} disabled={busy} onClick={() => togglePromotion(p)}>{p.active ? 'Deactivate' : 'Activate'}</button>
                            <button style={redBtn} disabled={busy} onClick={() => setPromotionRemoval(p)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {promotions.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No campaigns.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* SESSION PAYOUTS */}
          {activeNav === 'session_payouts' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">SESSION PAYOUT PRICING</h3>
              <p style={{ color: '#aaa', fontSize: '0.82rem', margin: '0 0 1rem' }}>
                Set one provider payout for each care type. Saving a value updates every service in that category; existing bookings keep their saved payout.
              </p>
              <div className="ad-table-scroll">
                <table className="ad-data-table">
                  <thead><tr><th>CARE TYPE</th><th>PROVIDER PAYOUT (LKR)</th><th>ACTION</th></tr></thead>
                  <tbody>
                    {sessionPayouts.map((service) => (
                      <tr key={service.category_id}>
                        <td>{service.category_name}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            aria-label={`Provider payout for ${service.category_name}`}
                            placeholder={service.has_mixed_rates ? 'Set one payout' : ''}
                            style={{ ...fieldStyle, minWidth: '145px' }}
                            value={payoutEdits[service.category_id] ?? service.provider_earning ?? ''}
                            onChange={(e) => setPayoutEdits((current) => ({ ...current, [service.category_id]: e.target.value }))}
                          />
                        </td>
                        <td><button style={goldBtn} disabled={busy} onClick={() => saveSessionPayout(service)}>Save</button></td>
                      </tr>
                    ))}
                    {sessionPayouts.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No care categories are configured yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REPORTS */}
          {activeNav === 'reports' && (
            <>
              <div className="ad-table-card" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
                <h3 className="ad-table-title">REPORTS & ANALYSIS</h3>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ color: '#888', fontSize: '0.75rem' }}>From</label>
                  <input type="date" style={fieldStyle} value={reportRange.from} onChange={(e) => setReportRange({ ...reportRange, from: e.target.value })} />
                  <label style={{ color: '#888', fontSize: '0.75rem' }}>To</label>
                  <input type="date" style={fieldStyle} value={reportRange.to} onChange={(e) => setReportRange({ ...reportRange, to: e.target.value })} />
                  <button style={goldBtn} onClick={loadReports}>Generate</button>
                </div>
              </div>
              {reports && (
                <>
                  <div className="ad-metrics-grid" style={{ marginBottom: '1.25rem' }}>
                    <MetricCard label="NEW CUSTOMERS" value={reports.summary.customers} icon={<Icons.Users />} />
                    <MetricCard label="NEW PROVIDERS" value={reports.summary.providers} icon={<Icons.Building />} />
                    <MetricCard label="BOOKINGS (DONE/TOTAL)" value={`${reports.summary.completedBookings} / ${reports.summary.bookings}`} icon={<Icons.Bookings />} />
                    <MetricCard label="REVENUE" value={fmtMoney(reports.summary.revenue)} icon={<Icons.Reports />} />
                    <MetricCard label="ACTIVE SUBSCRIPTIONS" value={reports.summary.activeSubscriptions} icon={<Icons.Subscriptions />} />
                    <MetricCard label="COMPLAINTS" value={reports.summary.complaints} icon={<Icons.Complaints />} />
                    <MetricCard label="AVG RATING" value={`${Number(reports.summary.averageRating || 0).toFixed(1)} (${reports.summary.ratingCount})`} icon={<Icons.Promotions />} />
                  </div>
                  <div className="ad-tables-grid">
                    <div className="ad-table-card">
                      <h3 className="ad-table-title">SERVICE POPULARITY</h3>
                      <table className="ad-data-table">
                        <thead><tr><th>SERVICE</th><th>BOOKINGS</th></tr></thead>
                        <tbody>
                          {reports.servicePopularity.map((s) => (<tr key={s.serviceId}><td>{s.service}</td><td>{s.bookings}</td></tr>))}
                          {reports.servicePopularity.length === 0 && <tr><td colSpan={2} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No data in range.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="ad-table-card">
                      <h3 className="ad-table-title">PROVIDER PERFORMANCE</h3>
                      <table className="ad-data-table">
                        <thead><tr><th>PROVIDER</th><th>COMPLETED</th><th>SERVICE VALUE</th></tr></thead>
                        <tbody>
                          {reports.providerPerformance.map((p) => (<tr key={p.providerId}><td>{p.provider}</td><td>{p.completedBookings}</td><td>{fmtMoney(p.serviceValue)}</td></tr>))}
                          {reports.providerPerformance.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>No data in range.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* OPERATIONS */}
          {activeNav === 'operations' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">OPERATIONS — AUTO-ASSIGNMENT SCHEDULING</h3>
              {schedulingForbidden ? (
                <p style={{ color: '#888', fontSize: '0.85rem' }}>Scheduling settings could not be loaded. Refresh and try again.</p>
              ) : scheduling ? (
                <>
                  <p style={{ color: '#aaa', fontSize: '0.82rem', marginBottom: '1rem' }}>
                    Bookings are auto-assigned to eligible providers inside this daily window, with a per-provider cooldown between assignments.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem', maxWidth: '760px' }}>
                    <label style={{ color: '#888', fontSize: '0.75rem' }}>Cooldown hours (1-24)
                      <input type="number" min="1" max="24" style={fieldStyle} value={scheduling.autoAssignmentCooldownHours}
                        onChange={(e) => setScheduling({ ...scheduling, autoAssignmentCooldownHours: Number(e.target.value) })} />
                    </label>
                    <label style={{ color: '#888', fontSize: '0.75rem' }}>Start hour (0-23)
                      <input type="number" min="0" max="23" style={fieldStyle} value={scheduling.autoAssignmentStartHour}
                        onChange={(e) => setScheduling({ ...scheduling, autoAssignmentStartHour: Number(e.target.value) })} />
                    </label>
                    <label style={{ color: '#888', fontSize: '0.75rem' }}>End hour (0-23)
                      <input type="number" min="0" max="23" style={fieldStyle} value={scheduling.autoAssignmentEndHour}
                        onChange={(e) => setScheduling({ ...scheduling, autoAssignmentEndHour: Number(e.target.value) })} />
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button style={goldBtn} disabled={busy} onClick={saveScheduling}>Save Window</button>
                    <button className="ad-reset-btn" style={ghostBtn} disabled={busy} onClick={restoreScheduling}>Restore Defaults</button>
                  </div>
                </>
              ) : (
                <p style={{ color: '#888', fontSize: '0.85rem' }}>Loading scheduling settings…</p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ══ MODALS ══ */}

      {showNotifModal && (
        <Modal title={`NOTIFICATIONS (${unreadNotifs.length} unread)`} onClose={() => setShowNotifModal(false)}
          footer={<button className="ad-notif-clear-btn" style={goldBtn} onClick={markAllNotifsRead}>Mark all read</button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '50vh', overflowY: 'auto' }}>
            {notifications.map((n) => (
              <div key={n.id} className="ad-notif-card" onClick={() => markNotifRead(n.id)} style={{ cursor: 'pointer', opacity: n.read ? 0.55 : 1, border: '1px solid #262626', borderRadius: '10px', padding: '0.7rem 0.9rem', background: '#121214' }}>
                <div style={{ fontSize: '0.82rem', color: '#ddd' }}>{n.message}</div>
                <div style={{ fontSize: '0.68rem', color: '#777', marginTop: '0.25rem' }}>{fmtDateTime(n.createdAt)} {n.read ? '· read' : '· tap to mark read'}</div>
              </div>
            ))}
            {notifications.length === 0 && <p className="ad-notif-empty" style={{ color: '#777', textAlign: 'center', padding: '1rem' }}>No notifications.</p>}
          </div>
        </Modal>
      )}

      {kycDecision && (
        <Modal title={`${kycDecision.mode === 'approve' ? 'APPROVE' : 'REJECT'} KYC — ${kycDecision.provider.name}`} onClose={() => { setKycDecision(null); setRejectReason('') }}>
          {kycDecision.mode === 'reject' && (
            <label style={{ color: '#888', fontSize: '0.78rem' }}>Rejection reason (required, 3-500 chars)
              <textarea rows={3} style={{ ...fieldStyle, marginTop: '0.4rem' }} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain what the provider must fix…" />
            </label>
          )}
          {kycDecision.mode === 'approve' && <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Approve {kycDecision.provider.name} ({kycDecision.provider.category || 'provider'})? They will be notified and can start receiving bookings.</p>}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.1rem', justifyContent: 'flex-end' }}>
            <button style={ghostBtn} onClick={() => { setKycDecision(null); setRejectReason('') }}>Cancel</button>
            <ActionButton
              style={kycDecision.mode === 'approve' ? goldBtn : redBtn}
              loading={busy}
              loadingText={kycDecision.mode === 'approve' ? 'Approving...' : 'Rejecting...'}
              onClick={decideKyc}
            >
              {kycDecision.mode === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </ActionButton>
          </div>
        </Modal>
      )}

      {providerDetail && (
        <Modal title={providerDetail.user?.name || 'PROVIDER'} eyebrow={`PROVIDER #${providerDetail.id}`} onClose={() => setProviderDetail(null)}>
          <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.85rem', color: '#ccc' }}>
            <span>Email: {providerDetail.user?.email || '—'}</span>
            <span>Phone: {providerDetail.user?.phone || '—'}</span>
            <span>Category: {providerDetail.category || '—'}</span>
            <span>KYC: <StatBadge value={providerDetail.kycStatus?.toLowerCase()} /></span>
            <span>Towns: {(providerDetail.service_towns || []).join(', ') || '—'}</span>
            <span>Earnings: {fmtMoney(providerDetail.earnings)}</span>
            <span>Rating: {providerDetail.averageRating ? Number(providerDetail.averageRating).toFixed(1) : 'No reviews yet'}</span>
          </div>
          <h4 style={{ margin: '1.1rem 0 0.5rem', color: 'var(--gold, #c9a84c)', fontSize: '0.72rem', letterSpacing: '0.12em' }}>KYC DOCUMENTS</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(providerDetail.documents || []).map((d) => (
              <button key={d.id} type="button" onClick={() => openKycDoc(d)} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.55rem 0.8rem', border: '1px solid #262626', borderRadius: '8px', color: '#ddd', background: '#121214', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span>{d.originalName || d.documentType}</span>
                <span style={{ color: 'var(--gold, #c9a84c)' }}>Open ↗</span>
              </button>
            ))}
            {(providerDetail.documents || []).length === 0 && <p style={{ color: '#777', fontSize: '0.8rem' }}>No documents uploaded.</p>}
          </div>
        </Modal>
      )}

      {bookingEdit && (
        <Modal title={`MANAGE BOOKING #${bookingEdit.booking.id}`} eyebrow={`${bookingCareLabel(bookingEdit.booking)} · ${bookingEdit.booking.customer_name}`} onClose={() => setBookingEdit(null)}>
          <p style={{ color: '#aaa', fontSize: '0.8rem' }}>Current: <StatBadge value={bookingEdit.booking.status} /> · Provider: {bookingEdit.booking.provider_name || 'Unassigned'}</p>
          <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: '0.4rem' }}>Override status (transitions are validated server-side)</label>
          <select style={fieldStyle} value={bookingEdit.status} onChange={(e) => setBookingEdit({ ...bookingEdit, status: e.target.value })}>
            <option value="">— unchanged —</option>
            {['pending', 'assigned', 'in_progress', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', margin: '0.8rem 0 0.4rem' }}>Assign provider</label>
          <select style={fieldStyle} value={bookingEdit.provider_id} onChange={(e) => setBookingEdit({ ...bookingEdit, provider_id: e.target.value })}>
            <option value="">— unchanged —</option>
            {approvedProviders.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
          </select>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.1rem', justifyContent: 'flex-end' }}>
            <button style={ghostBtn} onClick={() => setBookingEdit(null)}>Cancel</button>
            <button style={goldBtn} disabled={busy} onClick={saveBookingEdit}>Apply</button>
          </div>
        </Modal>
      )}

      {complaintOpen && (
        <Modal title={`COMPLAINT #${complaintOpen.id}`} eyebrow={complaintOpen.customer_name || 'MEMBER'} onClose={() => setComplaintOpen(null)}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{complaintOpen.subject}</p>
          <p style={{ color: '#bbb', fontSize: '0.84rem' }}>{complaintOpen.description}</p>
          {complaintOpen.service_title && <p style={{ color: '#777', fontSize: '0.75rem' }}>Service: {complaintOpen.service_title} · Filed {fmtDateTime(complaintOpen.createdAt)}</p>}
          <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', margin: '0.9rem 0 0.4rem' }}>Admin note (sent when resolved)</label>
          <textarea rows={3} style={fieldStyle} value={complaintNote} onChange={(e) => setComplaintNote(e.target.value)} placeholder="Resolution note for the member…" />
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button style={ghostBtn} disabled={busy} onClick={() => saveComplaint('in_review')}>Mark In Review</button>
            <button style={goldBtn} disabled={busy} onClick={() => saveComplaint('resolved')}>Resolve</button>
          </div>
        </Modal>
      )}

      {ticketOpen && (
        <Modal title={`TICKET #${ticketOpen.id}`} eyebrow={ticketOpen.user?.name || 'MEMBER'} onClose={() => setTicketOpen(null)}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{ticketOpen.subject} <span className="ad-badge-priority" style={{ marginLeft: '0.5rem' }}>{ticketOpen.priority}</span></p>
          <p style={{ color: '#bbb', fontSize: '0.84rem', whiteSpace: 'pre-wrap' }}>{ticketOpen.message}</p>
          <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', margin: '0.9rem 0 0.4rem' }}>Response to the member</label>
          <textarea rows={3} style={fieldStyle} value={ticketResponse} onChange={(e) => setTicketResponse(e.target.value)} placeholder="Write your response…" />
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {cancellationRequestBookingId(ticketOpen) && <button style={redBtn} disabled={busy || !bookings.some((booking) => Number(booking.id) === cancellationRequestBookingId(ticketOpen))} onClick={() => openCancellationBooking(ticketOpen)}>Manage Related Booking</button>}
            <button style={ghostBtn} disabled={busy} onClick={() => saveTicket('in_progress')}>Save & In Progress</button>
            <button style={goldBtn} disabled={busy} onClick={() => saveTicket('resolved')}>Send & Resolve</button>
          </div>
        </Modal>
      )}

      {promotionRemoval && (
        <Modal title="REMOVE PROMOTION" eyebrow="CONFIRMATION REQUIRED" onClose={() => setPromotionRemoval(null)}>
          <p style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.92rem' }}>Remove this promotion permanently?</p>
          <p style={{ color: '#bbb', fontSize: '0.84rem', lineHeight: 1.55 }}>
            <strong style={{ color: '#fff' }}>{promotionRemoval.title}</strong>{promotionRemoval.code ? ` (${promotionRemoval.code})` : ''} will no longer be available to customers. Promotions with payment history cannot be removed; deactivate them instead.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button style={ghostBtn} disabled={busy} onClick={() => setPromotionRemoval(null)}>Keep Promotion</button>
            <button style={redBtn} disabled={busy} onClick={() => removePromotion(promotionRemoval)}>{busy ? 'Removing…' : 'Yes, Remove Promotion'}</button>
          </div>
        </Modal>
      )}

      {planDetails && (
        <Modal title={`PACKAGE #${planDetails.id}`} eyebrow={planDetails.type || 'LUXORA PACKAGE'} onClose={() => { setPlanDetails(null); setConfirmPlanRemoval(false) }}>
          {confirmPlanRemoval ? (
            <>
              <p style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.92rem' }}>Remove this package permanently?</p>
              <p style={{ color: '#bbb', fontSize: '0.84rem', lineHeight: 1.55 }}>
                This removes <strong style={{ color: '#fff' }}>{planDetails.title}</strong> from the catalogue. Packages with customer purchases or payment history cannot be removed and must be disabled instead.
              </p>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button style={ghostBtn} disabled={busy} onClick={() => setConfirmPlanRemoval(false)}>Keep Package</button>
                <button style={redBtn} disabled={busy} onClick={() => removePlan(planDetails)}>{busy ? 'Removing…' : 'Yes, Remove Package'}</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', margin: '0 0 0.35rem' }}>{planDetails.title}</p>
              {planDetails.description && <p style={{ color: '#bbb', fontSize: '0.84rem', lineHeight: 1.5 }}>{planDetails.description}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.65rem', marginTop: '1rem' }}>
                <div><span style={{ color: '#777', fontSize: '0.7rem' }}>ORDER / #</span><strong style={{ display: 'block', color: 'var(--gold, #c9a84c)', marginTop: '0.15rem' }}>#{planDetails.displayOrder || planDetails.id}</strong></div>
                <div><span style={{ color: '#777', fontSize: '0.7rem' }}>PRICE</span><strong style={{ display: 'block', color: '#fff', marginTop: '0.15rem' }}>{fmtMoney(planDetails.priceMonthly)} / {planDetails.durationDays || 30}d</strong></div>
                <div><span style={{ color: '#777', fontSize: '0.7rem' }}>STATUS</span><div style={{ marginTop: '0.25rem' }}><StatBadge value={planDetails.active ? 'active' : 'closed'} /></div></div>
                <div><span style={{ color: '#777', fontSize: '0.7rem' }}>SUBSCRIBERS</span><strong style={{ display: 'block', color: '#fff', marginTop: '0.15rem' }}>{planDetails._count?.userSubscriptions ?? 0}</strong></div>
                <div><span style={{ color: '#777', fontSize: '0.7rem' }}>RECOMMENDED</span><strong style={{ display: 'block', color: '#fff', marginTop: '0.15rem' }}>{planDetails.recommended ? 'Yes' : 'No'}</strong></div>
              </div>
              <div style={{ borderTop: '1px solid #2a2a2a', marginTop: '1rem', paddingTop: '0.9rem' }}>
                <span style={{ color: '#777', fontSize: '0.7rem', letterSpacing: '0.05em' }}>INCLUDED SERVICE COINS</span>
                <div style={{ color: '#ddd', fontSize: '0.84rem', marginTop: '0.35rem' }}>{(planDetails.entitlements || []).map((entitlement) => `${entitlement.category?.name || entitlement.categoryId}: ${entitlement.units}`).join(' · ') || 'No entitlements'}</div>
              </div>
              <div style={{ borderTop: '1px solid #2a2a2a', marginTop: '1rem', paddingTop: '0.9rem' }}>
                <span style={{ color: '#777', fontSize: '0.7rem', letterSpacing: '0.05em' }}>CUSTOMER-FACING INCLUSIONS</span>
                <div style={{ color: '#ddd', fontSize: '0.84rem', marginTop: '0.35rem' }}>{(planDetails.features || []).join(' · ') || 'No custom inclusions — the customer card will show service coins.'}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.2rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button style={ghostBtn} disabled={busy} onClick={() => openPlanEditor(planDetails)}>Edit Package</button>
                <button style={redBtn} disabled={busy} onClick={() => setConfirmPlanRemoval(true)}>Remove Package</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {planEditor && (
        <Modal title={planEditor.id ? `EDIT PACKAGE #${planEditor.id}` : 'NEW PACKAGE'} onClose={() => setPlanEditor(null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <label style={{ color: '#888', fontSize: '0.75rem' }}>Title
                <input style={fieldStyle} value={planEditor.title} onChange={(e) => setPlanEditor({ ...planEditor, title: e.target.value })} /></label>
              <label style={{ color: '#888', fontSize: '0.75rem' }}>Order / #
                <input type="number" min="1" style={fieldStyle} placeholder="1" value={planEditor.displayOrder ?? ''} onChange={(e) => setPlanEditor({ ...planEditor, displayOrder: e.target.value })} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label style={{ color: '#888', fontSize: '0.75rem' }}>Price (LKR)
                <input type="number" min="0" style={fieldStyle} value={planEditor.price} onChange={(e) => setPlanEditor({ ...planEditor, price: e.target.value })} /></label>
              <label style={{ color: '#888', fontSize: '0.75rem' }}>Duration
                <input style={fieldStyle} value="30 days" readOnly /></label>
            </div>
            <label style={{ color: '#888', fontSize: '0.75rem' }}>Type
              <select style={fieldStyle} value={planEditor.type} onChange={(e) => {
                const type = e.target.value
                // A single-care package has exactly one matching entitlement.
                // Clear stale category values when the admin changes its type.
                setPlanEditor({ ...planEditor, type, entitlements: CATEGORY_NAMES_BY_PACKAGE_TYPE[type] ? {} : planEditor.entitlements })
              }}>
                <option>Auto Care</option><option>Garden Care</option><option>Pet Care</option><option>Combo Package</option>
              </select></label>
            <label style={{ color: '#888', fontSize: '0.75rem' }}>Description
              <textarea style={{ ...fieldStyle, minHeight: '76px', resize: 'vertical' }} value={planEditor.description || ''} maxLength={1000} onChange={(e) => setPlanEditor({ ...planEditor, description: e.target.value })} /></label>
            <label style={{ color: '#888', fontSize: '0.75rem' }}>What&apos;s included
              <textarea
                style={{ ...fieldStyle, minHeight: '110px', resize: 'vertical' }}
                value={(planEditor.features || []).join('\n')}
                maxLength={2000}
                placeholder={'One customer benefit per line\nExterior wash\nInterior vacuum\nBasic tire shine'}
                onChange={(e) => setPlanEditor({ ...planEditor, features: e.target.value.split('\n') })}
              />
              <small style={{ display: 'block', marginTop: '0.35rem', color: '#666', lineHeight: 1.45 }}>Each line appears with a check mark on the customer plan card. Service coins below control the actual booking allowance.</small>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#ccc', fontSize: '0.82rem' }}>
              <input type="checkbox" checked={Boolean(planEditor.recommended)} onChange={(e) => setPlanEditor({ ...planEditor, recommended: e.target.checked })} />
              Show the "Most Popular" banner on the homepage
            </label>
            <span style={{ color: '#888', fontSize: '0.75rem' }}>Entitlements (service coins / period)</span>
            {CARE_SETS.some((set) => set.label === planEditor.type) ? (
              CARE_SETS.filter((set) => set.label === planEditor.type).map((set) => {
                const groupCategories = categories.filter((c) => set.names.includes(c.name))
                if (!groupCategories.length) return null
                return (
                  <div key={set.label} style={{ background: set.bg, borderRadius: 10, padding: '0.75rem 0.85rem', border: `1px solid ${set.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.6rem' }}>
                      <span style={{ fontSize: '1rem' }}>{set.icon}</span>
                      <span style={{ color: set.accent, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.04em' }}>{set.label}</span>
                      <span style={{ color: '#666', fontSize: '0.68rem' }}>{set.hint}</span>
                    </div>
                    {groupCategories.map((c) => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', color: '#ccc', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                        {c.name}
                        <input type="number" min="0" max="30" style={{ ...fieldStyle, maxWidth: '90px', textAlign: 'center' }}
                          value={planEditor.entitlements[c.id] ?? 0}
                          onChange={(e) => setPlanEditor({ ...planEditor, entitlements: { ...planEditor.entitlements, [c.id]: Number(e.target.value) } })} />
                      </label>
                    ))}
                  </div>
                )
              })
            ) : (
              categories.map((c) => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', color: '#ccc', fontSize: '0.82rem' }}>
                  {c.name}
                  <input type="number" min="0" max="30" style={{ ...fieldStyle, maxWidth: '90px', textAlign: 'center' }}
                    value={planEditor.entitlements[c.id] ?? 0}
                    onChange={(e) => setPlanEditor({ ...planEditor, entitlements: { ...planEditor.entitlements, [c.id]: Number(e.target.value) } })} />
                </label>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.1rem', justifyContent: 'flex-end' }}>
            <button style={ghostBtn} onClick={() => setPlanEditor(null)}>Cancel</button>
            <ActionButton style={goldBtn} loading={busy} loadingText="Saving Package..." onClick={savePlan}>Save Package</ActionButton>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default AdminDashboard
