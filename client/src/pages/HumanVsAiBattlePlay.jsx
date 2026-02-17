import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import GameProgress from '../components/GameProgress'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n'
import { useTranslatedText } from '../hooks/useTranslation'

export default function HumanVsAiBattlePlay() {
  const { t, lang } = useLang()
  const toast = useToast()

  const [matches, setMatches] = useState([])
  const [available, setAvailable] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [voted, setVoted] = useState(false)
  const [votedSide, setVotedSide] = useState(null) // 'human' or 'ai'
  const [voting, setVoting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [stats, setStats] = useState(null)
  const [sessionCount, setSessionCount] = useState(0)
  const autoAdvanceTimer = useRef(null)

  // Cleanup auto-advance timer on unmount
  useEffect(() => {
    return () => { if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current) }
  }, [])

  useEffect(() => {
    api.get('/battle/human-vs-ai/play')
      .then(res => {
        setAvailable(res.data.available)
        setMatches(res.data.matches || [])
      })
      .catch(() => toast.error(t('humanVsAi.failedToLoad')))
      .finally(() => setLoading(false))
  }, [])

  const match = matches[currentIndex] || null
  const totalMatches = matches.length
  const isLastMatch = currentIndex === totalMatches - 1

  async function handleVote(side) {
    if (voted || voting || !match) return
    setVoting(true)
    try {
      const isHumanWin = side === 'human'
      await api.post('/battle/human-vs-ai/vote', {
        winner_id: isHumanWin ? match.human.id : match.ai.submission_id,
        winner_type: isHumanWin ? 'human' : 'ai',
        loser_id: isHumanWin ? match.ai.submission_id : match.human.id,
        loser_type: isHumanWin ? 'ai' : 'human'
      })
      setVoted(true)
      setVotedSide(side)
      setSessionCount(prev => prev + 1)
      // Auto-advance after 1 second
      autoAdvanceTimer.current = setTimeout(() => { handleNext() }, 1000)
    } catch {
      toast.error(t('humanVsAi.failedToVote'))
    } finally {
      setVoting(false)
    }
  }

  async function handleNext() {
    if (autoAdvanceTimer.current) { clearTimeout(autoAdvanceTimer.current); autoAdvanceTimer.current = null }
    if (isLastMatch) {
      setDone(true)
      try {
        const res = await api.get('/battle/human-vs-ai/stats')
        setStats(res.data)
      } catch { /* ignore */ }
      return
    }
    setCurrentIndex(prev => prev + 1)
    setVoted(false)
    setVotedSide(null)
  }

  if (loading) return <Loading message={t('humanVsAi.loading')} />

  if (!available || totalMatches === 0) {
    return (
      <div className="container animate-fade-in">
        <div className="battle-complete">
          <h2>{t('humanVsAi.notAvailable')}</h2>
          <p>{t('humanVsAi.notAvailableDesc')}</p>
          <Link to="/battle" className="btn btn-primary">&larr; {t('imageBattle.backToBattle')}</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="container animate-fade-in">
        <div className="battle-complete">
          <h2>{t('humanVsAi.sessionDone')}</h2>
          <p>{t('humanVsAi.sessionCount').replace('{count}', sessionCount)}</p>

          {stats && stats.total_battles > 0 && (
            <div className="hva-stats animate-slide-up">
              <h3>{t('humanVsAi.overallStats')}</h3>
              <div className="hva-stats-bar">
                <div className="hva-bar-human" style={{ width: (100 - stats.ai_win_rate) + '%' }}>
                  {t('humanVsAi.humanLabel')} {100 - stats.ai_win_rate}%
                </div>
                <div className="hva-bar-ai" style={{ width: stats.ai_win_rate + '%' }}>
                  AI {stats.ai_win_rate}%
                </div>
              </div>
              <div className="hva-stats-detail">
                <span>{t('humanVsAi.totalBattles')}: {stats.total_battles}</span>
                <span>{t('humanVsAi.humanWins')}: {stats.human_wins}</span>
                <span>{t('humanVsAi.aiWins')}: {stats.ai_wins}</span>
              </div>
              <p className="hva-stats-message">{t('humanVsAi.msg_' + stats.message)}</p>
            </div>
          )}

          <div className="battle-complete-actions">
            <Link to="/battle" className="btn btn-primary">&larr; {t('imageBattle.backToBattle')}</Link>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>
              {t('imageBattle.playAgain')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container animate-fade-in">
      <div className="battle-play-header">
        <Link to="/battle" className="btn btn-ghost btn-sm">&larr; {t('battle.back')}</Link>
        <span className="battle-round-badge">
          {t('imageBattle.match')} {currentIndex + 1} / {totalMatches}
        </span>
      </div>

      <div className="image-battle-match">
        <BattleCard
          entry={match.human}
          side="left"
          voted={voted}
          isSelected={votedSide === 'human'}
          onVote={() => handleVote('human')}
          disabled={voting}
          t={t}
          lang={lang}
          typeBadge={t('humanVsAi.humanBadge')}
          badgeClass="hva-badge-human"
          authorName={match.human.author_name}
        />

        <div className="battle-vs">{t('titleBattlePlay.vs')}</div>

        <BattleCard
          entry={match.ai}
          side="right"
          voted={voted}
          isSelected={votedSide === 'ai'}
          onVote={() => handleVote('ai')}
          disabled={voting}
          t={t}
          lang={lang}
          typeBadge="AI"
          badgeClass="hva-badge-ai"
          authorName={match.ai.author_name}
        />
      </div>

      {voted && (
        <div className="battle-play-actions animate-fade-in">
          <button className="btn btn-primary btn-lg" onClick={handleNext}>
            {isLastMatch ? t('humanVsAi.viewStats') : t('titleBattlePlay.nextMatch')} &rarr;
          </button>
        </div>
      )}

      <div className="battle-play-progress">
        <GameProgress current={currentIndex + (voted ? 1 : 0)} total={totalMatches} />
      </div>
    </div>
  )
}

function BattleCard({ entry, side, voted, isSelected, onVote, disabled, t, lang, typeBadge, badgeClass, authorName }) {
  const translated = useTranslatedText(entry.title, lang)
  let cls = 'image-battle-card image-battle-card-' + side
  if (isSelected) cls += ' match-card-selected match-card-winner auto-advance-selected'
  if (voted && !isSelected) cls += ' match-card-loser'

  return (
    <div
      className={cls}
      onClick={() => !voted && !disabled && onVote()}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && !voted && !disabled && onVote()}
    >
      {voted && <span className={`hva-type-badge ${badgeClass} animate-fade-in`}>{typeBadge}</span>}
      {(entry.image_url) && (
        <div className="image-battle-img">
          <img src={entry.image_url} alt="" loading="lazy" />
        </div>
      )}
      <blockquote className="match-card-title">"{entry.title}"</blockquote>
      {translated && <div className="match-card-translation">{translated}</div>}
      <div className={`match-card-author ${voted ? 'agent-reveal' : 'agent-hidden'}`}>
        <span>{t('titleBattlePlay.by')} {voted ? authorName : t('common.secretAgent')}</span>
      </div>
      {voted && isSelected && (
        <div className="match-winner-badge animate-fade-in">{t('titleBattlePlay.winner')}</div>
      )}
    </div>
  )
}
