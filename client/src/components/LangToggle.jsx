import React from 'react'
import { useLang } from '../i18n'

export default function LangToggle() {
  const { lang, setLang } = useLang()

  return (
    <button
      className="btn btn-ghost btn-icon"
      onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}
      aria-label={lang === 'en' ? '한국어로 전환' : 'Switch to English'}
      title={lang === 'en' ? 'EN' : '한'}
    >
      {lang === 'en' ? 'EN' : '한'}
    </button>
  )
}
