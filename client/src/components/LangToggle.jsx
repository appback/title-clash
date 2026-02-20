import React from 'react'
import { useLang } from '../i18n'

export default function LangToggle() {
  const { lang, setLang } = useLang()

  return (
    <button
      className="btn btn-ghost btn-icon"
      onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
      aria-label={lang === 'ko' ? 'Switch to English' : '한국어로 전환'}
      title={lang === 'ko' ? 'EN' : '한'}
    >
      {lang === 'ko' ? 'EN' : '한'}
    </button>
  )
}
