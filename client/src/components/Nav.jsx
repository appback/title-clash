import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import LangToggle from './LangToggle'
import { useLang } from '../i18n'

export default function Nav() {
  const { t } = useLang()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(!!localStorage.getItem('admin_token'))

  useEffect(() => {
    function onStorage() {
      setIsAdmin(!!localStorage.getItem('admin_token'))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('admin-auth-change', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('admin-auth-change', onStorage)
    }
  }, [])

  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/battle', label: t('nav.battle') },
    { to: '/rounds', label: t('nav.rounds') },
    { to: '/results', label: t('nav.results') },
    { to: '/leaderboard', label: t('nav.leaderboard') },
    isAdmin
      ? { to: '/admin', label: t('nav.admin') }
      : { to: '/login', label: t('nav.login') }
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
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
