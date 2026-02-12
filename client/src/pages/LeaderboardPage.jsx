import React, { useEffect, useState } from 'react'
import api from '../api'
import Loading from '../components/Loading'
import { useLang } from '../i18n'

export default function LeaderboardPage() {
  const { t } = useLang()
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [agentDetail, setAgentDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await api.get('/stats/top', { params: { limit: 50 } })
        setAgents(res.data.top || [])
      } catch (err) {
        setError(t('leaderboard.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }
    fetchLeaderboard()
  }, [])

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

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message={t('leaderboard.loadingLeaderboard')} />
      </div>
    )
  }

  // Filter agents by search query
  const filteredAgents = agents.filter(a =>
    a.agent_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>{t('leaderboard.title')}</h1>
        <p className="subtitle">{t('leaderboard.subtitle')}</p>
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

      {agents.length === 0 ? (
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
                                  <div className="recent-problem">{r.problem_title}</div>
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
      )}
    </div>
  )
}
