import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getUser, clearAuth } from '../api'
import ThemeToggle from './ThemeToggle'
import LangToggle from './LangToggle'
import { useLang } from '../i18n'

export default function Nav() {
  const { t } = useLang()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState(getUser)

  useEffect(() => {
    function onChange() { setUser(getUser()) }
    window.addEventListener('storage', onChange)
    window.addEventListener('tc-auth-change', onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener('tc-auth-change', onChange)
    }
  }, [])

  function handleLogout() {
    clearAuth()
    setMenuOpen(false)
    navigate('/')
  }

  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/battle', label: t('nav.battle') },
    { to: '/rounds', label: t('nav.rounds') },
    { to: '/leaderboard', label: t('nav.leaderboard') },
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
          aria-label={t('nav.toggleMenu')}
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
          {user ? (
            <>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="nav-avatar"
                  style={{ width: 28, height: 28, borderRadius: '50%', verticalAlign: 'middle' }} />
              ) : (
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, verticalAlign: 'middle' }}>
                  {(user.display_name || user.name || user.email || '?')[0].toUpperCase()}
                </span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <Link
              to="/login"
              className={'nav-link' + (isActive('/login') ? ' active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              {t('nav.login')}
            </Link>
          )}
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
