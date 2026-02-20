import React from 'react'
import { useLang } from '../i18n'

export default function VoteActions({ likes, onLike, onDislike, onReport, voted, disabled }) {
  const { t } = useLang()
  return (
    <div className="vote-actions">
      <button
        className={'vote-action-btn vote-action-like' + (voted === 'like' ? ' active' : '')}
        onClick={onLike}
        disabled={disabled}
        title={t('common.like')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>
        </svg>
        {typeof likes === 'number' && <span className="vote-action-count">{likes}</span>}
      </button>
      <button
        className={'vote-action-btn vote-action-dislike' + (voted === 'dislike' ? ' active' : '')}
        onClick={onDislike}
        disabled={disabled}
        title={t('common.dislike')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>
        </svg>
      </button>
      <button
        className="vote-action-btn vote-action-report"
        onClick={onReport}
        title={t('common.report')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>
        </svg>
      </button>
    </div>
  )
}
