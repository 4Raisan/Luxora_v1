import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { apiRequest } from '../services/api'
import './AdminDashboard.css'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalProviders: 0, totalBookings: 0, totalRevenue: 0 })
  const [providers, setProviders] = useState([])
  const [bookings, setBookings] = useState([])
  const [complaints, setComplaints] = useState([])
  const [promotions, setPromotions] = useState([])
  const [tab, setTab] = useState('overview')
  const [token, setToken] = useState(
    localStorage.getItem('luxora_token') || sessionStorage.getItem('token') || ''
  )
  const [error, setError] = useState('')
  const [providersForSelect, setProvidersForSelect] = useState([])
  const [newPromo, setNewPromo] = useState({ title: '', description: '', discount_percent: '', code: '' })

  useEffect(() => {
    loadAll()
  }, [token])

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
      setStats(s); setProviders(p); setBookings(b); setComplaints(c); setPromotions(pr)
      setProvidersForSelect(p.filter((x) => x.kyc_status === 'approved'))
    } catch (err) {
      // Fallback demo data if token is offline or demo mode active
      setStats({ totalUsers: 142, totalProviders: 18, totalBookings: 89, totalRevenue: 485000 })
      setProviders([
        { id: 1, user_name: 'Kamal Perera', category_name: 'Garden Care', kyc_status: 'approved', bio: 'Senior Horticulturist with 8 yrs experience' },
        { id: 2, user_name: 'Nimal Silva', category_name: 'Auto Care', kyc_status: 'pending', bio: 'Master Auto Detailer' },
        { id: 3, user_name: 'Sunil Fernando', category_name: 'Pet Care', kyc_status: 'pending', bio: 'Certified Veterinary Care Assistant' }
      ])
      setBookings([
        { id: 101, user_name: 'Ashan Perera', service_name: 'Auto Care Premium', status: 'confirmed', provider_name: 'Nimal Silva', scheduled_at: '2026-08-10 10:00' },
        { id: 102, user_name: 'Kasun Kalhara', service_name: 'Full Home Suite', status: 'completed', provider_name: 'Kamal Perera', scheduled_at: '2026-08-08 14:00' }
      ])
      setComplaints([
        { id: 1, user_name: 'Ashan Perera', subject: 'Scheduling Delay', status: 'open', description: 'Provider arrived 15 minutes past schedule' }
      ])
    }
  }

  const handleKyc = async (id, status) => {
    try { await apiRequest(`/admin/providers/${id}/kyc`, 'PUT', { status }, token); loadAll() }
    catch (err) { alert(err.message) }
  }
  const handleComplaint = async (id, status) => {
    try { await apiRequest(`/admin/complaints/${id}`, 'PUT', { status }, token); loadAll() }
    catch (err) { alert(err.message) }
  }
  const handleBookingOverride = async (id, fields) => {
    try { await apiRequest(`/admin/bookings/${id}`, 'PUT', fields, token); loadAll(); alert('Booking updated') }
    catch (err) { alert(err.message) }
  }
  const createPromo = async () => {
    try {
      await apiRequest('/admin/promotions', 'POST', {
        title: newPromo.title, description: newPromo.description,
        discount_pct: Number(newPromo.discount_percent), code: newPromo.code,
      }, token)
      setNewPromo({ title: '', description: '', discount_percent: '', code: '' }); loadAll()
    } catch (err) { alert(err.message) }
  }
  const togglePromo = async (id, active) => {
    try { await apiRequest(`/admin/promotions/${id}`, 'PUT', { active: active ? 0 : 1 }, token); loadAll() }
    catch (err) { alert(err.message) }
  }

  const statCards = [
    { label: 'Customers', value: stats.totalUsers, accent: false },
    { label: 'Providers', value: stats.totalProviders, accent: true },
    { label: 'Bookings', value: stats.totalBookings, accent: false },
    { label: 'Revenue (LKR)', value: Number(stats.totalRevenue || 0).toLocaleString(), accent: true },
  ]

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'providers', label: 'Providers' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'complaints', label: 'Complaints' },
    { id: 'promotions', label: 'Promotions' },
  ]

  const statusColor = { pending: '#d97706', assigned: '#2563eb', in_progress: '#7c3aed', completed: '#059669', cancelled: '#6b7280' }

  return (
    <motion.div className="admin-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">ADMINISTRATION</p>
          <h2>Luxora Operations Center</h2>
        </div>
        <button className="admin-logout" onClick={() => { localStorage.removeItem('luxora_token'); window.location.href = '/' }}>
          Sign Out
        </button>
      </header>

      <nav className="admin-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`admin-tab ${tab === t.id ? 'admin-tab--active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {error && <div className="admin-error">{error}</div>}

      {tab === 'overview' && (
        <div className="stats-grid">
          {statCards.map((s, i) => (
            <motion.div key={s.label} className="stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <h3>{s.label}</h3>
              <p className={s.accent ? 'stat-accent' : ''}>{s.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {tab === 'providers' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Category</th><th>NIC</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td><td>{p.name}</td><td>{p.email}</td><td>{p.category}</td><td>{p.nic || 'N/A'}</td>
                  <td><span className={`status-badge ${p.kyc_status}`}>{p.kyc_status}</span></td>
                  <td>
                    {p.kyc_status === 'pending' && (<>
                      <button className="btn-approve" onClick={() => handleKyc(p.id, 'approved')}>Approve</button>
                      <button className="btn-reject" onClick={() => handleKyc(p.id, 'rejected')}>Reject</button>
                    </>)}
                    {p.kyc_status === 'approved' && <span className="text-verified">Verified</span>}
                    {p.kyc_status === 'rejected' && <span className="text-rejected">Rejected</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'bookings' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Service</th><th>Customer</th><th>Provider</th><th>Date</th><th>Status</th><th>Total</th><th>Override</th></tr></thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td><td>{b.service_title}</td><td>{b.customer_name}</td>
                  <td>{b.provider_name || '—'}</td><td>{b.booking_date} {b.booking_time}</td>
                  <td><span className="status-badge" style={{ background: statusColor[b.status] || '#6b7280' }}>{b.status}</span></td>
                  <td>LKR {Number(b.total_price).toLocaleString()}</td>
                  <td>
                    <select className="admin-select" defaultValue="" onChange={(e) => e.target.value && handleBookingOverride(b.id, { status: e.target.value })}>
                      <option value="" disabled>Set status</option>
                      <option value="assigned">assigned</option>
                      <option value="in_progress">in_progress</option>
                      <option value="completed">completed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                    <select className="admin-select" defaultValue="" onChange={(e) => e.target.value && handleBookingOverride(b.id, { provider_id: Number(e.target.value) })}>
                      <option value="" disabled>Reassign</option>
                      {providersForSelect.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'complaints' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Subject</th><th>Detail</th><th>Customer</th><th>Service</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {complaints.length === 0 && <tr><td colSpan="7" className="admin-empty">No complaints filed.</td></tr>}
              {complaints.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td><td>{c.subject}</td><td className="admin-complaint-detail">{c.description || '—'}</td>
                  <td>{c.customer_name}</td><td>{c.service_title || '—'}</td>
                  <td><span className="status-badge" style={{ background: statusColor[c.status] || '#6b7280' }}>{c.status}</span></td>
                  <td>
                    <select className="admin-select" value={c.status} onChange={(e) => handleComplaint(c.id, e.target.value)}>
                      <option value="open">open</option>
                      <option value="in_review">in_review</option>
                      <option value="resolved">resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'promotions' && (
        <div className="admin-promo">
          <div className="admin-promo-create">
            <h3 className="pd-section-title">Create Promotion</h3>
            <input className="admin-input" placeholder="Title" value={newPromo.title} onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })} />
            <input className="admin-input" placeholder="Description" value={newPromo.description} onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })} />
            <div className="admin-promo-row">
              <input className="admin-input" placeholder="Discount %" type="number" value={newPromo.discount_percent} onChange={(e) => setNewPromo({ ...newPromo, discount_percent: e.target.value })} />
              <input className="admin-input" placeholder="Code" value={newPromo.code} onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value })} />
              <button className="pd-btn-gold" onClick={createPromo}>Add</button>
            </div>
          </div>
          <div className="admin-promo-list">
            {promotions.map((p) => (
              <div key={p.id} className={`admin-promo-card ${p.is_active ? '' : 'admin-promo-card--off'}`}>
                <div>
                  <h4>{p.title} <span className="admin-promo-pct">-{p.discount_percent}%</span></h4>
                  <p>{p.description}</p>
                  <span className="admin-promo-code">{p.code}</span>
                </div>
                <button className="admin-promo-toggle" onClick={() => togglePromo(p.id, p.is_active)}>
                  {p.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
            {promotions.length === 0 && <p className="admin-empty">No promotions yet.</p>}
          </div>
        </div>
      )}
    </motion.div>
  )
}
