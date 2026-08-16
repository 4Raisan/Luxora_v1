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
    return { name: 'Tariq Hassan', title: 'Super Admin', email: 'tariq.hassan@luxora.com' }
  })

  const [activeNav, setActiveNav] = useState('dashboard')
  const [stats, setStats] = useState({ totalUsers: 12841, totalProviders: 1092, totalBookings: 4230, totalRevenue: 81400 })
  const [providers, setProviders] = useState([])
  const [bookings, setBookings] = useState([])
  const [complaints, setComplaints] = useState([])
  const [promotions, setPromotions] = useState([])
  const [users, setUsers] = useState([])
  const [supportTickets, setSupportTickets] = useState([])
  const [token] = useState(localStorage.getItem('luxora_token') || sessionStorage.getItem('token') || '')

  const [newPromo, setNewPromo] = useState({ title: '', code: '', discount: '' })

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
    } catch (err) {
      // Fallback data matching Figma design specifications (No emojis)
      setStats({ totalUsers: 12841, totalProviders: 1092, totalBookings: 4230, totalRevenue: 81400 })
      setUsers([
        { id: 'USR-001', name: 'Sofia Marin', email: 'sofia@luxora.com', role: 'Customer', registered: '2026-01-12', plan: 'Combo Luxury Suite' },
        { id: 'USR-002', name: 'Marcus Webb', email: 'marcus@luxora.com', role: 'Customer', registered: '2026-02-05', plan: 'Single Auto Elite' },
        { id: 'USR-003', name: 'Priya Nair', email: 'priya@luxora.com', role: 'Customer', registered: '2026-02-18', plan: 'Single Garden Oasis' },
        { id: 'USR-004', name: 'James Okafor', email: 'james@luxora.com', role: 'Customer', registered: '2026-03-01', plan: 'Combo Luxury Suite' },
        { id: 'USR-005', name: 'Kamal Perera', email: 'kamal@luxora.com', role: 'Provider', registered: '2026-01-02', category: 'Garden Care' },
        { id: 'USR-006', name: 'Nimal Silva', email: 'nimal@luxora.com', role: 'Provider', registered: '2026-01-15', category: 'Auto Care' },
      ])
      setProviders([
        { id: 1, name: 'Kamal Perera', email: 'kamal@luxora.com', category: 'Garden Care', nic: '198812345678', kyc_status: 'approved', rating: '4.9 / 5.0' },
        { id: 2, name: 'Nimal Silva', email: 'nimal@luxora.com', category: 'Auto Care', nic: '199287654321', kyc_status: 'pending', rating: '4.8 / 5.0' },
        { id: 3, name: 'Sunil Fernando', email: 'sunil@luxora.com', category: 'Pet Care', nic: '199045678912', kyc_status: 'pending', rating: '5.0 / 5.0' },
        { id: 4, name: 'Marco Vance', email: 'marco@luxora.com', category: 'Auto Care', nic: '199512345678', kyc_status: 'approved', rating: '4.9 / 5.0' },
        { id: 5, name: 'Ashan Silva', email: 'ashan@luxora.com', category: 'Garden Care', nic: '199456789012', kyc_status: 'pending', rating: '4.7 / 5.0' }
      ])
      setBookings([
        { id: 'B-001', customer: 'Sofia Marin', service: 'Deep Cleaning', status: 'CONFIRMED', color: '#4ade80', date: '2026-08-15' },
        { id: 'B-002', customer: 'Marcus Webb', service: 'Pipe Repair', status: 'IN PROGRESS', color: '#60a5fa', date: '2026-08-15' },
        { id: 'B-003', customer: 'Priya Nair', service: 'Lawn Mowing', status: 'COMPLETED', color: '#c9a84c', date: '2026-08-15' },
        { id: 'B-004', customer: 'James Okafor', service: 'Wiring Check', status: 'CANCELLED', color: '#ef4444', date: '2026-08-15' }
      ])
      setComplaints([
        { id: 'C-001', from: 'Marcus Webb', priority: 'HIGH', status: 'OPEN', statusBg: '#991b1b', priorityColor: '#ef4444', detail: 'Provider delay on arrival' },
        { id: 'C-002', from: 'Priya Nair', priority: 'MEDIUM', status: 'INVESTIGATING', statusBg: '#1e3a8a', priorityColor: '#eab308', detail: 'Clarification on lawn treatment' },
        { id: 'C-003', from: 'Sofia Marin', priority: 'HIGH', status: 'RESOLVED', statusBg: '#854d0e', priorityColor: '#ef4444', detail: 'Followed up and satisfied' },
        { id: 'C-004', from: 'James Okafor', priority: 'LOW', status: 'RESOLVED', statusBg: '#854d0e', priorityColor: '#60a5fa', detail: 'Refund inquiry processed' }
      ])
      setPromotions([
        { id: 'PR-001', code: 'LUXORA2026', title: '20% Off First Concierge Service', discount: '20%', status: 'ACTIVE' },
        { id: 'PR-002', code: 'SUMMERVIP', title: 'Complimentary Detailing Upgrade', discount: '15%', status: 'ACTIVE' },
        { id: 'PR-003', code: 'ESTATE50', title: '50% Off Garden Maintenance', discount: '50%', status: 'ACTIVE' }
      ])
      setSupportTickets([
        { id: 'TK-101', customer: 'Sofia Marin', issue: 'Billing inquiry regarding combo tier', priority: 'High', status: 'In Review' },
        { id: 'TK-102', customer: 'Marcus Webb', issue: 'Rescheduling weekend detailing', priority: 'Normal', status: 'Open' },
        { id: 'TK-103', customer: 'Priya Nair', issue: 'Requesting additional fertilizer treatment', priority: 'Low', status: 'Resolved' },
      ])
    }
  }

  const handleKyc = async (id, status) => {
    try { await apiRequest(`/admin/providers/${id}/kyc`, 'PUT', { status }, token); loadAll() }
    catch (err) {
      setProviders(prev => prev.map(p => p.id === id ? { ...p, kyc_status: status } : p))
    }
  }

  const handleComplaintStatus = (id, newStatus) => {
    const bgMap = { 'OPEN': '#991b1b', 'INVESTIGATING': '#1e3a8a', 'RESOLVED': '#854d0e' }
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: newStatus, statusBg: bgMap[newStatus] || '#854d0e' } : c))
  }

  const handleAddPromo = (e) => {
    e.preventDefault()
    if (!newPromo.code || !newPromo.title) return
    const p = { id: `PR-00${promotions.length + 1}`, code: newPromo.code.toUpperCase(), title: newPromo.title, discount: newPromo.discount || '15%', status: 'ACTIVE' }
    setPromotions([p, ...promotions])
    setNewPromo({ title: '', code: '', discount: '' })
  }

  const handleSignOut = () => {
    sessionStorage.clear()
    localStorage.removeItem('luxora_token')
    window.location.href = '/'
  }

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { id: 'users', label: 'User Management', count: 6, icon: Icons.Users },
    { id: 'providers', label: 'Providers', count: 5, icon: Icons.Building },
    { id: 'approvals', label: 'Approvals', count: 4, icon: Icons.Approvals },
    { id: 'subscriptions', label: 'Subscriptions', icon: Icons.Subscriptions },
    { id: 'bookings', label: 'Bookings', count: 2, icon: Icons.Bookings },
    { id: 'complaints', label: 'Complaints', count: 1, icon: Icons.Complaints },
    { id: 'promotions', label: 'Promotions', icon: Icons.Promotions },
    { id: 'support', label: 'Support', count: 3, icon: Icons.Support },
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
                {item.count && <span className="ad-nav__badge">{item.count}</span>}
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
            <button className="ad-topbar__notif-btn" aria-label="Notifications">
              <Icons.Bell />
              <span className="ad-notif-count">7</span>
            </button>

            <div className="ad-user-pill">
              <div className="ad-user-avatar">
                {(adminUser.name || 'Tariq Hassan').charAt(0)}
              </div>
              <div className="ad-user-info">
                <span className="ad-user-name">{adminUser.name || 'Tariq Hassan'}</span>
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
                  <h2 className="ad-metric-val">12,841</h2>
                  <span className="ad-metric-trend ad-trend--up">+8.4% <span style={{ color: '#888' }}>vs last month</span></span>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">ACTIVE PROVIDERS</span>
                    <span className="ad-metric-icon"><Icons.Building /></span>
                  </div>
                  <h2 className="ad-metric-val">1,092</h2>
                  <span className="ad-metric-trend ad-trend--up">+12.1% <span style={{ color: '#888' }}>vs last month</span></span>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">BOOKINGS MTD</span>
                    <span className="ad-metric-icon"><Icons.Bookings /></span>
                  </div>
                  <h2 className="ad-metric-val">4,230</h2>
                  <span className="ad-metric-trend ad-trend--up">+6.7% <span style={{ color: '#888' }}>vs last month</span></span>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">REVENUE MTD</span>
                    <span className="ad-metric-icon"><Icons.Revenue /></span>
                  </div>
                  <h2 className="ad-metric-val">$81,400</h2>
                  <span className="ad-metric-trend ad-trend--up">+19.2% <span style={{ color: '#888' }}>vs last month</span></span>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">OPEN COMPLAINTS</span>
                    <span className="ad-metric-icon" style={{ color: '#eab308' }}><Icons.Complaints /></span>
                  </div>
                  <h2 className="ad-metric-val" style={{ color: '#fff' }}>7</h2>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">SUPPORT TICKETS</span>
                    <span className="ad-metric-icon"><Icons.Support /></span>
                  </div>
                  <h2 className="ad-metric-val">34</h2>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">PENDING APPROVALS</span>
                    <span className="ad-metric-icon"><Icons.Hourglass /></span>
                  </div>
                  <h2 className="ad-metric-val">4</h2>
                </div>

                <div className="ad-metric-card">
                  <div className="ad-metric-top">
                    <span className="ad-metric-label">ACTIVE PROMOS</span>
                    <span className="ad-metric-icon"><Icons.Gift /></span>
                  </div>
                  <h2 className="ad-metric-val">3</h2>
                </div>
              </div>

              {/* Lower Section: Tables Grid */}
              <div className="ad-tables-grid">
                {/* Recent Bookings Table */}
                <div className="ad-table-card">
                  <h3 className="ad-table-title">RECENT BOOKINGS</h3>
                  <table className="ad-data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>CUSTOMER</th>
                        <th>SERVICE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id}>
                          <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{b.id}</td>
                          <td style={{ color: '#fff' }}>{b.customer}</td>
                          <td style={{ color: '#ccc' }}>{b.service}</td>
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
              <h3 className="ad-table-title">USER MANAGEMENT DIRECTORY</h3>
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
                      <td style={{ color: '#aaa' }}>{u.email}</td>
                      <td>
                        <span className="ad-badge-status" style={{
                          borderColor: u.role === 'Customer' ? '#60a5fa' : '#c9a84c',
                          color: u.role === 'Customer' ? '#60a5fa' : '#c9a84c'
                        }}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ color: '#888' }}>{u.registered}</td>
                      <td style={{ color: '#ccc' }}>{u.plan || u.category || 'Standard'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeNav === 'providers' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">SERVICE PROVIDERS DIRECTORY</h3>
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
              <h3 className="ad-table-title">ESTATE SUBSCRIPTION TIERS</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={{ background: '#181818', padding: '1.5rem', borderRadius: '10px', border: '1px solid #282828' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em' }}>SINGLE CARE</span>
                  <h3 style={{ color: '#fff', fontSize: '1.4rem', margin: '0.4rem 0' }}>Auto Elite</h3>
                  <p style={{ color: '#c9a84c', fontSize: '1.25rem', fontWeight: 800 }}>LKR 12,000 / mo</p>
                  <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem' }}>Active Subscribers: 428</p>
                </div>
                <div style={{ background: '#181818', padding: '1.5rem', borderRadius: '10px', border: '1px solid #282828' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em' }}>SINGLE CARE</span>
                  <h3 style={{ color: '#fff', fontSize: '1.4rem', margin: '0.4rem 0' }}>Garden Oasis</h3>
                  <p style={{ color: '#c9a84c', fontSize: '1.25rem', fontWeight: 800 }}>LKR 15,000 / mo</p>
                  <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem' }}>Active Subscribers: 382</p>
                </div>
                <div style={{ background: '#181818', padding: '1.5rem', borderRadius: '10px', border: '1px solid var(--gold)' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em' }}>VIP COMBO SUITE</span>
                  <h3 style={{ color: '#fff', fontSize: '1.4rem', margin: '0.4rem 0' }}>Tri-Combo Luxury</h3>
                  <p style={{ color: '#c9a84c', fontSize: '1.25rem', fontWeight: 800 }}>LKR 32,000 / mo</p>
                  <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem' }}>Active Subscribers: 282</p>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'bookings' && (
            <div className="ad-table-card" style={{ marginTop: 0 }}>
              <h3 className="ad-table-title">ALL PLATFORM BOOKINGS</h3>
              <table className="ad-data-table">
                <thead>
                  <tr>
                    <th>BOOKING ID</th>
                    <th>CUSTOMER</th>
                    <th>SERVICE</th>
                    <th>DATE</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{b.id}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{b.customer}</td>
                      <td style={{ color: '#ccc' }}>{b.service}</td>
                      <td style={{ color: '#888' }}>{b.date || '2026-08-15'}</td>
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

              <form onSubmit={handleAddPromo} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: '#161616', padding: '1rem', borderRadius: '8px', border: '1px solid #282828' }}>
                <input
                  type="text"
                  placeholder="Promo Title (e.g. VIP Upgrade)"
                  value={newPromo.title}
                  onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })}
                  style={{ flex: 2, background: '#0a0a0a', color: '#fff', border: '1px solid #333', padding: '0.5rem 0.75rem', borderRadius: '6px' }}
                />
                <input
                  type="text"
                  placeholder="Code (e.g. LUXORA25)"
                  value={newPromo.code}
                  onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value })}
                  style={{ flex: 1, background: '#0a0a0a', color: '#fff', border: '1px solid #333', padding: '0.5rem 0.75rem', borderRadius: '6px' }}
                />
                <input
                  type="text"
                  placeholder="Discount %"
                  value={newPromo.discount}
                  onChange={(e) => setNewPromo({ ...newPromo, discount: e.target.value })}
                  style={{ flex: 1, background: '#0a0a0a', color: '#fff', border: '1px solid #333', padding: '0.5rem 0.75rem', borderRadius: '6px' }}
                />
                <button type="submit" className="ad-btn-approve" style={{ padding: '0.5rem 1.25rem' }}>+ Add Promo</button>
              </form>

              <table className="ad-data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>PROMO CODE</th>
                    <th>TITLE</th>
                    <th>DISCOUNT</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((p) => (
                    <tr key={p.id}>
                      <td style={{ color: '#888' }}>{p.id}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: 'monospace' }}>{p.code}</td>
                      <td style={{ color: '#fff' }}>{p.title}</td>
                      <td style={{ color: '#4ade80', fontWeight: 700 }}>{p.discount}</td>
                      <td>
                        <span className="ad-badge-status" style={{ borderColor: '#4ade80', color: '#4ade80' }}>
                          {p.status}
                        </span>
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
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.5rem 0' }}>Monthly Growth Metrics</h4>
                  <p style={{ color: '#888', fontSize: '0.82rem' }}>Total Users: +8.4% growth MTD</p>
                  <p style={{ color: '#888', fontSize: '0.82rem' }}>Provider Retention Rate: 98.4%</p>
                  <p style={{ color: '#888', fontSize: '0.82rem' }}>Booking Completion Rate: 96.2%</p>
                </div>
                <div style={{ background: '#161616', padding: '1.5rem', borderRadius: '10px', border: '1px solid #282828' }}>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.5rem 0' }}>Financial Summary</h4>
                  <p style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 800 }}>$81,400 USD Revenue MTD</p>
                  <p style={{ color: '#4ade80', fontSize: '0.85rem' }}>+19.2% vs previous billing cycle</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
