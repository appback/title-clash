import React, { useState, useEffect } from 'react'
import { useLang } from '../i18n'

export default function ThemeToggle() {
  const { t } = useLang()
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button
      className="btn btn-ghost btn-icon"
      onClick={() => setDark(d => !d)}
      aria-label={dark ? t('theme.switchToLight') : t('theme.switchToDark')}
      title={dark ? t('theme.lightMode') : t('theme.darkMode')}
    >
      {dark ? '\u2600' : '\u263E'}
    </button>
  )
}
