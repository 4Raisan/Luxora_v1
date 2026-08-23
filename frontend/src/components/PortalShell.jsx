import { useEffect, useRef, useState } from 'react'
import './PortalShell.css'
import './PortalPolish.css'
import './PortalMotion.css'
import './PortalSpatial.css'
import { Modal } from './ui'
import { useNotifications } from '../hooks/useNotifications'

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

export default function PortalShell({ role, title, heroTitle = title, subtitle, userName, navItems, onSignOut, children, actions, notice }) {
  const isCustomer = role.toLowerCase() === 'customer'
  const notifications = useNotifications(sessionStorage.getItem('token'))
  const [active, setActive] = useState(navItems[0]?.id)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  useEffect(() => {
    const onScroll = () => {
      const current = navItems.findLast?.((item) => document.getElementById(item.id)?.getBoundingClientRect().top < 170)
      if (current) setActive(current.id)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [navItems])
  useEffect(() => {
    const root = rootRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const revealTargets = root.querySelectorAll('.portal-panel, .attention-strip, .customer-overview')
    revealTargets.forEach((target, index) => { target.classList.add('motion-reveal'); target.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 55}ms`) })
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); observer.unobserve(entry.target) } }), { threshold: 0.08, rootMargin: '0px 0px -5%' })
    revealTargets.forEach((target) => observer.observe(target))
    const magneticButtons = root.querySelectorAll('.ui-button--primary')
    const moveButton = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return
      const button = event.currentTarget
      const rect = button.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      button.style.setProperty('--magnet-x', `${(x - rect.width / 2) * 0.08}px`)
      button.style.setProperty('--magnet-y', `${(y - rect.height / 2) * 0.08}px`)
      button.style.setProperty('--button-x', `${(x / rect.width) * 100}%`)
      button.style.setProperty('--button-y', `${(y / rect.height) * 100}%`)
      button.style.setProperty('--button-tilt-x', `${((y / rect.height) - .5) * -1.4}deg`)
      button.style.setProperty('--button-tilt-y', `${((x / rect.width) - .5) * 1.8}deg`)
    }
    const leaveButton = (event) => {
      const button = event.currentTarget
      button.style.setProperty('--magnet-x', '0px')
      button.style.setProperty('--magnet-y', '0px')
      button.style.setProperty('--button-tilt-x', '0deg')
      button.style.setProperty('--button-tilt-y', '0deg')
    }
    magneticButtons.forEach((button) => { button.addEventListener('pointermove', moveButton); button.addEventListener('pointerleave', leaveButton) })
    const hero = root.querySelector('.portal-intro')
    const depthTargets = [
      root.querySelector('.customer-next'),
      root.querySelector('.package-card'),
      root.querySelector('.execution-card'),
      root.querySelector('.provider-availability'),
    ].filter(Boolean)
    depthTargets.forEach((target) => target.classList.add('spatial-surface'))
    let pointerFrame
    const moveEnvironment = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return
      cancelAnimationFrame(pointerFrame)
      pointerFrame = requestAnimationFrame(() => {
        const x = Math.round((event.clientX / window.innerWidth) * 100)
        const y = Math.round((event.clientY / window.innerHeight) * 100)
        root.style.setProperty('--mouse-x', `${x}%`)
        root.style.setProperty('--mouse-y', `${y}%`)
        root.style.setProperty('--mouse-shift-x', `${(x - 50) * .18}px`)
        root.style.setProperty('--mouse-shift-y', `${(y - 50) * .15}px`)
      })
    }
    const moveDepthSurface = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return
      const surface = event.currentTarget
      const rect = surface.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      surface.style.setProperty('--tilt-x', `${(y - .5) * -4}deg`)
      surface.style.setProperty('--tilt-y', `${(x - .5) * 4}deg`)
      surface.style.setProperty('--shadow-x', `${(x - .5) * -8}px`)
      surface.style.setProperty('--surface-x', `${x * 100}%`)
      surface.style.setProperty('--surface-y', `${y * 100}%`)
    }
    const leaveDepthSurface = (event) => {
      event.currentTarget.style.setProperty('--tilt-x', '0deg')
      event.currentTarget.style.setProperty('--tilt-y', '0deg')
      event.currentTarget.style.setProperty('--shadow-x', '0px')
    }
    const updateScrollProgress = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight
      root.style.setProperty('--scroll-progress', String(height > 0 ? Math.min(1, window.scrollY / height) : 0))
    }
    let frame
    const moveHero = (event) => { if (!hero || event.pointerType !== 'mouse') return; cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { const rect = hero.getBoundingClientRect(); hero.style.setProperty('--hero-x', `${((event.clientX - rect.left) / rect.width - .5) * 7}px`); hero.style.setProperty('--hero-y', `${((event.clientY - rect.top) / rect.height - .5) * 5}px`) }) }
    const leaveHero = () => { hero?.style.setProperty('--hero-x', '0px'); hero?.style.setProperty('--hero-y', '0px') }
    root.addEventListener('pointermove', moveEnvironment)
    depthTargets.forEach((target) => { target.addEventListener('pointermove', moveDepthSurface); target.addEventListener('pointerleave', leaveDepthSurface) })
    hero?.addEventListener('pointermove', moveHero); hero?.addEventListener('pointerleave', leaveHero); updateScrollProgress(); window.addEventListener('scroll', updateScrollProgress, { passive: true })
    return () => {
      observer.disconnect()
      magneticButtons.forEach((button) => { button.removeEventListener('pointermove', moveButton); button.removeEventListener('pointerleave', leaveButton) })
      depthTargets.forEach((target) => { target.removeEventListener('pointermove', moveDepthSurface); target.removeEventListener('pointerleave', leaveDepthSurface); target.classList.remove('spatial-surface') })
      root.removeEventListener('pointermove', moveEnvironment)
      hero?.removeEventListener('pointermove', moveHero); hero?.removeEventListener('pointerleave', leaveHero); window.removeEventListener('scroll', updateScrollProgress); cancelAnimationFrame(frame); cancelAnimationFrame(pointerFrame)
    }
  }, [role, children])
  const jump = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActive(id); setOpen(false) }
  return <div ref={rootRef} className={`portal-app portal-app--${role.toLowerCase()}`}>
    <div className="portal-environment" aria-hidden="true"><i /><i /><i /></div>
    <aside className={`portal-rail ${isCustomer ? 'portal-rail--customer' : ''} ${open ? 'is-open' : ''}`} aria-label={`${role} navigation`}>
      <button className="portal-wordmark" onClick={() => jump(navItems[0]?.id)} aria-label="Go to dashboard"><b>L</b><span>Luxora</span></button>
      <p className="portal-role">{role} portal</p>
      <nav>{navItems.map((item, index) => <button key={item.id} className={active === item.id ? 'is-active' : ''} onClick={() => jump(item.id)}><i>{glyphs[index % glyphs.length]}</i><span>{item.label}</span></button>)}</nav>
    </aside>
    {open && <button className="portal-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <main className="portal-main">
      <header className={`portal-topbar ${isCustomer ? 'portal-topbar--customer' : ''}`}>
        <button className="portal-menu" onClick={() => setOpen(true)} aria-label="Open navigation">☰</button>
        {isCustomer && <button className="portal-header-brand" onClick={() => jump(navItems[0]?.id)} aria-label="Go to customer overview"><b>L</b><span>Luxora</span><em>Customer portal</em></button>}
        <div className="portal-title-block"><p className="portal-kicker">{role} · Luxora</p><h1>{title}</h1></div>
        {isCustomer && <nav className="portal-header-nav" aria-label="Customer sections">{navItems.map((item) => <button key={item.id} className={active === item.id ? 'is-active' : ''} onClick={() => jump(item.id)}>{item.label}</button>)}</nav>}
        <div className="portal-top-actions">{actions}<button className="portal-bell" onClick={() => notifications.setOpen(true)} aria-label={`Notifications${notifications.unread ? ` (${notifications.unread} unread)` : ''}`}><span aria-hidden="true">🔔</span>{notifications.unread > 0 && <b className="portal-bell-badge">{notifications.unread > 9 ? '9+' : notifications.unread}</b>}</button><span className="portal-date">{new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span><div className="portal-session"><b>{(userName || role).slice(0, 1).toUpperCase()}</b><span><strong>{userName || role}</strong><small>{role}</small></span></div><button className="portal-signout portal-signout--top" onClick={onSignOut}>Sign out</button></div><i className="portal-scroll-progress" aria-hidden="true" />
      </header>
      {notifications.open && <Modal kicker="Stay informed" title="Notifications" onClose={() => notifications.setOpen(false)} footer={<>
        <button className="ui-button ui-button--secondary" onClick={notifications.markAllRead} disabled={!notifications.unread}>Mark all as read</button>
        <button className="ui-button ui-button--text" onClick={() => notifications.setOpen(false)}>Close</button>
      </>}>
        <div className="ui-notification-list">
          {notifications.items.length ? notifications.items.map((item) => <button key={item.id} className={`ui-notification-item ${item.read ? '' : 'is-unread'}`} onClick={() => !item.read && notifications.markRead(item.id)}>
            <i aria-hidden="true" />
            <span>{item.message}</span>
            <small>{item.read ? 'Read' : 'New'}<br />{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}</small>
          </button>) : <p className="quiet-copy" style={{ margin: 0 }}>There are no notifications yet.</p>}
        </div>
      </Modal>}
      <div className="portal-content"><div className={`portal-intro portal-intro--${role.toLowerCase()}`}><div><p className="portal-kicker">Private service, beautifully managed</p><h2>{heroTitle}</h2><p>{subtitle}</p></div><div className="portal-intro-mark">L</div></div>{notice && <div role="status" className="portal-notice">{notice}</div>}{children}</div>
      <nav className="portal-mobile-nav" aria-label="Mobile navigation">{navItems.slice(0, 5).map((item, index) => <button key={item.id} className={active === item.id ? 'is-active' : ''} onClick={() => jump(item.id)}><i>{glyphs[index]}</i><span>{item.label}</span></button>)}</nav>
    </main>
  </div>
}
