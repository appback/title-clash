import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import GameProgress from '../components/GameProgress'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n'
import { useTranslatedText } from '../hooks/useTranslation'

export default function ImageBattlePlay() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const toast = useToast()

  const [matches, setMatches] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [voted, setVoted] = useState(false)
  const [votedEntry, setVotedEntry] = useState(null)
  const [voting, setVoting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [sessionWins, setSessionWins] = useState({}) // { id: { ...entry, wins: N } }
  const autoAdvanceTimer = useRef(null)

  // Cleanup auto-advance timer on unmount
  useEffect(() => {
    return () => { if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current) }
  }, [])

  useEffect(() => {
    api.get('/battle/image/play')
      .then(res => setMatches(res.data.matches || []))
      .catch(() => toast.error(t('imageBattle.failedToLoad')))
      .finally(() => setLoading(false))
  }, [])

  const match = matches[currentIndex] || null
  const totalMatches = matches.length
  const isLastMatch = currentIndex === totalMatches - 1

  async function handleVote(winnerId, loserId) {
    if (voted || voting) return
    setVoting(true)
    try {
      await api.post('/battle/image/vote', { winner_id: winnerId, loser_id: loserId })
      setVoted(true)
      setVotedEntry(winnerId)
      setSessionCount(prev => prev + 1)
      // Track winner entry for results
      const winnerEntry = match.entry_a.submission_id === winnerId ? match.entry_a : match.entry_b
      setSessionWins(prev => {
        const existing = prev[winnerId]
        return {
          ...prev,
          [winnerId]: existing
            ? { ...existing, wins: existing.wins + 1 }
            : { ...winnerEntry, wins: 1 }
        }
      })
      // Auto-advance after 1 second
      autoAdvanceTimer.current = setTimeout(() => { handleNext() }, 1000)
    } catch {
      toast.error(t('imageBattle.failedToVote'))
    } finally {
      setVoting(false)
    }
  }

  function handleNext() {
    if (autoAdvanceTimer.current) { clearTimeout(autoAdvanceTimer.current); autoAdvanceTimer.current = null }
    if (isLastMatch) {
      setDone(true)
      return
    }
    setCurrentIndex(prev => prev + 1)
    setVoted(false)
    setVotedEntry(null)
  }

  if (loading) return <Loading message={t('imageBattle.loading')} />

  const topWinners = Object.values(sessionWins)
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 5)

  const medals = ['', '\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49']

  if (done || totalMatches === 0) {
    return (
      <div className="container animate-fade-in">
        <div className="battle-complete">
          <h2>{totalMatches === 0 ? t('imageBattle.noMatches') : t('imageBattle.sessionDone')}</h2>
          {sessionCount > 0 && (
            <p>{t('imageBattle.sessionCount').replace('{count}', sessionCount)}</p>
          )}

          {topWinners.length > 0 && (
            <div className="result-rankings" style={{ textAlign: 'left', margin: 'var(--spacing-xl) auto', maxWidth: '500px' }}>
              <h3 style={{ textAlign: 'center', marginBottom: 'var(--spacing-md)' }}>{t('imageBattle.topWinners')}</h3>
              {topWinners.map((entry, i) => (
                <div key={entry.submission_id} className={'result-rank-row' + (i < 3 ? ' result-rank-top' : '')}>
                  <span className="result-rank-num">{i < 3 ? medals[i + 1] : `${i + 1}.`}</span>
                  <div className="result-rank-info">
                    <span className="result-rank-title">"{entry.title}"</span>
                    <span className="result-rank-author">
                      {entry.model_name && <span className="badge badge-sm">{entry.model_name}</span>}
                      {entry.author_name}
                    </span>
                  </div>
                  <span className="result-rank-votes">{entry.wins} {t('common.votes')}</span>
                </div>
              ))}
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
        <ImageCard
          entry={match.entry_a}
          side="left"
          voted={voted}
          isSelected={votedEntry === match.entry_a.submission_id}
          onVote={() => handleVote(match.entry_a.submission_id, match.entry_b.submission_id)}
          disabled={voting}
          t={t}
          lang={lang}
        />

        <div className="battle-vs">{t('titleBattlePlay.vs')}</div>

        <ImageCard
          entry={match.entry_b}
          side="right"
          voted={voted}
          isSelected={votedEntry === match.entry_b.submission_id}
          onVote={() => handleVote(match.entry_b.submission_id, match.entry_a.submission_id)}
          disabled={voting}
          t={t}
          lang={lang}
        />
      </div>

      {voted && (
        <div className="battle-play-actions animate-fade-in">
          <button className="btn btn-primary btn-lg" onClick={handleNext}>
            {isLastMatch ? t('imageBattle.finish') : t('titleBattlePlay.nextMatch')} &rarr;
          </button>
        </div>
      )}

      <div className="battle-play-progress">
        <GameProgress current={currentIndex + (voted ? 1 : 0)} total={totalMatches} />
      </div>
    </div>
  )
}

function ImageCard({ entry, side, voted, isSelected, onVote, disabled, t, lang }) {
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
      {entry.image_url && (
        <div className="image-battle-img">
          <img src={entry.image_url} alt="" loading="lazy" />
        </div>
      )}
      <blockquote className="match-card-title">"{entry.title}"</blockquote>
      {translated && <div className="match-card-translation">{translated}</div>}
      <div className={`match-card-author ${voted ? 'agent-reveal' : 'agent-hidden'}`}>
        {voted && entry.model_name && <span className="match-card-model">{entry.model_name}</span>}
        <span>{t('titleBattlePlay.by')} {voted ? entry.author_name : t('common.secretAgent')}</span>
      </div>
      {voted && isSelected && (
        <div className="match-winner-badge animate-fade-in">{t('titleBattlePlay.winner')}</div>
      )}
    </div>
  )
}
