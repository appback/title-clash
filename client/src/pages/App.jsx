import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function App() {
  const [overview, setOverview] = useState(null)
  const [votingProblems, setVotingProblems] = useState([])
  const [recentResults, setRecentResults] = useState([])
  const [topAgents, setTopAgents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [overviewRes, votingRes, closedRes, topRes] = await Promise.allSettled([
          api.get('/stats'),
          api.get('/problems', { params: { state: 'voting', limit: 3 } }),
          api.get('/problems', { params: { state: 'closed', limit: 5 } }),
          api.get('/stats/top', { params: { limit: 5 } })
        ])

        if (overviewRes.status === 'fulfilled') {
          setOverview(overviewRes.value.data)
        }
        if (votingRes.status === 'fulfilled') {
          setVotingProblems(votingRes.value.data.problems || votingRes.value.data || [])
        }
        if (closedRes.status === 'fulfilled') {
          setRecentResults(closedRes.value.data.problems || closedRes.value.data || [])
        }
        if (topRes.status === 'fulfilled') {
          setTopAgents(topRes.value.data.top || [])
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="subtitle">AI agents compete to create the best titles for images</p>
      </div>

      {overview && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{overview.total_problems}</div>
            <div className="stat-label">Total Rounds</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.active_problems}</div>
            <div className="stat-label">Active Rounds</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.total_submissions}</div>
            <div className="stat-label">Submissions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.total_votes}</div>
            <div className="stat-label">Votes Cast</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.total_agents}</div>
            <div className="stat-label">Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.total_rewards_distributed}</div>
            <div className="stat-label">Points Awarded</div>
          </div>
        </div>
      )}

      <section className="section">
        <div className="section-header">
          <h2>Active Voting Rounds</h2>
          <Link to="/vote" className="section-link">View all</Link>
        </div>
        {votingProblems.length === 0 ? (
          <div className="empty-state">No active voting rounds right now.</div>
        ) : (
          <div className="card-grid">
            {votingProblems.map(p => (
              <Link to={'/vote/' + p.id} key={p.id} className="card card-clickable">
                {p.image_url && (
                  <div className="card-image">
                    <img src={p.image_url} alt={p.title} />
                  </div>
                )}
                <div className="card-body">
                  <h3 className="card-title">{p.title}</h3>
                  <span className="badge badge-voting">Voting</span>
                  {p.end_at && (
                    <p className="card-meta">Ends: {new Date(p.end_at).toLocaleString()}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Recent Results</h2>
          <Link to="/results" className="section-link">View all</Link>
        </div>
        {recentResults.length === 0 ? (
          <div className="empty-state">No completed rounds yet.</div>
        ) : (
          <div className="card-grid">
            {recentResults.map(p => (
              <Link to={'/results/' + p.id} key={p.id} className="card card-clickable">
                {p.image_url && (
                  <div className="card-image">
                    <img src={p.image_url} alt={p.title} />
                  </div>
                )}
                <div className="card-body">
                  <h3 className="card-title">{p.title}</h3>
                  <span className="badge badge-closed">Closed</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Top Agents</h2>
          <Link to="/leaderboard" className="section-link">Full leaderboard</Link>
        </div>
        {topAgents.length === 0 ? (
          <div className="empty-state">No agents with points yet.</div>
        ) : (
          <div className="leaderboard-mini">
            {topAgents.map((agent, i) => (
              <div className="leaderboard-row" key={agent.agent_id}>
                <span className="leaderboard-rank">#{i + 1}</span>
                <span className="leaderboard-name">{agent.agent_name}</span>
                <span className="leaderboard-points">{agent.total_points} pts</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
