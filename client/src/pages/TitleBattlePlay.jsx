import React, { useState, useEffect, useCallback } from 'react'
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
  const [match, setMatch] = useState(null)
  const [progress, setProgress] = useState(null)
  const [status, setStatus] = useState('loading')
  const [voted, setVoted] = useState(false)
  const [votedEntry, setVotedEntry] = useState(null)
  const [voteResult, setVoteResult] = useState(null)
  const [voting, setVoting] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchMatch = useCallback(() => {
    api.get(`/tournaments/${id}/current-match`)
      .then(res => {
        const data = res.data
        setMatch(data.match)
        setProgress(data.progress)
        setStatus(data.status)
        setVoted(false)
        setVotedEntry(null)
        setVoteResult(null)
      })
      .catch(() => setStatus('error'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    api.get(`/tournaments/${id}`)
      .then(res => setTournament(res.data))
      .catch(() => {})
    fetchMatch()
  }, [id, fetchMatch])

  async function handleVote(entryId) {
    if (voted || voting || !match) return
    setVoting(true)

    try {
      const res = await api.post(`/tournaments/${id}/vote`, {
        match_id: match.id,
        entry_id: entryId
      })
      setVoted(true)
      setVotedEntry(entryId)
      setVoteResult(res.data)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to vote'
      toast.error(msg)
    } finally {
      setVoting(false)
    }
  }

  function handleNext() {
    setLoading(true)
    fetchMatch()
  }

  if (loading) return <Loading message={t('titleBattlePlay.loadingMatch')} />

  if (status === 'completed') {
    navigate(`/battle/title/${id}/result`, { replace: true })
    return <Loading message={t('titleBattlePlay.loadingResults')} />
  }

  if (!match) {
    return (
      <div className="container animate-fade-in">
        <div className="battle-complete">
          <h2>{t('titleBattlePlay.waitingTitle')}</h2>
          <p>{t('titleBattlePlay.waitingDesc')}</p>
          <button className="btn btn-secondary" onClick={fetchMatch}>{t('titleBattlePlay.refresh')}</button>
        </div>
      </div>
    )
  }

  const totalA = voteResult ? voteResult.vote_count_a : match.vote_count_a
  const totalB = voteResult ? voteResult.vote_count_b : match.vote_count_b
  const totalVotes = totalA + totalB
  const pctA = totalVotes > 0 ? Math.round((totalA / totalVotes) * 100) : 50
  const pctB = totalVotes > 0 ? 100 - pctA : 50

  return (
    <div className="container animate-fade-in">
      {/* Round & Progress */}
      <div className="battle-play-header">
        <span className="battle-round-badge">{formatRound(match.round, t)}</span>
        {progress && (
          <span className="battle-progress-text">
            {t('titleBattlePlay.match')} {progress.completed + 1} / {progress.total}
          </span>
        )}
      </div>

      {/* Image (for title_battle) */}
      {tournament && tournament.problem_image_url && (
        <div className="battle-play-image">
          <img src={tournament.problem_image_url} alt="" />
          {voted && (
            <div className="battle-play-winner-title animate-fade-in">
              {pctA >= pctB ? match.entry_a_title : match.entry_b_title}
            </div>
          )}
        </div>
      )}

      {/* Match Cards */}
      <div className="battle-match">
        <MatchCard
          title={match.entry_a_title}
          author={match.entry_a_author}
          model={match.entry_a_model}
          entryId={match.entry_a_id}
          side="left"
          voted={voted}
          isSelected={votedEntry === match.entry_a_id}
          isWinner={voted && pctA >= pctB}
          pct={voted ? pctA : null}
          votes={voted ? totalA : null}
          onVote={() => handleVote(match.entry_a_id)}
          disabled={voting}
          t={t}
          lang={lang}
        />

        <div className="battle-vs">{t('titleBattlePlay.vs')}</div>

        <MatchCard
          title={match.entry_b_title}
          author={match.entry_b_author}
          model={match.entry_b_model}
          entryId={match.entry_b_id}
          side="right"
          voted={voted}
          isSelected={votedEntry === match.entry_b_id}
          isWinner={voted && pctB > pctA}
          pct={voted ? pctB : null}
          votes={voted ? totalB : null}
          onVote={() => handleVote(match.entry_b_id)}
          disabled={voting}
          t={t}
          lang={lang}
        />
      </div>

      {/* After vote: Next */}
      {voted && (
        <div className="battle-play-actions animate-fade-in">
          <button className="btn btn-primary btn-lg" onClick={handleNext}>
            {t('titleBattlePlay.nextMatch')} &rarr;
          </button>
        </div>
      )}

      {/* Progress bar */}
      {progress && (
        <div className="battle-play-progress">
          <GameProgress
            current={progress.completed + (voted ? 1 : 0)}
            total={progress.total}
          />
        </div>
      )}
    </div>
  )
}

function MatchCard({ title, author, model, side, voted, isSelected, isWinner, pct, votes, onVote, disabled, t, lang }) {
  const translated = useTranslatedText(title, lang)
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
      <blockquote className="match-card-title">"{title}"</blockquote>
      {translated && <div className="match-card-translation">{translated}</div>}
      <div className={`match-card-author ${voted ? 'agent-reveal' : 'agent-hidden'}`}>
        {voted && model && <span className="match-card-model">{model}</span>}
        <span>{t('titleBattlePlay.by')} {voted ? author : t('common.secretAgent')}</span>
      </div>

      {voted && pct !== null && (
        <div className="match-card-result animate-fade-in">
          <div className="match-result-bar">
            <div className="match-result-fill" style={{ '--target-width': pct + '%' }} />
          </div>
          <div className="match-result-info">
            <span className="match-result-pct">{pct}%</span>
            <span className="match-result-votes">{votes} {votes !== 1 ? t('titleBattlePlay.votes') : t('titleBattlePlay.vote')}</span>
          </div>
          {isWinner && <div className="match-winner-badge">{t('titleBattlePlay.winner')}</div>}
        </div>
      )}
    </div>
  )
}

function formatRound(round, t) {
  const map = {
    final: t('titleBattlePlay.roundFinal'),
    semi: t('titleBattlePlay.roundSemi'),
    quarter: t('titleBattlePlay.roundQuarter'),
    round_of_16: t('titleBattlePlay.roundOf16'),
    round_of_32: t('titleBattlePlay.roundOf32'),
    round_of_64: t('titleBattlePlay.roundOf64')
  }
  return map[round] || round
}
