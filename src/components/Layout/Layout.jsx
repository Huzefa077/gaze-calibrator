import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import InteractiveEye from '../InteractiveEye/InteractiveEye'
import './Layout.css'

const navigationItems = [
  { label: 'Tracker', to: '/' },
  { label: 'Heatmap', to: '/heatmap' },
  { label: 'About', to: '/about' },
]

function Layout({ headerOnly = false, showHeader = true }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  if (!showHeader) return null

  const renderNavigationLink = ({ label, to }) => (
    <NavLink
      key={to}
      className={({ isActive }) =>
        isActive ? 'site-nav-link site-nav-link-active' : 'site-nav-link'
      }
      end={to === '/'}
      onClick={() => setIsMenuOpen(false)}
      to={to}
    >
      {label}
    </NavLink>
  )

  return (
    <div className={headerOnly ? 'site-layout site-layout-header-only' : 'site-layout'}>
      <header className="site-header">
        <div className="site-brand">
          <InteractiveEye className="site-brand-eye" />
          <NavLink className="site-brand-name" onClick={() => setIsMenuOpen(false)} to="/">
            GazeCal
          </NavLink>
        </div>

        <nav className="site-nav-desktop" aria-label="Primary navigation">
          {navigationItems.map(renderNavigationLink)}
        </nav>

        <button
          className={isMenuOpen ? 'site-menu-button site-menu-button-open' : 'site-menu-button'}
          type="button"
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMenuOpen}
          aria-controls="site-mobile-navigation"
          onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <button
        className={isMenuOpen ? 'site-menu-backdrop site-menu-backdrop-open' : 'site-menu-backdrop'}
        type="button"
        aria-label="Close navigation menu"
        onClick={() => setIsMenuOpen(false)}
      />

      <nav
        id="site-mobile-navigation"
        className={isMenuOpen ? 'site-nav-mobile site-nav-mobile-open' : 'site-nav-mobile'}
        aria-label="Mobile navigation"
      >
        <strong>Navigate</strong>
        {navigationItems.map(renderNavigationLink)}
      </nav>

      {!headerOnly && (
        <main className="site-main">
          <Outlet />
        </main>
      )}
    </div>
  )
}

export default Layout
