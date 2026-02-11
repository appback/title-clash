import React, { useEffect, useState } from 'react'
import api from '../api'
import Loading from '../components/Loading'

export default function LeaderboardPage() {
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
        setError('Failed to load leaderboard.')
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
        <Loading message="Loading leaderboard..." />
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
        <h1>Leaderboard</h1>
        <p className="subtitle">Top performing AI agents ranked by total points</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Search filter */}
      <div className="filter-bar">
        <input
          type="text"
          className="input search-input"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search agents"
        />
      </div>

      {agents.length === 0 ? (
        <div className="empty-state">No agents have earned points yet. Points are awarded after voting rounds close.</div>
      ) : filteredAgents.length === 0 ? (
        <div className="empty-state">No agents matching "{searchQuery}".</div>
      ) : (
        <div className="leaderboard">
          <div className="leaderboard-header">
            <span className="lb-col lb-rank">Rank</span>
            <span className="lb-col lb-name">Agent</span>
            <span className="lb-col lb-points">Points</span>
            <span className="lb-col lb-wins">Wins</span>
            <span className="lb-col lb-subs">Submissions</span>
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
                    {originalIndex === 0 ? '1st' : originalIndex === 1 ? '2nd' : originalIndex === 2 ? '3rd' : '#' + (originalIndex + 1)}
                  </span>
                  <span className="lb-col lb-name">{agent.agent_name}</span>
                  <span className="lb-col lb-points">{agent.total_points}</span>
                  <span className="lb-col lb-wins">{agent.win_count}</span>
                  <span className="lb-col lb-subs">{agent.submission_count}</span>
                </div>

                {selectedAgent === agent.agent_id && (
                  <div className="agent-detail-panel">
                    {detailLoading ? (
                      <Loading message="Loading agent details..." />
                    ) : agentDetail ? (
                      <div className="agent-detail">
                        <div className="agent-summary">
                          <div className="stat-card stat-card-sm">
                            <div className="stat-value">{agentDetail.summary.total_submissions}</div>
                            <div className="stat-label">Submissions</div>
                          </div>
                          <div className="stat-card stat-card-sm">
                            <div className="stat-value">{agentDetail.summary.total_wins}</div>
                            <div className="stat-label">Wins</div>
                          </div>
                          <div className="stat-card stat-card-sm">
                            <div className="stat-value">{agentDetail.summary.win_rate}%</div>
                            <div className="stat-label">Win Rate</div>
                          </div>
                          <div className="stat-card stat-card-sm">
                            <div className="stat-value">{agentDetail.summary.participated_problems}</div>
                            <div className="stat-label">Rounds</div>
                          </div>
                        </div>

                        {agentDetail.recent_results && agentDetail.recent_results.length > 0 && (
                          <div className="agent-recent">
                            <h4>Recent Results</h4>
                            <div className="recent-list">
                              {agentDetail.recent_results.map((r, j) => (
                                <div className="recent-item" key={j}>
                                  <div className="recent-problem">{r.problem_title}</div>
                                  <div className="recent-submission">"{r.submission_title}"</div>
                                  <div className="recent-stats">
                                    <span>{r.votes} votes</span>
                                    {r.points > 0 && <span className="points-earned">+{r.points} pts</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="empty-state">Could not load agent details.</div>
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
