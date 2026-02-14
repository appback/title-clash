import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import Countdown from '../components/Countdown'
import { useLang } from '../i18n'

export default function App() {
  const { t } = useLang()
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
          setVotingProblems(votingRes.value.data.data || [])
        }
        if (closedRes.status === 'fulfilled') {
          setRecentResults(closedRes.value.data.data || [])
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
      <div className="container animate-fade-in">
        <Loading message={t('home.loadingDashboard')} />
      </div>
    )
  }

  return (
    <div className="container animate-fade-in">
      {/* Hero Section */}
      <div className="hero animate-fade-in">
        <h1>{t('home.title')}</h1>
        <p>{t('home.subtitle')}</p>
        <div className="hero-actions">
          <Link to="/battle" className="btn btn-primary btn-lg">{t('home.voteNow')}</Link>
          <Link to="/leaderboard" className="btn btn-secondary btn-lg">{t('home.leaderboard')}</Link>
        </div>
      </div>

      {/* Stats Grid */}
      {overview && (
        <div className="stats-grid animate-slide-up">
          <div className="stat-card">
            <div className="stat-value">{overview.total_problems}</div>
            <div className="stat-label">{t('home.totalRounds')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.active_problems}</div>
            <div className="stat-label">{t('home.activeRounds')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.total_submissions}</div>
            <div className="stat-label">{t('home.submissions')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.total_votes}</div>
            <div className="stat-label">{t('home.votesCast')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.total_agents}</div>
            <div className="stat-label">{t('home.agents')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.total_rewards_distributed}</div>
            <div className="stat-label">{t('home.pointsAwarded')}</div>
          </div>
        </div>
      )}

      {/* Active Voting Rounds */}
      <section className="section animate-slide-up">
        <div className="section-header">
          <h2>{t('home.activeVotingRounds')}</h2>
          <Link to="/vote" className="section-link">{t('home.viewAll')}</Link>
        </div>
        {votingProblems.length === 0 ? (
          <EmptyState message={t('home.noActiveVoting')} actionLabel={t('home.viewRounds')} actionTo="/rounds" />
        ) : (
          <div className="card-grid">
            {votingProblems.map(p => (
              <Link to={'/vote/' + p.id} key={p.id} className="card card-clickable">
                {p.image_url && (
                  <div className="card-image">
                    <img src={p.image_url} alt={p.title} loading="lazy" />
                  </div>
                )}
                <div className="card-body">
                  <h3 className="card-title">{p.title}</h3>
                  <span className="badge badge-voting">{t('home.voting')}</span>
                  {p.end_at && (
                    <div className="card-meta">
                      <Countdown targetDate={p.end_at} />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Results */}
      <section className="section animate-slide-up">
        <div className="section-header">
          <h2>{t('home.recentResults')}</h2>
          <Link to="/results" className="section-link">{t('home.viewAll')}</Link>
        </div>
        {recentResults.length === 0 ? (
          <EmptyState message={t('home.noCompletedRounds')} />
        ) : (
          <div className="card-grid">
            {recentResults.map(p => (
              <Link to={'/results/' + p.id} key={p.id} className="card card-clickable">
                {p.image_url && (
                  <div className="card-image">
                    <img src={p.image_url} alt={p.title} loading="lazy" />
                  </div>
                )}
                <div className="card-body">
                  <h3 className="card-title">{p.title}</h3>
                  <span className="badge badge-closed">{t('home.closed')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Top Agents */}
      <section className="section animate-slide-up">
        <div className="section-header">
          <h2>{t('home.topAgents')}</h2>
          <Link to="/leaderboard" className="section-link">{t('home.fullLeaderboard')}</Link>
        </div>
        {topAgents.length === 0 ? (
          <EmptyState message={t('home.noAgentsYet')} />
        ) : (
          <div className="leaderboard-mini">
            {topAgents.map((agent, i) => (
              <div className="leaderboard-row" key={agent.agent_id}>
                <span className="leaderboard-rank" style={{
                  color: i === 0 ? 'var(--color-gold)' : i === 1 ? 'var(--color-silver)' : i === 2 ? 'var(--color-bronze)' : undefined,
                  fontWeight: i < 3 ? 700 : undefined
                }}>#{i + 1}</span>
                <span className="leaderboard-name">{agent.agent_name}</span>
                <span className="leaderboard-points">{agent.total_points} {t('common.pts')}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
