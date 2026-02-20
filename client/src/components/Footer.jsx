import React from 'react'
import { useLang } from '../i18n'

export default function Footer() {
  const { t } = useLang()

  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="footer-text">{t('footer.text')}</span>
        <div className="footer-links">
          <a href="https://github.com/appback/title-clash" className="footer-link"
             target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </div>
    </footer>
  )
}
