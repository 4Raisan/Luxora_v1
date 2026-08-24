import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Navbar.css'

const Navbar = () => {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeLink, setActiveLink] = useState('Home')

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)

      // Section Scroll Spy Tracking
      const sections = [
        { id: 'home', name: 'Home' },
        { id: 'services', name: 'Services' },
        { id: 'plans', name: 'Plans' },
        { id: 'contact', name: 'Contact' }
      ]

      const scrollPos = window.scrollY + 180

      for (let i = sections.length - 1; i >= 0; i--) {
        const secEl = document.getElementById(sections[i].id)
        if (secEl) {
          const top = secEl.offsetTop
          if (scrollPos >= top) {
            setActiveLink(sections[i].name)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = ['Home', 'Services', 'Plans', 'Contact']

  const handleNavClick = (link) => {
    setActiveLink(link)
    setMenuOpen(false)
    const targetId = link.toLowerCase()
    const el = document.getElementById(targetId)
    if (el) {
      const navOffset = 80
      const elementPosition = el.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - navOffset
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__inner">
        {/* Logo */}
        <a href="#" className="navbar__logo" onClick={() => handleNavClick('Home')}>
          <img src="/luxora-logo.png" alt="LUXORA" className="navbar__logo-img" />
        </a>

        {/* Desktop Nav Links */}
        <ul className="navbar__links">
          {navLinks.map((link) => (
            <li key={link}>
              <button
                className={`navbar__link ${activeLink === link ? 'navbar__link--active' : ''}`}
                onClick={() => handleNavClick(link)}
              >
                {link}
              </button>
            </li>
          ))}
        </ul>

        {/* CTA Buttons */}
        <div className="navbar__actions">
          <button className="navbar__btn-outline" onClick={() => navigate('/provider-register')}>Become Provider</button>
          <button className="navbar__btn-signup" id="navbar-signup-btn" onClick={() => navigate('/signup')}>
            Sign Up
          </button>
          <button className="navbar__btn-gold" id="navbar-login-btn" onClick={() => navigate('/login')}>
            Login
          </button>
        </div>

        {/* Hamburger */}
        <button
          className={`navbar__hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`navbar__mobile ${menuOpen ? 'navbar__mobile--open' : ''}`}>
        {navLinks.map((link) => (
          <button
            key={link}
            className={`navbar__mobile-link ${activeLink === link ? 'active' : ''}`}
            onClick={() => handleNavClick(link)}
          >
            {link}
          </button>
        ))}
        <div className="navbar__mobile-actions">
          <button className="navbar__btn-outline" onClick={() => navigate('/provider-register')}>Become Provider</button>
          <button className="navbar__btn-signup" id="navbar-mobile-signup-btn" onClick={() => navigate('/signup')}>Sign Up</button>
          <button className="navbar__btn-gold" id="navbar-mobile-login-btn" onClick={() => navigate('/login')}>Login</button>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
