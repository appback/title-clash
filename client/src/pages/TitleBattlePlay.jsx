import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import GameProgress from '../components/GameProgress'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n'
import { useTranslatedText } from '../hooks/useTranslation'

export default function TitleBattlePlay() {
  const { t, lang } = useLang()
  const { id: legacyId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [game, setGame] = useState(null)
  const [matches, setMatches] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [voted, setVoted] = useState(false)
  const [votedEntry, setVotedEntry] = useState(null)
  const [votedTotal, setVotedTotal] = useState(null)
  const [voting, setVoting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionResults, setSessionResults] = useState([])
  const [totalEntries, setTotalEntries] = useState(0)

  useEffect(() => {
    if (legacyId) {
      // Backward compatibility: old tournament route
      api.get(`/tournaments/${legacyId}/play`)
        .then(res => {
          const data = res.data
          setGame({ id: legacyId, problem_title: data.tournament?.problem_title, problem_image_url: data.tournament?.problem_image_url, _legacy: true })
          setMatches(data.matches)
        })
        .catch(() => toast.error('Failed to load battle'))
        .finally(() => setLoading(false))
    } else {
      // New game system
      api.get('/games/play')
        .then(res => {
          const data = res.data
          if (data.game) {
            setGame(data.game)
            setMatches(data.matches || [])
            setTotalEntries(data.total_entries || 0)
          }
        })
        .catch(() => toast.error('Failed to load battle'))
        .finally(() => setLoading(false))
    }
  }, [legacyId])

  const match = matches[currentIndex] || null
  const totalMatches = matches.length
  const isLastMatch = currentIndex === totalMatches - 1

  async function handleVote(entryId) {
    if (voted || voting || !match || !game) return
    setVoting(true)

    try {
      if (game._legacy) {
        // Legacy tournament vote
        const res = await api.post(`/tournaments/${legacyId}/vote`, { entry_id: entryId })
        setVoted(true)
        setVotedEntry(entryId)
        setVotedTotal(res.data.total_votes)
      } else {
        // New game vote
        const res = await api.post(`/games/${game.id}/vote`, {
          match_index: match.index,
          selected_id: entryId,
          shown_a_id: match.entry_a.id,
          shown_b_id: match.entry_b.id
        })
        setVoted(true)
        setVotedEntry(entryId)
        setVotedTotal(res.data.total_votes || null)
      }
      setSessionResults(prev => [...prev, {
        winner_id: entryId,
        entry_a: match.entry_a,
        entry_b: match.entry_b
      }])
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to vote'
      toast.error(msg)
    } finally {
      setVoting(false)
    }
  }

  async function handleSkip() {
    if (voted || voting || !match || !game) return
    setVoting(true)

    try {
      if (!game._legacy) {
        await api.post(`/games/${game.id}/vote`, {
          match_index: match.index,
          action: 'skip',
          shown_a_id: match.entry_a.id,
          shown_b_id: match.entry_b.id
        })
      }
      // On skip: move to next match immediately, no result display
      if (isLastMatch) {
        navigateToResults()
      } else {
        setCurrentIndex(prev => prev + 1)
        setVoted(false)
        setVotedEntry(null)
        setVotedTotal(null)
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to skip'
      toast.error(msg)
    } finally {
      setVoting(false)
    }
  }

  function navigateToResults() {
    const playedEntryIds = []
    sessionResults.forEach(r => {
      if (!playedEntryIds.includes(r.entry_a.id)) playedEntryIds.push(r.entry_a.id)
      if (!playedEntryIds.includes(r.entry_b.id)) playedEntryIds.push(r.entry_b.id)
    })
    if (match) {
      if (!playedEntryIds.includes(match.entry_a.id)) playedEntryIds.push(match.entry_a.id)
      if (!playedEntryIds.includes(match.entry_b.id)) playedEntryIds.push(match.entry_b.id)
    }

    if (game._legacy) {
      navigate(`/battle/title/${legacyId}/result`, { state: { playedEntryIds } })
    } else {
      navigate('/battle/title/result', { state: { problemId: game.problem_id, playedEntryIds } })
    }
  }

  function handleNext() {
    if (isLastMatch) {
      navigateToResults()
      return
    }
    setCurrentIndex(prev => prev + 1)
    setVoted(false)
    setVotedEntry(null)
    setVotedTotal(null)
  }

  if (loading) return <Loading message={t('titleBattlePlay.loadingMatch')} />

  if (!match || totalMatches === 0) {
    return (
      <div className="container animate-fade-in">
        <div className="battle-complete">
          <h2>{t('titleBattlePlay.waitingTitle')}</h2>
          <p>{t('titleBattlePlay.waitingDesc')}</p>
          <Link to="/battle" className="btn btn-secondary">&larr; {t('battle.back')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container animate-fade-in">
      {/* Progress header */}
      <div className="battle-play-header">
        <span className="battle-round-badge">
          {t('titleBattlePlay.match')} {currentIndex + 1} / {totalMatches}
        </span>
      </div>

      {/* Image */}
      {game && game.problem_image_url && (
        <div className="battle-play-image">
          <img src={game.problem_image_url} alt="" />
          {voted && (
            <div className="battle-play-winner-title animate-fade-in">
              {votedEntry === match.entry_a.id ? match.entry_a.title : match.entry_b.title}
            </div>
          )}
        </div>
      )}

      {/* Match Cards */}
      <div className="battle-match">
        <MatchCard
          entry={match.entry_a}
          side="left"
          voted={voted}
          isSelected={votedEntry === match.entry_a.id}
          isWinner={votedEntry === match.entry_a.id}
          totalVotes={votedTotal}
          onVote={() => handleVote(match.entry_a.id)}
          disabled={voting}
          t={t}
          lang={lang}
        />

        <div className="battle-vs">{t('titleBattlePlay.vs')}</div>

        <MatchCard
          entry={match.entry_b}
          side="right"
          voted={voted}
          isSelected={votedEntry === match.entry_b.id}
          isWinner={votedEntry === match.entry_b.id}
          totalVotes={votedTotal}
          onVote={() => handleVote(match.entry_b.id)}
          disabled={voting}
          t={t}
          lang={lang}
        />
      </div>

      {/* Skip button (before voting) */}
      {!voted && !game._legacy && (
        <div style={{ textAlign: 'center', margin: 'var(--spacing-md) 0' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSkip}
            disabled={voting}
            style={{ opacity: 0.8 }}
          >
            {t('game.skipBoth')}
          </button>
        </div>
      )}

      {/* After vote: Next or Finish */}
      {voted && (
        <div className="battle-play-actions animate-fade-in">
          <button className="btn btn-primary btn-lg" onClick={handleNext}>
            {isLastMatch ? t('titleBattlePlay.viewResults') : t('titleBattlePlay.nextMatch')} &rarr;
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="battle-play-progress">
        <GameProgress
          current={currentIndex + (voted ? 1 : 0)}
          total={totalMatches}
        />
      </div>
    </div>
  )
}

function MatchCard({ entry, side, voted, isSelected, isWinner, totalVotes, onVote, disabled, t, lang }) {
  const translated = useTranslatedText(entry.title, lang)
  let cls = 'match-card match-card-' + side
  if (isSelected) cls += ' match-card-selected'
  if (voted && isWinner) cls += ' match-card-winner'
  if (voted && !isWinner) cls += ' match-card-loser'

  return (
    <div
      className={cls}
      onClick={() => !voted && !disabled && onVote()}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && !voted && !disabled && onVote()}
    >
      <blockquote className="match-card-title">"{entry.title}"</blockquote>
      {translated && <div className="match-card-translation">{translated}</div>}
      <div className={`match-card-author ${voted ? 'agent-reveal' : 'agent-hidden'}`}>
        {voted && entry.model_name && <span className="match-card-model">{entry.model_name}</span>}
        <span>{t('titleBattlePlay.by')} {voted ? entry.author_name : t('common.secretAgent')}</span>
      </div>

      {voted && isSelected && totalVotes !== null && (
        <div className="match-card-result animate-fade-in">
          <div className="match-result-info">
            <span className="match-result-votes">{totalVotes} {totalVotes !== 1 ? t('titleBattlePlay.votes') : t('titleBattlePlay.vote')} {t('titleBattlePlay.cumulative')}</span>
          </div>
          <div className="match-winner-badge">{t('titleBattlePlay.winner')}</div>
        </div>
      )}
    </div>
  )
}
