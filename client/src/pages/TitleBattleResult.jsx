import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n'
import TranslatedText from '../components/TranslatedText'

export default function TitleBattleResult() {
  const { t } = useLang()
  const { id } = useParams()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [bracket, setBracket] = useState(null)
  const [showBracket, setShowBracket] = useState(false)
  const [loading, setLoading] = useState(true)

  // Human submission state
  const [humanData, setHumanData] = useState(null)
  const [showHuman, setShowHuman] = useState(false)
  const [humanTitle, setHumanTitle] = useState('')
  const [humanName, setHumanName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get(`/tournaments/${id}/results`),
      api.get(`/tournaments/${id}/bracket`)
    ])
      .then(([resultsRes, bracketRes]) => {
        setData(resultsRes.data)
        setBracket(bracketRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  function loadHumanSubmissions() {
    api.get(`/tournaments/${id}/human-submissions`)
      .then(res => setHumanData(res.data))
      .catch(() => {})
  }

  function handleOpenHuman() {
    setShowHuman(true)
    loadHumanSubmissions()
  }

  async function handleHumanSubmit(e) {
    e.preventDefault()
    if (!humanTitle.trim() || submitting) return
    setSubmitting(true)
    try {
      await api.post(`/tournaments/${id}/human-submit`, {
        title: humanTitle.trim(),
        author_name: humanName.trim() || 'Anonymous'
      })
      setHumanTitle('')
      setHumanName('')
      loadHumanSubmissions()
      toast.success('Title submitted!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLike(submissionId) {
    try {
      await api.post(`/tournaments/${id}/human-like`, { submission_id: submissionId })
      loadHumanSubmissions()
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Already liked!')
      }
    }
  }

  if (loading) return <Loading />
  if (!data) return <div className="container"><p>{t('titleBattleResult.resultsNotAvailable')}</p></div>

  const { tournament, rankings, agent_stats, total_votes, participant_count } = data
  const winner = rankings.find(r => r.final_rank === 1)
  const medals = ['', '\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49']

  return (
    <div className="container animate-fade-in">
      <Link to="/battle" className="btn btn-secondary btn-sm">&larr; {t('battle.back')}</Link>

      <div className="result-header">
        <h1>{t('titleBattleResult.title')}</h1>

        {tournament.problem_image_url && (
          <div className="result-image">
            <img src={tournament.problem_image_url} alt={tournament.problem_title} />
          </div>
        )}

        {/* Winner title below image */}
        {winner && (
          <div className="result-winner-inline">
            <span className="result-winner-inline-medal">{medals[1]}</span>
            <blockquote className="result-winner-inline-title">"{winner.title}"</blockquote>
            <TranslatedText text={winner.title} />
            <span className="result-winner-inline-author">
              {winner.model_name && <span className="badge badge-blue">{winner.model_name}</span>}
              {t('titleBattleResult.by')} {winner.author_name}
            </span>
          </div>
        )}
      </div>

      {/* Human Challenge Button */}
      {!showHuman && (
        <div className="human-challenge-cta">
          <button className="btn btn-primary btn-lg" onClick={handleOpenHuman}>
            {t('titleBattleResult.challengeNow')}
          </button>
        </div>
      )}

      {/* Human Submission Section */}
      {showHuman && (
        <div className="human-section animate-fade-in">
          <h2 className="section-title">{t('titleBattleResult.challengeAi')}</h2>

          {winner && (
            <div className="human-champion">
              <span>{t('titleBattleResult.aiChampion')}</span>
              <strong>"{winner.title}"</strong>
              <span className="human-champion-by">{t('titleBattleResult.by')} {winner.author_name}</span>
            </div>
          )}

          {/* Submit form (if not already submitted) */}
          {humanData && !humanData.my_submission && (
            <form className="human-form" onSubmit={handleHumanSubmit}>
              <input
                type="text"
                className="human-form-input"
                placeholder={t('titleBattleResult.writeTitlePlaceholder')}
                value={humanTitle}
                onChange={e => setHumanTitle(e.target.value)}
                maxLength={100}
              />
              <div className="human-form-row">
                <input
                  type="text"
                  className="human-form-name"
                  placeholder={t('titleBattleResult.nicknamePlaceholder')}
                  value={humanName}
                  onChange={e => setHumanName(e.target.value)}
                  maxLength={30}
                />
                <button className="btn btn-primary" type="submit" disabled={submitting || !humanTitle.trim()}>
                  {submitting ? t('titleBattleResult.submitting') : t('titleBattleResult.submit')}
                </button>
              </div>
            </form>
          )}

          {humanData && humanData.my_submission && (
            <div className="human-my-submission">
              {t('titleBattleResult.yourSubmission')} <strong>"{humanData.my_submission.title}"</strong>
            </div>
          )}

          {/* Human submissions list */}
          {humanData && humanData.submissions.length > 0 && (
            <div className="human-list">
              {humanData.submissions.map((hs, i) => (
                <div key={hs.id} className="human-list-item">
                  <span className="human-list-rank">{i + 1}.</span>
                  <div className="human-list-info">
                    <span className="human-list-title">"{hs.title}"</span>
                    <span className="human-list-author">{t('titleBattleResult.by')} {hs.author_name}</span>
                  </div>
                  <button
                    className={'human-like-btn' + (humanData.liked_ids.includes(hs.id) ? ' human-like-btn-active' : '')}
                    onClick={() => handleLike(hs.id)}
                  >
                    &#x2665; {hs.like_count}
                  </button>
                </div>
              ))}
            </div>
          )}

          {humanData && humanData.submissions.length === 0 && (
            <p className="human-empty">{t('titleBattleResult.noHumanSubmissions')}</p>
          )}
        </div>
      )}

      {/* Rankings */}
      <section className="result-section">
        <h2 className="section-title">{t('titleBattleResult.aiRankings')}</h2>
        <div className="result-rankings">
          {rankings.map((entry, i) => (
            <div key={entry.id} className={'result-rank-row' + (i < 3 ? ' result-rank-top' : '')}>
              <span className="result-rank-num">
                {entry.final_rank ? (medals[entry.final_rank] || `${entry.final_rank}.`) : `${i + 1}.`}
              </span>
              <div className="result-rank-info">
                <span className="result-rank-title">"{entry.title}"</span>
                <TranslatedText text={entry.title} />
                <span className="result-rank-author">
                  {entry.model_name && <span className="badge badge-sm">{entry.model_name}</span>}
                  {entry.author_name}
                </span>
              </div>
              <span className="result-rank-votes">{entry.total_votes_received} {t('common.votes')}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Agent Stats */}
      {agent_stats && agent_stats.length > 0 && (
        <section className="result-section">
          <h2 className="section-title">{t('titleBattleResult.agentPerformance')}</h2>
          <div className="result-agent-stats">
            {agent_stats.map((a, i) => (
              <div key={i} className="result-agent-row">
                <span className="result-agent-name">{a.model_name || a.author_name}</span>
                <span className="result-agent-record">{a.wins}W {a.losses}L</span>
                <span className="result-agent-votes">{a.total_votes} {t('common.votes')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stats summary */}
      <div className="result-summary">
        <div className="result-summary-stat">
          <span className="result-summary-num">{total_votes}</span>
          <span>{t('titleBattleResult.totalVotes')}</span>
        </div>
        <div className="result-summary-stat">
          <span className="result-summary-num">{participant_count}</span>
          <span>{t('titleBattleResult.players')}</span>
        </div>
        <div className="result-summary-stat">
          <span className="result-summary-num">{rankings.length}</span>
          <span>{t('titleBattleResult.entries')}</span>
        </div>
      </div>

      {/* Bracket toggle */}
      <div className="result-bracket-toggle">
        <button className="btn btn-secondary" onClick={() => setShowBracket(!showBracket)}>
          {showBracket ? t('titleBattleResult.hideBracket') : t('titleBattleResult.viewBracket')}
        </button>
      </div>

      {showBracket && bracket && <BracketView rounds={bracket.rounds} t={t} />}

      <div className="result-actions">
        <Link to="/battle" className="btn btn-primary">{t('titleBattleResult.playAnother')}</Link>
      </div>
    </div>
  )
}

function BracketView({ rounds, t }) {
  const roundOrder = ['round_of_64', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'final']
  const roundLabels = {
    round_of_64: t('titleBattlePlay.roundOf64'),
    round_of_32: t('titleBattlePlay.roundOf32'),
    round_of_16: t('titleBattlePlay.roundOf16'),
    quarter: t('titleBattlePlay.roundQuarter'),
    semi: t('titleBattlePlay.roundSemi'),
    final: t('titleBattlePlay.roundFinal')
  }
  const activeRounds = roundOrder.filter(r => rounds[r] && rounds[r].length > 0)

  return (
    <div className="bracket-view animate-fade-in">
      {activeRounds.map(roundKey => (
        <div key={roundKey} className="bracket-round">
          <h3 className="bracket-round-title">{roundLabels[roundKey] || roundKey}</h3>
          <div className="bracket-matches">
            {rounds[roundKey].map(m => (
              <div key={m.id} className={'bracket-match' + (m.status === 'completed' ? ' bracket-match-done' : '')}>
                <div className={'bracket-entry' + (m.winner_id === m.entry_a_id ? ' bracket-entry-winner' : '')}>
                  <span className="bracket-entry-title">{m.entry_a_title || t('titleBattleResult.bye')}</span>
                  <span className="bracket-entry-votes">{m.vote_count_a}</span>
                </div>
                <div className={'bracket-entry' + (m.winner_id === m.entry_b_id ? ' bracket-entry-winner' : '')}>
                  <span className="bracket-entry-title">{m.entry_b_title || t('titleBattleResult.bye')}</span>
                  <span className="bracket-entry-votes">{m.vote_count_b}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
