import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiRequest } from '../services/api'
import AccountVerificationPanel from '../components/AccountVerificationPanel'
import { ActionButton } from '../components/ui'
import LogoutOverlay from '../components/LogoutOverlay'
import ActiveBookingCards from '../components/ActiveBookingCards'
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

const PET_TYPE_OPTIONS = [
  { id: 'dog', title: 'Dog Care', detail: 'Walking & playtime', icon: '🐕', servicePattern: /dog|walk/i },
  { id: 'cat', title: 'Cat Care', detail: 'Bathing & grooming', icon: '🐈', servicePattern: /cat|bath|groom/i },
  { id: 'fish', title: 'Fish Care', detail: 'Aquarium cleaning', icon: '🐠', servicePattern: /fish|tank|aquarium/i },
]

const SubscriptionPlanCard = ({ plan, onSelect }) => {
  const title = String(plan.title || 'Luxora Package')
    .replace('Single Package: ', '')
    .replace('Combo Package: ', '')
  const customFeatures = Array.isArray(plan.features) ? plan.features.filter(Boolean) : []
  const tokenCount = Number(plan.tokens) || 0

  return (
    <article className={`cd-subscription-plan ${plan.recommended ? 'cd-subscription-plan--popular' : ''}`}>
      {plan.recommended && <div className="cd-subscription-plan__popular"><span aria-hidden="true">♛</span> MOST POPULAR</div>}

      <div className="cd-subscription-plan__content">
        <p className="cd-subscription-plan__type">{plan.type || 'Luxora Package'}</p>
        <h3 className="cd-subscription-plan__title">{title}</h3>

        {plan.promotion && (
          <p className="cd-subscription-plan__promotion">
            {plan.promotion.code ? `${plan.promotion.code} · ` : ''}{plan.promotion.discountPct}% OFF
          </p>
        )}

        <div className="cd-subscription-plan__price">
          <span>LKR</span>
          <strong>{Number(plan.price).toLocaleString()}</strong>
          {plan.promotion && <del>LKR {Number(plan.originalPrice).toLocaleString()}</del>}
        </div>
        <p className="cd-subscription-plan__period">{tokenCount} service coin{tokenCount === 1 ? '' : 's'} per month</p>

        {plan.description && <p className="cd-subscription-plan__description">{plan.description}</p>}

        <div className="cd-subscription-plan__divider" />
        <ul className="cd-subscription-plan__features">
          <li><span aria-hidden="true">✓</span>{tokenCount} service coin{tokenCount === 1 ? '' : 's'} / month</li>
          {customFeatures.map((item, index) => (
            <li key={`${plan.serverId}-${index}`}><span aria-hidden="true">✓</span>{item}</li>
          ))}
        </ul>
      </div>

      <button type="button" className="cd-subscription-plan__button" onClick={() => onSelect(plan, title)}>
        Get Started
      </button>
    </article>
  )
}

/* ── Sri Lanka towns/provinces for the delivery-address autocomplete.
      Static reference data (like a country list), not business mock data. ── */
const SRI_LANKA_TOWNS = [
  { name: "Colombo", province: "Western" },
  { name: "Sri Jayawardenepura Kotte", province: "Western" },
  { name: "Dehiwala-Mount Lavinia", province: "Western" },
  { name: "Kaduwela", province: "Western" },
  { name: "Moratuwa", province: "Western" },
  { name: "Kolonnawa", province: "Western" },
  { name: "Seethawakapura", province: "Western" },
  { name: "Maharagama", province: "Western" },
  { name: "Kesbewa", province: "Western" },
  { name: "Boralesgamuwa", province: "Western" },
  { name: "Gampaha", province: "Western" },
  { name: "Negombo", province: "Western" },
  { name: "Wattala", province: "Western" },
  { name: "Katunayake-Seeduwa", province: "Western" },
  { name: "Minuwangoda", province: "Western" },
  { name: "Ja-Ela", province: "Western" },
  { name: "Peliyagoda", province: "Western" },
  { name: "Kalutara", province: "Western" },
  { name: "Panadura", province: "Western" },
  { name: "Horana", province: "Western" },
  { name: "Beruwala", province: "Western" },
  { name: "Kandy", province: "Central" },
  { name: "Wattegama", province: "Central" },
  { name: "Kadugannawa", province: "Central" },
  { name: "Gampola", province: "Central" },
  { name: "Nawalapitiya", province: "Central" },
  { name: "Matale", province: "Central" },
  { name: "Dambulla", province: "Central" },
  { name: "Nuwara Eliya", province: "Central" },
  { name: "Hatton-Dickoya", province: "Central" },
  { name: "Thalawakele-Lindula", province: "Central" },
  { name: "Galle", province: "Southern" },
  { name: "Ambalangoda", province: "Southern" },
  { name: "Hikkaduwa", province: "Southern" },
  { name: "Matara", province: "Southern" },
  { name: "Weligama", province: "Southern" },
  { name: "Hambantota", province: "Southern" },
  { name: "Tangalle", province: "Southern" },
  { name: "Jaffna", province: "Northern" },
  { name: "Valvettithurai", province: "Northern" },
  { name: "Point Pedro", province: "Northern" },
  { name: "Chavakachcheri", province: "Northern" },
  { name: "Mannar", province: "Northern" },
  { name: "Vavuniya", province: "Northern" },
  { name: "Trincomalee", province: "Eastern" },
  { name: "Kinniya", province: "Eastern" },
  { name: "Batticaloa", province: "Eastern" },
  { name: "Eravur", province: "Eastern" },
  { name: "Kattankudy", province: "Eastern" },
  { name: "Kalmunai", province: "Eastern" },
  { name: "Akkaraipattu", province: "Eastern" },
  { name: "Ampara", province: "Eastern" },
  { name: "Kurunegala", province: "North Western" },
  { name: "Kuliyapitiya", province: "North Western" },
  { name: "Puttalam", province: "North Western" },
  { name: "Chilaw", province: "North Western" },
  { name: "Anuradhapura", province: "North Central" },
  { name: "Polonnaruwa", province: "North Central" },
  { name: "Badulla", province: "Uva" },
  { name: "Bandarawela", province: "Uva" },
  { name: "Haputale", province: "Uva" },
  { name: "Monaragala", province: "Uva" },
  { name: "Ratnapura", province: "Sabaragamuwa" },
  { name: "Balangoda", province: "Sabaragamuwa" },
  { name: "Embilipitiya", province: "Sabaragamuwa" },
  { name: "Kegalle", province: "Sabaragamuwa" }
]

