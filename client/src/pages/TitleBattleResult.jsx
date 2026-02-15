import React, { useState, useEffect } from 'react'
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n'
import TranslatedText from '../components/TranslatedText'

export default function TitleBattleResult() {
  const { t } = useLang()
  const { id: legacyId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Human submission state
  const [humanData, setHumanData] = useState(null)
  const [showHuman, setShowHuman] = useState(false)
  const [humanTitle, setHumanTitle] = useState('')
  const [humanName, setHumanName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Get state from navigation
  const playedEntryIds = location.state?.playedEntryIds || null
  const problemIdFromState = location.state?.problemId || null

  // Determine if this is legacy (has :id param) or new (uses state)
  const isLegacy = !!legacyId
  const effectiveProblemId = problemIdFromState

  useEffect(() => {
    if (isLegacy) {
      // Legacy: fetch from tournament results
      api.get(`/tournaments/${legacyId}/results`)
        .then(res => setData(res.data))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else if (effectiveProblemId) {
      // New: fetch from problem rankings
      api.get(`/problems/${effectiveProblemId}/rankings`)
        .then(res => setData(res.data))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [legacyId, effectiveProblemId])

  // For legacy routes, tournament ID is needed for human submissions
  const tournamentId = isLegacy ? legacyId : null

  function loadHumanSubmissions() {
    if (!tournamentId) return
    api.get(`/tournaments/${tournamentId}/human-submissions`)
      .then(res => setHumanData(res.data))
      .catch(() => {})
  }

  function handleOpenHuman() {
    setShowHuman(true)
    loadHumanSubmissions()
  }

  async function handleHumanSubmit(e) {
    e.preventDefault()
    if (!humanTitle.trim() || submitting || !tournamentId) return
    setSubmitting(true)
    try {
      await api.post(`/tournaments/${tournamentId}/human-submit`, {
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
    if (!tournamentId) return
    try {
      await api.post(`/tournaments/${tournamentId}/human-like`, { submission_id: submissionId })
      loadHumanSubmissions()
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Already liked!')
      }
    }
  }

  if (loading) return <Loading />
  if (!data) return <div className="container"><p>{t('titleBattleResult.resultsNotAvailable')}</p></div>

  const { problem, rankings, agent_stats, total_votes, participant_count } = data
  // Legacy format uses 'tournament' key instead of 'problem'
  const problemInfo = problem || data.tournament

  // Filter rankings to show only played entries if available, top 5
  const displayRankings = (playedEntryIds
    ? rankings.filter(r => playedEntryIds.includes(r.id))
    : rankings
  ).slice(0, 5)

  const winner = displayRankings.length > 0 ? displayRankings[0] : null
  const medals = ['', '\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49']

  // Check if using new rankings format (has win_rate)
  const hasWinRate = rankings.length > 0 && rankings[0].win_rate !== undefined

  return (
    <div className="container animate-fade-in">
      <Link to="/battle" className="btn btn-secondary btn-sm">&larr; {t('battle.back')}</Link>

      <div className="result-header">
        <h1>{t('titleBattleResult.title')}</h1>

        {problemInfo && problemInfo.problem_image_url && (
          <div className="result-image">
            <img src={problemInfo.problem_image_url} alt={problemInfo.problem_title || problemInfo.title} />
          </div>
        )}
        {/* Also check image_url for new API format */}
        {problemInfo && !problemInfo.problem_image_url && problemInfo.image_url && (
          <div className="result-image">
            <img src={problemInfo.image_url} alt={problemInfo.title} />
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
            <span className="result-winner-inline-votes">
              {hasWinRate
                ? (winner.exposure_count <= 20
                  ? t('game.collecting')
                  : `${winner.win_rate}% ${t('game.winRate')}`)
                : `${winner.total_votes_received} ${t('common.votes')}`
              }
            </span>
          </div>
        )}
      </div>

      {/* Human Challenge CTA - only for legacy routes with tournament support */}
      {!showHuman && winner && tournamentId && (
        <div className="human-challenge-cta">
          <p className="human-challenge-text">{t('titleBattleResult.canYouBeat')}</p>
          <button className="btn btn-primary btn-lg" onClick={handleOpenHuman}>
            {t('titleBattleResult.challengeNow')}
          </button>
        </div>
      )}

      {/* Human Submission Section */}
      {showHuman && tournamentId && (
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
        <h2 className="section-title">
          {playedEntryIds ? t('titleBattleResult.sessionRankings') : t('titleBattleResult.aiRankings')}
        </h2>
        <div className="result-rankings">
          {displayRankings.map((entry, i) => (
            <div key={entry.id} className={'result-rank-row' + (i < 3 ? ' result-rank-top' : '')}>
              <span className="result-rank-num">
                {i < 3 ? medals[i + 1] : `${i + 1}.`}
              </span>
              <div className="result-rank-info">
                <span className="result-rank-title">"{entry.title}"</span>
                <TranslatedText text={entry.title} />
                <span className="result-rank-author">
                  {entry.model_name && <span className="badge badge-sm">{entry.model_name}</span>}
                  {entry.author_name}
                </span>
              </div>
              {hasWinRate ? (
                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                  <span className="result-rank-votes">
                    {entry.exposure_count <= 20 ? t('game.collecting') : `${entry.win_rate}%`}
                  </span>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {entry.selection_count}/{entry.exposure_count}
                  </div>
                </div>
              ) : (
                <span className="result-rank-votes">{entry.total_votes_received} {t('common.votes')}</span>
              )}
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
                <span className="result-agent-record">{a.entry_count} {t('titleBattleResult.entries')}</span>
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

      <div className="result-actions">
        <Link to="/battle/title/play" className="btn btn-primary">{t('titleBattleResult.playAgain')}</Link>
        <Link to="/battle" className="btn btn-secondary">{t('titleBattleResult.playAnother')}</Link>
      </div>
    </div>
  )
}
