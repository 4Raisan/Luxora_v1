import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Calendar from '../components/Calendar'
import { apiRequest } from '../services/api'
import { ActionButton } from '../components/ui'
import LogoutOverlay from '../components/LogoutOverlay'
import BookingPhotoGallery from '../components/BookingPhotoGallery'
import { useRealtime } from '../hooks/useRealtime'
import { SRI_LANKA_PROVINCES, SRI_LANKA_TOWNS } from '../data/sriLankaLocations'
import { SRI_LANKAN_BANKS } from '../data/sriLankaBanks'
import './ProviderDashboard.css'

/* ── SVG Icons ─────────────────────────────────────── */
function GridIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg> }
function CalIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function HistIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/></svg> }
function PaymentIcon(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M7 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function BellIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function GearIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5"/></svg> }
function UserIcon()  { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function LogOutIcon(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> }

/* ── Helpers ───────────────────────────────────────── */
const STATUS_COLORS = {
  PENDING: '#eab308',
  ASSIGNED: '#C9A84C',
  IN_PROGRESS: '#60a5fa',
  COMPLETED: '#4ade80',
  CANCELLED: '#ef4444',
}

const formatMobileNumber = (val) => {
  if (!val) return '—'
  let cleaned = String(val).replace(/\D/g, '')
  if (cleaned.startsWith('94')) cleaned = cleaned.slice(2)
  if (cleaned.startsWith('0'))  cleaned = cleaned.slice(1)
  if (!cleaned) return '—'
  return '0' + cleaned
}

const relTime = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'JUST NOW'
  if (m < 60) return `${m} MIN AGO`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} HOUR${h !== 1 ? 'S' : ''} AGO`
  const d = Math.floor(h / 24)
  return `${d} DAY${d !== 1 ? 'S' : ''} AGO`
}

const formatRupees = (val) => `Rs. ${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'ONLINE', hint: 'Online & accepting new job assignments' },
  { value: 'offline', label: 'OFFLINE', hint: 'Offline — not accepting new job assignments' },
]

const SERVICE_CATEGORIES = ['Auto Care', 'Garden Care', 'Pet Care']

const SRI_LANKA_AREAS = Object.fromEntries(SRI_LANKA_PROVINCES.map((province) => [province, SRI_LANKA_TOWNS.filter((location) => location.province === province).map((location) => location.name)]))
const PROVINCE_NAMES = SRI_LANKA_PROVINCES

const providerCancellationIsOpen = (booking, now = Date.now()) => {
  const deadline = new Date(booking?.providerCancellationDeadline || '').getTime()
  return booking?.status === 'ASSIGNED'
    && booking?.providerCanCancel === true
    && Number.isFinite(deadline)
    && now <= deadline
}

