import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import LangToggle from './LangToggle'
import { useLang } from '../i18n'

function getUser() {
  const raw = localStorage.getItem('tc_user')
  return raw ? JSON.parse(raw) : null
}

export default function Nav() {
  const { t } = useLang()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(!!localStorage.getItem('admin_token'))
  const [user, setUser] = useState(getUser)

  useEffect(() => {
    function onAuthChange() {
      setIsAdmin(!!localStorage.getItem('admin_token'))
      setUser(getUser())
    }
    window.addEventListener('storage', onAuthChange)
    window.addEventListener('admin-auth-change', onAuthChange)
    return () => {
      window.removeEventListener('storage', onAuthChange)
      window.removeEventListener('admin-auth-change', onAuthChange)
    }
  }, [])

  function handleLogout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('tc_user')
    window.dispatchEvent(new Event('admin-auth-change'))
    setMenuOpen(false)
    navigate('/')
  }

  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/battle', label: t('nav.battle') },
    { to: '/rounds', label: t('nav.rounds') },
    { to: '/leaderboard', label: t('nav.leaderboard') },
  ]

  if (isAdmin) {
    links.push({ to: '/admin', label: t('nav.admin') })
  }

  function isActive(to) {
    if (to === '/') return pathname === '/'
    return pathname.startsWith(to)
  }

  const isLoggedIn = isAdmin || !!user

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
          {isLoggedIn ? (
            <>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="nav-avatar"
                  style={{ width: 28, height: 28, borderRadius: '50%', verticalAlign: 'middle' }} />
              ) : (
                <span className="nav-link" style={{ color: 'var(--primary)' }}>
                  {user?.display_name || user?.email || 'User'}
                </span>
              )}
              <button className="nav-link" onClick={handleLogout}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                Logout
              </button>
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
