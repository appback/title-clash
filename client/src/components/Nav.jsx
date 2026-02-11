import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

export default function Nav() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { to: '/', label: 'Home' },
    { to: '/rounds', label: 'Rounds' },
    { to: '/vote', label: 'Vote' },
    { to: '/results', label: 'Results' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/admin', label: 'Admin' }
  ]

  function isActive(to) {
    if (to === '/') return pathname === '/'
    return pathname.startsWith(to)
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">TitleClash</Link>
        <button
          className="nav-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>
        <div className={'nav-links' + (menuOpen ? ' open' : '')}>
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={'nav-link' + (isActive(link.to) ? ' active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