const CustomerDashboard = () => {
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'booking' | 'active_bookings' | 'transaction_history'
  const [bookingType, setBookingType] = useState('combo') // auto | garden | pet | combo
  const [historyFilter, setHistoryFilter] = useState('all') // 'all' | 'auto' | 'garden' | 'pet'
  const [historySearchInvoice, setHistorySearchInvoice] = useState('')
  const [historySearchPackage, setHistorySearchPackage] = useState('')
  const [historySearchDate, setHistorySearchDate] = useState('')
  const [showProfileDrawer, setShowProfileDrawer] = useState(false)

  const [showAddressModal, setShowAddressModal] = useState(false)
  const [townDropdownOpen, setTownDropdownOpen] = useState(false)
  const [addressForm, setAddressForm] = useState({
    street: '',
    city: '',
    district: ''
  })
  const [userAddress, setUserAddress] = useState(() => {
    try {
      const u = sessionStorage.getItem('user')
      const email = u ? JSON.parse(u).email : 'guest'
      const saved = localStorage.getItem('userAddress_' + email) || sessionStorage.getItem('userAddress')
      if (saved) return JSON.parse(saved)
    } catch {}
    return { street: '', city: '', district: '' }
  })

  // Package ownership and coins are always loaded from the backend. This
  // remains empty only for retired local-only package controls.
  const [activePackages, setActivePackages] = useState([])

  const [selectedPackageToBook, setSelectedPackageToBook] = useState(null)
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState(null)

  useEffect(() => {
    try {
      const savedPlanStr = sessionStorage.getItem('selected_home_plan')
      if (savedPlanStr) {
        sessionStorage.removeItem('selected_home_plan')
        // A plan chosen on the marketing page is an INTENT, not a purchase.
        // Never activate it locally — take the member to the real checkout.
        setActiveTab('booking')
        setBookingSuccessMsg('✨ Welcome! Complete your subscription below to activate your chosen package.')
        setTimeout(() => setBookingSuccessMsg(''), 6000)
      }
    } catch {}
  }, [])

  // Real booking coins from the server entitlement snapshot — declared before
  // the tokens computation below so it can be referenced safely.
  const [serverTokens, setServerTokens] = useState(null)

  // Coins are server-authoritative. Before the first response, show zero
  // instead of reconstructing balances from browser-stored package data.
  const tokens = serverTokens ?? {
    auto: 0,
    garden: 0,
    pet: 0
  }

  // Renewal/expiry dates follow the SERVER plan duration (durationDays),
  // not a hardcoded 30-day cycle.
  const getRenewalDate = (pkg) => {
    const days = (pkg && pkg.duration) || 30
    const base = pkg && pkg.purchasedAt ? pkg.purchasedAt : Date.now()
    const expiry = new Date(base + days * 24 * 60 * 60 * 1000)
    const yyyy = expiry.getFullYear()
    const mm = String(expiry.getMonth() + 1).padStart(2, '0')
    const dd = String(expiry.getDate()).padStart(2, '0')
    return `${yyyy}.${mm}.${dd}`
  }

  // Manage Active Package & Cancellation State
  const [selectedActivePackageToManage, setSelectedActivePackageToManage] = useState(null)
  const [showCancelConfirmStep, setShowCancelConfirmStep] = useState(false)
  const [showCancelPackageConfirmModal, setShowCancelPackageConfirmModal] = useState(false)
  const [packageToCancel, setPackageToCancel] = useState(null)
  const [showCancelledSuccessModal, setShowCancelledSuccessModal] = useState(false)
  const [cancelledPackageTitle, setCancelledPackageTitle] = useState('')
  const [bookingBillingType, setBookingBillingType] = useState('auto_renew') // 'auto_renew' | 'one_time'
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [selectedReceiptItem, setSelectedReceiptItem] = useState(null)

  // Easy Pay (PayHere) — backend-verified result shown after returning from
  // the hosted checkout. Never trusts the redirect itself: the status below is
  // always read from GET /payments/my, which only flips to COMPLETED when the
  // verified PayHere webhook has confirmed the charge server-side.
  const [payhereResult, setPayhereResult] = useState(null)
  const [payhereEnv, setPayhereEnv] = useState('SANDBOX')

  const resolvePaymentReturn = async (orderId, fromCancelUrl) => {
    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token') return
    setPayhereResult({ status: 'checking' })
    // The webhook / IPN can land a moment after the browser redirect — poll briefly.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const data = await apiRequest('/payments/my', 'GET', null, token)
        if (data?.environment) setPayhereEnv(data.environment)
        const payment = Array.isArray(data?.payments)
          ? (orderId ? data.payments.find((p) => p.gatewayOrderId === orderId) : data.payments[0])
          : null
        if (payment) {
          if (payment.status === 'COMPLETED') {
            setPayhereResult({ status: 'success', payment })
            void loadServerData()
            return
          }
          if (payment.status === 'FAILED') {
            setPayhereResult({ status: 'failed', payment })
            return
          }
          if (payment.status === 'REFUNDED') {
            setPayhereResult({ status: 'cancelled', payment })
            return
          }
          if (fromCancelUrl) {
            setPayhereResult({ status: 'cancelled', payment })
            return
          }
        } else if (fromCancelUrl) {
          setPayhereResult({ status: 'cancelled', payment: null })
          return
        }
      } catch { /* fall through to retry */ }
      await new Promise((resolve) => setTimeout(resolve, attempt === 5 ? 0 : 2500))
    }
    setPayhereResult({ status: 'pending', payment: null })
  }

  // Subscription plan catalogue — server-fed only (loadServerData maps
  // GET /subscriptions into these cards). No hardcoded fallback catalogue
  // and no localStorage cache, so the member always sees the real plans.
  const [adminSubscriptions, setAdminSubscriptions] = useState([])
  const [subscriptionPlansState, setSubscriptionPlansState] = useState('loading')

  // Customer Active Bookings Chart State & Filters
  const [selectedBookingId, setSelectedBookingId] = useState(null)
  const [activeBookingIdFilter, setActiveBookingIdFilter] = useState('')
  const [activeBookingDateFilter, setActiveBookingDateFilter] = useState('')
  const [customerActiveBookings, setCustomerActiveBookings] = useState([])

  const mapCustomerBookingRows = useCallback((rows) => {
    const currentUserName = (() => {
      try { return JSON.parse(sessionStorage.getItem('user') || '{}').name || 'Customer' } catch { return 'Customer' }
    })()
    return (rows || []).filter(Boolean).map((booking) => ({
      id: booking?.id,
      customer: currentUserName,
      // Booking tables represent the purchased care category. The detailed
      // service stays server-side for fulfilment, pricing, and assignment.
      service: booking?.category_name || booking?.service_title || 'Concierge Service',
      status: (booking?.status || '').toUpperCase(),
      color: booking?.status === 'cancelled' ? '#ef4444' : '#4ade80',
      date: booking?.bookingDate,
      time: booking?.bookingTime,
      amount: `LKR ${Number(booking?.totalPrice || 0).toLocaleString()}`,
      pin: booking?.pin_code,
      location: booking?.town || 'Town not set',
      providerName: booking?.provider_name || 'Awaiting assignment',
      providerPhone: booking?.provider_phone,
      cancellationReason: booking?.cancellationReason,
      isSession: true,
    }))
  }, [])

  /* ── Server-synced proposal features: memberships, notifications,
        payments history, reviews, profile management ── */
  const [serverSubscriptions, setServerSubscriptions] = useState([])
  const [paymentMode, setPaymentMode] = useState('demo')
  // Membership opened in the manage popup (renewal + cancel actions).
  const [selectedMembership, setSelectedMembership] = useState(null)
  const [reviewTarget, setReviewTarget] = useState(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [profileEdit, setProfileEdit] = useState({ name: '', phone: '', town: '' })
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileSavedMsg, setProfileSavedMsg] = useState('')
  const [memberSince, setMemberSince] = useState('')

  const loadServerData = async () => {
    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token') return
    try {
      const [dash, notes, paymentRows, entitlementRows, planRows, mode, bookingRows] = await Promise.all([
        apiRequest('/customer/dashboard', 'GET', null, token).catch(() => null),
        apiRequest('/notifications', 'GET', null, token).catch(() => null),
        apiRequest('/payments/my', 'GET', null, token).catch(() => null),
        apiRequest('/subscriptions/entitlements', 'GET', null, token).catch(() => null),
        apiRequest('/subscriptions').catch(() => null),
        apiRequest('/payments/mode', 'GET', null, token).catch(() => null),
        apiRequest('/bookings/my', 'GET', null, token).catch(() => null),
      ])
      if (mode?.mode) setPaymentMode(mode.mode)
      if (Array.isArray(dash?.activeSubscriptions)) setServerSubscriptions(dash.activeSubscriptions)
      if (Array.isArray(bookingRows)) {
        setCustomerActiveBookings(mapCustomerBookingRows(bookingRows))
      }
      // Keep the displayed name/phone/town in sync with the server profile so a
      // corrected profile replaces any stale copy cached in sessionStorage.
      if (dash?.profile) {
        if (dash.profile.addressStreet !== undefined || dash.profile.addressDistrict !== undefined) {
          setUserAddress({ street: dash.profile.addressStreet || '', city: dash.profile.town || '', district: dash.profile.addressDistrict || '' })
        }
        setCurrentUser((prev) => {
          const updatedName = dash.profile.name || prev.name
          const updatedPhone = dash.profile.phone !== undefined ? (dash.profile.phone || '') : prev.phone
          const updatedTown = dash.profile.town !== undefined ? (dash.profile.town || '') : prev.town
          const updated = {
            ...prev,
            name: updatedName,
            phone: updatedPhone,
            town: updatedTown,
          }
          try {
            const cached = JSON.parse(sessionStorage.getItem('user') || 'null')
            if (cached) {
              sessionStorage.setItem('user', JSON.stringify({ ...cached, name: updatedName, phone: updatedPhone, town: updatedTown }))
            }
          } catch {}
          return updated
        })
      }
      if (dash?.profile?.createdAt) {
        setMemberSince(new Date(dash.profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))
      }
      // Real booking coins: the backend enforces these at booking time, so the
      // token counters must reflect the server snapshot, not local estimates.
      if (Array.isArray(entitlementRows?.entitlements)) {
        const mapped = { auto: 0, garden: 0, pet: 0 }
        entitlementRows.entitlements.forEach((item) => {
          const key = String(item.category_name || '').toLowerCase().includes('garden') ? 'garden'
            : String(item.category_name || '').toLowerCase().includes('pet') ? 'pet'
            : 'auto'
          mapped[key] = Number(item.remaining_units) || 0
        })
        setServerTokens(mapped)
      }
      if (Array.isArray(notes)) {
        setNotifications(notes.map(n => ({
            id: 'srv-' + n.id,
            serverId: n.id,
            title: 'Luxora update',
            message: n.message,
            time: new Date(n.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
            unread: !n.read,
            category: 'system'
          })))
      }
      if (Array.isArray(paymentRows?.payments)) {
        const paid = paymentRows.payments
            .filter(p => p.status === 'COMPLETED')
            .map(p => ({
              id: 'pay-' + p.id,
              date: new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
              service: p.plan?.title || 'Luxora package',
              tier: 'Server payment',
              ref: p.gatewayOrderId || ('PAY-' + p.id),
              amount: (p.expectedCurrency || 'LKR') + ' ' + Number(p.expectedAmount).toLocaleString(),
              status: 'Completed',
              cat: 'system'
            }))
        setHistoryData(paid)
      }
      // Real subscription plans replace the old hardcoded catalog.
      if (Array.isArray(planRows)) {
        setAdminSubscriptions(planRows.map((p) => {
          const ents = p.entitlements || []
          const units = ents.reduce((sum, e) => sum + (Number(e.units) || 0), 0)
          return {
            id: 'SUB-' + p.id,
            serverId: p.id,
            displayOrder: (p.displayOrder !== undefined && p.displayOrder !== null && Number(p.displayOrder) > 0) ? Number(p.displayOrder) : Number(p.id),
            title: p.title,
            type: p.type || 'Auto Care',
            recommended: Boolean(p.recommended),
            description: p.description || '',
            cat: ents[0]?.category_name || 'Auto Care',
            tier: p.type || (ents[0]?.category_name || 'Care'),
            visits: units + ' visit' + (units === 1 ? '' : 's') + ' / month',
            tokens: units,
            price: Number(p.discountedPriceMonthly ?? p.priceMonthly) || 0,
            originalPrice: Number(p.originalPriceMonthly ?? p.priceMonthly) || 0,
            discountAmount: Number(p.discountAmount) || 0,
            promotion: p.promotion || null,
            duration: Number(p.durationDays) || 30,
            features: Array.isArray(p.features) ? p.features : [],
            inclusives: (Array.isArray(p.features) && p.features.length)
              ? p.features
              : (ents.length
                ? ents.map((e) => e.category_name + ': ' + e.units + ' service coin' + (Number(e.units) === 1 ? '' : 's') + ' / month')
                : (p.description || 'Luxora care package')),
          }
        }))
        setSubscriptionPlansState('ready')
      } else {
        setSubscriptionPlansState('error')
      }
    } catch (error) { console.warn('Could not sync server data.', error) }
  }

  useEffect(() => { loadServerData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh the server-owned package catalogue when a customer returns to an
  // already-open portal after an administrator edits a package.
  useEffect(() => {
    const refreshLivePlans = () => {
      if (document.visibilityState === 'visible') void loadServerData()
    }
    window.addEventListener('focus', refreshLivePlans)
    document.addEventListener('visibilitychange', refreshLivePlans)
    return () => {
      window.removeEventListener('focus', refreshLivePlans)
      document.removeEventListener('visibilitychange', refreshLivePlans)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // PayHere and NOWPayments hosted checkout returns to /customer-dashboard
  // Strip query parameters immediately, then confirm the authoritative payment
  // state from the backend before displaying any completion UI.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const payhereFlag = params.get('payhere')
      const paymentFlag = params.get('payment')
      const orderId = params.get('order_id')

      if (payhereFlag === 'return' || payhereFlag === 'cancel') {
        window.history.replaceState({}, '', window.location.pathname)
        resolvePaymentReturn(orderId, payhereFlag === 'cancel')
      } else if (paymentFlag === 'success' || paymentFlag === 'cancelled') {
        window.history.replaceState({}, '', window.location.pathname)
        resolvePaymentReturn(orderId, paymentFlag === 'cancelled')
      }
    } catch { /* ignore malformed query strings */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Real start/completion PINs for an expanded booking row (the list endpoint
  // no longer returns plaintext PINs; they live behind /bookings/:id/pins).
  useEffect(() => {
    if (!selectedBookingId) return
    const row = customerActiveBookings.find(b => b.id === selectedBookingId)
    if (!row || row.pinsFetched || row.status === 'CANCELLED' || row.status === 'COMPLETED') return
    const token = sessionStorage.getItem('token')
    apiRequest('/bookings/' + row.id + '/pins', 'GET', null, token).then(pins => {
      setCustomerActiveBookings(prev => prev.map(b => b.id === row.id ? { ...b, pin: pins.start_pin, endPin: pins.completion_pin, pinsFetched: true } : b))
    }).catch(() => {
      setCustomerActiveBookings(prev => prev.map(b => b.id === row.id ? { ...b, pinsFetched: true } : b))
    })
  }, [selectedBookingId, customerActiveBookings])

  const cancelMembership = async (sub) => {
    if (!window.confirm('Cancel your ' + (sub.plan?.title || 'membership') + '? Remaining credits will lapse.')) return
    const token = sessionStorage.getItem('token')
    try {
      await apiRequest('/subscriptions/' + sub.id + '/cancel', 'PUT', { confirmed: true }, token)
      addNotification({ title: 'Membership Cancelled', message: 'Your ' + (sub.plan?.title || 'membership') + ' has been cancelled.', category: 'system' })
      await loadServerData()
    } catch (error) { alert(error.message || 'Could not cancel membership.') }
  }

  const toggleAutoRenew = async (sub) => {
    const token = sessionStorage.getItem('token')
    try {
      await apiRequest('/subscriptions/' + sub.id + '/auto-renew', 'PUT', { auto_renew: !sub.autoRenew }, token)
      await loadServerData()
    } catch (error) { alert(error.message || 'Could not update renewal.') }
  }

  const openReview = (bookingRow) => {
    setReviewTarget(bookingRow)
    setReviewRating(5)
    setReviewComment('')
    setReviewError('')
  }

  const submitReview = async () => {
    if (!reviewTarget) return
    const token = sessionStorage.getItem('token')
    setReviewBusy(true)
    setReviewError('')
    try {
      await apiRequest('/reviews', 'POST', {
        booking_id: reviewTarget.id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      }, token)
      addNotification({ title: 'Review Submitted', message: 'Thanks for rating ' + (reviewTarget.service || 'your service') + '!', category: 'system' })
      setReviewTarget(null)
    } catch (error) {
      setReviewError(error.message || 'Could not submit review.')
    } finally {
      setReviewBusy(false)
    }
  }

  const saveProfileEdits = async (e) => {
    e.preventDefault()
    const token = sessionStorage.getItem('token')
    setProfileBusy(true)
    setProfileSavedMsg('')
    try {
      const body = {}
      if (profileEdit.name.trim() && profileEdit.name.trim() !== currentUser.name) body.name = profileEdit.name.trim()
      if (profileEdit.town.trim() && profileEdit.town.trim() !== (userAddress.city || '')) body.town = profileEdit.town.trim()
      if (profileEdit.phone !== undefined && profileEdit.phone.trim() !== (currentUser.phone || '')) body.phone = profileEdit.phone.trim()
      if (!Object.keys(body).length) { setProfileSavedMsg('Nothing to update.'); return }
      const savedProfile = await apiRequest('/profile', 'PUT', body, token)
      
      const updated = { ...currentUser }
      if (body.name) updated.name = body.name
      if (body.phone !== undefined) {
        updated.phone = savedProfile.phone
      }
      setCurrentUser(updated)
      try {
        const cached = JSON.parse(sessionStorage.getItem('user') || '{}')
        sessionStorage.setItem('user', JSON.stringify({ ...cached, ...updated }))
      } catch {}
      localStorage.setItem('user_' + currentUser.email, JSON.stringify(updated))

      if (body.town) {
        const newAddr = { ...userAddress, city: body.town }
        setUserAddress(newAddr)
        localStorage.setItem('userAddress_' + userKey, JSON.stringify(newAddr))
      }
      setProfileSavedMsg('Profile saved successfully!')
    } catch (error) {
      setProfileSavedMsg(error.message || 'Could not save profile.')
    } finally {
      setProfileBusy(false)
    }
  }

  const checkIsPinUnlocked = () => true

  const [cancelBookingConfirmModal, setCancelBookingConfirmModal] = useState(null)

  const handleCancelBooking = (bookingId) => {
    const target = customerActiveBookings.find(b => b.id === bookingId)
    const serviceName = target ? target.service : 'Service'
    setCancelBookingConfirmModal({ bookingId, serviceName })
  }

  const confirmCancelBooking = (bookingId, serviceName) => {
    setCancelBookingConfirmModal(null)
    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token' || !Number.isInteger(Number(bookingId))) {
      alert('Please sign in to cancel this booking.')
      return
    }
    apiRequest(`/bookings/${bookingId}/cancel`, 'PUT', null, token)
      .then(async () => {
        setCustomerActiveBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'CANCELLED' } : b))
        setSelectedBookingId(prev => prev === bookingId ? null : prev)
        addNotification({ title: 'Booking Cancelled', message: `Your booking ${bookingId} (${serviceName}) has been cancelled.`, category: 'system' })
        await loadServerData()
      })
      .catch((error) => alert(error.message || 'Could not cancel this booking.'))
  }

  // Service Booking State
  const [serviceBookingForm, setServiceBookingForm] = useState({
    packageId: '',
    petType: '',
    date: new Date().toISOString().split('T')[0],
    hour: '10',
    minute: '30',
    ampm: 'AM'
  })
  const [showInsufficientTokensModal, setShowInsufficientTokensModal] = useState(false)
  const [insufficientTokenCategory, setInsufficientTokenCategory] = useState('')
  const [sessionBookingSuccessModal, setSessionBookingSuccessModal] = useState(null)
  const [bookingSessionBusy, setBookingSessionBusy] = useState(false)

  const handleConfirmServiceBooking = async () => {
    if (bookingSessionBusy) return
    if (!userAddress || (!userAddress.street && !userAddress.city)) {
      setShowAddressModal(true)
      setBookingSuccessMsg('📍 Address Required: Please set your Service Delivery Address before booking a session.')
      setTimeout(() => setBookingSuccessMsg(''), 6000)
      return
    }

    if (!serviceBookingForm.packageId) {
      alert('Please select a category to book a session.')
      return
    }

    const cat = serviceBookingForm.packageId || 'auto'
    const catLabels = { auto: 'Auto Care', garden: 'Garden Care', pet: 'Pet Care' }
    const categoryName = catLabels[cat] || 'Service'
    const selectedPetType = PET_TYPE_OPTIONS.find((item) => item.id === serviceBookingForm.petType)

    if (cat === 'pet' && !selectedPetType) {
      alert('Please choose Dog Care, Cat Care, or Fish Care.')
      return
    }

    if ((tokens[cat] || 0) <= 0) {
      setInsufficientTokenCategory(categoryName)
      setShowInsufficientTokensModal(true)
      return
    }

    const selectedTimeFormatted = `${serviceBookingForm.hour}:${serviceBookingForm.minute} ${serviceBookingForm.ampm}`
    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token') {
      alert('Please sign in with your Luxora account to book a service.')
      return
    }
    let created
    setBookingSessionBusy(true)
    try {
      await apiRequest('/profile', 'PUT', {
        town: userAddress.city,
        address_street: userAddress.street,
        address_district: userAddress.district,
      }, token)
      const services = await apiRequest('/services', 'GET', null, token)
      const categoryServices = services.filter((item) => item.category_name === categoryName)
      const service = cat === 'pet'
        ? categoryServices.find((item) => selectedPetType.servicePattern.test(item.title))
        : categoryServices[0]
      if (!service) {
        throw new Error(cat === 'pet'
          ? `${selectedPetType.title} is not currently available.`
          : `No ${categoryName} service is currently available.`)
      }
      created = await apiRequest('/bookings', 'POST', {
        service_id: service.id,
        booking_date: serviceBookingForm.date,
        booking_time: selectedTimeFormatted,
      }, token)
    } catch (error) {
      alert(error.message || 'Could not create this booking.')
      return
    } finally {
      setBookingSessionBusy(false)
    }

    const serviceTitle = categoryName

    let startPin = created?.start_pin
    let completionPin = created?.completion_pin
    if (!startPin && created?.booking_id) {
      try {
        const pins = await apiRequest('/bookings/' + created.booking_id + '/pins', 'GET', null, token)
        startPin = pins.start_pin
        completionPin = pins.completion_pin
      } catch {
        // Pins will still be fetched on dashboard active bookings list
      }
    }

    const newB = {
      id: created.booking_id,
      customer: currentUser?.name || 'Customer',
      service: serviceTitle,
      status: String(created.status).toUpperCase(),
      color: '#4ade80',
      date: serviceBookingForm.date,
      time: selectedTimeFormatted,
      amount: `LKR ${Number(created.total_price).toLocaleString()}`,
      pin: startPin,
      endPin: completionPin,
      location: `${userAddress.street}, ${userAddress.city}${userAddress.district ? `, ${userAddress.district}` : ''}`,
      providerName: String(created.status).toLowerCase() === 'assigned' ? 'Assigned Provider' : 'Awaiting assignment',
      providerRole: '',
      isSession: true,
    }

    addNotification({
      title: '📅 Service Session Booked',
      message: `Your session for ${serviceTitle} has been confirmed for ${serviceBookingForm.date} at ${selectedTimeFormatted}.`,
      category: cat
    })

    setSessionBookingSuccessModal({
      ...newB,
      categoryName,
      remainingTokens: Math.max(0, Number(created.entitlement?.remaining_units) || 0)
    })
    setServiceBookingForm(prev => ({ ...prev, packageId: '', petType: '' }))

    // 1. Immediate optimistic UI update with full booking details
    setCustomerActiveBookings((prev) => [newB, ...prev.filter((b) => b.id !== newB.id)])

    // 2. Authoritative server refresh of active bookings, coin counters, memberships and notifications
    await loadServerData()
  }

  // Custom Request State — real support tickets from GET /support/my only.
  const [showCustomRequestModal, setShowCustomRequestModal] = useState(false)
  const [customRequestSuccessModal, setCustomRequestSuccessModal] = useState(null)
  const [customRequests, setCustomRequests] = useState([])

  const [customForm, setCustomForm] = useState({ title: '', category: 'Home & Estate Care', date: '', time: '10:00 AM', notes: '' })

  // Restore a pre-filled Bespoke Concierge request passed from the chatbot.
  useEffect(() => {
    try {
      const savedRequest = sessionStorage.getItem('pendingBespokeRequest')
      const params = new URLSearchParams(window.location.search)
      const shouldOpenRequest = params.get('openBespoke') === 'true'

      if (savedRequest) {
        const parsed = JSON.parse(savedRequest)
        setCustomForm((prev) => ({
          ...prev,
          title: parsed.title || prev.title,
          category: parsed.category || prev.category,
          date: parsed.date || prev.date,
          notes: parsed.notes || prev.notes,
        }))
        setShowCustomRequestModal(true)
        sessionStorage.removeItem('pendingBespokeRequest')
      } else if (shouldOpenRequest) {
        setShowCustomRequestModal(true)
      }

      if (shouldOpenRequest) window.history.replaceState({}, '', window.location.pathname)
    } catch (error) {
      console.warn('Could not restore bespoke request from session.', error)
    }
  }, [])

  // Custom requests are real support tickets on the server; load them so the
  // list survives reloads and is visible to the concierge/admin team.
  useEffect(() => {
    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token') return
    apiRequest('/support/my', 'GET', null, token).then((tickets) => {
      if (!Array.isArray(tickets) || tickets.length === 0) return
      const mapped = tickets.map((t) => ({
        id: `REQ-${String(t.id).padStart(3, '0')}`,
        serverId: t.id,
        title: t.subject,
        category: 'Concierge Desk',
        date: new Date(t.createdAt).toISOString().split('T')[0],
        time: '10:00 AM',
        notes: t.message,
        status: t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'Resolved' : 'Under Concierge Review'
      }))
      setCustomRequests(mapped)
    }).catch((error) => console.warn('Could not load custom requests.', error))
  }, [])

  const handleCustomRequestSubmit = async (e) => {
    e.preventDefault()
    if (!customForm.title?.trim() || !customForm.category?.trim() || !customForm.date?.trim() || !customForm.notes?.trim()) {
      alert('Please fill out all required fields: Subject Title, Category, Preferred Date, and Special Requirements.')
      return
    }

    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token') {
      alert('Please log in with a live backend account to submit a custom request.')
      return
    }

    try {
      const ticket = await apiRequest('/support', 'POST', {
        subject: customForm.title.trim(),
        message: `[${customForm.category}${customForm.date ? ` · preferred ${customForm.date} ${customForm.time || '10:00 AM'}` : ''}] ${customForm.notes.trim()}`,
        priority: 'NORMAL',
      }, token)
      const newReq = {
        id: `REQ-${String(ticket.id).padStart(3, '0')}`,
        serverId: ticket.id,
        title: customForm.title,
        category: customForm.category,
        date: customForm.date || new Date().toISOString().split('T')[0],
        time: customForm.time || '10:00 AM',
        notes: customForm.notes,
        status: 'Under Concierge Review'
      }
      setCustomRequests([newReq, ...customRequests])
      addNotification({
        title: 'Custom Request Submitted',
        message: `Your request "${customForm.title}" (${newReq.id}) has been submitted to Concierge Desk.`,
        category: 'system'
      })
      setCustomRequestSuccessModal({
        title: customForm.title,
        id: newReq.id,
      })
      setShowCustomRequestModal(false)
      setCustomForm({ title: '', category: 'Home & Estate Care', date: '', time: '10:00 AM', notes: '' })
    } catch (error) {
      alert(error.message || 'Could not submit your request. Please try again.')
    }
  }

  const handleCancelSubscription = (pkgId) => {
    const targetId = (pkgId !== undefined && pkgId !== null) ? pkgId : ((selectedActivePackageToManage && selectedActivePackageToManage.id) || (packageToCancel && packageToCancel.id))
    if (targetId === undefined || targetId === null) {
      alert('Package ID missing.')
      return
    }

    const cancelledPkg = activePackages.find(p => String(p.id) === String(targetId)) || packageToCancel
    const updated = activePackages.filter(p => String(p.id) !== String(targetId))

    setActivePackages(updated)

    if (cancelledPkg) {
      addNotification({
        title: '⚠️ Subscription Cancelled',
        message: `Your ${cancelledPkg.title} (${cancelledPkg.tier || 'Standard'}) subscription has been cancelled.`,
        category: cancelledPkg.cat || 'system'
      })

    }

    setSelectedActivePackageToManage(null)
    setShowCancelConfirmStep(false)
    setPackageToCancel(null)
    setShowCancelPackageConfirmModal(false)

    setCancelledPackageTitle(cancelledPkg ? cancelledPkg.title : 'Package')
    setShowCancelledSuccessModal(true)
  }

  // Real checkout: in demo mode this creates a server-side payment and
  // activates the subscription through the backend; in PayHere mode it
  // delegates to the hosted checkout. No local-only subscription state.
  const handleConfirmBooking = async (pkg) => {
    if (!userAddress || (!userAddress.street && !userAddress.city)) {
      setSelectedPackageToBook(null)
      setShowAddressModal(true)
      setBookingSuccessMsg('📍 Address Required: Please set your Service Delivery Address before completing this purchase.')
      setTimeout(() => setBookingSuccessMsg(''), 6000)
      return
    }

    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token') {
      alert('Please log in with a live backend account before subscribing.')
      return
    }

    setPaymentBusy(true)
    try {
      const plans = await apiRequest('/subscriptions')
      const plan = plans.find((p) => p.id === pkg.serverId) || plans.find((p) => p.title === pkg.title || p.title.endsWith(pkg.title))
      if (!plan) throw new Error('This package is not available on the server. Please contact Luxora support.')

      if (paymentMode === 'payhere') {
        await startPayment('payhere', { ...pkg, title: plan.title })
        return
      }

      const order = await apiRequest('/payments/demo/order', 'POST', {
        plan_id: plan.id,
        auto_renew: bookingBillingType === 'auto_renew',
      }, token)
      const completed = await apiRequest(`/payments/demo/${order.payment_id}/complete`, 'POST', { outcome: 'success' }, token)

      // Refresh coins, memberships, payments history and notifications from the server.
      await loadServerData()
      setSelectedPackageToBook(null)
      const coins = completed.receipt?.coins_granted || 0
      setActiveTab('overview')
      setPaymentSuccess({ planTitle: plan.title, coins, emailDelivery: completed.email_delivery })
    } catch (error) {
      alert(error.message || 'Subscription could not be completed. Please try again.')
    } finally {
      setPaymentBusy(false)
    }
  }

  const startPayment = async (provider, pkg) => {
    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token') { alert('Please log in with a live backend account before paying.'); return }
    const amount = Number(String(pkg.price || '').replace(/[^\d.]/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) { alert('This package has no valid payment amount.'); return }
    setPaymentBusy(true)
    try {
      // Resolve the selected package to a server subscription plan
      const plans = await apiRequest('/subscriptions')
      const plan = plans.find((p) => p.id === pkg.serverId) || plans.find((p) => p.title === pkg.title) || plans.find((p) => Number(p.priceMonthly) === amount)
      if (!plan) throw new Error('This package is not available on the server. Please contact Luxora support.')

      if (provider === 'nowpayments') {
        const order = await apiRequest('/payments/nowpayments/order', 'POST', { plan_id: plan.id }, token)
        if (order.invoiceUrl) {
          window.location.href = order.invoiceUrl
          return
        }
        throw new Error('Invoice URL not returned by payment gateway.')
      }

      const order = await apiRequest('/payments/payhere/order', 'POST', { plan_id: plan.id }, token)
      const form = document.createElement('form'); form.method = 'POST'; form.action = order.checkoutUrl
      Object.entries(order.fields).forEach(([name, value]) => { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value ?? ''; form.appendChild(input) })
      document.body.appendChild(form); form.submit()
    } catch (error) {
      alert(error.message || 'Payment could not be started.')
    } finally {
      setPaymentBusy(false)
    }
  }

  // Support Modal State
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [supportCategory, setSupportCategory] = useState('General Inquiry')
  const [supportMessage, setSupportMessage] = useState('')
  const [supportSentSuccess, setSupportSentSuccess] = useState(false)
  const [supportRefNum, setSupportRefNum] = useState('')
  const [supportBusy, setSupportBusy] = useState(false)

  const handleSendSupportMessage = async (e) => {
    e.preventDefault()
    if (!supportMessage.trim() || supportBusy) return

    const token = sessionStorage.getItem('token')
    if (!token || token === 'demo-token') {
      alert('Please sign in to send a support request.')
      return
    }
    let created
    setSupportBusy(true)
    try {
      created = await apiRequest('/complaints', 'POST', {
        subject: supportCategory,
        description: supportMessage,
      }, token)
    } catch (error) {
      alert(error.message || 'Could not send your support request.')
      return
    } finally {
      setSupportBusy(false)
    }
    const ref = created?.complaint?.id ? `SUP-${String(created.complaint.id).padStart(4, '0')}` : 'SUP-REGISTERED'
    setSupportRefNum(ref)
    setSupportSentSuccess(true)
    void loadServerData()

    setTimeout(() => {
      setSupportSentSuccess(false)
      setSupportMessage('')
      setShowSupportModal(false)
    }, 2800)
  }



  // Dynamic History Data State — server payments only (see loadServerData);
  // no seeded or cached rows so fake transactions can never render.
  const [historyData, setHistoryData] = useState([])

  // Notification Drawer State — server notifications only (see
  // loadServerData); no seeded rows so fabricated alerts can never render.
  const [showNotifDrawer, setShowNotifDrawer] = useState(false)
  const [notifications, setNotifications] = useState([])

  const addNotification = () => { void loadServerData() }

  const unreadCount = notifications.filter(n => n.unread).length

  const markAllNotifsRead = () => {
    const token = sessionStorage.getItem('token')
    if (!token) return
    apiRequest('/notifications/read-all', 'PUT', null, token)
      .then(() => setNotifications(prev => prev.map(n => ({ ...n, unread: false }))))
      .catch((error) => alert(error.message || 'Could not mark notifications as read.'))
  }

  const markNotifAsRead = (id) => {
    const target = notifications.find(n => n.id === id)
    const token = sessionStorage.getItem('token')
    if (!target?.serverId || !token) return
    apiRequest('/notifications/' + target.serverId + '/read', 'PUT', null, token)
      .then(() => setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n)))
      .catch((error) => alert(error.message || 'Could not mark this notification as read.'))
  }

  const dismissNotification = (id) => {
    const target = notifications.find(n => n.id === id)
    const token = sessionStorage.getItem('token')
    if (!target?.serverId || !token) return
    apiRequest('/notifications/' + target.serverId, 'DELETE', null, token)
      .then(() => setNotifications(prev => prev.filter(n => n.id !== id)))
      .catch((error) => alert(error.message || 'Could not dismiss this notification.'))
  }

  // Current User State & LocalStorage Sync
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = sessionStorage.getItem('user')
      if (u) {
        const parsed = JSON.parse(u)
        const saved = localStorage.getItem('user_' + (parsed.email || 'guest'))
        // Merge over defaults so a stale saved profile can never leave
        // name/email undefined for .trim() calls downstream.
        return {
          name: parsed.name || 'Member',
          email: parsed.email || '',
          phone: parsed.phone || '',
          id: parsed.id ? `CUS-2026-0${parsed.id}` : '',
          ...(saved ? JSON.parse(saved) : {})
        }
      }
    } catch {}
    return {
      name: 'Member',
      email: '',
      phone: '',
      id: ''
    }
  })

  const userKey = currentUser.email || 'guest'

  useEffect(() => {
    // Auth gate: the shared Login stores a JWT token (the legacy
    // isCustomerLoggedIn flag is never set by it).
    const token = sessionStorage.getItem('token')
    if (!token) {
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

  const handleSaveAddress = async (e) => {
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
    const token = sessionStorage.getItem('token')
    if (token && token !== 'demo-token') {
      try {
        await apiRequest('/profile', 'PUT', {
          town: newAddr.city,
          address_street: newAddr.street,
          address_district: newAddr.district,
        }, token)
      } catch (error) {
        console.warn('Could not persist customer town to backend.', error)
      }
    }
    sessionStorage.removeItem('isFirstTimeSignup')
    setShowAddressModal(false)
  }

  const isGoldMember = serverSubscriptions.some((sub) => {
    const titleLower = (sub.plan?.title || '').toLowerCase()
    return Number(sub.plan?.priceMonthly || 0) >= 30000 || titleLower.includes('combo')
  }) || activePackages.some((pkg) => {
    const tierLower = (pkg.tier || '').toLowerCase()
    const titleLower = (pkg.title || '').toLowerCase()
    return tierLower.includes('premium') || titleLower.includes('premium') || titleLower.includes('full home suite')
  })

  const firstName = currentUser.name.trim().split(' ')[0] || 'Member'
  const initials = currentUser.name.trim().split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AP'

  // Next upcoming session for the hero banner (earliest non-cancelled
  // booking dated today or later). Null → the banner invites a booking.
  const todayStr = new Date().toISOString().slice(0, 10)
  const nextBooking = [...customerActiveBookings]
    .filter(b => b && b.status !== 'CANCELLED' && b.date && b.date >= todayStr)
    .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`))[0] || null

  const filteredHistory = historyFilter === 'all'
    ? historyData
    : historyData.filter((item) => item.cat === historyFilter)

  const totalHistorySpent = historyData.reduce((acc, item) => {
    const num = parseInt((item.amount || '').replace(/[^0-9]/g, '')) || 0
    return acc + num
  }, 0)

  const formattedTotalSpent = `LKR ${totalHistorySpent.toLocaleString()}`
  const avgPerMonth = `LKR ${Math.round(totalHistorySpent / Math.max(1, historyData.length)).toLocaleString()}`

  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
  }

  const finalizeLogout = () => {
    sessionStorage.removeItem('isCustomerLoggedIn')
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('token')
    navigate('/')
  }

  const handleSelectSubscriptionPlan = (plan, title) => {
    if (!userAddress || (!userAddress.street && !userAddress.city)) {
      setShowAddressModal(true)
      setBookingSuccessMsg('📍 Address Required: Please set your Service Delivery Address before purchasing a plan.')
      setTimeout(() => setBookingSuccessMsg(''), 6000)
      return
    }
    const planType = String(plan.type || '').toLowerCase()
    const categoryName = String(plan.cat || '').toLowerCase()
    const category = planType.includes('combo') ? 'system'
      : categoryName.includes('garden') ? 'garden'
        : categoryName.includes('pet') ? 'pet'
          : 'auto'
    setSelectedPackageToBook({
      title,
      serverId: plan.serverId,
      tier: plan.type || 'Luxora Package',
      price: `LKR ${Number(plan.price).toLocaleString()}`,
      originalPrice: plan.originalPrice,
      promotion: plan.promotion,
      cat: category,
      duration: plan.duration || 30,
      service_id: 1,
    })
  }

  return (
    <div className="cd-page">
      {/* 2-Second Polished Logout Overlay */}
      <LogoutOverlay isOpen={isLoggingOut} onComplete={finalizeLogout} />

      {paymentSuccess && (
        <div className="cd-support-overlay" style={{ zIndex: 1000 }}>
          <div className="cd-support-modal animate-fade-in" style={{ maxWidth: '440px', textAlign: 'center' }} role="dialog" aria-modal="true" aria-label="Payment successful">
            <div className="cd-support-modal__header" style={{ alignItems: 'center' }}>
              <div className="cd-support-icon-box" style={{ background: 'rgba(34, 197, 94, 0.16)', color: '#4ade80' }}>✓</div>
              <h2 className="cd-support-modal__title">Demo Payment Successful</h2>
              <p className="cd-support-modal__subtitle">No real money was charged.</p>
            </div>
            <div className="cd-book-confirm-details" style={{ marginTop: '1rem', textAlign: 'left' }}>
              <div className="cd-book-confirm-row"><span>Package</span><strong>{paymentSuccess.planTitle}</strong></div>
              <div className="cd-book-confirm-row"><span>Coins added</span><strong className="gold-accent">{paymentSuccess.coins}</strong></div>
              <div className="cd-book-confirm-row"><span>Receipt email</span><small>{paymentSuccess.emailDelivery === 'sent' ? 'Sent to your account email' : paymentSuccess.emailDelivery === 'not_configured' ? 'Email delivery is not configured' : 'Could not be delivered'}</small></div>
            </div>
            <button type="button" className="cd-support-send-btn" style={{ marginTop: '1.5rem' }} onClick={() => setPaymentSuccess(null)}>VIEW MY PACKAGE</button>
          </div>
        </div>
      )}
      {/* ── PayHere result — status read from the backend, never from the redirect ── */}
      {payhereResult && (
        <div className="cd-support-overlay" style={{ zIndex: 1000 }} onClick={() => payhereResult.status !== 'checking' && setPayhereResult(null)}>
          <div className="cd-support-modal animate-fade-in" style={{ maxWidth: '460px', textAlign: 'center' }} role="dialog" aria-modal="true" aria-label="PayHere payment result">
            {payhereResult.status === 'checking' && (
              <>
                <div className="cd-support-modal__header" style={{ alignItems: 'center' }}>
                  <div className="cd-support-icon-box">…</div>
                  <h2 className="cd-support-modal__title">Checking your payment</h2>
                  <p className="cd-support-modal__subtitle">Confirming the payment status with the Luxora server…</p>
                </div>
              </>
            )}
            {payhereResult.status === 'success' && (() => {
              const p = payhereResult.payment
              const txRef = p?.webhookPayload?.payment_id || p?.gatewayOrderId
              return (
                <>
                  <div className="cd-support-modal__header" style={{ alignItems: 'center' }}>
                    <div className="cd-support-icon-box" style={{ background: 'rgba(34, 197, 94, 0.16)', color: '#4ade80' }}>✓</div>
                    <h2 className="cd-support-modal__title">Payment Successful</h2>
                    <p className="cd-support-modal__subtitle">Confirmed by the Luxora server via {p?.gateway === 'NOWPAYMENTS' ? 'NOWPayments' : 'PayHere'}</p>
                  </div>
                  <div className="cd-book-confirm-details" style={{ marginTop: '1rem', textAlign: 'left' }}>
                    <div className="cd-book-confirm-row"><span>Status</span><strong style={{ color: '#4ade80' }}>PAID</strong></div>
                    <div className="cd-book-confirm-row"><span>Luxora Order ID</span><strong>{p?.gatewayOrderId}</strong></div>
                    <div className="cd-book-confirm-row"><span>Amount</span><strong>{p?.capturedCurrency || p?.expectedCurrency} {Number(p?.capturedAmount ?? p?.expectedAmount ?? 0).toLocaleString()}</strong></div>
                    <div className="cd-book-confirm-row"><span>Payment Method</span><strong className="gold-accent">{p?.gateway === 'NOWPAYMENTS' ? 'Cryptocurrency (NOWPayments)' : 'PayHere'}</strong></div>
                    {txRef && <div className="cd-book-confirm-row"><span>Transaction Reference</span><small style={{ wordBreak: 'break-all' }}>{txRef}</small></div>}
                    <div className="cd-book-confirm-row"><span>Paid At</span><small>{p?.updatedAt ? new Date(p.updatedAt).toLocaleString() : '—'}</small></div>
                  </div>
                  <button type="button" className="cd-support-send-btn" style={{ marginTop: '1.5rem' }} onClick={() => { setPayhereResult(null); loadServerData(); setActiveTab('overview') }}>VIEW MY PACKAGE</button>
                </>
              )
            })()}
            {(payhereResult.status === 'pending') && (
              <>
                <div className="cd-support-modal__header" style={{ alignItems: 'center' }}>
                  <div className="cd-support-icon-box" style={{ background: 'rgba(234, 179, 8, 0.16)', color: '#eab308' }}>⏳</div>
                  <h2 className="cd-support-modal__title">Payment Pending</h2>
                  <p className="cd-support-modal__subtitle">The payment has not been confirmed yet. If you completed the checkout, confirmation usually arrives within a minute — check your payments history shortly.</p>
                </div>
                <button type="button" className="cd-support-send-btn" style={{ marginTop: '1.5rem' }} onClick={() => { setPayhereResult(null); loadServerData() }}>OK</button>
              </>
            )}
            {(payhereResult.status === 'failed' || payhereResult.status === 'cancelled') && (
              <>
                <div className="cd-support-modal__header" style={{ alignItems: 'center' }}>
                  <div className="cd-support-icon-box" style={{ background: 'rgba(239, 68, 68, 0.16)', color: '#ef4444' }}>✕</div>
                  <h2 className="cd-support-modal__title">{payhereResult.status === 'failed' ? 'Payment Failed' : 'Payment Cancelled'}</h2>
                  <p className="cd-support-modal__subtitle">
                    {payhereResult.status === 'failed'
                      ? 'The payment was not completed and you have not been charged. You can safely try again.'
                      : 'The checkout was cancelled and nothing was charged. Your package was not activated.'}
                  </p>
                </div>
                <button type="button" className="cd-support-send-btn" style={{ marginTop: '1.5rem' }} onClick={() => setPayhereResult(null)}>OK</button>
              </>
            )}
          </div>
        </div>
      )}
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
          </nav>

          {/* Header Right Actions */}
          <div className="cd-header__right">
            {/* Token / coin counters (server entitlements) — desktop copy;
                the mobile header renders its own full-width strip below */}
            <div className="cd-header-tokens cd-header-tokens--desktop" title="Remaining service coins (server entitlements)">
              <span className="cd-htoken" title={'Auto Care — ' + tokens.auto + ' coin(s) remaining'}>
                <CarIcon /> <strong>×{tokens.auto}</strong>
              </span>
              <span className="cd-htoken" title={'Garden Care — ' + tokens.garden + ' coin(s) remaining'}>
                <LeafIcon /> <strong>×{tokens.garden}</strong>
              </span>
              <span className="cd-htoken" title={'Pet Care — ' + tokens.pet + ' coin(s) remaining'}>
                <PawIcon /> <strong>×{tokens.pet}</strong>
              </span>
            </div>

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
              onClick={() => {
                // Seed the edit form with the current values so a save always
                // REPLACES the name/phone/town instead of appending to it.
                setProfileEdit({
                  name: currentUser.name || '',
                  phone: currentUser.phone || '',
                  town: userAddress?.city || ''
                })
                setProfileSavedMsg('')
                setShowProfileDrawer(true)
              }}
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

            <button className="cd-btn-logout" title="Log out" disabled={isLoggingOut} onClick={handleLogout}>
              <LogOutIcon />
            </button>
          </div>

          {/* Token / coin counters — dedicated full-width mobile strip
              (hidden on desktop, where the copy inside the actions group shows) */}
          <div className="cd-header-tokens cd-header-tokens--mobile" title="Remaining service coins (server entitlements)">
            <span className="cd-htoken" title={'Auto Care — ' + tokens.auto + ' coin(s) remaining'}>
              <CarIcon /> <strong>×{tokens.auto}</strong>
            </span>
            <span className="cd-htoken" title={'Garden Care — ' + tokens.garden + ' coin(s) remaining'}>
              <LeafIcon /> <strong>×{tokens.garden}</strong>
            </span>
            <span className="cd-htoken" title={'Pet Care — ' + tokens.pet + ' coin(s) remaining'}>
              <PawIcon /> <strong>×{tokens.pet}</strong>
            </span>
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
                <span className="cd-hero__member-tag">MEMBER SINCE {memberSince || '—'}</span>
              )}
              <h1 className="cd-hero__title">
                Welcome back, <span className="gold-accent">{firstName}</span>
              </h1>

              {/* Next-booking banner: shows the member's next scheduled
                  session, or invites them to book when none is upcoming.
                  Carries a continuous gold sweep animation. */}
              <div className="cd-next-booking" role="status">
                {nextBooking ? (
                  <span className="cd-next-booking__inner">
                    <span className="cd-next-booking__label">⚡ NEXT SERVICE</span>
                    <strong className="cd-next-booking__service">{nextBooking.service || 'Concierge Service'}</strong>
                    <span className="cd-next-booking__when">
                      {nextBooking.date}{nextBooking.time ? ` · ${nextBooking.time}` : ''}
                    </span>
                  </span>
                ) : (
                  <span className="cd-next-booking__inner">
                    <span className="cd-next-booking__label">⚡ NO UPCOMING SERVICE</span>
                    <strong className="cd-next-booking__service">Please add a booking</strong>
                    <button
                      type="button"
                      className="cd-next-booking__cta"
                      onClick={() => document.getElementById('cd-scheduler-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    >
                      Book a session ›
                    </button>
                  </span>
                )}
              </div>

            </div>
          </section>

          {/* Active Packages — one section, driven by the real server
              subscriptions (replaces the old separate MY MEMBERSHIPS block) */}
          <div className="cd-main-container">
            <section className="cd-section">
              <h3 className="cd-section-label">ACTIVE PACKAGES ({serverSubscriptions.length || activePackages.length})</h3>
              {bookingSuccessMsg && (
                <div className="cd-booking-success-toast animate-fade-in">
                  {bookingSuccessMsg}
                </div>
              )}
              <div className="cd-packages-grid">
                {serverSubscriptions.length > 0 ? (
                  serverSubscriptions.map((sub) => (
                    <div
                      key={'srv-' + sub.id}
                      className="cd-package-card cd-package-card--membership"
                      onClick={() => setSelectedMembership(sub)}
                      role="button"
                      tabIndex={0}
                      title="Click to manage membership"
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="cd-package-card__icon"><ShieldIcon /></div>
                      <div className="cd-package-card__info">
                        <h4 className="cd-package-card__title">{sub.plan?.title || 'Luxora membership'}</h4>
                        <p className="cd-package-card__tier">
                          Active until {new Date(sub.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {sub.autoRenew ? 'Auto-renews' : 'One-time'}
                        </p>
                      </div>
                      <div className="cd-package-card__price">
                        <span className="cd-price-amount">LKR {Number(sub.plan?.priceMonthly || 0).toLocaleString()}</span>
                        <span className="cd-price-period">/month</span>
                      </div>
                    </div>
                  ))
                ) : (
                  activePackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="cd-package-card cd-active-pkg-clickable animate-fade-in"
                      onClick={() => { setSelectedActivePackageToManage(pkg); setShowCancelConfirmStep(false) }}
                      role="button"
                      tabIndex={0}
                      title="Click to manage or cancel subscription"
                      style={{ position: 'relative' }}
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
                  ))
                )}

                <button className="cd-package-card cd-package-card--add" onClick={() => setActiveTab('booking')}>
                  <span>+ Add a Package &rsaquo;</span>
                </button>
              </div>
            </section>

            {/* ── SERVICE BOOKING & ACTIVE BOOKINGS DUO GRID LAYOUT ── */}
            <div
              className="cd-duo-booking-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
                gap: '1.75rem',
                alignItems: 'stretch',
                marginTop: '1.75rem'
              }}
            >
              {/* ── LEFT COLUMN: SERVICE BOOKING LUXURY MODULE ── */}
              <section
                id="cd-scheduler-panel"
                className="cd-section animate-fade-in cd-scheduler-panel"
                style={{
                  background: 'linear-gradient(145deg, #121214 0%, #1a1a1f 100%)',
                  border: '1px solid rgba(201, 168, 76, 0.35)',
                  borderRadius: '20px',
                  padding: '1.75rem',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%'
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

                {/* ── STEP 1: SELECT CATEGORY (Always Display Auto Care, Garden Care, Pet Care) ── */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                    <span style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontSize: '0.75rem', fontWeight: 900, width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                    <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em' }}>SELECT CATEGORY:</span>
                  </div>

                  <div className="cd-cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
                    {[
                      { id: 'auto', title: 'Auto Care', icon: <CarIcon /> },
                      { id: 'garden', title: 'Garden Care', icon: <LeafIcon /> },
                      { id: 'pet', title: 'Pet Care', icon: <PawIcon /> }
                    ].map(catItem => {
                      const isSelected = serviceBookingForm.packageId === catItem.id
                      return (
                        <div
                          key={catItem.id}
                          onClick={() => setServiceBookingForm(prev => ({
                            ...prev,
                            packageId: catItem.id,
                            petType: catItem.id === 'pet' ? prev.petType : '',
                          }))}
                          role="button"
                          tabIndex={0}
                          style={{
                            background: isSelected ? 'rgba(201, 168, 76, 0.14)' : '#161619',
                            border: isSelected ? '2px solid var(--gold, #c9a84c)' : '1px solid #2a2a30',
                            borderRadius: '14px',
                            padding: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            boxShadow: isSelected ? '0 0 20px rgba(201, 168, 76, 0.2)' : 'none'
                          }}
                        >
                          {isSelected && (
                            <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--gold, #c9a84c)', color: '#000', fontSize: '0.6rem', fontWeight: 900, padding: '0.15rem 0.4rem', borderRadius: '10px' }}>
                              ✓
                            </span>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <div style={{ background: isSelected ? 'var(--gold, #c9a84c)' : '#222', color: isSelected ? '#000' : 'var(--gold, #c9a84c)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {catItem.icon}
                            </div>
                            <div>
                              <h4 style={{ color: '#fff', margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>{catItem.title}</h4>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {serviceBookingForm.packageId === 'pet' && (
                    <div className="cd-pet-type-picker">
                      <div className="cd-pet-type-picker__heading">
                        <span>2</span>
                        <div>
                          <strong>CHOOSE PET CARE</strong>
                          <small>Select the pet that needs care before scheduling.</small>
                        </div>
                      </div>
                      <div className="cd-pet-type-grid" role="group" aria-label="Pet care type">
                        {PET_TYPE_OPTIONS.map((petType) => {
                          const isSelected = serviceBookingForm.petType === petType.id
                          return (
                            <button
                              type="button"
                              key={petType.id}
                              className={`cd-pet-type-card${isSelected ? ' is-selected' : ''}`}
                              aria-pressed={isSelected}
                              onClick={() => setServiceBookingForm((prev) => ({ ...prev, petType: petType.id }))}
                            >
                              <span className="cd-pet-type-card__icon" aria-hidden="true">{petType.icon}</span>
                              <span>
                                <strong>{petType.title}</strong>
                                <small>{petType.detail}</small>
                              </span>
                              {isSelected && <b aria-label="Selected">✓</b>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── STEP 2 & 3: DATE & TIME SELECTION ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {/* Step 2 Card */}
                  <div style={{ background: '#18181c', border: '1px solid #2a2a30', borderRadius: '14px', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      <span style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontSize: '0.7rem', fontWeight: 900, width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                      <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em' }}>CALENDAR DATE</span>
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
                        padding: '0.65rem 0.75rem',
                        borderRadius: '10px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        outline: 'none',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>

                  {/* Step 3 Card: Broken down into Hours, Minutes, and AM/PM */}
                  <div style={{ background: '#18181c', border: '1px solid #2a2a30', borderRadius: '14px', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      <span style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontSize: '0.7rem', fontWeight: 900, width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                      <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em' }}>TIME (HOURS, MIN, AM/PM)</span>
                    </div>

                    <div className="cd-time-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.35rem' }}>
                      {/* Hours */}
                      <div>
                        <label style={{ display: 'block', color: '#888', fontSize: '0.6rem', fontWeight: 700, marginBottom: '0.2rem' }}>HOUR</label>
                        <select
                          value={serviceBookingForm.hour}
                          onChange={(e) => setServiceBookingForm(prev => ({ ...prev, hour: e.target.value }))}
                          style={{ width: '100%', background: '#0d0d0f', color: '#fff', border: '1px solid #333', padding: '0.55rem 0.2rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, textAlign: 'center', outline: 'none', cursor: 'pointer' }}
                        >
                          {['01','02','03','04','05','06','07','08','09','10','11','12'].map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      {/* Minutes */}
                      <div>
                        <label style={{ display: 'block', color: '#888', fontSize: '0.6rem', fontWeight: 700, marginBottom: '0.2rem' }}>MIN</label>
                        <select
                          value={serviceBookingForm.minute}
                          onChange={(e) => setServiceBookingForm(prev => ({ ...prev, minute: e.target.value }))}
                          style={{ width: '100%', background: '#0d0d0f', color: '#fff', border: '1px solid #333', padding: '0.55rem 0.2rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, textAlign: 'center', outline: 'none', cursor: 'pointer' }}
                        >
                          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      {/* AM/PM */}
                      <div>
                        <label style={{ display: 'block', color: '#888', fontSize: '0.6rem', fontWeight: 700, marginBottom: '0.2rem' }}>PERIOD</label>
                        <select
                          value={serviceBookingForm.ampm}
                          onChange={(e) => setServiceBookingForm(prev => ({ ...prev, ampm: e.target.value }))}
                          style={{ width: '100%', background: '#0d0d0f', color: 'var(--gold, #c9a84c)', border: '1px solid var(--gold, #c9a84c)', padding: '0.55rem 0.2rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 900, textAlign: 'center', outline: 'none', cursor: 'pointer' }}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <ActionButton
                    loading={bookingSessionBusy}
                    loadingText="Reserving Concierge..."
                    onClick={handleConfirmServiceBooking}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #d4af37 0%, #aa7c11 100%)',
                      color: '#000',
                      border: 'none',
                      padding: '0.85rem 1.5rem',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      letterSpacing: '0.04em',
                      cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(201, 168, 76, 0.35)'
                    }}
                  >
                    CONFIRM &amp; BOOK SERVICE SESSION ✨
                  </ActionButton>
                </div>
              </section>

              {/* ── RIGHT COLUMN: ACTIVE BOOKINGS CHART / TABLE ── */}
              <section
                className="cd-section animate-fade-in"
                style={{
                  background: 'linear-gradient(145deg, #121214 0%, #1a1a1f 100%)',
                  border: '1px solid rgba(201, 168, 76, 0.35)',
                  borderRadius: '20px',
                  padding: '1.75rem',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 className="cd-section-label" style={{ margin: 0, color: 'var(--gold, #c9a84c)' }}>ACTIVE BOOKINGS</h3>
                    <p style={{ color: '#aaa', fontSize: '0.82rem', margin: '0.2rem 0 0 0' }}>Real-time active bookings chart with security PINs</p>
                  </div>
                  <button
                    className="cd-btn-view-receipt"
                    onClick={() => {
                      setActiveTab('active_bookings')
                    }}
                    style={{ background: 'transparent', border: '1px solid var(--gold, #c9a84c)', color: 'var(--gold, #c9a84c)', padding: '0.4rem 0.9rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', borderRadius: '8px' }}
                  >
                    View All ›
                  </button>
                </div>

                <div className="cd-table-wrap cd-overview-bookings-table-wrap" style={{ background: '#141414', border: '1px solid #282828', borderRadius: '16px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <table className="cd-table cd-bookings-table cd-overview-bookings-table" style={{ margin: 0 }}>
                    <thead>
                      <tr style={{ background: '#18181c', borderBottom: '1px solid #282828' }}>
                        <th style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.72rem', padding: '0.75rem 0.75rem' }}>BOOKING ID</th>
                        <th style={{ fontSize: '0.72rem', padding: '0.75rem 0.75rem' }}>CATEGORY</th>
                        <th style={{ fontSize: '0.72rem', padding: '0.75rem 0.75rem' }}>PROVIDER</th>
                        <th style={{ fontSize: '0.72rem', padding: '0.75rem 0.75rem' }}>DATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const sessionOnly = customerActiveBookings.filter(b => b.isSession || b.pin || b.location || (b.time && (b.time.includes('AM') || b.time.includes('PM'))))
                        const displayList = sessionOnly.slice(0, 6)
                        if (displayList.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '0.85rem' }}>
                                No active service session bookings scheduled yet. Select a category on the left to book a session!
                              </td>
                            </tr>
                          )
                        }
                        return displayList.map((b) => {
                          return (
                            <tr
                              key={b.id}
                              className="cd-overview-bookings-row"
                              onClick={() => {
                                if (b.status !== 'CANCELLED') {
                                  setSelectedBookingId(b.id)
                                  setActiveTab('active_bookings')
                                }
                              }}
                              style={{
                                borderBottom: '1px solid #202020',
                                background: b.status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                                cursor: b.status === 'CANCELLED' ? 'not-allowed' : 'pointer',
                                opacity: b.status === 'CANCELLED' ? 0.65 : 1,
                                transition: 'all 0.2s ease'
                              }}
                              title={b.status === 'CANCELLED' ? 'Booking cancelled' : 'Open full booking details'}
                            >
                              <td data-label="Booking" style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800, fontSize: '0.85rem' }}>{b.id}</td>
                              <td data-label="Category" style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }}>
                                {b.service === 'Auto Care' || b.service === 'Garden Care' || b.service === 'Pet Care'
                                  ? b.service
                                  : ((b.service || b.cat || '').toLowerCase().includes('auto') || (b.service || b.cat || '').toLowerCase().includes('car')
                                      ? 'Auto Care'
                                      : ((b.service || b.cat || '').toLowerCase().includes('garden') || (b.service || b.cat || '').toLowerCase().includes('lawn')
                                          ? 'Garden Care'
                                          : ((b.service || b.cat || '').toLowerCase().includes('pet')
                                              ? 'Pet Care'
                                              : (b.service || 'Service'))))}
                              </td>
                              <td data-label="Provider">
                                <span style={{ color: '#eee', fontSize: '0.82rem', fontWeight: 700 }}>{b.providerName || 'Awaiting assignment'}</span>
                                {b.providerPhone && (
                                  <small style={{ display: 'block', color: '#888', fontSize: '0.7rem' }}>📞 {b.providerPhone}</small>
                                )}
                              </td>
                              <td data-label="Date" style={{ color: '#ccc', fontSize: '0.78rem' }}>
                                <div>{b.date}</div>
                                <small style={{ color: 'var(--gold, #c9a84c)', fontWeight: 700 }}>{b.time}</small>
                              </td>
                            </tr>
                      )
                    })
                  })()}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

            {/* ── Custom Service Request Module ── */}
            <section className="cd-section" style={{ marginTop: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 className="cd-section-label" style={{ margin: 0, color: 'var(--gold, #c9a84c)' }}>CUSTOM REQUESTS ({customRequests.length})</h3>
                  <p style={{ color: '#aaa', fontSize: '0.82rem', margin: '0.2rem 0 0 0' }}>Request specialized estate care, bespoke valet, or tailored concierge services</p>
                </div>
                {customRequests.length > 0 && (
                  <button
                    className="cd-btn-view-receipt"
                    onClick={() => setShowCustomRequestModal(true)}
                    style={{ background: 'var(--gold, #c9a84c)', color: '#000', border: 'none', fontWeight: 800, padding: '0.6rem 1.25rem', fontSize: '0.82rem', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    + Submit Custom Request
                  </button>
                )}
              </div>

              {customRequests.length === 0 ? (
                <div style={{ background: '#141414', border: '1px dashed rgba(201, 168, 76, 0.3)', borderRadius: '16px', padding: '3rem 2rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <button
                    className="cd-btn-view-receipt"
                    onClick={() => setShowCustomRequestModal(true)}
                    style={{ background: 'var(--gold, #c9a84c)', color: '#000', border: 'none', fontWeight: 800, padding: '0.85rem 2rem', fontSize: '0.9rem', borderRadius: '10px', boxShadow: '0 4px 15px rgba(201, 168, 76, 0.35)', cursor: 'pointer' }}
                  >
                    + Add Custom Request
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

          {/* Category selector — package type is authoritative, so each
              single-care package is visible only in its own category. */}
          <div className="cd-toggle-bar">
            <button
              className={`cd-toggle-btn ${bookingType === 'combo' ? 'active' : ''}`}
              onClick={() => setBookingType('combo')}
            >
              Combo Packages
            </button>
            <button
              className={`cd-toggle-btn ${bookingType === 'auto' ? 'active' : ''}`}
              onClick={() => setBookingType('auto')}
            >
              Auto Care
            </button>
            <button
              className={`cd-toggle-btn ${bookingType === 'garden' ? 'active' : ''}`}
              onClick={() => setBookingType('garden')}
            >
              Garden Care
            </button>
            <button
              className={`cd-toggle-btn ${bookingType === 'pet' ? 'active' : ''}`}
              onClick={() => setBookingType('pet')}
            >
              Pet Care
            </button>
          </div>

          {/* ── Live plans from the server; neutral message instead of a
              hardcoded catalogue when the backend has not answered yet ── */}
          {subscriptionPlansState === 'loading' && (
            <div style={{ marginTop: '1.5rem', padding: '2rem 1.25rem', textAlign: 'center', color: '#888', fontSize: '0.85rem', border: '1px dashed #282828', borderRadius: '14px', background: '#111' }}>
              Loading live subscription plans from Luxora…
            </div>
          )}
          {subscriptionPlansState === 'error' && (
            <div style={{ marginTop: '1.5rem', padding: '2rem 1.25rem', textAlign: 'center', color: '#bca869', fontSize: '0.85rem', border: '1px dashed rgba(201, 168, 76, 0.35)', borderRadius: '14px', background: '#111' }}>
              Subscription plans are temporarily unavailable. Please try again shortly.
            </div>
          )}
          {subscriptionPlansState === 'ready' && adminSubscriptions.length === 0 && (
            <div style={{ marginTop: '1.5rem', padding: '2rem 1.25rem', textAlign: 'center', color: '#888', fontSize: '0.85rem', border: '1px dashed #282828', borderRadius: '14px', background: '#111' }}>
              No subscription packages are currently active.
            </div>
          )}

          {/* ── Individual category package grid ── */}
          {['auto', 'garden', 'pet'].includes(bookingType) && (
            <div className="cd-subscription-plans-grid">
              {adminSubscriptions
                .filter(s => s.type === ({ auto: 'Auto Care', garden: 'Garden Care', pet: 'Pet Care' }[bookingType]))
                .slice()
                .sort((a, b) => (Number(a.displayOrder || a.serverId || 0) - Number(b.displayOrder || b.serverId || 0)) || (Number(a.serverId || 0) - Number(b.serverId || 0)))
                .map((s) => <SubscriptionPlanCard key={s.id} plan={s} onSelect={handleSelectSubscriptionPlan} />)}
            </div>
          )}

          {/* ── Combo Packages Grid ── */}
          {bookingType === 'combo' && (
            <div className="cd-subscription-plans-grid">
              {adminSubscriptions
                .filter(s => s.type === 'Combo Package')
                .slice()
                .sort((a, b) => (Number(a.displayOrder || a.serverId || 0) - Number(b.displayOrder || b.serverId || 0)) || (Number(a.serverId || 0) - Number(b.serverId || 0)))
                .map((s) => <SubscriptionPlanCard key={s.id} plan={s} onSelect={handleSelectSubscriptionPlan} />)}
            </div>
          )}

          {/* ── Transaction History (Merged Under Subscription Plans) ── */}
          <div style={{ marginTop: '3.5rem', paddingTop: '2.5rem', borderTop: '1px solid #282828' }}>
            <div className="cd-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 className="cd-page-title" style={{ fontSize: '1.45rem', color: 'var(--gold, #c9a84c)' }}>Transaction History</h2>
                <p className="cd-page-subtitle">Real-time log of your concierge payments and receipts</p>
              </div>
              <button
                className="cd-btn-view-receipt"
                onClick={() => setActiveTab('transaction_history')}
                style={{ background: 'transparent', border: '1px solid var(--gold, #c9a84c)', color: 'var(--gold, #c9a84c)', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', borderRadius: '8px' }}
              >
                View All ({filteredHistory.length}) ›
              </button>
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
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#888', fontSize: '0.88rem' }}>
                        No transaction history records found.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.slice(0, 5).map((item) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: ACTIVE BOOKINGS (FULL DEDICATED VIEW WITH DATES & BOOKING ID FILTERS) ── */}
      {activeTab === 'active_bookings' && (
        <div className="cd-tab-content cd-main-container animate-fade-in">
          <div className="cd-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <button
                onClick={() => setActiveTab('overview')}
                style={{ background: 'transparent', border: 'none', color: 'var(--gold, #c9a84c)', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', padding: 0, marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              >
                ‹ Back to Overview
              </button>
              <h1 className="cd-page-title">Active Service Bookings</h1>
              <p className="cd-page-subtitle">Full real-time chart of scheduled concierge dispatches, specialist profiles, and 30-minute security PINs</p>
            </div>

            {/* Interactive Filters Bar */}
            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap', background: '#141414', border: '1px solid #282828', padding: '0.85rem 1.1rem', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              {/* Filter by Booking ID */}
              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.25rem' }}>SEARCH BOOKING ID:</label>
                <input
                  type="text"
                  placeholder="Filter ID (e.g. B-011)..."
                  value={activeBookingIdFilter}
                  onChange={(e) => setActiveBookingIdFilter(e.target.value)}
                  style={{ background: '#1c1c1c', color: '#fff', border: '1px solid #333', padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', width: '170px', outline: 'none' }}
                />
              </div>

              {/* Filter by Date */}
              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.25rem' }}>FILTER BY DATE:</label>
                <input
                  type="date"
                  value={activeBookingDateFilter}
                  onChange={(e) => setActiveBookingDateFilter(e.target.value)}
                  style={{ background: '#1c1c1c', color: '#fff', border: '1px solid #333', padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {/* Clear Filters Button */}
              {(activeBookingIdFilter || activeBookingDateFilter) && (
                <button
                  onClick={() => { setActiveBookingIdFilter(''); setActiveBookingDateFilter('') }}
                  style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Clear Filters ✕
                </button>
              )}
            </div>
          </div>

          <ActiveBookingCards
            bookings={customerActiveBookings
              .filter(b => b.isSession || b.pin || b.location || (b.time && (b.time.includes('AM') || b.time.includes('PM'))))
              .filter(b => {
                const matchId = !activeBookingIdFilter || String(b.id || '').toLowerCase().includes(activeBookingIdFilter.toLowerCase())
                const matchDate = !activeBookingDateFilter || b.date === activeBookingDateFilter
                return matchId && matchDate
              })}
            selectedBookingId={selectedBookingId}
            onToggleDetails={(bookingId) => setSelectedBookingId(prev => prev === bookingId ? null : bookingId)}
            onCancel={handleCancelBooking}
            onReview={openReview}
            isPinUnlocked={checkIsPinUnlocked}
          />

          {/* Legacy table retained for contract parity; replaced visually by cards */}
          <div className="cd-table-wrap" hidden aria-hidden="true" style={{ display: 'none', background: '#141414', border: '1px solid #282828', borderRadius: '16px', overflow: 'hidden' }}>
            <table className="cd-table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ background: '#18181c', borderBottom: '1px solid #282828' }}>
                  <th style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.78rem', padding: '0.95rem 1rem' }}>BOOKING ID</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>PACKAGE</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>PROVIDER PROFILE</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>DATE &amp; TIME</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>SECURITY PIN (30m)</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredActive = customerActiveBookings
                    .filter(b => b.isSession || b.pin || b.location || (b.time && (b.time.includes('AM') || b.time.includes('PM'))))
                    .filter(b => {
                      const matchId = !activeBookingIdFilter || String(b.id || '').toLowerCase().includes(activeBookingIdFilter.toLowerCase())
                      const matchDate = !activeBookingDateFilter || b.date === activeBookingDateFilter
                      return matchId && matchDate
                    })

                  if (filteredActive.length === 0) {
                    return (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#888', fontSize: '0.88rem' }}>
                          No active service bookings found.
                        </td>
                      </tr>
                    )
                  }

                  return filteredActive.map((b) => {
                    const isSelectedRow = selectedBookingId === b.id
                    return (
                      <React.Fragment key={b.id}>
                        <tr
                          onClick={() => {
                            if (b.status !== 'CANCELLED') {
                              setSelectedBookingId(prev => prev === b.id ? null : b.id)
                            }
                          }}
                          style={{
                            borderBottom: isSelectedRow && b.status !== 'CANCELLED' ? '1px solid var(--gold, #c9a84c)' : '1px solid #202020',
                            background: b.status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.03)' : (isSelectedRow ? 'rgba(201, 168, 76, 0.08)' : 'transparent'),
                            cursor: b.status === 'CANCELLED' ? 'not-allowed' : 'pointer',
                            opacity: b.status === 'CANCELLED' ? 0.65 : 1,
                            transition: 'all 0.2s ease'
                          }}
                          title={b.status === 'CANCELLED' ? 'Booking cancelled - details disabled' : 'Click row to view location, working end PIN, or make changes'}
                        >
                          <td style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800, fontSize: '0.9rem' }}>{b.id}</td>
                          <td style={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>{b.service}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold, #c9a84c)', color: '#000', fontWeight: 900, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {(b.providerName || 'Awaiting assignment')[0]}
                              </div>
                              <div>
                                <span style={{ color: '#eee', fontSize: '0.88rem', fontWeight: 700, display: 'block' }}>{b.providerName || 'Awaiting assignment'}</span>
                                <small style={{ color: '#888', fontSize: '0.75rem' }}>{b.providerPhone ? '📞 ' + b.providerPhone : (b.providerRole || 'Luxora Provider')}</small>
                              </div>
                            </div>
                          </td>
                          <td style={{ color: '#ccc', fontSize: '0.85rem' }}>
                            <div>{b.date}</div>
                            <small style={{ color: 'var(--gold, #c9a84c)', fontWeight: 700 }}>{b.time}</small>
                          </td>
                          <td>
                            {b.status === 'CANCELLED' ? (
                              <span style={{ color: '#666', fontSize: '0.78rem', fontStyle: 'italic', fontWeight: 600 }}>— Cancelled —</span>
                            ) : b.status === 'IN_PROGRESS' ? (
                              <span style={{ background: 'rgba(201, 168, 76, 0.15)', border: '1px solid var(--gold, #c9a84c)', color: 'var(--gold, #c9a84c)', fontSize: '0.88rem', fontWeight: 900, padding: '0.35rem 0.75rem', borderRadius: '6px', letterSpacing: '0.1em' }} title="Give this completion PIN to provider once service is finished">
                                🏁 End PIN: {b.completionPin || b.pin || '••••••'}
                              </span>
                            ) : b.status === 'ASSIGNED' ? (
                              <span style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', fontSize: '0.88rem', fontWeight: 900, padding: '0.35rem 0.75rem', borderRadius: '6px', letterSpacing: '0.1em' }} title="Give this start PIN to provider when they arrive">
                                🔑 Start PIN: {b.pin || b.startPin || '••••••'}
                              </span>
                            ) : (
                              <span style={{ background: '#1c1c1c', border: '1px solid #333', color: '#888', fontSize: '0.78rem', fontWeight: 600, padding: '0.35rem 0.65rem', borderRadius: '6px' }} title="Start PIN will be visible once a provider is assigned">
                                ⏳ Awaiting Provider
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="cd-status-tag cd-status-tag--completed" style={{ background: b.status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(201, 168, 76, 0.12)', color: b.status === 'CANCELLED' ? '#ef4444' : 'var(--gold, #c9a84c)', border: b.status === 'CANCELLED' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(201, 168, 76, 0.3)', fontWeight: 800 }} title={b.cancellationReason || undefined}>
                                {b.status || '—'}
                              </span>
                              {b.status !== 'CANCELLED' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCancelBooking(b.id); }}
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', textDecoration: 'underline', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                  title="Cancel this booking"
                                >
                                  Cancel
                                </button>
                              )}
                              {b.status === 'COMPLETED' && b.providerName && b.providerName !== 'Awaiting assignment' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openReview(b); }}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--gold, #c9a84c)', textDecoration: 'underline', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                  title="Rate and review this service"
                                >
                                  ★ Rate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Selected Row Detail Panel */}
                        {isSelectedRow && b.status !== 'CANCELLED' && (
                          <tr style={{ background: '#0e0e11', borderBottom: '1px solid var(--gold, #c9a84c)' }}>
                            <td colSpan={6} style={{ padding: '0.85rem 1.25rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'rgba(201, 168, 76, 0.05)', border: '1px solid rgba(201, 168, 76, 0.3)', borderRadius: '12px', padding: '0.85rem 1.25rem' }}>
                                  <div>
                                    <span style={{ color: '#888', fontSize: '0.68rem', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DISPATCH ADDRESS LOCATION</span>
                                    <span style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                                      📍 {b.location || 'Address not set'}
                                    </span>
                                  </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                  <div style={{ background: '#16161a', border: '1px solid rgba(201, 168, 76, 0.3)', borderRadius: '10px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div>
                                      <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', display: 'block' }}>🏁 WORKING END PIN</span>
                                      <small style={{ color: '#888', fontSize: '0.68rem' }}>Completion Verification Code</small>
                                    </div>
                                    <span style={{ background: 'rgba(201, 168, 76, 0.15)', border: '1px solid var(--gold, #c9a84c)', color: 'var(--gold, #c9a84c)', fontSize: '1.05rem', fontWeight: 900, padding: '0.25rem 0.75rem', borderRadius: '8px', letterSpacing: '0.15em' }}>
                                      {b.endPin || '······'}
                                    </span>
                                  </div>

                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedBookingId(null); }}
                                    style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#aaa', padding: '0.55rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                    title="Close panel"
                                  >
                                    Close ✕
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: TRANSACTION HISTORY (FULL DEDICATED VIEW WITH DATE, PACKAGE & INVOICE NUMBER FILTERS) ── */}
      {activeTab === 'transaction_history' && (
        <div className="cd-tab-content cd-main-container animate-fade-in">
          <div className="cd-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <button
                onClick={() => setActiveTab('booking')}
                style={{ background: 'transparent', border: 'none', color: 'var(--gold, #c9a84c)', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', padding: 0, marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              >
                ‹ Back to Subscription Plans
              </button>
              <h1 className="cd-page-title">Transaction History Log</h1>
              <p className="cd-page-subtitle">Full real-time log of all concierge payments, invoice references, and downloadable PDF receipts</p>
            </div>

            {/* Interactive Filters Bar */}
            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap', background: '#141414', border: '1px solid #282828', padding: '0.85rem 1.1rem', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              {/* Filter by Invoice Ref */}
              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.25rem' }}>INVOICE NUMBER:</label>
                <input
                  type="text"
                  placeholder="Filter Invoice (e.g. INV-2026)..."
                  value={historySearchInvoice}
                  onChange={(e) => setHistorySearchInvoice(e.target.value)}
                  style={{ background: '#1c1c1c', color: '#fff', border: '1px solid #333', padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', width: '180px', outline: 'none' }}
                />
              </div>



              {/* Filter by Date */}
              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.25rem' }}>FILTER BY DATE:</label>
                <input
                  type="date"
                  value={historySearchDate}
                  onChange={(e) => setHistorySearchDate(e.target.value)}
                  style={{ background: '#1c1c1c', color: '#fff', border: '1px solid #333', padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {/* Clear Filters Button */}
              {(historySearchInvoice || historySearchPackage || historySearchDate) && (
                <button
                  onClick={() => { setHistorySearchInvoice(''); setHistorySearchPackage(''); setHistorySearchDate('') }}
                  style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Clear Filters ✕
                </button>
              )}
            </div>
          </div>

          {/* Package Breakdown Quick Pill Selector Bar */}
          <div className="cd-filter-pills" style={{ marginBottom: '1.25rem' }}>
            <button
              className={`cd-filter-pill ${historySearchPackage === '' ? 'active' : ''}`}
              onClick={() => setHistorySearchPackage('')}
            >
              All Packages ({historyData.length})
            </button>
            <button
              className={`cd-filter-pill ${historySearchPackage === 'auto' ? 'active' : ''}`}
              onClick={() => setHistorySearchPackage('auto')}
            >
              🚗 Auto Care ({historyData.filter(h => h.cat === 'auto').length})
            </button>
            <button
              className={`cd-filter-pill ${historySearchPackage === 'garden' ? 'active' : ''}`}
              onClick={() => setHistorySearchPackage('garden')}
            >
              🌿 Garden Care ({historyData.filter(h => h.cat === 'garden').length})
            </button>
            <button
              className={`cd-filter-pill ${historySearchPackage === 'pet' ? 'active' : ''}`}
              onClick={() => setHistorySearchPackage('pet')}
            >
              🐾 Pet Care ({historyData.filter(h => h.cat === 'pet').length})
            </button>
            <button
              className={`cd-filter-pill ${historySearchPackage === 'combo' ? 'active' : ''}`}
              onClick={() => setHistorySearchPackage('combo')}
            >
              👑 VIP Combo ({historyData.filter(h => h.cat === 'system' || (h.service || '').toLowerCase().includes('combo') || (h.tier || '').toLowerCase().includes('vip')).length})
            </button>
          </div>

          {/* Full Interactive History Table */}
          <div className="cd-table-wrap" style={{ background: '#141414', border: '1px solid #282828', borderRadius: '16px', overflow: 'hidden' }}>
            <table className="cd-table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ background: '#18181c', borderBottom: '1px solid #282828' }}>
                  <th style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.78rem', padding: '0.95rem 1rem' }}>DATE</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>SERVICE / PACKAGE</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>TIER / PLAN</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>INVOICE REF</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>AMOUNT</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>STATUS</th>
                  <th style={{ fontSize: '0.78rem', padding: '0.95rem 1rem' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredFullHistory = historyData.filter(item => {
                    const matchInvoice = !historySearchInvoice || (item.ref || '').toLowerCase().includes(historySearchInvoice.toLowerCase())
                    const matchPackage = !historySearchPackage ||
                      (item.cat === historySearchPackage) ||
                      (historySearchPackage === 'combo' && (item.cat === 'system' || (item.service || '').toLowerCase().includes('combo') || (item.tier || '').toLowerCase().includes('vip'))) ||
                      (item.service || '').toLowerCase().includes(historySearchPackage.toLowerCase()) ||
                      (item.tier || '').toLowerCase().includes(historySearchPackage.toLowerCase())
                    const matchDate = !historySearchDate || (item.date || '').includes(historySearchDate)
                    return matchInvoice && matchPackage && matchDate
                  })

                  if (filteredFullHistory.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#888', fontSize: '0.88rem' }}>
                          No transaction history records matching your search criteria.
                        </td>
                      </tr>
                    )
                  }

                  return filteredFullHistory.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #202020' }}>
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
                      <td className="cd-cell-ref" style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800 }}>{item.ref}</td>
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
                  ))
                })()}
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
                  <span className="cd-contact-val">{currentUser.phone || '— Not Specified —'}</span>
                </div>
              </div>

              <div className="cd-contact-item">
                <div className="cd-contact-icon-box"><MapPinIcon /></div>
                <div className="cd-contact-text">
                  <span className="cd-contact-field">DELIVERY ADDRESS</span>
                  {userAddress && (userAddress.street || userAddress.city) ? (
                    <span className="cd-contact-val">
                      {userAddress.street}<br />
                      {userAddress.city}{userAddress.district ? `, ${userAddress.district}` : ''}
                    </span>
                  ) : (
                    <span className="cd-contact-val" style={{ color: '#888', fontStyle: 'italic', fontSize: '0.82rem' }}>
                      — Not Specified (Pending) —
                    </span>
                  )}
                </div>
              </div>

              <button
                className="cd-btn-support"
                style={{ width: '100%', marginTop: '0.85rem', justifyContent: 'center' }}
                onClick={() => { setShowProfileDrawer(false); setShowAddressModal(true) }}
              >
                {userAddress && (userAddress.street || userAddress.city) ? '✏️ Edit Delivery Address' : '📍 Set Delivery Address'}
              </button>

              {/* Profile management: edit name, phone + service town on the server */}
              <form onSubmit={saveProfileEdits} style={{ marginTop: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <h4 className="cd-profile-sublabel" style={{ marginBottom: 0 }}>EDIT PROFILE</h4>
                <input
                  type="text"
                  value={profileEdit.name}
                  onChange={(e) => setProfileEdit({ ...profileEdit, name: e.target.value })}
                  placeholder="Full Name"
                  maxLength={100}
                  style={{ background: '#101012', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#eee', padding: '0.6rem 0.8rem', fontSize: '0.85rem', fontFamily: 'inherit' }}
                />
                <input
                  type="tel"
                  value={profileEdit.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d+]/g, '').slice(0, 15)
                    setProfileEdit({ ...profileEdit, phone: val })
                  }}
                  placeholder="Phone Number (e.g. 0771234567)"
                  maxLength={15}
                  style={{ background: '#101012', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#eee', padding: '0.6rem 0.8rem', fontSize: '0.85rem', fontFamily: 'inherit' }}
                />
                <input
                  type="text"
                  list="sl-towns-profile"
                  value={profileEdit.town}
                  onChange={(e) => setProfileEdit({ ...profileEdit, town: e.target.value })}
                  placeholder="Service town (e.g. Colombo)"
                  maxLength={100}
                  style={{ background: '#101012', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#eee', padding: '0.6rem 0.8rem', fontSize: '0.85rem', fontFamily: 'inherit' }}
                />
                <datalist id="sl-towns-profile">
                  {SRI_LANKA_TOWNS.map((t) => (
                    <option key={t.name} value={t.name}>{t.name} ({t.province})</option>
                  ))}
                </datalist>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <button
                    type="submit"
                    disabled={profileBusy}
                    style={{ background: 'var(--gold, #c9a84c)', border: 'none', color: '#000', padding: '0.5rem 1.1rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    {profileBusy ? 'SAVING…' : '✓ SAVE PROFILE'}
                  </button>
                  {profileSavedMsg && <small style={{ color: profileSavedMsg.includes('saved') || profileSavedMsg.includes('success') ? 'var(--gold, #c9a84c)' : '#ef4444', fontSize: '0.75rem' }}>{profileSavedMsg}</small>}
                </div>
              </form>

              {/* ── LUXORA MULTI-METHOD ACCOUNT VERIFICATION ── */}
              <AccountVerificationPanel
                currentUser={currentUser}
                onUserUpdated={(updated) => {
                  setCurrentUser(updated);
                  try {
                    sessionStorage.setItem('user', JSON.stringify(updated));
                  } catch {}
                }}
              />
            </div>

            <div className="cd-profile-section-divider" />

            {/* Member Details */}
            <div className="cd-profile-section">
              <h4 className="cd-profile-sublabel">MEMBERSHIP SUMMARY</h4>
              
              <div className="cd-md-row">
                <span className="cd-md-label">Member since</span>
                <span className="cd-md-val">{memberSince || '—'}</span>
              </div>

              <div className="cd-md-row">
                <span className="cd-md-label">Active packages</span>
                <span className="cd-md-val">{(serverSubscriptions.length || activePackages.length)} Active</span>
              </div>

              <div className="cd-md-row">
                <span className="cd-md-label">Member tier</span>
                <span className={`cd-md-val ${isGoldMember ? 'cd-md-val--gold' : ''}`}>
                  {isGoldMember ? '👑 Gold Member' : 'Standard Member'}
                </span>
              </div>
            </div>

            {/* Log out lives here on mobile (the header keeps its icon-only
                logout on desktop only). */}
            <button
              type="button"
              className="cd-drawer-logout"
              disabled={isLoggingOut}
              onClick={handleLogout}
            >
              <LogOutIcon /> Log out
            </button>
          </div>
        </div>
      )}

      {/* ── Rate & Review Modal (proposal: rate and review service providers) ── */}
      {reviewTarget && (
        <div className="cd-drawer-overlay" onClick={() => setReviewTarget(null)}>
          <div className="cd-drawer-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="cd-drawer-header">
              <span className="cd-drawer-title">RATE YOUR SERVICE</span>
              <button className="cd-drawer-close" onClick={() => setReviewTarget(null)} aria-label="Close review">✕</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: '#ccc', fontSize: '0.88rem', margin: '0 0 0.25rem' }}>
                {reviewTarget.service || 'Luxora service'} · Booking #{reviewTarget.id}
              </p>
              <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 1.1rem' }}>
                Provider: <b style={{ color: '#eee' }}>{reviewTarget.providerName}</b>
                {reviewTarget.providerPhone ? ' · ' + reviewTarget.providerPhone : ''}
              </p>

              <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em' }}>YOUR RATING *</span>
              <div style={{ display: 'flex', gap: '0.4rem', margin: '0.5rem 0 1.1rem' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    aria-label={star + ' star' + (star > 1 ? 's' : '')}
                    style={{
                      background: star <= reviewRating ? 'rgba(201, 168, 76, 0.18)' : '#16161a',
                      border: star <= reviewRating ? '1px solid var(--gold, #c9a84c)' : '1px solid #2a2a2a',
                      color: star <= reviewRating ? 'var(--gold, #c9a84c)' : '#666',
                      fontSize: '1.3rem',
                      width: '46px',
                      height: '42px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>

              <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em' }}>YOUR REVIEW (OPTIONAL)</span>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                maxLength={1000}
                placeholder="Tell other members about your experience…"
                style={{ width: '100%', minHeight: '90px', marginTop: '0.5rem', background: '#101012', border: '1px solid #2a2a2a', borderRadius: '10px', color: '#eee', padding: '0.75rem', fontSize: '0.88rem', fontFamily: 'inherit', resize: 'vertical' }}
              />

              {reviewError && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0.4rem 0 0' }}>{reviewError}</p>}

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.1rem' }}>
                <button
                  type="button"
                  onClick={() => setReviewTarget(null)}
                  style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#aaa', padding: '0.6rem 1.1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={submitReview}
                  style={{ background: 'var(--gold, #c9a84c)', border: 'none', color: '#000', padding: '0.6rem 1.3rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  {reviewBusy ? 'SUBMITTING…' : '★ SUBMIT REVIEW'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── First-Time Login Address Setup Modal Popup ── */}
      {showAddressModal && (
        <div className="cd-address-overlay">
          <div className="cd-address-modal animate-fade-in" style={{ position: 'relative' }}>
            {/* Upper Right Close / Remind Me Later Button */}
            <button
              className="auth-card-close-btn"
              onClick={() => {
                setShowAddressModal(false)
                sessionStorage.setItem('address_remind_later', 'true')
              }}
              aria-label="Remind Me Later"
              title="Remind Me Later"
              type="button"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#aaa',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                zIndex: 10
              }}
            >
              ✕
            </button>

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
                <div className="cd-address-field" style={{ position: 'relative' }}>
                  <label htmlFor="addr-city">City / Town</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="addr-city"
                      name="luxora_town_no_autofill"
                      type="text"
                      placeholder="Type or scroll to select town..."
                      value={addressForm.city}
                      onChange={(e) => {
                        const typedVal = e.target.value
                        const matched = SRI_LANKA_TOWNS.find(t => t.name.toLowerCase() === typedVal.trim().toLowerCase())
                        setAddressForm(prev => ({
                          ...prev,
                          city: typedVal,
                          district: matched ? matched.province : (typedVal ? prev.district : '')
                        }))
                        setTownDropdownOpen(true)
                      }}
                      onFocus={() => setTownDropdownOpen(true)}
                      required
                      autoComplete="off"
                      data-lpignore="true"
                    />
                    <button
                      type="button"
                      onClick={() => setTownDropdownOpen(!townDropdownOpen)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--gold, #c9a84c)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 800
                      }}
                    >
                      {townDropdownOpen ? '▲' : '▼'}
                    </button>
                  </div>

                  {townDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '190px',
                        overflowY: 'auto',
                        background: '#16161a',
                        border: '1px solid var(--gold, #c9a84c)',
                        borderRadius: '10px',
                        zIndex: 999,
                        marginTop: '4px',
                        boxShadow: '0 12px 35px rgba(0,0,0,0.85)'
                      }}
                    >
                      {SRI_LANKA_TOWNS
                        .filter(t => t.name.toLowerCase().includes((addressForm.city || '').toLowerCase()) || t.province.toLowerCase().includes((addressForm.city || '').toLowerCase()))
                        .map((townObj, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setAddressForm(prev => ({
                                ...prev,
                                city: townObj.name,
                                district: townObj.province
                              }))
                              setTownDropdownOpen(false)
                            }}
                            style={{
                              padding: '0.55rem 0.85rem',
                              color: '#eee',
                              fontSize: '0.84rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              transition: 'background 0.15s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(201, 168, 76, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                              <span style={{ color: 'var(--gold, #c9a84c)' }}>📍</span> {townObj.name}
                            </span>
                            <span style={{ fontSize: '0.68rem', background: 'rgba(201,168,76,0.15)', color: 'var(--gold, #c9a84c)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(201,168,76,0.3)', fontWeight: 700 }}>
                              {townObj.province}
                            </span>
                          </div>
                        ))}
                      {SRI_LANKA_TOWNS.filter(t => t.name.toLowerCase().includes((addressForm.city || '').toLowerCase())).length === 0 && (
                        <div style={{ padding: '0.75rem', color: '#888', fontSize: '0.8rem', textAlign: 'center' }}>
                          No exact match. Using custom entry &quot;{addressForm.city}&quot;...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="cd-address-field">
                  <label htmlFor="addr-district">Province</label>
                  <input
                    id="addr-district"
                    type="text"
                    placeholder="Auto-selected based on City"
                    value={addressForm.district ? `${addressForm.district} Province` : ''}
                    readOnly
                    disabled
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      color: addressForm.district ? 'var(--gold, #c9a84c)' : '#666',
                      fontWeight: 700,
                      cursor: 'not-allowed',
                      border: addressForm.district ? '1px solid rgba(201, 168, 76, 0.4)' : '1px solid #333'
                    }}
                  />
                </div>
              </div>

              <div className="cd-address-actions">
                <button type="submit" className="cd-address-save-btn">
                  SAVE TO PROFILE &rarr;
                </button>
                <button
                  type="button"
                  className="cd-address-remind-btn"
                  onClick={() => {
                    setShowAddressModal(false)
                    sessionStorage.setItem('address_remind_later', 'true')
                  }}
                >
                  REMIND ME LATER
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Insufficient Tokens Modal Popup ── */}
      {showInsufficientTokensModal && (
        <div className="cd-address-overlay" onClick={() => setShowInsufficientTokensModal(false)}>
          <div
            className="cd-address-modal animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              textAlign: 'center',
              padding: '2.5rem 2rem',
              position: 'relative'
            }}
          >
            <button
              className="auth-card-close-btn"
              onClick={() => setShowInsufficientTokensModal(false)}
              aria-label="Close"
              type="button"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#aaa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem'
              }}
            >
              ✕
            </button>

            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                margin: '0 auto 1.25rem auto'
              }}
            >
              🪙
            </div>

            <h3 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>
              INSUFFICIENT SERVICE TOKENS
            </h3>

            <p style={{ color: '#aaa', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.75rem 0' }}>
              You currently have <strong style={{ color: '#ef4444' }}>0 {insufficientTokenCategory || 'Service'} tokens</strong> remaining. To place a session booking for {insufficientTokenCategory}, please subscribe to a package or pass in Subscription Plans to receive booking tokens.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setShowInsufficientTokensModal(false)
                  setActiveTab('booking')
                }}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, var(--gold, #c9a84c) 0%, #a68432 100%)',
                  color: '#000',
                  border: 'none',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(201, 168, 76, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                BROWSE SUBSCRIPTION PLANS &rarr;
              </button>

              <button
                type="button"
                onClick={() => setShowInsufficientTokensModal(false)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#888',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Service Session Confirmed Modal Popup ── */}
      {sessionBookingSuccessModal && (
        <div
          className="cd-drawer-overlay animate-fade-in"
          onClick={() => setSessionBookingSuccessModal(null)}
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem',
            zIndex: 1001,
          }}
        >
          <div
            className="cd-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'linear-gradient(180deg, #181818 0%, #111111 100%)',
              border: '1px solid rgba(201, 168, 76, 0.4)',
              borderRadius: '20px',
              padding: '2.25rem 2rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(201, 168, 76, 0.18)',
              textAlign: 'center',
              position: 'relative',
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setSessionBookingSuccessModal(null)}
              aria-label="Close confirmation"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: '#1c1c1c',
                border: '1px solid #333',
                color: '#aaa',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--gold, #c9a84c)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333'
                e.currentTarget.style.color = '#aaa'
              }}
            >
              ✕
            </button>

            {/* Gold Checkmark Success Badge */}
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(201, 168, 76, 0.25) 0%, rgba(201, 168, 76, 0.05) 70%)',
                border: '2px solid rgba(201, 168, 76, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem auto',
                boxShadow: '0 0 30px rgba(201, 168, 76, 0.3)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold, #c9a84c)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <span
              style={{
                color: 'var(--gold, #c9a84c)',
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                display: 'block',
              }}
            >
              SESSION BOOKED
            </span>

            <h3
              style={{
                color: '#ffffff',
                fontSize: '1.4rem',
                fontWeight: 800,
                margin: '0.35rem 0 1.25rem 0',
                letterSpacing: '-0.01em',
              }}
            >
              Service Session Booked Successfully
            </h3>

            {/* Booking Summary Box */}
            <div
              style={{
                background: '#141414',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                marginBottom: '1.25rem',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Service Style
                </span>
                <span style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 800 }}>
                  {sessionBookingSuccessModal.service}
                </span>
              </div>

              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Date &amp; Time
                </span>
                <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.88rem', fontWeight: 800 }}>
                  {sessionBookingSuccessModal.date} at {sessionBookingSuccessModal.time}
                </span>
              </div>

              {sessionBookingSuccessModal.id && (
                <>
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Booking Reference
                    </span>
                    <span style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.05em' }}>
                      #{sessionBookingSuccessModal.id}
                    </span>
                  </div>
                </>
              )}

              {sessionBookingSuccessModal.categoryName && (
                <>
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Token Balance
                    </span>
                    <span style={{ color: '#4ade80', fontSize: '0.82rem', fontWeight: 800 }}>
                      1 Token Used ({sessionBookingSuccessModal.remainingTokens} Left)
                    </span>
                  </div>
                </>
              )}
            </div>

            <p
              style={{
                color: '#cccccc',
                fontSize: '0.88rem',
                lineHeight: '1.55',
                margin: '0 0 1.5rem 0',
              }}
            >
              Your <strong style={{ color: '#fff' }}>{sessionBookingSuccessModal.service}</strong> service session has been successfully booked for <strong style={{ color: '#fff' }}>{sessionBookingSuccessModal.date}</strong> at <strong style={{ color: '#fff' }}>{sessionBookingSuccessModal.time}</strong>. A Luxora Concierge Specialist will contact you shortly.
            </p>

            <button
              type="button"
              onClick={() => setSessionBookingSuccessModal(null)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #dfc06b 0%, #c9a84c 100%)',
                color: '#000',
                border: 'none',
                fontWeight: 800,
                padding: '0.85rem 1.5rem',
                fontSize: '0.92rem',
                borderRadius: '10px',
                boxShadow: '0 4px 18px rgba(201, 168, 76, 0.35)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(201, 168, 76, 0.45)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 18px rgba(201, 168, 76, 0.35)'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── Cancel Booking Confirmation Modal Popup ── */}
      {cancelBookingConfirmModal && (
        <div
          className="cd-drawer-overlay animate-fade-in"
          onClick={() => setCancelBookingConfirmModal(null)}
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem',
            zIndex: 1001,
          }}
        >
          <div
            className="cd-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'linear-gradient(180deg, #181818 0%, #111111 100%)',
              border: '1px solid rgba(201, 168, 76, 0.4)',
              borderRadius: '20px',
              padding: '2.25rem 2rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(201, 168, 76, 0.18)',
              textAlign: 'center',
              position: 'relative',
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setCancelBookingConfirmModal(null)}
              aria-label="Close cancellation modal"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: '#1c1c1c',
                border: '1px solid #333',
                color: '#aaa',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--gold, #c9a84c)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333'
                e.currentTarget.style.color = '#aaa'
              }}
            >
              ✕
            </button>

            {/* Amber/Gold Warning Badge */}
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, rgba(201, 168, 76, 0.08) 70%)',
                border: '2px solid rgba(201, 168, 76, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem auto',
                boxShadow: '0 0 30px rgba(201, 168, 76, 0.25)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold, #c9a84c)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <span
              style={{
                color: 'var(--gold, #c9a84c)',
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                display: 'block',
              }}
            >
              CANCEL BOOKING CONFIRMATION
            </span>

            <h3
              style={{
                color: '#ffffff',
                fontSize: '1.4rem',
                fontWeight: 800,
                margin: '0.35rem 0 1rem 0',
                letterSpacing: '-0.01em',
              }}
            >
              Cancel Booking?
            </h3>

            {/* Dynamic Details Box */}
            <div
              style={{
                background: '#141414',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                marginBottom: '1.25rem',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Booking Number
                </span>
                <span style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.05em' }}>
                  #{cancelBookingConfirmModal.bookingId}
                </span>
              </div>

              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Service
                </span>
                <span style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 800 }}>
                  {cancelBookingConfirmModal.serviceName}
                </span>
              </div>
            </div>

            <p
              style={{
                color: '#cccccc',
                fontSize: '0.9rem',
                lineHeight: '1.55',
                margin: '0 0 1.5rem 0',
              }}
            >
              Are you sure you want to cancel booking <strong style={{ color: 'var(--gold, #c9a84c)' }}>#{cancelBookingConfirmModal.bookingId}</strong> (<span style={{ color: '#fff', fontWeight: 600 }}>{cancelBookingConfirmModal.serviceName}</span>)?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setCancelBookingConfirmModal(null)}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#aaa',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  fontWeight: 700,
                  padding: '0.85rem 1rem',
                  fontSize: '0.9rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                  e.currentTarget.style.color = '#aaa'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => confirmCancelBooking(cancelBookingConfirmModal.bookingId, cancelBookingConfirmModal.serviceName)}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #dfc06b 0%, #c9a84c 100%)',
                  color: '#000',
                  border: 'none',
                  fontWeight: 800,
                  padding: '0.85rem 1rem',
                  fontSize: '0.9rem',
                  borderRadius: '10px',
                  boxShadow: '0 4px 18px rgba(201, 168, 76, 0.35)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 22px rgba(201, 168, 76, 0.45)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 18px rgba(201, 168, 76, 0.35)'
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Are You Sure Cancel Package Subscription Modal Popup ── */}
      {showCancelPackageConfirmModal && packageToCancel && (
        <div className="cd-address-overlay" onClick={() => setShowCancelPackageConfirmModal(false)}>
          <div
            className="cd-address-modal animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              padding: '2.5rem 2rem',
              position: 'relative'
            }}
          >
            <button
              className="auth-card-close-btn"
              onClick={() => setShowCancelPackageConfirmModal(false)}
              aria-label="Close"
              type="button"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#aaa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem'
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  margin: '0 auto 1rem auto'
                }}
              >
                ⚠️
              </div>

              <h3 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.4rem 0', letterSpacing: '-0.01em' }}>
                ARE YOU SURE YOU WANT TO CANCEL?
              </h3>
              <p style={{ color: '#aaa', fontSize: '0.86rem', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
                Are you sure you want to cancel your <strong style={{ color: '#fff' }}>{packageToCancel.title} ({packageToCancel.tier})</strong> package subscription?
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  handleCancelSubscription(packageToCancel.id)
                  setShowCancelPackageConfirmModal(false)
                  setPackageToCancel(null)
                }}
                style={{
                  flex: 1,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.84rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                YES, CANCEL SUBSCRIPTION
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCancelPackageConfirmModal(false)
                  setPackageToCancel(null)
                }}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, var(--gold, #c9a84c) 0%, #a68432 100%)',
                  color: '#000',
                  border: 'none',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.84rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(201, 168, 76, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                KEEP MY SUBSCRIPTION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Subscription Cancelled Success Modal Popup ── */}
      {showCancelledSuccessModal && (
        <div className="cd-address-overlay" onClick={() => setShowCancelledSuccessModal(false)}>
          <div
            className="cd-address-modal animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              textAlign: 'center',
              padding: '2.5rem 2rem',
              position: 'relative'
            }}
          >
            <button
              className="auth-card-close-btn"
              onClick={() => setShowCancelledSuccessModal(false)}
              aria-label="Close"
              type="button"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#aaa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem'
              }}
            >
              ✕
            </button>

            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                margin: '0 auto 1.25rem auto'
              }}
            >
              ⚠️
            </div>

            <h3 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>
              SUBSCRIPTION CANCELLED
            </h3>

            <p style={{ color: '#aaa', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.75rem 0' }}>
              Your subscription for <strong style={{ color: '#fff' }}>"{cancelledPackageTitle}"</strong> has been successfully cancelled. You can resubscribe anytime from Subscription Plans.
            </p>

            <button
              type="button"
              onClick={() => setShowCancelledSuccessModal(false)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, var(--gold, #c9a84c) 0%, #a68432 100%)',
                color: '#000',
                border: 'none',
                padding: '0.85rem 1.25rem',
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: 900,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(201, 168, 76, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              GOT IT
            </button>
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
                  <ActionButton
                    type="submit"
                    className="cd-support-send-btn"
                    loading={supportBusy}
                    loadingText="SENDING MESSAGE..."
                  >
                    SEND MESSAGE &rarr;
                  </ActionButton>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Notifications Centered Popup Modal ── */}
      {showNotifDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
          }}
          onClick={() => setShowNotifDrawer(false)}
        >
          <div
            className="animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#141416',
              border: '1px solid var(--gold, #c9a84c)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(201, 168, 76, 0.2)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #282828', background: '#18181c' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.95rem', fontWeight: 900, letterSpacing: '0.08em' }}>🔔 NOTIFICATIONS</span>
                {unreadCount > 0 && (
                  <span style={{ background: 'var(--gold, #c9a84c)', color: '#000', fontSize: '0.68rem', fontWeight: 900, padding: '0.2rem 0.55rem', borderRadius: '10px' }}>
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotifsRead}
                    style={{ background: 'transparent', border: 'none', color: 'var(--gold, #c9a84c)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotifDrawer(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Close Notifications"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: '#888' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.6 }}>🔔</div>
                  <h4 style={{ color: '#fff', margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 700 }}>No Notifications Yet</h4>
                  <p style={{ color: '#aaa', fontSize: '0.82rem', margin: 0 }}>You have no unread notifications or system alerts at this time.</p>
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => markNotifAsRead(item.id)}
                    style={{
                      background: item.unread ? 'rgba(201, 168, 76, 0.08)' : '#1a1a1e',
                      border: item.unread ? '1px solid rgba(201, 168, 76, 0.4)' : '1px solid #282828',
                      borderRadius: '14px',
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.85rem',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ background: item.unread ? 'var(--gold, #c9a84c)' : '#282828', color: item.unread ? '#000' : 'var(--gold, #c9a84c)', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.category === 'auto' && <CarIcon />}
                      {item.category === 'garden' && <LeafIcon />}
                      {item.category === 'system' && <ShieldIcon />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <h4 style={{ color: '#fff', fontSize: '0.92rem', margin: 0, fontWeight: 700 }}>{item.title}</h4>
                        <span style={{ color: '#888', fontSize: '0.72rem' }}>{item.time}</span>
                      </div>
                      <p style={{ color: '#ccc', fontSize: '0.82rem', margin: 0, lineHeight: 1.4 }}>{item.message}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissNotification(item.id); }}
                      style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '0.85rem', cursor: 'pointer', padding: '0.2rem' }}
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
                  {selectedPackageToBook.promotion && <del style={{ color: '#888', fontSize: '0.82rem', marginRight: '0.45rem' }}>LKR {Number(selectedPackageToBook.originalPrice).toLocaleString()}</del>}
                  {selectedPackageToBook.price} {bookingBillingType === 'one_time' ? '/ 30 days' : '/ month'}
                </strong>
              </div>
              {selectedPackageToBook.promotion && <div className="cd-book-confirm-row">
                <span>Package discount:</span>
                <small style={{ color: '#7ed49b' }}>{selectedPackageToBook.promotion.code ? `${selectedPackageToBook.promotion.code} · ` : ''}{selectedPackageToBook.promotion.discountPct}% applied at checkout</small>
              </div>}
              <div className="cd-book-confirm-row">
                <span>Delivery Address:</span>
                <small>{userAddress.street}, {userAddress.city}, {userAddress.district}</small>
              </div>
              <div className="cd-book-confirm-row">
                <span>{bookingBillingType === 'auto_renew' ? 'Next Renewal Date:' : 'Expiry Date:'}</span>
                <small className="gold-accent">{getRenewalDate(null)}</small>
              </div>
            </div>

            <div className="cd-support-actions" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Option 1: PayHere */}
              <div className="cd-easypay">
                <div className="cd-easypay__head">
                  <span className="cd-easypay__title">CREDIT / DEBIT CARD</span>
                  <span className="cd-easypay__badge">{payhereEnv === 'LIVE' ? 'PAYHERE' : 'SANDBOX / DEMO PAYMENT'}</span>
                </div>
                <ActionButton
                  type="button"
                  className="cd-support-send-btn"
                  loading={paymentBusy}
                  loadingText="Preparing payment..."
                  onClick={() => startPayment('payhere', selectedPackageToBook)}
                >
                  PAY WITH PAYHERE
                </ActionButton>
                <small style={{ display: 'block', marginTop: '0.4rem', color: '#888', fontSize: '0.72rem' }}>
                  Redirects to PayHere {payhereEnv === 'LIVE' ? '' : 'sandbox '}hosted checkout. Package activates automatically upon verified server callback.
                </small>
                {payhereEnv !== 'LIVE' && (
                  <details className="cd-easypay__help" style={{ marginTop: '0.4rem' }}>
                    <summary>Test card details (sandbox)</summary>
                    <div className="cd-easypay__help-body">
                      <p>Use PayHere's official sandbox test cards — no real money is charged:</p>
                      <ul>
                        <li><strong>Visa:</strong> 4916217501611292</li>
                        <li><strong>Mastercard:</strong> 5484181001001004</li>
                        <li><strong>American Express:</strong> 345678901234564</li>
                      </ul>
                      <p>Use any future expiry date (e.g. 12/28), any 3-digit CVV, and name <strong>Test User</strong>.</p>
                    </div>
                  </details>
                )}
              </div>

              {/* Option 2: NOWPayments Crypto */}
              <div className="cd-easypay" style={{ borderColor: 'rgba(212, 175, 55, 0.3)' }}>
                <div className="cd-easypay__head">
                  <span className="cd-easypay__title">CRYPTOCURRENCY</span>
                  <span className="cd-easypay__badge" style={{ background: 'rgba(212, 175, 55, 0.15)', color: '#d4af37' }}>USDT-BSC / BTC / ETH</span>
                </div>
                <ActionButton
                  type="button"
                  className="cd-support-send-btn"
                  style={{ background: 'linear-gradient(135deg, #d4af37 0%, #aa8010 100%)', color: '#000', fontWeight: 'bold' }}
                  loading={paymentBusy}
                  loadingText="Preparing payment..."
                  onClick={() => startPayment('nowpayments', selectedPackageToBook)}
                >
                  PAY WITH CRYPTO (NOWPAYMENTS)
                </ActionButton>
                <small style={{ display: 'block', marginTop: '0.4rem', color: '#888', fontSize: '0.72rem' }}>
                  Live LKR to USD conversion with instant crypto invoice. Settles strictly after full blockchain finality.
                </small>
              </div>

              {/* Demo fallback if PAYMENT_MODE=demo */}
              {paymentMode === 'demo' && (
                <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="cd-support-send-btn"
                    style={{ background: '#333', color: '#ccc', fontSize: '0.8rem' }}
                    disabled={paymentBusy}
                    onClick={() => handleConfirmBooking(selectedPackageToBook)}
                  >
                    DEMO INSTANT PASS (DEVELOPMENT ONLY)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Membership Manage Popup (renewal + cancel for server subscriptions) ── */}
      {selectedMembership && (
        <div className="cd-support-overlay" onClick={() => setSelectedMembership(null)}>
          <div className="cd-support-modal cd-manage-membership-modal animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="cd-support-modal__header">
              <div className="cd-support-icon-box"><ShieldIcon /></div>
              <div>
                <h2 className="cd-support-modal__title">{selectedMembership.plan?.title || 'Luxora membership'}</h2>
                <p className="cd-support-modal__subtitle">Manage your membership</p>
              </div>
              <button className="cd-support-modal__close" onClick={() => setSelectedMembership(null)} aria-label="Close membership manager">✕</button>
            </div>

            <div className="cd-book-confirm-details" style={{ marginTop: '1rem' }}>
              <div className="cd-book-confirm-row">
                <span>Status</span>
                <span className="gold-accent" style={{ fontWeight: 700 }}>
                  Active until {new Date(selectedMembership.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="cd-book-confirm-row">
                <span>Price</span>
                <strong>LKR {Number(selectedMembership.plan?.priceMonthly || 0).toLocaleString()} / month</strong>
              </div>
              <div className="cd-book-confirm-row">
                <span>Renewal</span>
                <span className="gold-accent">
                  {selectedMembership.autoRenew ? `🔄 Auto-renews every ${selectedMembership.renewalIntervalDays || 30} days` : '⚡ One-time pass — no recurring charges'}
                </span>
              </div>
            </div>

            <div className="cd-support-actions" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { toggleAutoRenew(selectedMembership); setSelectedMembership(null) }}
                style={{ background: 'rgba(201, 168, 76, 0.12)', border: '1px solid rgba(201, 168, 76, 0.4)', color: 'var(--gold, #c9a84c)', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {selectedMembership.autoRenew ? '⏸ PAUSE RENEWAL' : '↻ ENABLE RENEWAL'}
              </button>
              <button
                type="button"
                onClick={() => { cancelMembership(selectedMembership); setSelectedMembership(null) }}
                style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                CANCEL MEMBERSHIP
              </button>
              <small style={{ color: '#777', fontSize: '0.7rem', textAlign: 'center' }}>
                Cancelling lapses any remaining service coins at the end of the period.
              </small>
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
                    onClick={() => {
                      const pkg = selectedActivePackageToManage
                      setSelectedActivePackageToManage(null)
                      setPackageToCancel(pkg)
                      setShowCancelPackageConfirmModal(true)
                    }}
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
                  Are you sure you want to cancel your {selectedActivePackageToManage.title} subscription?
                </p>

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
                    required
                    min={new Date().toISOString().split('T')[0]}
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

      {/* ── Custom Request Success Modal ── */}
      {customRequestSuccessModal && (
        <div
          className="cd-drawer-overlay animate-fade-in"
          onClick={() => setCustomRequestSuccessModal(null)}
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem',
            zIndex: 1001,
          }}
        >
          <div
            className="cd-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'linear-gradient(180deg, #181818 0%, #111111 100%)',
              border: '1px solid rgba(201, 168, 76, 0.4)',
              borderRadius: '20px',
              padding: '2.25rem 2rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(201, 168, 76, 0.18)',
              textAlign: 'center',
              position: 'relative',
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setCustomRequestSuccessModal(null)}
              aria-label="Close confirmation"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: '#1c1c1c',
                border: '1px solid #333',
                color: '#aaa',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--gold, #c9a84c)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333'
                e.currentTarget.style.color = '#aaa'
              }}
            >
              ✕
            </button>

            {/* Gold Checkmark Success Badge */}
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(201, 168, 76, 0.25) 0%, rgba(201, 168, 76, 0.05) 70%)',
                border: '2px solid rgba(201, 168, 76, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem auto',
                boxShadow: '0 0 30px rgba(201, 168, 76, 0.3)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold, #c9a84c)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <span
              style={{
                color: 'var(--gold, #c9a84c)',
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                display: 'block',
              }}
            >
              REQUEST SUBMITTED
            </span>

            <h3
              style={{
                color: '#ffffff',
                fontSize: '1.4rem',
                fontWeight: 800,
                margin: '0.35rem 0 1.25rem 0',
                letterSpacing: '-0.01em',
              }}
            >
              Customer Request Confirmed
            </h3>

            {/* Request Summary Box */}
            <div
              style={{
                background: '#141414',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                marginBottom: '1.25rem',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                Request Subject
              </div>
              <div
                style={{
                  fontSize: '1rem',
                  color: '#fff',
                  fontWeight: 700,
                  marginBottom: '0.85rem',
                  lineHeight: '1.4',
                  wordBreak: 'break-word',
                }}
              >
                "{customRequestSuccessModal.title}"
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.68rem', color: '#888', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Reference ID
                  </span>
                  <span style={{ color: 'var(--gold, #c9a84c)', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.05em' }}>
                    {customRequestSuccessModal.id}
                  </span>
                </div>

                <span
                  style={{
                    background: 'rgba(201, 168, 76, 0.12)',
                    border: '1px solid rgba(201, 168, 76, 0.3)',
                    color: 'var(--gold, #c9a84c)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.3rem 0.75rem',
                    borderRadius: '20px',
                    letterSpacing: '0.03em',
                  }}
                >
                  Concierge Review
                </span>
              </div>
            </div>

            <p
              style={{
                color: '#cccccc',
                fontSize: '0.88rem',
                lineHeight: '1.55',
                margin: '0 0 1.5rem 0',
              }}
            >
              Customer Request <strong style={{ color: '#fff' }}>"{customRequestSuccessModal.title}"</strong> submitted successfully (ref <strong style={{ color: 'var(--gold, #c9a84c)' }}>{customRequestSuccessModal.id}</strong>). A Luxora Concierge Specialist will contact you shortly.
            </p>

            <button
              type="button"
              onClick={() => setCustomRequestSuccessModal(null)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #dfc06b 0%, #c9a84c 100%)',
                color: '#000',
                border: 'none',
                fontWeight: 800,
                padding: '0.85rem 1.5rem',
                fontSize: '0.92rem',
                borderRadius: '10px',
                boxShadow: '0 4px 18px rgba(201, 168, 76, 0.35)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(201, 168, 76, 0.45)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 18px rgba(201, 168, 76, 0.35)'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerDashboard
