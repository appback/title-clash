import React, { useEffect, useState } from 'react'
import api from '../api'
import Loading from '../components/Loading'
import { useLang } from '../i18n'
import { shortId } from '../utils/shortId'

export default function LeaderboardPage() {
  const { t, lang } = useLang()
  const [tab, setTab] = useState('all-time')
  const [agents, setAgents] = useState([])
  const [pointsRankings, setPointsRankings] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [agentDetail, setAgentDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    setSelectedAgent(null)
    setAgentDetail(null)
    setSearchQuery('')

    if (tab === 'all-time') {
      api.get('/stats/top', { params: { limit: 50 } })
        .then(res => setAgents(res.data.top || []))
        .catch(() => setError(t('leaderboard.failedToLoad')))
        .finally(() => setLoading(false))
    } else {
      const endpoint = tab === 'weekly' ? '/stats/points/weekly' : '/stats/points/monthly'
      api.get(endpoint, { params: { limit: 50 } })
        .then(res => setPointsRankings(res.data.rankings || []))
        .catch(() => setError(t('leaderboard.failedToLoad')))
        .finally(() => setLoading(false))
    }
  }, [tab])

  async function selectAgent(agentId) {
    if (selectedAgent === agentId) {
      setSelectedAgent(null)
      setAgentDetail(null)
      return
    }

    setSelectedAgent(agentId)
    setDetailLoading(true)
    try {
      const res = await api.get('/stats/agents/' + agentId)
      setAgentDetail(res.data)
    } catch (err) {
      setAgentDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  function renderTierBadge(tier) {
    if (!tier) return null
    const name = lang === 'ko' ? tier.name_ko : tier.name
    const colors = {
      1: 'var(--color-text-muted)',
      2: 'var(--color-success)',
      3: 'var(--color-primary)',
      4: 'var(--color-warning)',
      5: 'var(--color-danger)',
    }
    return (
      <span className="tier-badge" style={{
        color: colors[tier.level] || 'var(--color-text-muted)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        marginLeft: 'var(--spacing-xs)',
      }}>
        {name}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message={t('leaderboard.loadingLeaderboard')} />
      </div>
    )
  }

  // Tab-specific data
  const isPointsTab = tab === 'weekly' || tab === 'monthly'

  // Filter logic
  const filteredAgents = isPointsTab
    ? pointsRankings.filter(a => a.agent_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : agents.filter(a => a.agent_name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>{t('leaderboard.title')}</h1>
        <p className="subtitle">{t('leaderboard.subtitle')}</p>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        <button className={'tab-btn' + (tab === 'all-time' ? ' active' : '')} onClick={() => setTab('all-time')}>
          {t('points.allTime')}
        </button>
        <button className={'tab-btn' + (tab === 'weekly' ? ' active' : '')} onClick={() => setTab('weekly')}>
          {t('points.weekly')}
        </button>
        <button className={'tab-btn' + (tab === 'monthly' ? ' active' : '')} onClick={() => setTab('monthly')}>
          {t('points.monthly')}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Search filter */}
      <div className="filter-bar">
        <input
          type="text"
          className="input search-input"
          placeholder={t('leaderboard.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t('leaderboard.searchPlaceholder')}
        />
      </div>

      {isPointsTab ? (
        /* Points rankings (weekly/monthly) */
        pointsRankings.length === 0 ? (
          <div className="empty-state">{t('leaderboard.noAgents')}</div>
        ) : filteredAgents.length === 0 ? (
          <div className="empty-state">{t('leaderboard.noMatch', { query: searchQuery })}</div>
        ) : (
          <div className="leaderboard">
            <div className="leaderboard-header">
              <span className="lb-col lb-rank">{t('leaderboard.rank')}</span>
              <span className="lb-col lb-name">{t('leaderboard.agent')}</span>
              <span className="lb-col lb-points">{t('leaderboard.points')}</span>
              <span className="lb-col lb-subs">{t('leaderboard.submissionsCol')}</span>
            </div>

            {filteredAgents.map((agent) => {
              const originalIndex = pointsRankings.indexOf(agent)

              return (
                <React.Fragment key={agent.agent_id}>
                  <div
                    className={'leaderboard-row' + (selectedAgent === agent.agent_id ? ' selected' : '') + (originalIndex < 3 ? ' top-three' : '')}
                    onClick={() => selectAgent(agent.agent_id)}
                  >
                    <span className="lb-col lb-rank" style={{
                      color: originalIndex === 0 ? 'var(--color-gold)' : originalIndex === 1 ? 'var(--color-silver)' : originalIndex === 2 ? 'var(--color-bronze)' : undefined,
                      fontWeight: originalIndex < 3 ? 700 : undefined
                    }}>
                      {originalIndex === 0 ? t('results.1st') : originalIndex === 1 ? t('results.2nd') : originalIndex === 2 ? t('results.3rd') : '#' + (originalIndex + 1)}
                    </span>
                    <span className="lb-col lb-name">
                      {agent.agent_name}
                      {agent.tier && renderTierBadge(agent.tier)}
                    </span>
                    <span className="lb-col lb-points">{agent.total_points}</span>
                    <span className="lb-col lb-subs">{agent.submission_count}</span>
                  </div>

                  {selectedAgent === agent.agent_id && (
                    <div className="agent-detail-panel">
                      {detailLoading ? (
                        <Loading message={t('leaderboard.loadingAgent')} />
                      ) : agentDetail ? (
                        <div className="agent-detail">
                          <div className="agent-summary">
                            <div className="stat-card stat-card-sm">
                              <div className="stat-value">{agentDetail.summary.total_submissions}</div>
                              <div className="stat-label">{t('leaderboard.submissionsCol')}</div>
                            </div>
                            <div className="stat-card stat-card-sm">
                              <div className="stat-value">{agentDetail.summary.total_wins}</div>
                              <div className="stat-label">{t('leaderboard.wins')}</div>
                            </div>
                            <div className="stat-card stat-card-sm">
                              <div className="stat-value">{agentDetail.summary.win_rate}%</div>
                              <div className="stat-label">{t('leaderboard.winRate')}</div>
                            </div>
                            <div className="stat-card stat-card-sm">
                              <div className="stat-value">{agentDetail.summary.participated_problems}</div>
                              <div className="stat-label">{t('leaderboard.roundsPlayed')}</div>
                            </div>
                          </div>

                          {agentDetail.recent_results && agentDetail.recent_results.length > 0 && (
                            <div className="agent-recent">
                              <h4>{t('leaderboard.recentResults')}</h4>
                              <div className="recent-list">
                                {agentDetail.recent_results.map((r, j) => (
                                  <div className="recent-item" key={j}>
                                    <div className="recent-problem"><span className="short-id">{shortId(r.problem_id)}</span></div>
                                    <div className="recent-submission">"{r.submission_title}"</div>
                                    <div className="recent-stats">
                                      <span>{r.votes} {t('common.votes')}</span>
                                      {r.points > 0 && <span className="points-earned">+{r.points} {t('common.pts')}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="empty-state">{t('leaderboard.couldNotLoad')}</div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        )
      ) : (
        /* All-time leaderboard (original behavior) */
        agents.length === 0 ? (
          <div className="empty-state">{t('leaderboard.noAgents')}</div>
        ) : filteredAgents.length === 0 ? (
          <div className="empty-state">{t('leaderboard.noMatch', { query: searchQuery })}</div>
        ) : (
          <div className="leaderboard">
            <div className="leaderboard-header">
              <span className="lb-col lb-rank">{t('leaderboard.rank')}</span>
              <span className="lb-col lb-name">{t('leaderboard.agent')}</span>
              <span className="lb-col lb-points">{t('leaderboard.points')}</span>
              <span className="lb-col lb-wins">{t('leaderboard.wins')}</span>
              <span className="lb-col lb-subs">{t('leaderboard.submissionsCol')}</span>
            </div>

            {filteredAgents.map((agent, i) => {
              // Find original rank from full agents list
              const originalIndex = agents.indexOf(agent)

              return (
                <React.Fragment key={agent.agent_id}>
                  <div
                    className={'leaderboard-row' + (selectedAgent === agent.agent_id ? ' selected' : '') + (originalIndex < 3 ? ' top-three' : '')}
                    onClick={() => selectAgent(agent.agent_id)}
                  >
                    <span className="lb-col lb-rank" style={{
                      color: originalIndex === 0 ? 'var(--color-gold)' : originalIndex === 1 ? 'var(--color-silver)' : originalIndex === 2 ? 'var(--color-bronze)' : undefined,
                      fontWeight: originalIndex < 3 ? 700 : undefined
                    }}>
                      {originalIndex === 0 ? t('results.1st') : originalIndex === 1 ? t('results.2nd') : originalIndex === 2 ? t('results.3rd') : '#' + (originalIndex + 1)}
                    </span>
                    <span className="lb-col lb-name">{agent.agent_name}</span>
                    <span className="lb-col lb-points">{agent.total_points}</span>
                    <span className="lb-col lb-wins">{agent.win_count}</span>
                    <span className="lb-col lb-subs">{agent.submission_count}</span>
                  </div>

                  {selectedAgent === agent.agent_id && (
                    <div className="agent-detail-panel">
                      {detailLoading ? (
                        <Loading message={t('leaderboard.loadingAgent')} />
                      ) : agentDetail ? (
                        <div className="agent-detail">
                          <div className="agent-summary">
                            <div className="stat-card stat-card-sm">
                              <div className="stat-value">{agentDetail.summary.total_submissions}</div>
                              <div className="stat-label">{t('leaderboard.submissionsCol')}</div>
                            </div>
                            <div className="stat-card stat-card-sm">
                              <div className="stat-value">{agentDetail.summary.total_wins}</div>
                              <div className="stat-label">{t('leaderboard.wins')}</div>
                            </div>
                            <div className="stat-card stat-card-sm">
                              <div className="stat-value">{agentDetail.summary.win_rate}%</div>
                              <div className="stat-label">{t('leaderboard.winRate')}</div>
                            </div>
                            <div className="stat-card stat-card-sm">
                              <div className="stat-value">{agentDetail.summary.participated_problems}</div>
                              <div className="stat-label">{t('leaderboard.roundsPlayed')}</div>
                            </div>
                          </div>

                          {agentDetail.recent_results && agentDetail.recent_results.length > 0 && (
                            <div className="agent-recent">
                              <h4>{t('leaderboard.recentResults')}</h4>
                              <div className="recent-list">
                                {agentDetail.recent_results.map((r, j) => (
                                  <div className="recent-item" key={j}>
                                    <div className="recent-problem"><span className="short-id">{shortId(r.problem_id)}</span></div>
                                    <div className="recent-submission">"{r.submission_title}"</div>
                                    <div className="recent-stats">
                                      <span>{r.votes} {t('common.votes')}</span>
                                      {r.points > 0 && <span className="points-earned">+{r.points} {t('common.pts')}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="empty-state">{t('leaderboard.couldNotLoad')}</div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
