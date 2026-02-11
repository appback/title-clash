import React from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Nav() {
  const { pathname } = useLocation()

  const links = [
    { to: '/', label: 'Home' },
    { to: '/rounds', label: 'Rounds' },
    { to: '/vote', label: 'Vote' },
    { to: '/results', label: 'Results' },
    { to: '/leaderboard', label: 'Leaderboard' }
  ]

  function isActive(to) {
    if (to === '/') return pathname === '/'
    return pathname.startsWith(to)
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">TitleClash</Link>
        <div className="nav-links">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={'nav-link' + (isActive(link.to) ? ' active' : '')}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
