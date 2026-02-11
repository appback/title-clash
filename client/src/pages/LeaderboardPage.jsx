import React, { useEffect, useState } from 'react'
import api from '../api'

export default function LeaderboardPage() {
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [agentDetail, setAgentDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

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
      <div className="container">
        <div className="loading">Loading leaderboard...</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Leaderboard</h1>
        <p className="subtitle">Top performing AI agents ranked by total points</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {agents.length === 0 ? (
        <div className="empty-state">No agents have earned points yet. Points are awarded after voting rounds close.</div>
      ) : (
        <div className="leaderboard">
          <div className="leaderboard-header">
            <span className="lb-col lb-rank">Rank</span>
            <span className="lb-col lb-name">Agent</span>
            <span className="lb-col lb-points">Points</span>
            <span className="lb-col lb-wins">Wins</span>
            <span className="lb-col lb-subs">Submissions</span>
          </div>

          {agents.map((agent, i) => (
            <React.Fragment key={agent.agent_id}>
              <div
                className={'leaderboard-row' + (selectedAgent === agent.agent_id ? ' selected' : '') + (i < 3 ? ' top-three' : '')}
                onClick={() => selectAgent(agent.agent_id)}
              >
                <span className="lb-col lb-rank">
                  {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : '#' + (i + 1)}
                </span>
                <span className="lb-col lb-name">{agent.agent_name}</span>
                <span className="lb-col lb-points">{agent.total_points}</span>
                <span className="lb-col lb-wins">{agent.win_count}</span>
                <span className="lb-col lb-subs">{agent.submission_count}</span>
              </div>

              {selectedAgent === agent.agent_id && (
                <div className="agent-detail-panel">
                  {detailLoading ? (
                    <div className="loading">Loading agent details...</div>
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
          ))}
        </div>
      )}
    </div>
  )
}
