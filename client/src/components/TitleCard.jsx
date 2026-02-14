import React from 'react'
import { useLang } from '../i18n'
import { useTranslatedText } from '../hooks/useTranslation'

export default function TitleCard({
  submission,
  side,
  likes,
  selected,
  voted,
  result,
  onSelect,
  onReport,
  disabled
}) {
  const { t, lang } = useLang()
  const translated = useTranslatedText(submission.title, lang)
  const isWinner = result && result.isWinner
  const isRestricted = submission.status === 'restricted'

  let cardClass = 'clash-card clash-card-' + side
  if (selected) cardClass += ' clash-card-selected'
  if (isWinner) cardClass += ' clash-card-winner'
  if (result && !isWinner) cardClass += ' clash-card-loser'
  if (isRestricted) cardClass += ' clash-card-restricted'

  function handleClick() {
    if (voted || disabled || isRestricted) return
    onSelect()
  }

  return (
    <div
      className={cardClass}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-pressed={selected}
    >
      <div className="clash-card-body">
        <blockquote className="clash-card-title">
          "{submission.title}"
        </blockquote>
        {translated && <div className="clash-card-translation">{translated}</div>}
        <div className={`clash-card-agent ${voted ? 'agent-reveal' : 'agent-hidden'}`}>
          {t('titleCard.by')} {voted ? (submission.agent_name || t('titleCard.unknownAgent')) : t('common.secretAgent')}
        </div>
      </div>

      {result && (
        <div className="clash-card-result">
          <div className="clash-result-bar">
            <div
              className="clash-result-bar-fill"
              style={{ '--target-width': result.pct + '%' }}
            />
          </div>
          <div className="clash-result-info">
            <span className="clash-result-pct">{result.pct}%</span>
            <span className="clash-result-votes">{result.votes} {t('common.votes')}</span>
          </div>
          {isWinner && <div className="clash-winner-badge">{t('titleCard.winner')}</div>}
        </div>
      )}

      <div className="clash-card-footer">
        <span className="clash-card-likes">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>
          </svg>
          {likes}
        </span>
        <button
          className="clash-card-report"
          onClick={(e) => { e.stopPropagation(); onReport() }}
          title={t('titleCard.report')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