/* ── Component ─────────────────────────────────────── */
const ProviderDashboard = () => {
  const navigate = useNavigate()
  const token = sessionStorage.getItem('token')
  const [activeNav, setActiveNav] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancellationClock, setCancellationClock] = useState(Date.now())

  const [currentProvider, setCurrentProvider] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('user') || 'null') || {} } catch { return {} }
  })
  const providerFullName = currentProvider.name || 'Provider Partner'

  /* Bookings assigned by the server scheduling flow */
  const [bookingsList, setBookingsList] = useState([])
  /* Pending unassigned bookings available for manual claim */
  const [pendingBookingsList, setPendingBookingsList] = useState([])
  const [serviceRequests, setServiceRequests] = useState([])
  const [claimingId, setClaimingId] = useState(null)
  const [claimingServiceRequestId, setClaimingServiceRequestId] = useState(null)
  const [completingServiceRequestId, setCompletingServiceRequestId] = useState(null)
  /* Availability / earnings / notifications */
  const [availability, setAvailability] = useState('available')
  const [providerCategory, setProviderCategory] = useState('')
  const [providerCategories, setProviderCategories] = useState([])
  const [serviceTowns, setServiceTowns] = useState('')
  const [earnings, setEarnings] = useState(null)
  const [sessionPayouts, setSessionPayouts] = useState([])
  const [bankForm, setBankForm] = useState({ bank_name: '', account_holder: '', account_number: '', branch: '' })
  const [redeemAmount, setRedeemAmount] = useState('')
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [notificationsList, setNotificationsList] = useState([])
  /* UI modals */
  const [showNotifModal, setShowNotifModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showProfileDrawer, setShowProfileDrawer] = useState(false)
  const [selectedDetailsBooking, setSelectedDetailsBooking] = useState(null)
  const [bookingFilter, setBookingFilter] = useState('ASSIGNED')
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(new Date().getDate())
  /* PIN verification modal for start/complete */
  const [pinDialog, setPinDialog] = useState(null) // { row, next, pin, error }
  /* Photo uploads per booking: { [apiId]: [{ id, kind, original_name }] } */
  const [photosByBooking, setPhotosByBooking] = useState({})
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  /* Settings form */
  const [settingsForm, setSettingsForm] = useState({ name: providerFullName, phone: '', categories: [], towns: [], provinces: [] })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [townSearch, setTownSearch] = useState('')
  const [areaMode, setAreaMode] = useState('towns')
  const switchToProvinceMode = () => {
    setAreaMode('provinces')
    setSettingsForm((prev) => ({ ...prev, towns: [] }))
  }
  const switchToTownMode = () => {
    setAreaMode('towns')
    setSettingsForm((prev) => ({ ...prev, provinces: [] }))
  }

  const [providerKyc, setProviderKyc] = useState({ status: 'APPROVED', rejectionReason: null })
  const [kycDocType, setKycDocType] = useState('NIC_FRONT')
  const [kycDocFile, setKycDocFile] = useState(null)
  const [kycDocBusy, setKycDocBusy] = useState(false)
  const [kycDocMsg, setKycDocMsg] = useState('')

  const cancelAssignedBooking = async () => {
    if (!selectedDetailsBooking) return
    if (!providerCancellationIsOpen(selectedDetailsBooking)) {
      return alert('Cancellation is unavailable because fewer than four hours remain before this booking.')
    }
    const confirmed = window.confirm('Cancel this assigned booking? Cancellation is unavailable when fewer than four hours remain. When allowed, Luxora immediately assigns an eligible replacement. If none is available, the booking is cancelled and the customer token is restored.')
    if (!confirmed) return
    setBusy(true)
    try {
      const result = await apiRequest(`/provider/bookings/${selectedDetailsBooking.apiId}/cancel`, 'POST', null, token)
      setSelectedDetailsBooking(null)
      await Promise.all([loadAll(), loadNotifications()])
      alert(result.message || 'Booking cancelled.')
    } catch (error) {
      alert(error.message || 'Could not cancel this booking.')
    } finally {
      setBusy(false)
    }
  }
  const mapBookingRow = useCallback((booking) => {
    const date = new Date(`${booking.bookingDate}T00:00:00`)
    const status = String(booking.status).toUpperCase()
    const petLabel = (booking.petType || booking.pet_type) === 'dog' ? '🐕 Dog Care' : (booking.petType || booking.pet_type) === 'cat' ? '🐈 Cat Care' : ''
    return {
      apiId: booking.id,
      month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: String(date.getDate()),
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      title: booking.service_title || 'Service booking',
      sub: `${booking.customer_name || 'Customer'}${petLabel ? ` • ${petLabel}` : ''}${booking.customer_phone ? ` • 📞 ${formatMobileNumber(booking.customer_phone)}` : ''}${booking.town ? ` • 📍 ${booking.town}` : ''}`,
      status,
      color: STATUS_COLORS[status] || '#C9A84C',
      claimable: status === 'PENDING',
      providerEarning: booking.providerEarning,
      customerName: booking.customer_name || 'Customer',
      customerPhone: booking.customer_phone || '',
      customerEmail: booking.user?.email || '',
      town: booking.town || '',
      address: [booking.addressStreet, booking.town, booking.addressDistrict].filter(Boolean).join(', '),
      notes: booking.notes || '',
      price: booking.totalPrice,
      category: booking.category_name || '',
      serviceDesc: booking.service_desc || '',
      petType: booking.petType || booking.pet_type || '',
      providerCanCancel: booking.provider_can_cancel === true,
      providerCancellationDeadline: booking.provider_cancellation_deadline || null,
    }
  }, [])

  const mapServiceRequestRow = useCallback((request) => {
    const date = new Date(`${request.preferred_date}T00:00:00`)
    const providerId = request.provider_id ?? request.providerId ?? null
    const assignmentStatus = String(request.assignment_status || (providerId ? 'assigned' : 'pending')).toLowerCase()
    const claimable = typeof request.claimable === 'boolean'
      ? request.claimable
      : !providerId && assignmentStatus !== 'assigned'
    return {
      apiId: request.id,
      month: Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: Number.isNaN(date.getTime()) ? '' : String(date.getDate()),
      bookingDate: request.preferred_date,
      bookingTime: request.preferred_time,
      title: request.subject || 'Requested service',
      notes: request.notes || '',
      category: request.category || 'Service category',
      customerName: request.customer_name || 'Customer',
      customerPhone: request.customer_phone || '',
      town: request.town || '',
      status: assignmentStatus.toUpperCase(),
      claimable,
    }
  }, [])

  const loadAll = useCallback(async () => {
    if (!token) return navigate('/login', { replace: true })
    setLoading(true)
    try {
      const me = await apiRequest('/auth/me', 'GET', null, token).catch(() => null)
      if (me?.provider) {
        setProviderKyc({
          status: me.provider.kycStatus || 'APPROVED',
          rejectionReason: me.provider.kycRejectionReason || null,
        })
      }
      if (me?.provider?.kycStatus && me.provider.kycStatus !== 'APPROVED') {
        setLoading(false)
        return
      }

      const [avail, bookingRows, pendingRows, serviceRequestRows, earningsRow] = await Promise.all([
        apiRequest('/provider/availability', 'GET', null, token),
        apiRequest('/bookings/assigned', 'GET', null, token),
        apiRequest('/bookings/pending', 'GET', null, token).catch(() => []),
        apiRequest('/support/service-requests/provider?include_completed=true', 'GET', null, token).catch(() => []),
        apiRequest('/provider/earnings', 'GET', null, token),
      ])
      setAvailability(avail.availability_status)
      const categories = Array.isArray(avail.categories)
        ? avail.categories
        : String(avail.category || '').split(',').map((category) => category.trim()).filter(Boolean)
      setProviderCategories(categories)
      setProviderCategory(categories[0] || '')
      setServiceTowns(avail.service_towns || '')
      setBookingsList((Array.isArray(bookingRows) ? bookingRows : []).map(mapBookingRow))
      setPendingBookingsList((Array.isArray(pendingRows) ? pendingRows : []).map(mapBookingRow))
      setServiceRequests((Array.isArray(serviceRequestRows) ? serviceRequestRows : []).map(mapServiceRequestRow))
      setEarnings(earningsRow)
      setSessionPayouts(Array.isArray(earningsRow.session_payouts) ? earningsRow.session_payouts : [])
      const bank = (earningsRow.bank_accounts || []).find((account) => account.selected) || earningsRow.bank_accounts?.[0]
      if (bank) setBankForm((current) => ({ ...current, bank_name: bank.bank_name || '', account_holder: bank.account_holder || '', branch: bank.branch || '', account_number: '' }))
      setLoadError('')
    } catch (error) {
      setLoadError(error.message || 'Could not load your dashboard.')
    } finally {
      setLoading(false)
    }
  }, [token, navigate, mapBookingRow, mapServiceRequestRow])

  const refreshBookingLists = useCallback(async () => {
    if (!token) return
    try {
      const [bookingRows, pendingRows] = await Promise.all([
        apiRequest('/bookings/assigned', 'GET', null, token),
        apiRequest('/bookings/pending', 'GET', null, token),
      ])
      setBookingsList((Array.isArray(bookingRows) ? bookingRows : []).map(mapBookingRow))
      setPendingBookingsList((Array.isArray(pendingRows) ? pendingRows : []).map(mapBookingRow))
      setLoadError('')
    } catch (error) {
      setLoadError(error.message || 'Could not refresh your bookings.')
    }
  }, [token, mapBookingRow])

  const refreshServiceRequests = useCallback(async () => {
    if (!token) return
    try {
      const rows = await apiRequest('/support/service-requests/provider?include_completed=true', 'GET', null, token)
      setServiceRequests((Array.isArray(rows) ? rows : []).map(mapServiceRequestRow))
    } catch (error) {
      setLoadError(error.message || 'Could not refresh requested services.')
    }
  }, [token, mapServiceRequestRow])

  const handleKycDocUpload = async (e) => {
    e.preventDefault()
    if (!kycDocFile) return setKycDocMsg('Please select a file to upload.')
    setKycDocBusy(true)
    setKycDocMsg('')
    try {
      const formData = new FormData()
      formData.append('document_type', kycDocType)
      formData.append('document', kycDocFile)
      await apiRequest('/provider/kyc-documents', 'POST', formData, token)
      setKycDocMsg('Document uploaded successfully! Our team will review your submission.')
      setKycDocFile(null)
    } catch (err) {
      setKycDocMsg(err.message || 'Upload failed')
    } finally {
      setKycDocBusy(false)
    }
  }

  const loadNotifications = useCallback(async () => {
    if (!token) return
    try {
      const rows = await apiRequest('/notifications', 'GET', null, token)
      setNotificationsList(Array.isArray(rows) ? rows : [])
    } catch { /* notifications are non-critical */ }
  }, [token])

  const applyBookingStatusLocally = useCallback((bookingId, status) => {
    const id = Number(bookingId)
    const normalizedStatus = String(status || '').toUpperCase()
    if (!id || !STATUS_COLORS[normalizedStatus]) return

    const updateRow = (row) => row.apiId === id
      ? { ...row, status: normalizedStatus, color: STATUS_COLORS[normalizedStatus], claimable: normalizedStatus === 'PENDING' }
      : row

    setBookingsList((current) => current.map(updateRow))
    setPendingBookingsList((current) => normalizedStatus === 'PENDING'
      ? current.map(updateRow)
      : current.filter((row) => row.apiId !== id))
    setSelectedDetailsBooking((current) => current?.apiId === id ? updateRow(current) : current)
  }, [])

  const handleClaimBooking = useCallback(async (bookingId) => {
    if (!token) return
    setClaimingId(bookingId)
    setBusy(true)
    try {
      await apiRequest(`/bookings/${bookingId}/claim`, 'POST', null, token)
      // Instant local move from PENDING to ASSIGNED in 0ms
      setPendingBookingsList((prev) => prev.filter((b) => b.apiId !== bookingId && b.id !== bookingId))
      const claimedItem = pendingBookingsList.find((b) => b.apiId === bookingId || b.id === bookingId)
      if (claimedItem) {
        const assignedItem = {
          ...claimedItem,
          status: 'ASSIGNED',
          color: STATUS_COLORS.ASSIGNED,
          claimable: false,
        }
        setBookingsList((prev) => [assignedItem, ...prev.filter((b) => b.apiId !== bookingId && b.id !== bookingId)])
        setBookingFilter('ASSIGNED')
      }
      // Light background refresh
      void loadNotifications()
    } catch (error) {
      alert(error.message || 'Could not claim this booking.')
      // Immediately remove stale claimed booking from view
      setPendingBookingsList((prev) => prev.filter((b) => b.apiId !== bookingId && b.id !== bookingId))
    } finally {
      setClaimingId(null)
      setBusy(false)
    }
  }, [token, pendingBookingsList, loadNotifications])

  const handleClaimServiceRequest = useCallback(async (requestId) => {
    if (!token) return
    setClaimingServiceRequestId(requestId)
    setBusy(true)
    try {
      await apiRequest(`/support/service-requests/${requestId}/claim`, 'POST', null, token)
      await Promise.all([refreshServiceRequests(), loadNotifications()])
    } catch (error) {
      alert(error.message || 'Could not accept this requested service.')
      await refreshServiceRequests()
    } finally {
      setClaimingServiceRequestId(null)
      setBusy(false)
    }
  }, [token, refreshServiceRequests, loadNotifications])

  const handleCompleteServiceRequest = useCallback(async (requestId) => {
    if (!token) return
    setCompletingServiceRequestId(requestId)
    setBusy(true)
    try {
      await apiRequest(`/support/service-requests/${requestId}/complete`, 'POST', null, token)
      await Promise.all([refreshServiceRequests(), loadNotifications()])
    } catch (error) {
      alert(error.message || 'Could not mark this requested service as completed.')
      await refreshServiceRequests()
    } finally {
      setCompletingServiceRequestId(null)
      setBusy(false)
    }
  }, [token, refreshServiceRequests, loadNotifications])

  useEffect(() => { void loadAll() }, [loadAll])
  useEffect(() => { void loadNotifications() }, [loadNotifications])
  useEffect(() => {
    const timer = window.setInterval(() => setCancellationClock(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useRealtime({
    onEvent: (type, data) => {
      if (type === 'PAYOUT_UPDATED') {
        const payoutId = Number(data?.payoutId || data?.id)
        setEarnings((current) => {
          if (!current) return current
          return {
            ...current,
            balance: data?.balance ?? current.balance,
            earnings: data?.balance ?? current.earnings,
            redeemed: data?.redeemed ?? current.redeemed,
            payouts: (current.payouts || []).map((payout) => Number(payout.id) === payoutId
              ? { ...payout, status: data.status || payout.status, paid_at: data.paid_at ?? payout.paid_at }
              : payout),
          }
        })
        void loadAll()
        void loadNotifications()
        return
      }

      if (['SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_ASSIGNED', 'SERVICE_REQUEST_COMPLETED'].includes(type)) {
        void refreshServiceRequests()
        void loadNotifications()
        return
      }

      const b = data?.booking || data
      if (!b) return

      if (type === 'BOOKING_CREATED') {
        // Re-read both lists through the backend eligibility rules. This handles
        // unassigned requests as well as bookings auto-assigned at creation time,
        // without duplicating category and service-area matching in the browser.
        void refreshBookingLists()
        void loadNotifications()
      } else if (type === 'BOOKING_CLAIMED') {
        const claimedId = b.bookingId || b.id
        if (claimedId) {
          setPendingBookingsList((prev) => prev.filter((item) => item.apiId !== claimedId && item.id !== claimedId))
        }
      } else if (type === 'BOOKING_ASSIGNED') {
        const assignedId = b.bookingId || b.id
        setPendingBookingsList((prev) => prev.filter((item) => item.apiId !== assignedId && item.id !== assignedId))
        if (b.providerId) {
          // If assigned to another provider, remove from pending
          applyBookingStatusLocally(assignedId, 'ASSIGNED')
        }
      } else if (type === 'BOOKING_STATUS_CHANGED') {
        const id = b.bookingId || b.id
        if (id && b.status) {
          applyBookingStatusLocally(id, b.status)
        }
      } else if (type === 'BOOKING_CANCELLED') {
        const id = b.bookingId || b.id
        if (id) {
          applyBookingStatusLocally(id, 'CANCELLED')
          setPendingBookingsList((prev) => prev.filter((item) => item.apiId !== id && item.id !== id))
        }
      }
    },
    onSync: () => {
      void loadAll()
      void loadNotifications()
    },
  })

  /* ── Availability (Manage service availability) ── */
  const saveAvailability = async (value) => {
    const previous = availability
    setAvailability(value)
    setBusy(true)
    try {
      await apiRequest('/provider/availability', 'PUT', { availability_status: value }, token)
      await loadAll()
    } catch (error) {
      setAvailability(previous)
      setLoadError(error.message)
      alert(error.message || 'Could not update availability')
    } finally {
      setBusy(false)
    }
  }

  /* ── Booking actions ── */
  const submitPinStatus = async () => {
    const { row, next, pin } = pinDialog
    if (!pin || pin.trim().length === 0) {
      return setPinDialog((d) => ({ ...d, error: 'Enter the PIN code provided by the customer.' }))
    }
    setBusy(true)
    try {
      const result = await apiRequest(`/bookings/${row.apiId}/status`, 'PUT', { status: next, pin_code: pin.trim() }, token)
      const nextStatus = String(result?.status || next).toUpperCase()
      applyBookingStatusLocally(row.apiId, nextStatus)
      setBookingFilter(nextStatus)
      setPinDialog(null)
      setSelectedDetailsBooking(null)
      await Promise.all([loadAll(), loadNotifications()])
    } catch (error) {
      if (/from (\w+) to \1/i.test(error.message || '')) {
        // The status change already happened (e.g. double submit) — just refresh.
        setPinDialog(null)
        setSelectedDetailsBooking(null)
        await loadAll()
      } else {
        setPinDialog((d) => ({ ...d, error: error.message || 'PIN verification failed.' }))
      }
    } finally {
      setBusy(false)
    }
  }

  /* ── Before / after service photos ── */
  const uploadPhotos = async (event, row, kind) => {
    const files = [...event.target.files]
    event.target.value = ''
    if (!files.length) return
    setPhotoError('')
    if (files.some((f) => !['image/jpeg', 'image/png'].includes(f.type) || f.size > 5 * 1024 * 1024)) {
      return setPhotoError('Only genuine JPEG/PNG images up to 5 MB are allowed.')
    }
    const form = new FormData()
    form.append('kind', kind)
    files.forEach((file) => form.append('photos', file))
    setPhotoBusy(true)
    try {
      const result = await apiRequest(`/bookings/${row.apiId}/photos`, 'POST', form, token)
      setPhotosByBooking((prev) => ({ ...prev, [row.apiId]: [...(prev[row.apiId] || []), ...(result.photos || [])] }))
      setSelectedDetailsBooking((prev) => (prev && prev.apiId === row.apiId ? { ...prev, [kind.toLowerCase() + 'Count']: (prev[kind.toLowerCase() + 'Count'] || 0) + (result.photos || []).length } : prev))
    } catch (error) {
      setPhotoError(error.message || 'Photo upload failed.')
    } finally {
      setPhotoBusy(false)
    }
  }

  /* ── Notifications ── */
  const markNotificationRead = async (id) => {
    setNotificationsList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try { await apiRequest(`/notifications/${id}/read`, 'PUT', null, token) } catch {}
  }
  const markAllNotificationsRead = async () => {
    setNotificationsList((prev) => prev.map((n) => ({ ...n, read: true })))
    try { await apiRequest('/notifications/read-all', 'PUT', null, token) } catch {}
  }

  /* ── Settings: name, mobile number, and service area. */

  const toggleSettingsTown = (town) => {
    setSettingsForm((prev) => prev.towns.includes(town)
      ? { ...prev, towns: prev.towns.filter((selectedTown) => selectedTown !== town) }
      : { ...prev, towns: [...prev.towns, town], provinces: [] })
  }

  const toggleSettingsCategory = (category) => {
    setSettingsForm((prev) => prev.categories.includes(category)
      ? { ...prev, categories: prev.categories.filter((selectedCategory) => selectedCategory !== category) }
      : { ...prev, categories: [...prev.categories, category] })
  }

  const toggleSettingsProvince = (prov) => {
    setSettingsForm((prev) => prev.provinces.includes(prov)
      ? { ...prev, provinces: prev.provinces.filter((p) => p !== prov) }
      : { ...prev, provinces: [...prev.provinces, prov], towns: [] })
  }

  const openSettings = () => {
    const tokens = (serviceTowns || '').split(',').map((t) => t.trim()).filter(Boolean)
    const provinces = tokens.filter((t) => t.toLowerCase().startsWith('province:')).map((t) => t.slice('province:'.length))
    setTownSearch('')
    setAreaMode(provinces.length ? 'provinces' : 'towns')
    setSettingsForm({
      name: currentProvider.name || providerFullName,
      phone: currentProvider.phone || currentProvider.mobile || '',
      categories: providerCategories,
      towns: tokens.filter((t) => !t.toLowerCase().startsWith('province:')),
      provinces,
    })
    setShowSettingsModal(true)
  }

  const saveSettings = async (e) => {
    e.preventDefault()
    if (!settingsForm.towns.length && !settingsForm.provinces.length) {
      return alert('Select your service area: individual towns or whole provinces.')
    }
    if (!settingsForm.categories.length) {
      return alert('Select at least one service category.')
    }
    if (settingsForm.towns.length > 10) {
      return alert('A provider may serve at most 10 towns. To cover a wider area, switch to province selection.')
    }
    setBusy(true)
    setSettingsSaving(true)
    try {
      const name = settingsForm.name.trim()
      if (name && name !== (currentProvider.name || '')) {
        const saved = await apiRequest('/profile', 'PUT', { name }, token)
        const updated = { ...currentProvider, name: saved.name }
        setCurrentProvider(updated)
        sessionStorage.setItem('user', JSON.stringify(updated))
      }
      const phone = settingsForm.phone.trim()
      if (phone && phone !== (currentProvider.phone || currentProvider.mobile || '')) {
        const saved = await apiRequest('/profile', 'PUT', { phone }, token)
        const updated = { ...currentProvider, name, phone: saved.phone }
        setCurrentProvider(updated)
        sessionStorage.setItem('user', JSON.stringify(updated))
      }
      const savedCategories = await apiRequest('/provider/service-categories', 'PUT', { categories: settingsForm.categories }, token)
      setProviderCategories(savedCategories.categories || settingsForm.categories)
      setProviderCategory(savedCategories.category || settingsForm.categories[0])
      const area = settingsForm.towns.length
        ? settingsForm.towns.join(', ')
        : settingsForm.provinces.map((p) => `province:${p}`).join(', ')
      await apiRequest('/provider/service-towns', 'PUT', { service_towns: area }, token)
      setShowSettingsModal(false)
      await loadAll()
    } catch (error) {
      alert(error.message || 'Could not save settings.')
    } finally {
      setBusy(false)
      setSettingsSaving(false)
    }
  }

  const saveBankAccount = async (e) => {
    e.preventDefault()
    if (!bankForm.bank_name || !bankForm.account_holder.trim() || !bankForm.account_number.trim() || !bankForm.branch.trim()) {
      return setPaymentMessage('Complete the bank, account name, account number, and branch.')
    }
    setPaymentBusy(true)
    setPaymentMessage('Saving bank account securely…')
    try {
      await apiRequest('/provider/bank-accounts', 'POST', bankForm, token)
      setBankForm((current) => ({ ...current, account_number: '' }))
      setPaymentMessage('Bank account saved successfully.')
      await loadAll()
    } catch (error) {
      setPaymentMessage(error.message || 'Could not save the bank account.')
    } finally {
      setPaymentBusy(false)
    }
  }

  const requestRedemption = async (e) => {
    e.preventDefault()
    const amount = Number(redeemAmount)
    if (!selectedBankAccount) return setPaymentMessage('Add and save your bank account before requesting a redemption.')
    if (availableBalance < minimumRedemptionAmount) return setPaymentMessage(`Your available balance must reach ${formatRupees(minimumRedemptionAmount)} before you can request a redemption.`)
    if (!/^\d+(?:\.\d{1,2})?$/.test(redeemAmount) || !Number.isFinite(amount) || amount < minimumRedemptionAmount) return setPaymentMessage(`Enter an amount of at least ${formatRupees(minimumRedemptionAmount)} with no more than two decimal places.`)
    if (amount > availableBalance) return setPaymentMessage(`The amount cannot exceed your available balance of ${formatRupees(availableBalance)}.`)
    setPaymentBusy(true)
    setPaymentMessage('Submitting your redemption request…')
    try {
      const result = await apiRequest('/provider/payouts/redeem', 'POST', { amount }, token)
      setRedeemAmount('')
      setPaymentMessage(result.message || 'Redemption request sent to the admin.')
      await loadAll()
    } catch (error) {
      setPaymentMessage(error.message || 'Could not submit the redemption request.')
    } finally {
      setPaymentBusy(false)
    }
  }


  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
  }

  const finalizeLogout = () => {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    navigate('/')
  }

  const handleBookingClick = (dayStr) => {
    const d = parseInt(dayStr, 10)
    if (!isNaN(d)) {
      setSelectedCalendarDay(d)
      const el = document.getElementById('cal-widget')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  /* ── Derived data ── */
  const visibleBookings = bookingsList

  const activeRows = visibleBookings.filter((b) => ['ASSIGNED', 'IN_PROGRESS'].includes(b.status))
  const requestRows = serviceRequests.filter((request) => request.status !== 'COMPLETED')
  const completedRequestRows = serviceRequests.filter((request) => request.status === 'COMPLETED')
  const calendarServiceRequests = requestRows
    .filter((request) => !request.claimable && request.status === 'ASSIGNED')
    .map((request) => ({
      ...request,
      sub: `${request.customerName}${request.town ? ` • ${request.town}` : ''} • Requested service`,
      color: STATUS_COLORS.ASSIGNED,
    }))
  const inProgressRows = visibleBookings.filter((b) => b.status === 'IN_PROGRESS')
  const upcomingRows = visibleBookings
    .filter((b) => b.status === 'ASSIGNED')
    .sort((a, b) => `${a.bookingDate} ${a.bookingTime}`.localeCompare(`${b.bookingDate} ${b.bookingTime}`))
  const overviewUpcomingRows = upcomingRows.slice(0, 5)
  const overviewRequestRows = requestRows.slice(0, 5)
  const nextService = upcomingRows[0]
  const nextServiceStr = nextService ? nextService.bookingDate.replaceAll('-', '.') : '—'
  const historyRows = (earnings?.history || [])
    .filter((h) => String(h.status).toLowerCase() === 'completed')
    .slice().sort((a, b) => {
      const completedA = Date.parse(a.completed_at || `${a.booking_date}T${String(a.booking_time || '00:00').slice(0, 5)}`) || 0
      const completedB = Date.parse(b.completed_at || `${b.booking_date}T${String(b.booking_time || '00:00').slice(0, 5)}`) || 0
      return (completedB - completedA) || (Number(b.id) - Number(a.id))
    })

  const filteredBookings = bookingFilter === 'PENDING'
    ? pendingBookingsList
    : visibleBookings.filter((b) => b.status === bookingFilter)

  const unreadCount = notificationsList.filter((n) => !n.read).length
  const activeAvailability = AVAILABILITY_OPTIONS.find((o) => o.value === availability)
  const selectedBankAccount = (earnings?.bank_accounts || []).find((account) => account.selected) || earnings?.bank_accounts?.[0]
  const availableBalance = Number(earnings?.balance ?? earnings?.earnings ?? 0)
  const minimumRedemptionAmount = Number(earnings?.minimum_redemption_amount || 5000)
  const redemptionRows = (earnings?.payouts || []).filter((payout) => payout.kind === 'redemption')
  const pendingRedemptionTotal = redemptionRows
    .filter((payout) => payout.status === 'pending')
    .reduce((total, payout) => total + Number(payout.amount || 0), 0)
  const requestedRedemptionAmount = Number(redeemAmount)
  const redemptionAmountHasValidPrecision = /^\d+(?:\.\d{1,2})?$/.test(redeemAmount)
  const redemptionAmountIsValid = redemptionAmountHasValidPrecision
    && Number.isFinite(requestedRedemptionAmount)
    && requestedRedemptionAmount >= minimumRedemptionAmount
    && requestedRedemptionAmount <= availableBalance
  const canRequestRedemption = Boolean(selectedBankAccount)
    && availableBalance >= minimumRedemptionAmount
    && redemptionAmountIsValid

  const openHistoryBooking = (historyBooking) => {
    const date = new Date(`${historyBooking.booking_date}T00:00:00`)
    setPhotoError('')
    setSelectedDetailsBooking({
      apiId: historyBooking.id,
      month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: String(date.getDate()),
      bookingDate: historyBooking.booking_date,
      bookingTime: historyBooking.booking_time,
      title: historyBooking.service_title || 'Service booking',
      status: 'COMPLETED',
      color: STATUS_COLORS.COMPLETED,
      customerName: historyBooking.customer_name || 'Customer',
      customerPhone: historyBooking.customer_phone || '',
      category: historyBooking.category_name || '',
      address: '',
      town: '',
      notes: '',
      serviceDesc: '',
    })
  }

  /* Action buttons for a booking row (used in cards + modal) */
  const renderBookingActions = (row, compact = false) => (
    <>
      {(row.claimable || row.status === 'PENDING') && (
        <button
          type="button"
          className="pd-cr-btn-accept"
          disabled={busy || claimingId === row.apiId}
          onClick={() => handleClaimBooking(row.apiId)}
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 800 }}
        >
          {claimingId === row.apiId ? 'CLAIMING...' : 'ACCEPT JOB ✨'}
        </button>
      )}
      {row.status === 'ASSIGNED' && (
        <button type="button" className="pd-cr-btn-accept" disabled={busy} onClick={() => setPinDialog({ row, next: 'in_progress', pin: '', error: '' })}>
          START SERVICE (PIN)
        </button>
      )}
      {row.status === 'IN_PROGRESS' && (
        <button type="button" className="pd-cr-btn-accept" disabled={busy} onClick={() => setPinDialog({ row, next: 'completed', pin: '', error: '' })}>
          COMPLETE SERVICE (PIN)
        </button>
      )}
      {!compact && (
        <button type="button" className="pd-cr-btn-decline" onClick={() => { setActiveNav('overview'); handleBookingClick(row.day) }}>
          VIEW ON CALENDAR
        </button>
      )}
    </>
  )

  return (
    <div className="pd">
      {/* 2-Second Polished Logout Overlay */}
      <LogoutOverlay isOpen={isLoggingOut} onComplete={finalizeLogout} />

      {/* ── Sidebar ── */}
      <aside className="pd-sidebar">
        <div className="pd-sidebar__logo">
          <img src="/luxora-logo.png" alt="LUXORA" className="pd-sidebar__logo-img" />
          <span className="pd-sidebar__tier">SERVICE PROVIDER</span>
        </div>

        <nav className="pd-nav">
          {[
            { id: 'overview', icon: <GridIcon />, label: 'Overview' },
            { id: 'bookings', icon: <CalIcon />, label: 'Bookings' },
            { id: 'service_requests', icon: <CalIcon />, label: 'Requested Services' },
            { id: 'history',  icon: <HistIcon />, label: 'History' },
            { id: 'payments', icon: <PaymentIcon />, label: 'Payments' },
          ].map((item) => (
            <button
              key={item.id}
              id={`pd-nav-${item.id}`}
              className={`pd-nav__item ${activeNav === item.id ? 'pd-nav__item--active' : ''}`}
              onClick={() => setActiveNav(item.id)}
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
          <div className="pd-topbar__title">Provider Dashboard</div>
          <div className="pd-topbar__actions">
            <button
              type="button"
              className="pd-topbar__account-pill"
              id="pd-topbar-profile"
              title="Click to view Provider Profile"
              onClick={() => setShowProfileDrawer(true)}
            >
              <div className="pd-topbar__avatar"><UserIcon /></div>
              <div className="pd-topbar__user-info">
                <span className="pd-topbar__user-name">{providerFullName}</span>
                <span className="pd-topbar__user-badge">VERIFIED PROVIDER</span>
              </div>
            </button>

            <button
              className="pd-topbar__icon-btn"
              id="pd-notif-btn"
              aria-label="Notifications"
              title="Click to view Notifications"
              onClick={() => { setShowNotifModal(true); loadNotifications() }}
              style={{ position: 'relative' }}
            >
              <BellIcon />
              {unreadCount > 0 && <span className="pd-topbar__badge">{unreadCount}</span>}
            </button>

            <button
              className="pd-topbar__icon-btn"
              id="pd-settings-btn"
              aria-label="Settings"
              title="Click to view Settings"
              onClick={openSettings}
            >
              <GearIcon />
            </button>

            <button className="pd-topbar__icon-btn" id="pd-logout-btn" aria-label="Log out" title="Log out" disabled={isLoggingOut} onClick={handleLogout}>
              <LogOutIcon />
            </button>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="pd-content">
          {loadError && (
            <div className="pd-all-bookings-view" style={{ gridColumn: '1 / -1' }}>
              <div className="pd-modal-cancel-preview">
                <h4 style={{ color: '#ef4444' }}>{loadError}</h4>
                <button type="button" className="pd-cr-btn-accept" onClick={loadAll}>RETRY</button>
              </div>
            </div>
          )}

          {activeNav === 'payments' ? (
            <div className="pd-all-bookings-view" style={{ gridColumn: '1 / -1' }}>
              <div className="pd-section-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <span className="pd-greeting__label">PROVIDER PAYMENTS</span>
                  <h1 className="pd-section-title" style={{ fontSize: '1.6rem' }}>Earnings & Redemptions</h1>
                </div>
                <button className="pd-section-link" onClick={() => setActiveNav('overview')}>← Back to Overview</button>
              </div>

              <div className="pd-all-booking-card" style={{ marginBottom: '1.25rem' }}>
                <div className="pd-section-header" style={{ marginBottom: '1rem' }}>
                  <div><span className="pd-greeting__label">PAYMENT DESTINATION</span><h2 className="pd-section-title" style={{ fontSize: '1.1rem' }}>Bank Account</h2></div>
                  <span className="pd-booking__status" style={{ color: selectedBankAccount ? '#4ade80' : '#eab308', borderColor: selectedBankAccount ? '#4ade80' : '#eab308' }}>{selectedBankAccount ? 'SAVED' : 'REQUIRED'}</span>
                </div>
                {selectedBankAccount ? (
                  <div className="pd-stats" style={{ marginBottom: '1rem' }}>
                    <div className="pd-stat"><p className="pd-stat__label">BANK</p><p style={{ color: '#fff', margin: 0 }}>{selectedBankAccount.bank_name}</p></div>
                    <div className="pd-stat"><p className="pd-stat__label">ACCOUNT NUMBER</p><p style={{ color: '#fff', margin: 0 }}>{selectedBankAccount.account_number}</p></div>
                    <div className="pd-stat"><p className="pd-stat__label">ACCOUNT NAME</p><p style={{ color: '#fff', margin: 0 }}>{selectedBankAccount.account_holder}</p></div>
                    <div className="pd-stat"><p className="pd-stat__label">BRANCH</p><p style={{ color: '#fff', margin: 0 }}>{selectedBankAccount.branch || '—'}</p></div>
                  </div>
                ) : <p className="pd-avail__hint">Add one Sri Lankan bank account before requesting a redemption.</p>}

                <form onSubmit={saveBankAccount} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                  <select id="provider-bank-name" name="bank_name" className="pd-edit-input" value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} required>
                    <option value="">Select Sri Lankan bank</option>
                    {SRI_LANKAN_BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                  </select>
                  <input id="provider-bank-branch" name="branch" className="pd-edit-input" value={bankForm.branch} onChange={(e) => setBankForm({ ...bankForm, branch: e.target.value })} placeholder="Branch" maxLength={100} required />
                  <input id="provider-bank-account-holder" name="account_holder" className="pd-edit-input" value={bankForm.account_holder} onChange={(e) => setBankForm({ ...bankForm, account_holder: e.target.value })} placeholder="Account holder name" maxLength={100} required />
                  <input id="provider-bank-account-number" name="account_number" className="pd-edit-input" value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value.replace(/[^0-9A-Za-z-]/g, '') })} placeholder={selectedBankAccount ? `Re-enter to change (${selectedBankAccount.account_number})` : 'Account number'} maxLength={40} required />
                  <button type="submit" className="pd-cr-btn-accept" disabled={paymentBusy} style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>{paymentBusy ? 'SAVING…' : selectedBankAccount ? 'UPDATE BANK ACCOUNT' : 'ADD BANK ACCOUNT'}</button>
                </form>
              </div>

              <div className="pd-stats" style={{ marginBottom: '1.25rem' }}>
                <div className="pd-stat"><p className="pd-stat__label">OVERALL EARNINGS</p><p className="pd-stat__value">{formatRupees(earnings?.overall_earnings)}</p></div>
                <div className="pd-stat"><p className="pd-stat__label">REDEEMED</p><p className="pd-stat__value">{formatRupees(earnings?.redeemed)}</p></div>
                <div className="pd-stat"><p className="pd-stat__label">AVAILABLE BALANCE</p><p className="pd-stat__value pd-stat__value--gold">{formatRupees(availableBalance)}</p></div>
                <div className="pd-stat"><p className="pd-stat__label">PENDING REDEMPTIONS</p><p className="pd-stat__value">{formatRupees(pendingRedemptionTotal)}</p></div>
              </div>

              <div className="pd-all-booking-card" style={{ marginBottom: '1.25rem' }}>
                <h2 className="pd-section-title" style={{ fontSize: '1.1rem' }}>Request Redemption</h2>
                <p className="pd-avail__hint" style={{ maxWidth: '720px', lineHeight: 1.55 }}>A minimum available balance of {formatRupees(minimumRedemptionAmount)} is required. A submitted amount is reserved from your balance while the admin processes it.</p>
                <form noValidate onSubmit={requestRedemption} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input id="provider-redemption-amount" name="redemption_amount" type="number" inputMode="decimal" className="pd-edit-input pd-redemption-input" min={minimumRedemptionAmount} max={availableBalance >= minimumRedemptionAmount ? availableBalance : undefined} step="0.01" value={redeemAmount} onChange={(e) => { setRedeemAmount(e.target.value); setPaymentMessage('') }} placeholder={`Amount (minimum ${minimumRedemptionAmount.toLocaleString()})`} aria-label="Redemption amount in Sri Lankan Rupees" aria-describedby="pd-redemption-help" style={{ maxWidth: '260px' }} disabled={paymentBusy} required />
                  <button type="submit" className="pd-cr-btn-accept" disabled={paymentBusy || !canRequestRedemption} title={!selectedBankAccount ? 'Save a bank account first' : availableBalance < minimumRedemptionAmount ? 'Available balance is below the minimum' : !redemptionAmountIsValid ? 'Enter an amount within your available balance' : 'Submit redemption request'}>{paymentBusy ? 'SUBMITTING…' : 'REQUEST REDEMPTION'}</button>
                </form>
                <div id="pd-redemption-help" aria-live="polite">
                  {!selectedBankAccount ? (
                    <p className="pd-redemption-help pd-redemption-help--warning">Save your bank account above before submitting a redemption request.</p>
                  ) : availableBalance < minimumRedemptionAmount ? (
                    <p className="pd-redemption-help pd-redemption-help--warning">Available balance: {formatRupees(availableBalance)}. You need {formatRupees(minimumRedemptionAmount - availableBalance)} more before redemption is enabled.</p>
                  ) : redeemAmount && requestedRedemptionAmount > availableBalance ? (
                    <p className="pd-redemption-help pd-redemption-help--warning">The maximum you can request is {formatRupees(availableBalance)}.</p>
                  ) : (
                    <p className="pd-redemption-help pd-redemption-help--ready">Available to request: {formatRupees(minimumRedemptionAmount)} to {formatRupees(availableBalance)}.</p>
                  )}
                </div>
                {paymentMessage && <p role="status" style={{ color: /success|sent/i.test(paymentMessage) ? '#4ade80' : 'var(--gold)', fontSize: '0.8rem', fontWeight: 700 }}>{paymentMessage}</p>}
              </div>

              <div className="pd-all-bookings-grid">
                <h2 className="pd-section-title" style={{ fontSize: '1.1rem' }}>Redemption Requests</h2>
                {redemptionRows.map((payout) => (
                  <div key={payout.id} className="pd-all-booking-card">
                    <div className="pd-all-booking-header"><div style={{ flex: 1 }}><h3 className="pd-all-booking-title">Request #{payout.id}</h3><p className="pd-all-booking-sub">{new Date(payout.created_at).toLocaleString()} • {payout.bank_name} • {payout.account_number}</p></div><span className="pd-booking__status" style={{ color: payout.status === 'paid' ? '#4ade80' : payout.status === 'failed' ? '#ef4444' : '#eab308', borderColor: 'currentColor' }}>{payout.status === 'paid' ? 'REDEEMED' : payout.status.toUpperCase()}</span></div>
                    <strong style={{ color: 'var(--gold)', fontSize: '1rem' }}>{formatRupees(payout.amount)}</strong>
                  </div>
                ))}
                {redemptionRows.length === 0 && <p className="pd-avail__hint">No redemption requests yet.</p>}
              </div>
            </div>
          ) : activeNav === 'history' ? (
            /* ══ COMPLETED SERVICE HISTORY & EARNINGS ══ */
            <div className="pd-all-bookings-view" style={{ gridColumn: '1 / -1' }}>
              <div className="pd-section-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <span className="pd-greeting__label">SERVICE RECORDS</span>
                  <h1 className="pd-section-title" style={{ fontSize: '1.6rem' }}>Completed Service History</h1>
                </div>
                <button className="pd-section-link" onClick={() => setActiveNav('overview')}>← Back to Overview</button>
              </div>

              <div className="pd-stats" style={{ marginBottom: '1.5rem' }}>
                <div className="pd-stat">
                  <p className="pd-stat__label">AVAILABLE BALANCE</p>
                  <p className="pd-stat__value pd-stat__value--gold">{formatRupees(earnings?.earnings)}</p>
                </div>
                <div className="pd-stat">
                  <p className="pd-stat__label">COMPLETED JOBS</p>
                  <p className="pd-stat__value">{earnings?.completedJobs ?? '—'}</p>
                </div>
                <div className="pd-stat">
                  <p className="pd-stat__label">OVERALL CUSTOMER RATING</p>
                  <p className="pd-stat__value" aria-label={`${Number(earnings?.average_rating || 0).toFixed(1)} out of 5 stars`}>
                    <span style={{ color: 'var(--gold)', letterSpacing: '0.08em' }}>★</span> {Number(earnings?.average_rating || 0).toFixed(1)} / 5
                  </p>
                  <small style={{ color: '#777' }}>{earnings?.rating_count || 0} customer review{Number(earnings?.rating_count || 0) === 1 ? '' : 's'}</small>
                </div>
              </div>

              <div className="pd-all-bookings-grid">
                {historyRows.length === 0 && !loading && (
                  <p style={{ color: '#888', fontStyle: 'italic' }}>No service history yet. Completed jobs will appear here.</p>
                )}
                {historyRows.map((h, i) => (
                  <div key={h.id || i} className="pd-all-booking-card">
                    <div className="pd-all-booking-header">
                      <div className="pd-booking__date">
                        <span className="pd-booking__month">{new Date(`${h.booking_date}T00:00:00`).toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
                        <span className="pd-booking__day">{String(new Date(`${h.booking_date}T00:00:00`).getDate())}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 className="pd-all-booking-title">{h.category_name || h.service_title || 'Service booking'}</h3>
                        <p className="pd-all-booking-sub">{h.customer_name || 'Customer'}{(h.petType || h.pet_type) ? ` • ${(h.petType || h.pet_type) === 'dog' ? '🐕 Dog Care' : '🐈 Cat Care'}` : ''}{h.customer_phone ? ` • 📞 ${formatMobileNumber(h.customer_phone)}` : ''} • {String(h.booking_time || '').slice(0, 5)}</p>
                      </div>
                      <span className="pd-booking__status" style={{ borderColor: STATUS_COLORS[String(h.status).toUpperCase()] || '#888', color: STATUS_COLORS[String(h.status).toUpperCase()] || '#888' }}>
                        {String(h.status).toUpperCase()}
                      </span>
                    </div>
                    <div className="pd-all-booking-actions" style={{ alignItems: 'center' }}>
                      <span style={{ color: '#888', fontSize: '0.75rem' }}>PAID: {String(h.payment_status || '—').toUpperCase()}</span>
                      <button type="button" className="pd-booking__details" onClick={() => openHistoryBooking(h)}>
                        VIEW PHOTOS
                      </button>
                      <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '0.9rem', marginLeft: 'auto' }}>
                        {formatRupees(h.job_earnings)}
                      </span>
                    </div>
                    <div style={{ marginTop: '0.85rem', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(201, 168, 76, 0.2)', background: 'rgba(201, 168, 76, 0.04)' }}>
                      {h.rating ? (
                        <>
                          <div aria-label={`${h.rating} out of 5 stars`} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            {[1, 2, 3, 4, 5].map((star) => <span key={star} aria-hidden="true" style={{ color: star <= Number(h.rating) ? 'var(--gold)' : '#3b3b3b', fontSize: '1rem' }}>★</span>)}
                            <strong style={{ color: '#eee', marginLeft: '0.35rem', fontSize: '0.8rem' }}>{h.rating} / 5</strong>
                            {h.reviewed_at && <small style={{ color: '#777', marginLeft: 'auto' }}>{new Date(h.reviewed_at).toLocaleDateString()}</small>}
                          </div>
                          <p style={{ color: h.review_comment ? '#bbb' : '#777', fontSize: '0.82rem', lineHeight: 1.55, margin: '0.55rem 0 0', fontStyle: h.review_comment ? 'normal' : 'italic' }}>{h.review_comment || 'The customer left a star rating without a written review.'}</p>
                        </>
                      ) : (
                        <p style={{ color: '#777', fontSize: '0.8rem', margin: 0, fontStyle: 'italic' }}>Not rated by the customer yet.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeNav === 'service_requests' ? (
            /* ══ ALL REQUESTED SERVICES ══ */
            <div className="pd-all-bookings-view" style={{ gridColumn: '1 / -1' }}>
              <div className="pd-section-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <span className="pd-greeting__label">CUSTOM REQUESTS</span>
                  <h1 className="pd-section-title" style={{ fontSize: '1.6rem' }}>Requested Services</h1>
                </div>
                <button className="pd-section-link" onClick={() => setActiveNav('overview')}>← Back to Overview</button>
              </div>

              <div className="pd-section-header" style={{ marginBottom: '0.9rem' }}>
                <h2 className="pd-section-title" style={{ fontSize: '1.05rem' }}>Ongoing Requested Services ({requestRows.length})</h2>
              </div>
              <div className="pd-all-bookings-grid" style={{ marginBottom: '2rem' }}>
                {requestRows.length === 0 && <p style={{ color: '#888', fontStyle: 'italic' }}>No ongoing requested services.</p>}
                {requestRows.map((request) => (
                  <div key={`ongoing-${request.apiId}`} className="pd-request-card">
                    <div className="pd-request-card__header">
                      <div className="pd-booking__date"><span className="pd-booking__month">{request.month}</span><span className="pd-booking__day">{request.day}</span></div>
                      <div className="pd-request-card__info"><h3 className="pd-request-card__title">{request.title}</h3><p className="pd-request-card__sub">{request.customerName}{request.customerPhone ? ` • ${formatMobileNumber(request.customerPhone)}` : ''}{request.town ? ` • ${request.town}` : ''}</p></div>
                      <span className="pd-request-card__status">{request.claimable ? 'AVAILABLE' : 'ASSIGNED'}</span>
                    </div>
                    {request.notes && <p className="pd-request-card__notes">{request.notes}</p>}
                    <div className="pd-request-card__divider" />
                    <div className="pd-request-card__actions">
                      <span className="pd-request-card__category">{request.category}</span>
                      {request.claimable ? (
                        <button type="button" className="pd-cr-btn-accept" disabled={busy || claimingServiceRequestId === request.apiId} onClick={() => handleClaimServiceRequest(request.apiId)}>{claimingServiceRequestId === request.apiId ? 'ACCEPTING...' : 'ACCEPT REQUEST'}</button>
                      ) : (
                        <button type="button" className="pd-cr-btn-accept" disabled={busy || completingServiceRequestId === request.apiId} onClick={() => handleCompleteServiceRequest(request.apiId)}>{completingServiceRequestId === request.apiId ? 'MARKING DONE...' : 'MARK AS DONE'}</button>
                      )}
                      <button type="button" className="pd-cr-btn-decline" onClick={() => { setActiveNav('overview'); handleBookingClick(request.day) }}>VIEW ON CALENDAR</button>
                      {request.customerPhone && <a className="pd-cr-btn-decline" href={`tel:${request.customerPhone}`} style={{ textDecoration: 'none' }}>CONTACT CUSTOMER</a>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pd-section-header" style={{ marginBottom: '0.9rem' }}>
                <h2 className="pd-section-title" style={{ fontSize: '1.05rem' }}>Completed Requested Services ({completedRequestRows.length})</h2>
              </div>
              <div className="pd-all-bookings-grid">
                {completedRequestRows.length === 0 && <p style={{ color: '#888', fontStyle: 'italic' }}>No completed requested services yet.</p>}
                {completedRequestRows.map((request) => (
                    <div key={`completed-${request.apiId}`} className="pd-request-card pd-request-card--completed">
                    <div className="pd-request-card__header">
                      <div className="pd-booking__date"><span className="pd-booking__month">{request.month}</span><span className="pd-booking__day">{request.day}</span></div>
                      <div className="pd-request-card__info"><h3 className="pd-request-card__title">{request.title}</h3><p className="pd-request-card__sub">{request.customerName}{request.town ? ` • ${request.town}` : ''}</p></div>
                      <span className="pd-request-card__status">COMPLETED</span>
                    </div>
                    <div className="pd-request-card__divider" />
                    <div className="pd-request-card__actions"><span className="pd-request-card__category">{request.category}</span></div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeNav === 'bookings' ? (
            /* ══ ALL BOOKINGS ══ */
            <div className="pd-all-bookings-view" style={{ gridColumn: '1 / -1' }}>
              <div className="pd-section-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <span className="pd-greeting__label">SCHEDULE & APPOINTMENTS</span>
                  <h1 className="pd-section-title" style={{ fontSize: '1.6rem' }}>All Provider Bookings</h1>
                </div>
                <button className="pd-section-link" onClick={() => setActiveNav('overview')}>← Back to Overview</button>
              </div>

              <div className="pd-bookings-filter-bar">
                {[
                  { id: 'ASSIGNED', label: `ASSIGNED (${visibleBookings.filter((b) => b.status === 'ASSIGNED').length})` },
                  { id: 'PENDING', label: `PENDING (${pendingBookingsList.length})` },
                  { id: 'IN_PROGRESS', label: `IN PROGRESS (${visibleBookings.filter((b) => b.status === 'IN_PROGRESS').length})` },
                  { id: 'COMPLETED', label: `COMPLETED (${visibleBookings.filter((b) => b.status === 'COMPLETED').length})` },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={`pd-filter-btn ${bookingFilter === id ? 'pd-filter-btn--active' : ''}`}
                    onClick={() => setBookingFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="pd-all-bookings-grid">
                {loading && <p style={{ color: '#888' }}>Loading bookings…</p>}
                {!loading && filteredBookings.length === 0 && (
                  <p style={{ color: '#888', fontStyle: 'italic', padding: '1.5rem 0' }}>
                    {bookingFilter === 'PENDING'
                      ? 'No unassigned bookings currently available to claim in your service area. Real-time notifications will alert you when new requests arrive!'
                      : `No ${bookingFilter.replace('_', ' ').toLowerCase()} bookings found.`}
                  </p>
                )}
                {filteredBookings.map((b, i) => (
                  <div key={b.apiId || i} className="pd-all-booking-card">
                    <div className="pd-all-booking-header">
                      <div className="pd-booking__date">
                        <span className="pd-booking__month">{b.month}</span>
                        <span className="pd-booking__day">{b.day}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 className="pd-all-booking-title">{b.category || 'Service category'}</h3>
                        <p className="pd-all-booking-sub">{b.sub}</p>
                      </div>
                      <span className="pd-booking__status" style={{ borderColor: b.color, color: b.color }}>
                        {b.status}
                      </span>
                    </div>

                    <div className="pd-all-booking-actions">
                      {renderBookingActions(b)}
                      <button type="button" className="pd-cr-btn-decline" onClick={() => setSelectedDetailsBooking(b)}>
                        VIEW DETAILS
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {providerKyc.status !== 'APPROVED' && (
                <div style={{ background: 'rgba(20,20,25,0.95)', border: providerKyc.status === 'REJECTED' ? '1px solid #ef4444' : '1px solid var(--gold)', borderRadius: '14px', padding: '1.75rem', marginBottom: '2rem', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{providerKyc.status === 'REJECTED' ? '⚠️' : '⏳'}</span>
                    <div>
                      <h2 style={{ fontSize: '1.2rem', color: providerKyc.status === 'REJECTED' ? '#ef4444' : 'var(--gold)', margin: 0, fontWeight: 800 }}>
                        {providerKyc.status === 'REJECTED' ? 'KYC Verification Rejected' : 'KYC Verification Pending'}
                      </h2>
                      <p style={{ margin: '0.25rem 0 0', color: '#aaa', fontSize: '0.88rem' }}>
                        {providerKyc.status === 'REJECTED'
                          ? 'Your verification documents require revision before your account can receive job assignments.'
                          : 'Your account is under review by the Luxora operations team. Operational features will unlock upon approval.'}
                      </p>
                    </div>
                  </div>
                  {providerKyc.status === 'REJECTED' && providerKyc.rejectionReason && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.85rem 1rem', margin: '1rem 0' }}>
                      <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.8rem', display: 'block' }}>REJECTION REASON</span>
                      <p style={{ margin: '0.25rem 0 0', color: '#fca5a5', fontSize: '0.9rem' }}>{providerKyc.rejectionReason}</p>
                    </div>
                  )}
                  <form onSubmit={handleKycDocUpload} style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                    <select id="provider-kyc-document-type" name="document_type" value={kycDocType} onChange={(e) => setKycDocType(e.target.value)} style={{ background: '#111', border: '1px solid #333', color: '#fff', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.88rem' }}>
                      <option value="NIC_FRONT">National ID (Front)</option>
                      <option value="NIC_BACK">National ID (Back)</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="BUSINESS_REG">Business Registration</option>
                      <option value="SELFIE">Selfie Verification</option>
                      <option value="UTILITY_BILL">Proof of Address</option>
                    </select>
                    <input id="provider-kyc-document" name="kyc_document" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setKycDocFile(e.target.files?.[0] || null)} style={{ color: '#ccc', fontSize: '0.85rem' }} />
                    <button type="submit" disabled={kycDocBusy || !kycDocFile} style={{ background: 'var(--gold)', color: '#000', fontWeight: 800, border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', cursor: kycDocBusy || !kycDocFile ? 'not-allowed' : 'pointer' }}>
                      {kycDocBusy ? 'Uploading...' : 'Upload Document'}
                    </button>
                    {kycDocMsg && <span style={{ fontSize: '0.85rem', color: kycDocMsg.includes('successfully') ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{kycDocMsg}</span>}
                  </form>
                </div>
              )}
              {/* ══ LEFT PANEL ══ */}
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
                  <div className="pd-stat">
                    <p className="pd-stat__label">ACTIVE BOOKINGS</p>
                    <p className="pd-stat__value">{activeRows.length}</p>
                  </div>
                  <div className="pd-stat">
                    <p className="pd-stat__label">AVAILABLE BALANCE</p>
                    <p className="pd-stat__value pd-stat__value--gold">{formatRupees(earnings?.earnings)}</p>
                  </div>
                  <div className="pd-stat">
                    <p className="pd-stat__label">NEXT SERVICE</p>
                    <p className="pd-stat__value">{nextServiceStr}</p>
                  </div>
                </div>

                {/* Upcoming Bookings */}
                <div className="pd-section-header">
                  <h2 className="pd-section-title">Upcoming Bookings</h2>
                  <button className="pd-section-link" id="pd-view-archive-btn" onClick={() => setActiveNav('bookings')}>
                    View All
                  </button>
                </div>
                <div className="pd-bookings">
                  {loading && <p style={{ color: '#888' }}>Loading bookings…</p>}
                  {!loading && upcomingRows.length === 0 && (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>No upcoming bookings right now.</p>
                  )}
                  {overviewUpcomingRows.map((b, i) => {
                    const dayNum = parseInt(b.day, 10)
                    const isSelected = selectedCalendarDay === dayNum
                    return (
                      <div
                        key={b.apiId || i}
                        className={`pd-booking ${isSelected ? 'pd-booking--selected' : ''}`}
                        id={`pd-booking-${i}`}
                        style={{
                          cursor: 'pointer',
                          borderLeft: isSelected ? `3px solid ${b.color}` : '1px solid #222',
                          background: isSelected ? 'rgba(201, 168, 76, 0.08)' : 'rgba(20, 20, 20, 0.5)',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => { handleBookingClick(b.day); setSelectedDetailsBooking(b) }}
                      >
                        <div className="pd-booking__date">
                          <span className="pd-booking__month">{b.month}</span>
                          <span className="pd-booking__day">{b.day}</span>
                        </div>
                        <div className="pd-booking__info">
                          <p className="pd-booking__title">{b.category || 'Not available'}</p>
                          <p className="pd-booking__sub">{b.sub}</p>
                        </div>
                        <span className="pd-booking__status" style={{ borderColor: b.color, color: b.color }}>
                          {b.status}
                        </span>
                        <button type="button" className="pd-booking__details" onClick={(e) => { e.stopPropagation(); setSelectedDetailsBooking(b) }}>
                          VIEW DETAILS
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Services In Progress — upload after photo, end with completion PIN */}
                {inProgressRows.length > 0 && (
                  <>
                    <div className="pd-section-header" style={{ marginTop: '2.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2 className="pd-section-title">Services In Progress</h2>
                        <span className="pd-badge-gold">END SERVICE ({inProgressRows.length})</span>
                      </div>
                    </div>
                    <div className="pd-custom-requests">
                      {inProgressRows.map((b) => (
                        <div key={b.apiId} className="pd-cr-card">
                          <div className="pd-cr-header">
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span className="pd-cr-client">👤 {b.customerName}</span>
                                {b.customerPhone && (
                                  <a href={`tel:${b.customerPhone}`} style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}>
                                    📞 {formatMobileNumber(b.customerPhone)}
                                  </a>
                                )}
                              </div>
                              <h3 className="pd-cr-service">{b.title}</h3>
                            </div>
                            <span className="pd-cr-status" style={{ borderColor: STATUS_COLORS.IN_PROGRESS, color: STATUS_COLORS.IN_PROGRESS }}>
                              IN PROGRESS
                            </span>
                          </div>

                          <p className="pd-cr-notes">
                            📅 {b.month} {b.day}, {b.bookingDate?.slice(0, 4)} • {String(b.bookingTime || '').slice(0, 5)}{b.town ? ` • 📍 ${b.town}` : ''}
                          </p>

                          <div className="pd-cr-footer">
                            <div className="pd-cr-meta" style={{ alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                     {(photosByBooking[b.apiId] || []).filter((p) => p.kind === 'AFTER').map((p) => (
                                <span key={p.id} className="pd-photo-chip">🖼 {p.original_name}</span>
                              ))}
                            </div>
                            <div className="pd-cr-actions">
                              <button type="button" className="pd-cr-btn-accept" disabled={busy} onClick={() => setPinDialog({ row: b, next: 'completed', pin: '', error: '' })}>
                                END SERVICE (PIN)
                              </button>
                              <button type="button" className="pd-cr-btn-decline" onClick={() => setSelectedDetailsBooking(b)}>
                                VIEW DETAILS
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Bespoke service requests assigned or offered to this provider */}
                <div className="pd-section-header" style={{ marginTop: '2.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h2 className="pd-section-title">Requested Services</h2>
                    {requestRows.some((request) => request.claimable) && (
                      <span className="pd-badge-gold">NEW REQUESTS ({requestRows.filter((request) => request.claimable).length})</span>
                    )}
                  </div>
                  <button type="button" className="pd-booking__details" onClick={() => setActiveNav('service_requests')}>VIEW ALL</button>
                </div>
                <div className="pd-custom-requests">
                  {requestRows.length === 0 && (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>No new service requests right now.</p>
                  )}
                  {overviewRequestRows.map((b) => (
                    <div key={b.apiId} className="pd-request-card">
                      <div className="pd-request-card__header">
                        <div className="pd-booking__date"><span className="pd-booking__month">{b.month}</span><span className="pd-booking__day">{b.day}</span></div>
                        <div className="pd-request-card__info">
                          <h3 className="pd-request-card__title">{b.title}</h3>
                          <p className="pd-request-card__sub">{b.customerName}{b.customerPhone ? ` • ${formatMobileNumber(b.customerPhone)}` : ''}{b.town ? ` • ${b.town}` : ''}</p>
                        </div>
                      <span className="pd-request-card__status">{b.claimable ? 'AVAILABLE' : 'ASSIGNED'}</span>
                      </div>
                      {b.notes && <p className="pd-request-card__notes">{b.notes}</p>}
                      <div className="pd-request-card__divider" />
                      <div className="pd-request-card__actions">
                          <span className="pd-request-card__category">{b.category}</span>
                          {b.claimable ? (
                            <button
                              type="button"
                              className="pd-cr-btn-accept pd-request-accept-btn"
                              disabled={busy || claimingServiceRequestId === b.apiId}
                              onClick={() => handleClaimServiceRequest(b.apiId)}
                              title="Accept this custom service request"
                            >
                              {claimingServiceRequestId === b.apiId ? 'ACCEPTING...' : 'ACCEPT REQUEST'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="pd-cr-btn-accept pd-request-accept-btn"
                              disabled={busy || completingServiceRequestId === b.apiId}
                              onClick={() => handleCompleteServiceRequest(b.apiId)}
                              title="Mark this accepted requested service as completed"
                            >
                              {completingServiceRequestId === b.apiId ? 'MARKING DONE...' : 'MARK AS DONE'}
                            </button>
                          )}
                          <button type="button" className="pd-cr-btn-decline" onClick={() => handleBookingClick(b.day)}>VIEW ON CALENDAR</button>
                          {b.customerPhone && (
                            <a className="pd-cr-btn-decline" href={`tel:${b.customerPhone}`} style={{ textDecoration: 'none' }}>
                              CONTACT CUSTOMER
                            </a>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ RIGHT PANEL ══ */}
              <div className="pd-panel-right">
                {/* Calendar */}
                <div className="pd-widget" id="cal-widget">
                  <Calendar bookings={[...upcomingRows, ...calendarServiceRequests]} selectedDay={selectedCalendarDay} onSelectDay={setSelectedCalendarDay} />
                </div>

                {/* Session payout rates */}
                <div className="pd-widget pd-avail-widget">
                  <div className="pd-section-header" style={{ marginBottom: '0.75rem' }}>
                    <h2 className="pd-section-title" style={{ fontSize: '1rem' }}>Session Payout</h2>
                  </div>
                  {sessionPayouts.map((p) => (
                    <div className="pd-kv" key={p.category_name}>
                      <span className="pd-kv__key">
                        {p.category_name.toUpperCase()}{providerCategories.includes(p.category_name) ? ' ★' : ''}
                      </span>
                      <span className={`pd-kv__val${providerCategories.includes(p.category_name) ? ' pd-kv__val--gold' : ''}`}>
                        {p.provider_earning === null ? 'Set in admin' : `Rs. ${Number(p.provider_earning).toLocaleString('en-US')}`}
                      </span>
                    </div>
                  ))}
                  {sessionPayouts.length === 0 && <p className="pd-avail__hint">No payout rates are configured for your active categories yet.</p>}
                  <p className="pd-avail__hint">Provider pay per completed session. Rates are set by the admin.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── BOOKING DETAILS MODAL (customer details + photos + actions) ── */}
      {selectedDetailsBooking && (
        <div className="pd-drawer-overlay" onClick={() => setSelectedDetailsBooking(null)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pd-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>📅</span>
                <div>
                  <h3 className="pd-modal__title">{selectedDetailsBooking.title}</h3>
                  <span className="pd-modal__subtitle">BOOKING #{selectedDetailsBooking.apiId} • {selectedDetailsBooking.category}</span>
                </div>
              </div>
              <button type="button" className="pd-drawer__close" onClick={() => setSelectedDetailsBooking(null)}>✕</button>
            </div>

            <div className="pd-modal__body">
              <div className="pd-profile-field">
                <label>SCHEDULED DATE & TIME</label>
                <p style={{ color: 'var(--gold)', fontWeight: 'bold' }}>
                  {selectedDetailsBooking.month} {selectedDetailsBooking.day}, {selectedDetailsBooking.bookingDate?.slice(0, 4)} • {String(selectedDetailsBooking.bookingTime || '').slice(0, 5)}
                </p>
              </div>

              <div className="pd-profile-field">
                <label>CUSTOMER DETAILS</label>
                <p>{selectedDetailsBooking.customerName}</p>
                <p style={{ fontSize: '0.82rem', color: '#aaa' }}>
                  {selectedDetailsBooking.address || selectedDetailsBooking.town || 'Location not specified'}
                </p>
              </div>

              <div className="pd-profile-field">
                <label>CUSTOMER MOBILE NUMBER</label>
                <p>{formatMobileNumber(selectedDetailsBooking.customerPhone)}</p>
              </div>

              {selectedDetailsBooking.serviceDesc && (
                <div className="pd-profile-field">
                  <label>SERVICE DESCRIPTION</label>
                  <p>{selectedDetailsBooking.serviceDesc}</p>
                </div>
              )}

              {selectedDetailsBooking.notes && (
                <div className="pd-profile-field">
                  <label>SPECIAL INSTRUCTIONS</label>
                  <p style={{ fontStyle: 'italic', color: '#aaa' }}>{selectedDetailsBooking.notes}</p>
                </div>
              )}

              {selectedDetailsBooking.status === 'ASSIGNED' && (
                <div className="pd-profile-field">
                  <label>CANCEL ASSIGNED BOOKING</label>
                  <p style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: '0.55rem' }}>
                    {providerCancellationIsOpen(selectedDetailsBooking, cancellationClock)
                      ? 'Cancellation is available until four hours before the booking. Luxora will assign an eligible replacement; otherwise the booking is cancelled and the customer token is restored.'
                      : 'Cancellation is locked because fewer than four hours remain before this booking.'}
                  </p>
                  <button type="button" className="pd-cr-btn-decline" disabled={busy || !providerCancellationIsOpen(selectedDetailsBooking, cancellationClock)} style={{ marginTop: '0.65rem' }} onClick={cancelAssignedBooking}>
                    {busy ? 'CANCELLING…' : providerCancellationIsOpen(selectedDetailsBooking, cancellationClock) ? 'CANCEL BOOKING' : 'CANCELLATION LOCKED'}
                  </button>
                </div>
              )}
              <div className="pd-profile-field">
                <label>BOOKING STATUS</label>
                <span className="pd-booking__status" style={{ borderColor: selectedDetailsBooking.color, color: selectedDetailsBooking.color, display: 'inline-block', marginTop: '0.25rem' }}>
                  {selectedDetailsBooking.status}
                </span>
              </div>

              {/* Before / After photo upload — stage-aware */}
              {['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(selectedDetailsBooking.status) && (
                <div className="pd-profile-field">
                  <label>SERVICE PHOTOS (BEFORE / AFTER)</label>
                  {selectedDetailsBooking.status === 'ASSIGNED' && (
                    <div className="pd-photo-row">
                      <div className="pd-photo-row__head">
                        <span>BEFORE PHOTOS <small style={{ color: '#888' }}>(required to start)</small></span>
                        <label className={`pd-photo-upload ${photoBusy ? 'pd-photo-upload--busy' : ''}`}>
                          + UPLOAD
                          <input id={`provider-before-photos-${selectedDetailsBooking.apiId}`} name="before_photos" type="file" accept="image/jpeg,image/png" multiple hidden disabled={photoBusy} onChange={(e) => uploadPhotos(e, selectedDetailsBooking, 'BEFORE')} />
                        </label>
                      </div>
                      <div className="pd-photo-chips">
                        {(photosByBooking[selectedDetailsBooking.apiId] || []).filter((p) => p.kind === 'BEFORE').map((p) => (
                          <span key={p.id} className="pd-photo-chip">🖼 {p.original_name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedDetailsBooking.status === 'IN_PROGRESS' && (
                    <div className="pd-photo-row">
                      <div className="pd-photo-row__head">
                        <span>AFTER PHOTOS <small style={{ color: '#888' }}>(required to complete)</small></span>
                        <label className={`pd-photo-upload ${photoBusy ? 'pd-photo-upload--busy' : ''}`}>
                          + UPLOAD
                          <input id={`provider-after-photos-${selectedDetailsBooking.apiId}`} name="after_photos" type="file" accept="image/jpeg,image/png" multiple hidden disabled={photoBusy} onChange={(e) => uploadPhotos(e, selectedDetailsBooking, 'AFTER')} />
                        </label>
                      </div>
                      <div className="pd-photo-chips">
                        {(photosByBooking[selectedDetailsBooking.apiId] || []).filter((p) => p.kind === 'AFTER').map((p) => (
                          <span key={p.id} className="pd-photo-chip">🖼 {p.original_name}</span>
                        ))}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.4rem' }}>BEFORE photos were verified at service start.</p>
                    </div>
                  )}
                  {photoError && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.4rem' }}>{photoError}</p>}
                  <BookingPhotoGallery
                    bookingId={selectedDetailsBooking.apiId}
                    token={token}
                    refreshKey={(photosByBooking[selectedDetailsBooking.apiId] || []).length}
                    title={selectedDetailsBooking.status === 'COMPLETED' ? 'COMPLETED SERVICE EVIDENCE' : 'SAVED SERVICE PHOTOS'}
                  />
                </div>
              )}
            </div>

            <div className="pd-modal__footer">
              {renderBookingActions(selectedDetailsBooking, true)}
              <button type="button" className="pd-modal-btn-close" onClick={() => setSelectedDetailsBooking(null)}>
                CLOSE WINDOW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PIN VERIFICATION MODAL (start / complete service) ── */}
      {pinDialog && (
        <div className="pd-drawer-overlay" onClick={() => setPinDialog(null)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="pd-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🔐</span>
                <div>
                  <h3 className="pd-modal__title">{pinDialog.next === 'in_progress' ? 'Start Service' : 'Complete Service'}</h3>
                  <span className="pd-modal__subtitle">CUSTOMER PIN VERIFICATION REQUIRED</span>
                </div>
              </div>
              <button type="button" className="pd-drawer__close" onClick={() => setPinDialog(null)}>✕</button>
            </div>

            <div className="pd-modal__body">
              <p style={{ fontSize: '0.88rem', color: '#ccc', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Ask the customer for their {pinDialog.next === 'in_progress' ? 'START' : 'COMPLETION'} PIN for booking
                #{pinDialog.row.apiId} — {pinDialog.row.title}. Entering the PIN verifies the service {pinDialog.next === 'in_progress' ? 'has started on site' : 'is finished'}.
              </p>
              <input
                id="provider-service-pin"
                name="service_pin"
                type="password"
                inputMode="numeric"
                className="pd-edit-input pd-pin-input"
                placeholder="Enter customer PIN"
                value={pinDialog.pin}
                autoFocus
                onChange={(e) => setPinDialog((d) => ({ ...d, pin: e.target.value, error: '' }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !busy) submitPinStatus() }}
              />
              {pinDialog.error && <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.5rem' }}>{pinDialog.error}</p>}
            </div>

            <div className="pd-modal__footer">
              <button type="button" className="pd-modal-btn-secondary" onClick={() => setPinDialog(null)}>CANCEL</button>
              <ActionButton
                type="button"
                className="pd-modal-btn-danger pd-pin-submit"
                loading={busy}
                loadingText="Verifying PIN..."
                onClick={submitPinStatus}
              >
                {`✓ VERIFY & ${pinDialog.next === 'in_progress' ? 'START' : 'COMPLETE'}`}
              </ActionButton>
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
                  <span className="pd-drawer__badge">VERIFIED PROVIDER ✓</span>
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
                <p>{currentProvider.email || '—'}</p>
              </div>

              <div className="pd-profile-field">
                <label>MOBILE NUMBER</label>
                <p>{formatMobileNumber(currentProvider.phone || currentProvider.mobile)}</p>
              </div>

              <div className="pd-profile-field">
                <label>SERVICES OFFERED</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {(providerCategories.length ? providerCategories : (providerCategory ? [providerCategory] : [])).map((srv) => (
                    <span key={srv} className="pd-service-chip">✓ {srv}</span>
                  ))}
                </div>
              </div>

              <div className="pd-profile-field">
                <label>SERVICE CATEGORIES</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {(providerCategories.length ? providerCategories : (providerCategory ? [providerCategory] : ['—'])).map((category) => <span key={category} className="pd-service-chip">{category}</span>)}
                </div>
              </div>

              <div className="pd-profile-field">
                <label>SERVICE AREA (TOWNS / PROVINCES)</label>
                <p>{serviceTowns || '—'}</p>
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

            {notificationsList.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginBottom: '0.85rem' }}>
                <button
                  onClick={markAllNotificationsRead}
                  style={{ background: 'rgba(201, 168, 76, 0.12)', border: '1px solid var(--gold, #c9a84c)', color: 'var(--gold, #c9a84c)', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  ✓ Mark as Read All
                </button>
              </div>
            )}

            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notificationsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#888', fontSize: '0.88rem' }}>
                  No notifications at this time.
                </div>
              ) : (
                notificationsList.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markNotificationRead(n.id)}
                    style={{
                      background: n.read ? '#0e0e11' : '#141414',
                      border: n.read ? '1px solid #202020' : '1px solid rgba(201, 168, 76, 0.3)',
                      opacity: n.read ? 0.7 : 1,
                      borderRadius: '10px',
                      padding: '0.95rem',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'flex-start',
                      cursor: n.read ? 'default' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: n.read ? '#1a1a1a' : 'rgba(201, 168, 76, 0.15)', color: n.read ? '#888' : 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      🔔
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}>{n.message}</span>
                        {!n.read && (
                          <span style={{ background: 'var(--gold)', color: '#000', borderRadius: '50%', width: '7px', height: '7px', display: 'inline-block', flexShrink: 0 }} title="Unread" />
                        )}
                      </div>
                      <small style={{ color: 'var(--gold)', fontSize: '0.7rem', fontWeight: 600 }}>{relTime(n.createdAt)}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL (profile name + towns served) ── */}
      {showSettingsModal && (
        <div className="pd-drawer-overlay" onClick={() => !settingsSaving && setShowSettingsModal(false)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #222', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⚙️</span>
                <h3 style={{ color: 'var(--gold)', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Provider Settings</h3>
              </div>
              <button type="button" disabled={settingsSaving} onClick={() => setShowSettingsModal(false)} style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '1.1rem', cursor: settingsSaving ? 'wait' : 'pointer', fontWeight: 700 }}>✕</button>
            </div>

            <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {settingsSaving && <div role="status" aria-live="polite" style={{ background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.45)', borderRadius: '8px', color: 'var(--gold)', padding: '0.7rem 0.85rem', fontSize: '0.78rem', fontWeight: 700 }}>Saving your settings securely. Please wait…</div>}
              <div className="pd-edit-field">
                <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.3rem', display: 'block' }}>DISPLAY NAME *</label>
                <input
                  id="provider-display-name"
                  name="name"
                  type="text"
                  required
                  className="pd-edit-input"
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  placeholder="e.g. Marco Vance"
                />
              </div>

              {/* Phone Number */}
              <div className="pd-edit-field">
                <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.3rem', display: 'block' }}>MOBILE NUMBER</label>
                <input
                  id="provider-mobile-number"
                  name="phone"
                  type="tel"
                  className="pd-edit-input"
                  value={settingsForm.phone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value.replace(/[^\d+]/g, '').slice(0, 25) })}
                  placeholder="e.g. +94771234567"
                />
                <small style={{ color: '#888', fontSize: '0.68rem', display: 'block', marginTop: '0.3rem' }}>
                  Keep your mobile number current so customers can reach you about assigned work.
                </small>

              </div>

              <div className="pd-edit-field">
                <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.35rem', display: 'block' }}>SERVICE AVAILABILITY</label>
                <div className="pd-avail">
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={busy || settingsSaving}
                      className={`pd-avail__btn ${availability === opt.value ? 'pd-avail__btn--active' : ''}`}
                      onClick={() => saveAvailability(opt.value)}
                    >
                      <span className="pd-avail__dot" />
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="pd-avail__hint">{activeAvailability?.hint || ''}</p>
              </div>

              {/* Service categories — providers choose the work they offer. */}
              <div className="pd-edit-field">
                <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.35rem', display: 'block' }}>SERVICE CATEGORIES *</label>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {SERVICE_CATEGORIES.map((category) => {
                    const selected = settingsForm.categories.includes(category)
                    return <button
                      key={category}
                      type="button"
                      onClick={() => toggleSettingsCategory(category)}
                      aria-pressed={selected}
                      style={{
                        background: selected ? 'rgba(201, 168, 76, 0.2)' : 'transparent',
                        border: `1px solid ${selected ? 'var(--gold, #c9a84c)' : '#444'}`,
                        color: selected ? 'var(--gold, #c9a84c)' : '#aaa',
                        padding: '0.5rem 1rem', borderRadius: '20px', cursor: 'pointer',
                        fontSize: '0.82rem', fontWeight: 700,
                      }}
                    >
                      {selected ? '✓ ' : ''}{category}
                    </button>
                  })}
                </div>
                <small style={{ color: '#888', fontSize: '0.68rem', display: 'block', marginTop: '0.3rem' }}>
                  Activate every category you are qualified to serve. You will only receive bookings for active categories.
                </small>
              </div>

              {/* Service area: mode switch — towns picker or province chips */}
              <div className="pd-edit-field">
                <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.35rem', display: 'block' }}>SERVICE AREA *</label>

                <div className="pd-area-mode">
                  <button
                    type="button"
                    className={`pd-area-mode__btn ${areaMode === 'towns' ? 'pd-area-mode__btn--active' : ''}`}
                    onClick={switchToTownMode}
                  >
                    📍 SELECT BY TOWN
                  </button>
                  <button
                    type="button"
                    className={`pd-area-mode__btn ${areaMode === 'provinces' ? 'pd-area-mode__btn--active' : ''}`}
                    onClick={switchToProvinceMode}
                  >
                    🗺 SELECT BY PROVINCE
                  </button>
                </div>

                {areaMode === 'towns' ? (
                  <>
                    <input
                      id="provider-town-search"
                      name="town_search"
                      type="text"
                      className="pd-edit-input"
                      placeholder="🔍 Search towns…"
                      value={townSearch}
                      onChange={(e) => setTownSearch(e.target.value)}
                      style={{ marginBottom: '0.5rem' }}
                    />
                    <div className="pd-town-list">
                      {(() => {
                        const q = townSearch.trim().toLowerCase()
                        const groups = PROVINCE_NAMES
                          .map((prov) => ({ prov, towns: SRI_LANKA_AREAS[prov].filter((t) => t.toLowerCase().includes(q)) }))
                          .filter((g) => g.towns.length)
                        if (!groups.length) return <p className="pd-avail__hint" style={{ padding: '0.6rem 0.4rem' }}>No towns match "{townSearch}".</p>
                        return groups.map(({ prov, towns }) => (
                          <div key={prov}>
                            <div className="pd-town-group">{prov} Province</div>
                            {towns.map((town) => (
                              <label key={town} className="pd-town-check">
                                <input
                                  id={`provider-town-${town.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                                  name="service_towns"
                                  type="checkbox"
                                  checked={settingsForm.towns.includes(town)}
                                  onChange={() => toggleSettingsTown(town)}
                                />
                                <span>{town}</span>
                                {settingsForm.towns.includes(town) && <span style={{ marginLeft: 'auto', color: 'var(--gold, #c9a84c)', fontSize: '0.7rem' }}>✓</span>}
                              </label>
                            ))}
                          </div>
                        ))
                      })()}
                    </div>
                    {settingsForm.towns.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {settingsForm.towns.map((town) => (
                          <span key={town} className="pd-chip-x">
                            {town}
                            <button type="button" aria-label={`Remove ${town}`} onClick={() => toggleSettingsTown(town)}>✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <small style={{ color: '#888', fontSize: '0.68rem', display: 'block', marginTop: '0.35rem' }}>
                      {settingsForm.towns.length}/10 towns selected.
                    </small>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {PROVINCE_NAMES.map((prov) => {
                        const isSelected = settingsForm.provinces.includes(prov)
                        return (
                          <button
                            key={prov}
                            type="button"
                            onClick={() => toggleSettingsProvince(prov)}
                            style={{
                              background: isSelected ? 'rgba(201, 168, 76, 0.2)' : '#16161a',
                              border: isSelected ? '1px solid var(--gold, #c9a84c)' : '1px solid #333',
                              color: isSelected ? 'var(--gold, #c9a84c)' : '#aaa',
                              padding: '0.45rem 0.9rem',
                              borderRadius: '16px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {isSelected ? '✓ ' : ''}{prov}
                          </button>
                        )
                      })}
                    </div>
                    {settingsForm.provinces.length > 0 && (
                      <small style={{ color: '#888', fontSize: '0.68rem', display: 'block', marginTop: '0.35rem' }}>
                        Covers bookings whose saved delivery province is: {settingsForm.provinces.map((p) => `${p} Province`).join(', ')}.
                      </small>
                    )}
                    {settingsForm.provinces.length === 0 && (
                      <small style={{ color: '#888', fontSize: '0.68rem', display: 'block', marginTop: '0.35rem' }}>
                        Tap provinces to cover all their towns.
                      </small>
                    )}
                  </>
                )}
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
                  disabled={settingsSaving}
                  style={{ background: 'var(--gold)', border: 'none', color: '#000', padding: '0.6rem 1.4rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, cursor: settingsSaving ? 'wait' : 'pointer', opacity: settingsSaving ? 0.75 : 1 }}
                >
                  {settingsSaving ? 'SAVING… PLEASE WAIT' : '✓ SAVE SETTINGS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── MOBILE BOTTOM NAVIGATION ── */}
      <nav className="pd-mobile-nav" aria-label="Sections">
        {[
          { id: 'overview', icon: <GridIcon />, label: 'OVERVIEW' },
          { id: 'bookings', icon: <CalIcon />, label: 'BOOKINGS' },
          { id: 'service_requests', icon: <CalIcon />, label: 'REQUESTS' },
          { id: 'history', icon: <HistIcon />, label: 'HISTORY' },
          { id: 'payments', icon: <PaymentIcon />, label: 'PAYMENTS' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`pd-mobile-nav__btn ${activeNav === item.id ? 'pd-mobile-nav__btn--active' : ''}`}
            onClick={() => setActiveNav(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default ProviderDashboard
