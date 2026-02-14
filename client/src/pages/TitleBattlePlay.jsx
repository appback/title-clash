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
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [tournament, setTournament] = useState(null)
  const [matches, setMatches] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [voted, setVoted] = useState(false)
  const [votedEntry, setVotedEntry] = useState(null)
  const [votedTotal, setVotedTotal] = useState(null)
  const [voting, setVoting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionResults, setSessionResults] = useState([])

  useEffect(() => {
    api.get(`/tournaments/${id}/play`)
      .then(res => {
        const data = res.data
        setTournament(data.tournament)
        setMatches(data.matches)
      })
      .catch(() => toast.error('Failed to load battle'))
      .finally(() => setLoading(false))
  }, [id])

  const match = matches[currentIndex] || null
  const totalMatches = matches.length
  const isLastMatch = currentIndex === totalMatches - 1

  async function handleVote(entryId) {
    if (voted || voting || !match) return
    setVoting(true)

    try {
      const res = await api.post(`/tournaments/${id}/vote`, { entry_id: entryId })
      setVoted(true)
      setVotedEntry(entryId)
      setVotedTotal(res.data.total_votes)
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

  function handleNext() {
    if (isLastMatch) {
      // Collect all entry IDs that participated in this session
      const playedEntryIds = []
      sessionResults.forEach(r => {
        if (!playedEntryIds.includes(r.entry_a.id)) playedEntryIds.push(r.entry_a.id)
        if (!playedEntryIds.includes(r.entry_b.id)) playedEntryIds.push(r.entry_b.id)
      })
      // Include last match entries
      if (match) {
        if (!playedEntryIds.includes(match.entry_a.id)) playedEntryIds.push(match.entry_a.id)
        if (!playedEntryIds.includes(match.entry_b.id)) playedEntryIds.push(match.entry_b.id)
      }
      navigate(`/battle/title/${id}/result`, { state: { playedEntryIds } })
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

      {/* Image (for title_battle) */}
      {tournament && tournament.problem_image_url && (
        <div className="battle-play-image">
          <img src={tournament.problem_image_url} alt="" />
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
