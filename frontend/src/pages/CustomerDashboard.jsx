import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api'
import PortalShell, { EmptyState, LoadingState, Panel, Status } from '../components/PortalShell'
import { CategoryIcon, ConfirmDialog, Coin, FilterPills, Modal, PromptDialog, SearchInput } from '../components/ui'
import './CustomerDashboard.css'

const emptyWizard = { step: 1, category: null, service_id: '', booking_date: '', booking_time: '' }
const TICKET_TONE = { OPEN: 'available', IN_PROGRESS: 'active', RESOLVED: 'completed', CLOSED: 'cancelled' }
const PAGE_META = {
  booking: { title: 'Booking', subtitle: 'Your coins, active packages, concierge bookings and personal requests — kept together in one considered place.' },
  plans: { title: 'Subscription plans', subtitle: 'Combos, single-care packages and your full transaction history.' },
  support: { title: 'Support', subtitle: 'Refunds, customer service and every conversation with our concierge team.' },
  profile: { title: 'Profile', subtitle: 'Keep your contact details current and review your notifications.' },
}

export default function CustomerDashboard() {
  const navigate = useNavigate()
  const token = sessionStorage.getItem('token')
  const [data, setData] = useState(null)
  const [services, setServices] = useState([])
  const [plans, setPlans] = useState([])
  const [entitlements, setEntitlements] = useState([])
  const [payments, setPayments] = useState([])
  const [refunds, setRefunds] = useState([])
  const [paymentMode, setPaymentMode] = useState({ mode: 'payhere', label: 'PayHere Sandbox' })
  const [demoPayment, setDemoPayment] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [notes, setNotes] = useState([])
  const [tickets, setTickets] = useState([])
  const [profile, setProfile] = useState({ name: '', email: '', town: '', phone: '' })
  const [otp, setOtp] = useState('')
  const [wizard, setWizard] = useState(emptyWizard)
  const [ticket, setTicket] = useState({ subject: '', message: '', priority: 'NORMAL' })
  const [complaint, setComplaint] = useState({ subject: '', description: '' })
  const [submittedComplaints, setSubmittedComplaints] = useState([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [serviceSearch, setServiceSearch] = useState('')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [page, setPage] = useState('booking')
  const [showAllBookings, setShowAllBookings] = useState(false)

  const load = async () => {
    if (!token) return navigate('/login', { replace: true })
    try {
      const [dashboard, catalogue, planRows, entitlementRows, paymentRows, paymentModeRow, notificationRows, ticketRows, complaintRows, refundRows] = await Promise.all([
        apiRequest('/customer/dashboard', 'GET', null, token), apiRequest('/services'), apiRequest('/subscriptions'), apiRequest('/subscriptions/entitlements', 'GET', null, token), apiRequest('/payments/my', 'GET', null, token), apiRequest('/payments/mode', 'GET', null, token), apiRequest('/notifications', 'GET', null, token), apiRequest('/support/my', 'GET', null, token), apiRequest('/complaints/my', 'GET', null, token), apiRequest('/refunds/my', 'GET', null, token),
      ])
      setData(dashboard); setProfile({ name: dashboard.profile.name || '', email: dashboard.profile.email || '', town: dashboard.profile.town || '', phone: dashboard.profile.phone || '' })
      setServices(catalogue); setPlans(planRows); setEntitlements(entitlementRows.entitlements || entitlementRows); setPayments(paymentRows.payments || []); setPaymentMode(paymentModeRow); setNotes(notificationRows); setTickets(ticketRows); setSubmittedComplaints(complaintRows); setRefunds(refundRows)
    } catch (error) { setMessage(error.message) }
  }
  useEffect(() => { load() }, [])
  const goPage = (next) => { setPage(next); window.scrollTo({ top: 0 }) }
  const submitProfile = async (event) => { event.preventDefault(); setBusy(true); try { await apiRequest('/profile', 'PUT', profile, token); setMessage('Profile saved.'); await load() } catch (error) { setMessage(error.message) } finally { setBusy(false) } }
  const sendOtp = async () => { try { await apiRequest('/profile/phone/send', 'POST', { phone: profile.phone }, token); setMessage('Verification code sent to your phone.') } catch (error) { setMessage(error.message) } }
  const verifyOtp = async () => { try { await apiRequest('/profile/phone/verify', 'POST', { phone: profile.phone, code: otp }, token); setMessage('Phone verified.'); await load() } catch (error) { setMessage(error.message) } }
  const wizardServices = wizard.category ? services.filter((service) => service.category_id === wizard.category.category_id) : []
  const confirmWizard = async () => { const category = wizard.category?.category_name; setBusy(true); try { const result = await apiRequest('/bookings', 'POST', { service_id: Number(wizard.service_id), booking_date: wizard.booking_date, booking_time: wizard.booking_time }, token); setWizard(emptyWizard); setDialog({ type: 'confirmed', result, category }); await load() } catch (error) { setMessage(error.message) } finally { setBusy(false) } }
  const cancelBooking = async (values) => { try { await apiRequest(`/bookings/${dialog.row.id}/cancel`, 'PUT', { confirmed: true, reason: values.reason }, token); setDialog(null); await load() } catch (error) { setMessage(error.message); setDialog(null) } }
  const showPins = async (id) => { try { const pins = await apiRequest(`/bookings/${id}/pins`, 'GET', null, token); setDialog({ type: 'pins', pins, id }) } catch (error) { setMessage(error.message) } }
  const cancelMembership = async () => { try { await apiRequest(`/subscriptions/${dialog.row.id}/cancel`, 'PUT', { confirmed: true }, token); setDialog(null); await load() } catch (error) { setMessage(error.message); setDialog(null) } }
  const setAutoRenew = async (id, auto_renew) => { try { await apiRequest(`/subscriptions/${id}/auto-renew`, 'PUT', { auto_renew }, token); await load(); setDialog((current) => current?.row?.id === id ? { ...current, row: { ...current.row, autoRenew: auto_renew } } : current) } catch (error) { setMessage(error.message) } }
  const reschedule = async (values) => { const row = dialog.row; try { await apiRequest(`/bookings/${row.id}/reschedule`, 'PUT', { booking_date: values.booking_date, booking_time: values.booking_time, reason: values.reason, confirmed: true }, token); setDialog(null); await load() } catch (error) { setMessage(error.message); setDialog(null) } }
  const startPayment = async (plan) => { setBusy(true); try { if (paymentMode.mode === 'demo') { setDemoPayment(await apiRequest('/payments/demo/order', 'POST', { plan_id: plan.id, auto_renew: false }, token)); setBusy(false); return } const order = await apiRequest('/payments/payhere/order', 'POST', { plan_id: plan.id }, token); const form = document.createElement('form'); form.method = 'POST'; form.action = order.checkoutUrl; Object.entries(order.fields).forEach(([name, value]) => { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value || ''; form.appendChild(input) }); document.body.appendChild(form); form.submit() } catch (error) { setMessage(error.message); setBusy(false) } }
  const completeDemoPayment = async (outcome) => { if (!demoPayment) return; setBusy(true); try { const result = await apiRequest(`/payments/demo/${demoPayment.payment_id}/complete`, 'POST', { outcome }, token); setMessage(result.message); setDemoPayment(null); await load() } catch (error) { setMessage(error.message) } finally { setBusy(false) } }
  const sendTicket = async (event) => { event.preventDefault(); try { await apiRequest('/support', 'POST', ticket, token); setTicket({ subject: '', message: '', priority: 'NORMAL' }); setMessage('Support ticket created.'); await load() } catch (error) { setMessage(error.message) } }
  const submitCustomRequest = async (values) => { const lines = [String(values.details || '').trim()]; if (values.preferred_date) lines.push(`Preferred date: ${values.preferred_date}`); if (values.category) lines.push(`Category: ${values.category}`); try { await apiRequest('/support', 'POST', { subject: String(values.title || '').trim(), message: lines.filter(Boolean).join('\n'), priority: 'NORMAL' }, token); setMessage('Custom request submitted — our concierge team will review it.'); setDialog(null); await load() } catch (error) { setMessage(error.message) } }
  const submitComplaint = async (event) => { event.preventDefault(); setBusy(true); try { const result = await apiRequest('/complaints', 'POST', complaint, token); setComplaint({ subject: '', description: '' }); setMessage(result.message); await load(); } catch (error) { setMessage(error.message) } finally { setBusy(false) } }
  const requestRefund = async (values) => { try { await apiRequest('/refunds', 'POST', { subscription_id: dialog.row.id, reason: values.reason || '' }, token); setMessage('Refund request submitted for review.'); setDialog(null); await load() } catch (error) { setMessage(error.message); setDialog(null) } }
  const markRead = async (id) => { try { await apiRequest(`/notifications/${id}/read`, 'PUT', {}, token); await load() } catch (error) { setMessage(error.message) } }
  if (!data) return <LoadingState title={message || 'Preparing your private member portal'} />

  const rows = [...data.upcomingBookings, ...data.pastBookings]
  // Every catalogue category gets a coin balance (zero-filled where no active
  // package covers it) so the coin bar always shows Auto / Garden / Pet.
  const coinCategories = (services.length
    ? [...new Map(services.map((service) => [service.category_id, { category_id: service.category_id, category_name: service.category_name, category_icon: service.category_icon || null }])).values()]
    : entitlements.map((item) => ({ category_id: item.category_id, category_name: item.category_name, category_icon: item.category_icon || null }))
  ).map((category) => entitlements.find((item) => item.category_id === category.category_id) || { ...category, remaining_units: 0, entitled_units: 0, used_units: 0 })
  const bookingBase = showAllBookings ? rows : data.upcomingBookings
  const searched = serviceSearch.trim() ? bookingBase.filter((row) => [row.service?.title, row.provider?.user?.name, row.provider_name, `#${row.id}`, row.bookingDate].filter(Boolean).join(' ').toLowerCase().includes(serviceSearch.trim().toLowerCase())) : bookingBase
  const statusCounts = searched.reduce((counts, row) => { const key = String(row.status).toLowerCase(); counts[key] = (counts[key] || 0) + 1; return counts }, {})
  const tableRows = serviceFilter === 'all' ? searched : searched.filter((row) => String(row.status).toLowerCase() === serviceFilter)
  const filteredPayments = paymentFilter === 'all' ? payments : payments.filter((payment) => String(payment.status).toLowerCase() === paymentFilter)
  const planKind = (plan) => plan.entitlements?.length > 1 ? 'Combo package' : 'Individual package'
  const renewalCopy = (plan) => plan.type?.toLowerCase().includes('recurr') ? 'Recurring every 30 days' : 'One-time package'
  const combos = plans.filter((plan) => plan.entitlements?.length > 1)
  const singles = plans.filter((plan) => !(plan.entitlements?.length > 1))
  const subCoinMap = {}
  entitlements.forEach((item) => { item.subscriptions?.forEach((sub) => { if (!subCoinMap[sub.subscription_id]) subCoinMap[sub.subscription_id] = []; subCoinMap[sub.subscription_id].push({ name: item.category_name, icon: item.category_icon, remaining: sub.remaining_units, units: sub.units }) }) })
  const categories = services.length ? Object.values(services.reduce((map, service) => { if (service.category && !map[service.category.id]) map[service.category.id] = service.category; return map }, {})) : []
  const firstName = profile.name?.split(' ')[0] || 'member'
  const meta = PAGE_META[page] || PAGE_META.booking
  const heroTitle = page === 'booking' ? `Welcome back, ${firstName}.` : { plans: 'Care, on your terms.', support: 'We are here when you need us.', profile: 'Your Luxora details.' }[page]
  const memberSince = data.profile?.createdAt ? `Member since ${new Date(data.profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · Your Luxora coins` : 'Your Luxora coins'
  const wizardService = services.find((service) => service.id === Number(wizard.service_id))
  const planCard = (plan) => <article className="package-card" key={plan.id}><div><Status>{planKind(plan)}</Status><h3>{plan.title}</h3><p>{plan.description || 'A considered Luxora service package.'}</p></div><ul>{plan.entitlements?.map((item) => <li key={item.category_name}><span>{item.category_name}</span><b className="coin-inline"><Coin size={12} /> {item.units} coins</b></li>)}</ul><div className="package-card-footer"><span><b>LKR {Number(plan.priceMonthly).toLocaleString()}</b><small>{plan.durationDays} days · {renewalCopy(plan)}</small></span><button className="ui-button ui-button--secondary" disabled={busy || plan.active === false} onClick={() => setSelectedPlan(plan)}>View package</button></div></article>

  return <PortalShell role="Customer" userName={profile.name} title={meta.title} heroTitle={heroTitle} subtitle={meta.subtitle} notice={message} activeId={page} onNavigate={goPage} onSignOut={() => { sessionStorage.clear(); navigate('/login') }} navItems={[{ id: 'booking', label: 'Booking' }, { id: 'plans', label: 'Subscription Plans' }, { id: 'support', label: 'Support' }, { id: 'profile', label: 'Profile' }]}>

    {page === 'booking' && <>
      <Panel id="booking" className="customer-credit-summary"><p className="portal-kicker">{memberSince}</p>
        <div className="coin-bar">{coinCategories.length ? coinCategories.map((item) => <span key={item.category_id} className={`coin-pill ${item.remaining_units > 0 ? '' : 'is-empty'}`} title={`${item.remaining_units} of ${item.entitled_units} ${item.category_name} coins remaining`}><CategoryIcon icon={item.category_icon} name={item.category_name} size={15} /> {item.category_name} <b><Coin size={13} /> ×{item.remaining_units}</b></span>) : <span className="coin-pill is-empty"><Coin size={15} /> No coins yet</span>}</div>
        <div className="credit-summary-grid">{coinCategories.length ? coinCategories.map((item) => <div key={item.category_id}><span><CategoryIcon icon={item.category_icon} name={item.category_name} size={15} /> {item.category_name}</span><strong>{item.remaining_units}</strong><small>of {item.entitled_units} coins · {item.used_units || 0} used</small></div>) : <EmptyState title="No coins yet">Add a package below to start collecting Luxora coins.</EmptyState>}</div>
        <p className="coin-hint">1 coin = 1 service booking in that category. Coins come with your packages.</p>
      </Panel>

      <Panel className="customer-packages"><div className="section-heading"><div><p className="portal-kicker">Membership</p><h2>Active packages ({data.activeSubscriptions.length})</h2></div><button className="ui-button ui-button--secondary" onClick={() => goPage('plans')}>＋ Add a package →</button></div>
        <div className="membership-card-grid">{data.activeSubscriptions.length ? data.activeSubscriptions.map((subscription) => <article className="membership-card membership-card--clickable" key={subscription.id} onClick={() => setDialog({ type: 'packageDetails', row: subscription })}><div><Status tone={String(subscription.status).toLowerCase()}>{subscription.status}</Status><h3>{subscription.plan.title}</h3><p>Active until {new Date(subscription.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p><div className="coin-bar membership-coins">{(subCoinMap[subscription.id] || []).map((coin) => <span key={coin.name} className={`coin-pill ${coin.remaining > 0 ? '' : 'is-empty'}`}><CategoryIcon icon={coin.icon} name={coin.name} size={13} /> {coin.name} <b><Coin size={11} /> ×{coin.remaining}</b></span>)}</div></div><small className="membership-manage">Manage package →</small></article>) : <EmptyState title="Your membership begins here">Add a package to unlock Luxora services and start collecting coins.</EmptyState>}</div>
      </Panel>

      <div className="booking-columns">
        <Panel className="booking-workspace"><p className="portal-kicker">Concierge booking · 01 Service · 02 Date & time · 03 Confirmation</p><h2>Book your next service</h2>
          <div className="booking-wizard">
            <div className="wizard-steps"><span className={wizard.step === 1 ? 'is-active' : ''}>01 · Category</span><span className={wizard.step === 2 ? 'is-active' : ''}>02 · Date & time</span><span className={wizard.step === 3 ? 'is-active' : ''}>03 · Confirm</span></div>
            {wizard.step === 1 && (entitlements.length
              ? <div className="wizard-category-grid">{coinCategories.map((item) => { const bookable = item.remaining_units > 0; return (<button key={item.category_id} type="button" aria-disabled={!bookable} className={`wizard-category ${wizard.category?.category_id === item.category_id ? 'is-selected' : ''}`} onClick={() => (bookable ? setWizard({ ...wizard, category: item, service_id: '' }) : setDialog({ type: 'insufficientCoins', category: item }))}><i aria-hidden="true"><CategoryIcon icon={item.category_icon} name={item.category_name} size={24} /></i><b><span className="coin-inline"><Coin size={14} /> {item.category_name}</span></b><small>{bookable ? `${item.remaining_units} of ${item.entitled_units} coins available` : 'No coins left in this category'}</small></button>)})}</div>
              : <EmptyState title="No coins available">Add a package to collect Luxora coins.</EmptyState>)}
            {wizard.step === 2 && <div className="luxora-form booking-form">
              <label><span>Service</span><select value={wizard.service_id} onChange={(event) => setWizard({ ...wizard, service_id: event.target.value })}><option value="">Select a service</option>{wizardServices.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select></label>
              <label><span>Preferred date</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={wizard.booking_date} onChange={(event) => setWizard({ ...wizard, booking_date: event.target.value })} /></label>
              <label><span>Preferred time</span><input type="time" value={wizard.booking_time} onChange={(event) => setWizard({ ...wizard, booking_time: event.target.value })} /></label>
            </div>}
            {wizard.step === 3 && <div className="wizard-review">
              <div><span>Service</span><b>{wizardService?.title || '—'}</b></div>
              <div><span>Category</span><b>{wizard.category?.category_name}</b></div>
              <div><span>Date</span><b>{wizard.booking_date ? new Date(`${wizard.booking_date}T00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}</b></div>
              <div><span>Time</span><b>{wizard.booking_time || '—'}</b></div>
              <div><span>Coins after booking</span><b>{wizard.category ? `${wizard.category.remaining_units - 1} ${wizard.category.category_name} coins remaining` : '—'}</b></div>
            </div>}
            <div className="wizard-actions">
              {wizard.step > 1 && <button className="ui-button ui-button--text" onClick={() => setWizard({ ...wizard, step: wizard.step - 1 })}>← Back</button>}
              {wizard.step === 1 && wizard.category && <button className="ui-button ui-button--primary" onClick={() => setWizard({ ...wizard, step: 2 })}>Continue →</button>}
              {wizard.step === 2 && <button className="ui-button ui-button--primary" disabled={!wizard.service_id || !wizard.booking_date || !wizard.booking_time} onClick={() => setWizard({ ...wizard, step: 3 })}>Review booking →</button>}
              {wizard.step === 3 && <button className="ui-button ui-button--primary" disabled={busy} onClick={confirmWizard}>Confirm service ✓</button>}
            </div>
          </div>
        </Panel>

        <Panel className="bookings-panel"><div className="section-heading"><div><p className="portal-kicker">Concierge schedule</p><h2>{showAllBookings ? 'All bookings' : 'Active bookings'}</h2></div><button className="ui-button ui-button--secondary" onClick={() => setShowAllBookings(!showAllBookings)}>{showAllBookings ? 'Upcoming only' : 'View all →'}</button></div>
          <div className="bookings-toolbar"><SearchInput value={serviceSearch} onChange={setServiceSearch} placeholder="Search service, provider or #id" ariaLabel="Search bookings" /><FilterPills ariaLabel="Filter by status" value={serviceFilter} onChange={setServiceFilter} options={[{ value: 'all', label: 'All', count: searched.length }, ...Object.entries(statusCounts).map(([status, count]) => ({ value: status, label: status.replace('_', ' '), count }))]} /></div>
          <div className="bookings-table-wrap"><table className="bookings-table">
            <thead><tr><th>#</th><th>Category</th><th>Service</th><th>Provider</th><th>When</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>{tableRows.length ? tableRows.map((row) => <tr key={row.id}>
              <td><b>#{row.id}</b></td>
              <td><span className="cat-cell"><CategoryIcon icon={row.service?.category?.icon} name={row.service?.category?.name} size={15} />{row.service?.category?.name || '—'}</span></td>
              <td>{row.service?.title || 'Luxora service'}</td>
              <td>{row.provider?.user?.name || row.provider_name || <em>Awaiting provider</em>}</td>
              <td>{new Date(row.bookingDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {row.bookingTime}</td>
              <td><Status tone={String(row.status).toLowerCase()}>{row.status}</Status></td>
              <td><div className="table-actions">{!['CANCELLED', 'COMPLETED'].includes(row.status) && <button className="ui-button ui-button--text" onClick={() => showPins(row.id)}>PINs</button>}{['PENDING', 'ASSIGNED'].includes(row.status) && <><button className="ui-button ui-button--text" onClick={() => setDialog({ type: 'reschedule', row })}>Reschedule</button><button className="ui-button ui-button--text danger" onClick={() => setDialog({ type: 'cancelBooking', row })}>Cancel</button></>}</div></td>
            </tr>) : <tr><td colSpan={7}><EmptyState title="No bookings in this view">Book your next service with the concierge wizard.</EmptyState></td></tr>}</tbody>
          </table></div>
        </Panel>
      </div>

      <Panel className="custom-requests"><div className="section-heading"><div><p className="portal-kicker">Personal concierge</p><h2>Custom requests ({tickets.length})</h2></div><button className="ui-button ui-button--primary" onClick={() => setDialog({ type: 'customRequest' })}>＋ Submit custom request</button></div>
        <p className="quiet-copy">Request specialized estate care, bespoke valet or unique service arrangements — our concierge team reviews every request personally.</p>
        {tickets.length ? <div className="request-grid">{tickets.map((item) => <article className="request-card" key={item.id}><header><small>REQ-{String(item.id).padStart(3, '0')}</small><Status tone={TICKET_TONE[item.status] || ''}>{String(item.status).replace('_', ' ')}</Status></header><h3>{item.subject}</h3><p>{item.message}</p><small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}{item.adminResponse ? ` · Concierge: ${item.adminResponse}` : ''}</small></article>)}</div> : <EmptyState title="No custom requests yet">Tell us what you need and our concierge team will arrange it.</EmptyState>}
      </Panel>
    </>}

    {page === 'plans' && <>
      <Panel id="plans" className="package-workspace"><div className="section-heading"><div><p className="portal-kicker">Packages & memberships</p><h2>Exceptional care, selected for you.</h2></div><Status tone={paymentMode.mode === 'demo' ? 'available' : ''}>{paymentMode.mode === 'demo' ? 'Demo payment' : paymentMode.label}</Status></div>
        <div className="plan-group"><h3>Combo packages</h3><div className="package-grid">{combos.length ? combos.map(planCard) : <EmptyState title="No combos available">Please return shortly to see available Luxora care.</EmptyState>}</div></div>
        <div className="plan-group"><h3>Single-care packages</h3><div className="package-grid">{singles.length ? singles.map(planCard) : <EmptyState title="No single packages available">Please return shortly to see available Luxora care.</EmptyState>}</div></div>
        {selectedPlan && <div className="purchase-drawer"><div><p className="portal-kicker">Selected package</p><h3>{selectedPlan.title}</h3><p>{selectedPlan.entitlements?.map((item) => `${item.category_name}: ${item.units} coins`).join(' · ')}</p></div><b>LKR {Number(selectedPlan.priceMonthly).toLocaleString()}</b><button className="ui-button ui-button--primary" disabled={busy} onClick={() => startPayment(selectedPlan)}>{paymentMode.mode === 'demo' ? 'Open demo checkout' : 'Continue to checkout'}</button><button className="ui-button ui-button--text" onClick={() => setSelectedPlan(null)}>Close</button></div>}
        {demoPayment && <div className="demo-checkout"><div><p className="portal-kicker">Demo payment</p><h3>{demoPayment.plan.title}</h3><p>{demoPayment.plan.currency} {demoPayment.plan.amount} · No real money is charged.</p></div><div><button className="ui-button ui-button--primary" disabled={busy} onClick={() => completeDemoPayment('success')}>Simulate success</button><button className="ui-button ui-button--secondary" disabled={busy} onClick={() => completeDemoPayment('failure')}>Simulate failure</button><button className="ui-button ui-button--text" disabled={busy} onClick={() => completeDemoPayment('cancel')}>Cancel</button></div></div>}
      </Panel>
      <Panel className="transactions-panel"><div className="section-heading"><div><p className="portal-kicker">Billing</p><h2>Transaction history</h2></div></div>
        <FilterPills ariaLabel="Filter payments" value={paymentFilter} onChange={setPaymentFilter} options={[{ value: 'all', label: 'All', count: payments.length }, ...['completed', 'refunded', 'failed', 'pending'].filter((status) => payments.some((payment) => String(payment.status).toLowerCase() === status)).map((status) => ({ value: status, label: status, count: payments.filter((payment) => String(payment.status).toLowerCase() === status).length }))]} />
        <div className="payment-history">{filteredPayments.length ? filteredPayments.map((payment) => <p key={payment.id}><Status tone={String(payment.status).toLowerCase()}>{payment.status}</Status><span>{payment.plan?.title || 'Luxora package'} · {payment.gateway}</span><b>{payment.expectedCurrency} {Number(payment.expectedAmount).toLocaleString()}</b><button className="ui-button ui-button--text" onClick={() => setDialog({ type: 'receipt', row: payment })}>Receipt</button></p>) : <p className="quiet-copy">No payments match this filter.</p>}</div>
      </Panel>
    </>}

    {page === 'support' && <Panel id="support" className="support-workspace"><p className="portal-kicker">Help & support</p><h2>We are here when you need us.</h2>
      <div className="support-columns">
        <div><h3>Refunds</h3>{refunds.length ? refunds.map((item) => <article className="support-record" key={item.id}><Status tone={item.refundRequest?.status?.toLowerCase() || (item.eligible ? 'available' : 'cancelled')}>{item.refundRequest?.status || (item.eligible ? 'Eligible' : 'Not eligible')}</Status><b>{item.plan.title}</b><p>{item.used_units} coins used · {item.plan.entitlements.map((e) => `${e.category.name}: ${e.units}`).join(' · ')}</p>{item.eligible && <button className="ui-button ui-button--secondary" onClick={() => setDialog({ type: 'refund', row: item })}>Request refund</button>}{item.refundRequest?.adminNote && <small>Note: {item.refundRequest.adminNote}</small>}</article>) : <EmptyState title="No purchases to review">Your refunds and package purchases will appear here.</EmptyState>}</div>
        <div><h3>Customer service</h3><form className="luxora-form" onSubmit={sendTicket}><label><span>Subject</span><input value={ticket.subject} onChange={(e) => setTicket({ ...ticket, subject: e.target.value })} required /></label><label><span>How can we help?</span><textarea value={ticket.message} onChange={(e) => setTicket({ ...ticket, message: e.target.value })} required /></label><label><span>Priority</span><select value={ticket.priority} onChange={(e) => setTicket({ ...ticket, priority: e.target.value })}><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select></label><button className="ui-button ui-button--primary">Send request</button></form>{tickets.map((item) => <p className="support-ticket" key={item.id}><Status tone={TICKET_TONE[item.status] || ''}>{String(item.status).replace('_', ' ')}</Status> {item.subject}{item.adminResponse ? ` — ${item.adminResponse}` : ''}</p>)}</div>
      </div>
      <div className="complaints-block"><h3>Complaints</h3><form className="luxora-form" onSubmit={submitComplaint}><input placeholder="Subject" value={complaint.subject} onChange={(e) => setComplaint({ ...complaint, subject: e.target.value })} required maxLength={150} /><textarea placeholder="Describe the issue" value={complaint.description} onChange={(e) => setComplaint({ ...complaint, description: e.target.value })} required maxLength={2000} /><button className="ui-button ui-button--secondary" disabled={busy}>Submit complaint</button></form>{submittedComplaints.map((item) => <p className="support-ticket" key={item.id}><Status tone={item.status?.toLowerCase()}>{item.status}</Status> {item.subject}{item.admin_note ? ` — ${item.admin_note}` : ''}</p>)}</div>
    </Panel>}

    {page === 'profile' && <Panel id="profile" className="profile-workspace"><p className="portal-kicker">Profile & preferences</p><h2>Your Luxora details</h2><form className="luxora-form profile-form" onSubmit={submitProfile}><label><span>Name</span><input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></label><label><span>Email</span><input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required /></label><label><span>Service town</span><input value={profile.town} onChange={(e) => setProfile({ ...profile, town: e.target.value })} /></label><label><span>Phone (E.164)</span><input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+94771234567" /></label><button className="ui-button ui-button--primary" disabled={busy}>Save profile</button></form><div className="phone-verification"><button className="ui-button ui-button--secondary" onClick={sendOtp}>Send verification code</button><input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter code" aria-label="Verification code" /><button className="ui-button ui-button--secondary" onClick={verifyOtp}>Verify phone</button></div><div className="customer-activity"><h3>Notifications</h3>{notes.length ? notes.map((note) => <button key={note.id} className={`notification-row ${note.read ? '' : 'is-unread'}`} onClick={() => !note.read && markRead(note.id)}>{note.message}<small>{note.read ? 'Read' : 'Mark as read'}</small></button>) : <p className="quiet-copy">There are no new notifications.</p>}</div></Panel>}

    {dialog?.type === 'insufficientCoins' && <Modal kicker="Not enough coins" title={`No ${dialog.category.category_name} coins left`} onClose={() => setDialog(null)} footer={<>
      <button className="ui-button ui-button--text" onClick={() => setDialog(null)}>Cancel</button>
      <button className="ui-button ui-button--primary" onClick={() => { setDialog(null); goPage('plans') }}>Browse packages →</button>
    </>}>
      <div style={{ display: 'grid', placeItems: 'center', gap: 12, padding: '10px 0 4px' }}>
        <Coin size={46} />
        <p style={{ margin: 0, color: '#d6d4cc', fontSize: 13.5, lineHeight: 1.6, textAlign: 'center' }}>Each {dialog.category.category_name} service booking uses one coin. Top up with a package to keep your concierge rhythm going.</p>
      </div>
    </Modal>}
    {dialog?.type === 'confirmed' && <Modal kicker="Booking confirmed" title="Your service is reserved" onClose={() => setDialog(null)} footer={<button className="ui-button ui-button--primary" onClick={() => setDialog(null)}>Great, got it</button>}>
      <p>Booking <b>#{dialog.result.booking_id}</b> is <b>{String(dialog.result.status).toLowerCase()}</b>. Keep these PINs handy — your provider will ask for them.</p>
      {dialog.result.entitlement && <p className="coin-used-note"><Coin size={14} /> 1 {dialog.category} coin used · {dialog.result.entitlement.remaining_units} left on {dialog.result.entitlement.plan_title}</p>}
      <div className="pin-display"><div><span>Start PIN</span><b>{dialog.result.start_pin}</b></div><div><span>Completion PIN</span><b>{dialog.result.completion_pin}</b></div></div>
    </Modal>}
    {dialog?.type === 'pins' && <Modal kicker={`Booking #${dialog.id}`} title="Your verification PINs" onClose={() => setDialog(null)} footer={<button className="ui-button ui-button--primary" onClick={() => setDialog(null)}>Close</button>}>
      <div className="pin-display"><div><span>Start PIN</span><b>{dialog.pins.start_pin}</b></div><div><span>Completion PIN</span><b>{dialog.pins.completion_pin}</b></div></div>
    </Modal>}
    {dialog?.type === 'packageDetails' && (() => { const subscription = dialog.row; const coins = subCoinMap[subscription.id] || []; return <Modal kicker="Active package" title={subscription.plan.title} onClose={() => setDialog(null)} footer={<>
      <button className="ui-button ui-button--text" onClick={() => setDialog(null)}>Close</button>
      <button className="ui-button ui-button--text danger" onClick={() => setDialog({ type: 'refund', row: subscription })}>Request refund</button>
      <button className="ui-button ui-button--secondary" onClick={() => setAutoRenew(subscription.id, !subscription.autoRenew)}>{subscription.autoRenew ? 'Pause renewal' : 'Enable renewal'}</button>
      <button className="ui-button ui-button--danger" onClick={() => setDialog({ type: 'cancelMembership', row: subscription })}>Cancel package</button>
    </>}>
      <div className="package-detail">
        <p><Status tone={String(subscription.status).toLowerCase()}>{subscription.status}</Status></p>
        <dl>
          <div><dt>Active until</dt><dd>{new Date(subscription.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
          <div><dt>Price</dt><dd>LKR {Number(subscription.plan.priceMonthly).toLocaleString()} / month</dd></div>
          <div><dt>Renewal</dt><dd>{subscription.autoRenew ? 'Enabled' : 'Paused'}</dd></div>
        </dl>
        <p className="portal-kicker">Coins in this package</p>
        <div className="coin-bar membership-coins">{coins.length ? coins.map((coin) => <span key={coin.name} className={`coin-pill ${coin.remaining > 0 ? '' : 'is-empty'}`}><CategoryIcon icon={coin.icon} name={coin.name} size={14} /> {coin.name} <b><Coin size={12} /> ×{coin.remaining}</b></span>) : <span className="coin-pill is-empty"><Coin size={14} /> No coins</span>}</div>
        <p className="coin-hint">Refunds are available for completely unused packages.</p>
      </div>
    </Modal> })()}
    {dialog?.type === 'customRequest' && <PromptDialog kicker="Personal concierge" title="Submit a custom request" submitLabel="Send request" fields={[
      { name: 'title', label: 'Request title', required: true, initial: '', placeholder: 'e.g. Full estate detailing before the weekend', maxLength: 120, full: true },
      { name: 'category', label: 'Category', type: 'select', initial: categories[0]?.name || '', options: categories.map((category) => ({ value: category.name, label: category.name })), full: true },
      { name: 'preferred_date', label: 'Preferred date (optional)', type: 'date', initial: '' },
      { name: 'details', label: 'What do you need?', type: 'textarea', required: true, initial: '', placeholder: 'Tell us about the service you have in mind…', maxLength: 2000, rows: 4, full: true },
    ]} onSubmit={submitCustomRequest} onClose={() => setDialog(null)} />}
    {dialog?.type === 'cancelBooking' && <PromptDialog kicker={`Booking #${dialog.row.id}`} title="Cancel this service?" submitLabel="Cancel booking" fields={[{ name: 'reason', label: 'Reason (optional)', type: 'textarea', initial: '', placeholder: 'Tell us why you are cancelling', maxLength: 500, full: true }]} onSubmit={cancelBooking} onClose={() => setDialog(null)} />}
    {dialog?.type === 'cancelMembership' && <ConfirmDialog danger title="Cancel membership?" message={`Your ${dialog.row.plan.title} membership will end and remaining credits will lapse. This cannot be undone.`} confirmLabel="Cancel membership" onConfirm={cancelMembership} onClose={() => setDialog(null)} />}
    {dialog?.type === 'reschedule' && <PromptDialog kicker={`Booking #${dialog.row.id}`} title="Reschedule service" submitLabel="Reschedule" fields={[{ name: 'booking_date', label: 'New date', type: 'date', required: true, initial: dialog.row.bookingDate }, { name: 'booking_time', label: 'New time', type: 'time', required: true, initial: dialog.row.bookingTime }, { name: 'reason', label: 'Reason', type: 'textarea', required: true, initial: '', placeholder: 'Share a short reason (min 3 characters)', maxLength: 500, full: true }]} onSubmit={reschedule} onClose={() => setDialog(null)} />}
    {dialog?.type === 'refund' && <PromptDialog kicker={dialog.row.plan.title} title="Request a refund" submitLabel="Submit request" fields={[{ name: 'reason', label: 'Reason (optional)', type: 'textarea', initial: '', placeholder: 'Anything the team should know?', maxLength: 1000, full: true, hint: 'Only completely unused packages are eligible for refund.' }]} onSubmit={requestRefund} onClose={() => setDialog(null)} />}
    {dialog?.type === 'receipt' && (() => { const payment = dialog.row; return <Modal printTarget onClose={() => setDialog(null)} footer={<button className="ui-button ui-button--primary" onClick={() => window.print()}>Print receipt</button>}>
      <div className="ui-receipt">
        <div className="ui-receipt-head"><div><b>LUXORA</b><small>Home concierge · Tax invoice</small></div><small>#{payment.gatewayOrderId || `PAY-${payment.id}`}<br />{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</small></div>
        <dl>
          <div><dt>Customer</dt><dd>{profile.name}</dd></div>
          <div><dt>Email</dt><dd>{profile.email}</dd></div>
          <div><dt>Package</dt><dd>{payment.plan?.title || 'Luxora package'}</dd></div>
          <div><dt>Gateway</dt><dd>{payment.gateway}</dd></div>
          {payment.subscription?.startDate && <div><dt>Coverage</dt><dd>{new Date(payment.subscription.startDate).toLocaleDateString()} – {payment.subscription.endDate ? new Date(payment.subscription.endDate).toLocaleDateString() : ''}</dd></div>}
          <div><dt>Status</dt><dd>{String(payment.status).toLowerCase()}</dd></div>
        </dl>
        <div className="ui-receipt-total"><span>Total paid</span><b>{payment.expectedCurrency} {Number(payment.capturedAmount ?? payment.expectedAmount).toLocaleString()}</b></div>
      </div>
    </Modal> })()}
  </PortalShell>
}
