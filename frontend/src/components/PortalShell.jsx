import { useEffect, useState } from 'react'
import './PortalShell.css'

const glyphs = ['◈', '◌', '◇', '▣', '◫', '○', '⋮', '◐', '□', '◎', '△']

export function Status({ children, tone = '' }) {
  return <span className={`portal-status ${tone}`.trim()}><i />{children}</span>
}

export function Panel({ children, className = '', id }) {
  return <section id={id} className={`portal-panel ${className}`.trim()}>{children}</section>
}

export function EmptyState({ title, children, action }) {
  return <div className="portal-empty"><span>◇</span><strong>{title}</strong><p>{children}</p>{action}</div>
}

export function LoadingState({ title = 'Preparing your workspace' }) {
  return <main className="portal-loading"><div className="portal-loader-brand">L</div><p>{title}</p><div className="portal-skeletons"><i /><i /><i /></div></main>
}

export default function PortalShell({ role, title, subtitle, userName, navItems, onSignOut, children, actions, notice }) {
  const [active, setActive] = useState(navItems[0]?.id)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => {
      const current = navItems.findLast?.((item) => document.getElementById(item.id)?.getBoundingClientRect().top < 170)
      if (current) setActive(current.id)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [navItems])
  const jump = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActive(id); setOpen(false) }
  return <div className={`portal-app portal-app--${role.toLowerCase()}`}>
    <aside className={`portal-rail ${open ? 'is-open' : ''}`} aria-label={`${role} navigation`}>
      <button className="portal-wordmark" onClick={() => jump(navItems[0]?.id)} aria-label="Go to dashboard"><b>L</b><span>Luxora</span></button>
      <p className="portal-role">{role} portal</p>
      <nav>{navItems.map((item, index) => <button key={item.id} className={active === item.id ? 'is-active' : ''} onClick={() => jump(item.id)}><i>{glyphs[index % glyphs.length]}</i><span>{item.label}</span></button>)}</nav>
      <div className="portal-rail-footer"><div className="portal-identity"><b>{(userName || role).slice(0, 1).toUpperCase()}</b><span><strong>{userName || role}</strong><small>{role}</small></span></div><button className="portal-signout" onClick={onSignOut}>Sign out</button></div>
    </aside>
    {open && <button className="portal-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <main className="portal-main">
      <header className="portal-topbar"><button className="portal-menu" onClick={() => setOpen(true)} aria-label="Open navigation">☰</button><div><p className="portal-kicker">{role} · Luxora</p><h1>{title}</h1></div><div className="portal-top-actions">{actions}<span className="portal-date">{new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span></div></header>
      <div className="portal-content"><div className="portal-intro"><div><p className="portal-kicker">Private service, beautifully managed</p><h2>{title}</h2><p>{subtitle}</p></div><div className="portal-intro-mark">L</div></div>{notice && <div role="status" className="portal-notice">{notice}</div>}{children}</div>
      <nav className="portal-mobile-nav" aria-label="Mobile navigation">{navItems.slice(0, 5).map((item, index) => <button key={item.id} className={active === item.id ? 'is-active' : ''} onClick={() => jump(item.id)}><i>{glyphs[index]}</i><span>{item.label}</span></button>)}</nav>
    </main>
  </div>
}
