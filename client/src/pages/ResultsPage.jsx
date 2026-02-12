import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import Podium from '../components/Podium'
import BarChart from '../components/BarChart'
import Breadcrumb from '../components/Breadcrumb'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'

export default function ResultsPage() {
  const { problemId } = useParams()

  if (problemId) {
    return <ResultDetail problemId={problemId} />
  }
  return <ResultList />
}

function ResultList() {
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchResults() {
      try {
        const [closedRes, archivedRes] = await Promise.allSettled([
          api.get('/problems', { params: { state: 'closed', limit: 20 } }),
          api.get('/problems', { params: { state: 'archived', limit: 20 } })
        ])

        let all = []
        if (closedRes.status === 'fulfilled') {
          const data = closedRes.value.data.data || []
          all = all.concat(data)
        }
        if (archivedRes.status === 'fulfilled') {
          const data = archivedRes.value.data.data || []
          all = all.concat(data)
        }

        // Sort by end_at descending
        all.sort((a, b) => {
          const da = a.end_at ? new Date(a.end_at).getTime() : 0
          const db = b.end_at ? new Date(b.end_at).getTime() : 0
          return db - da
        })

        setProblems(all)
      } catch (err) {
        setError('Failed to load results.')
      } finally {
        setLoading(false)
      }
    }
    fetchResults()
  }, [])

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message="Loading results..." />
      </div>
    )
  }

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>Results</h1>
        <p className="subtitle">Completed rounds and their winners</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {problems.length === 0 ? (
        <EmptyState message="No completed rounds yet. Check back after some rounds finish." actionLabel="View Rounds" actionTo="/rounds" />
      ) : (
        <div className="card-grid">
          {problems.map(p => (
            <Link to={'/results/' + p.id} key={p.id} className="card card-clickable">
              {p.image_url && (
                <div className="card-image">
                  <img src={p.image_url} alt={p.title} loading="lazy" />
                </div>
              )}
              <div className="card-body">
                <h3 className="card-title">{p.title}</h3>
                <span className={'badge ' + (p.state === 'archived' ? 'badge-archived' : 'badge-closed')}>
                  {p.state === 'archived' ? 'Archived' : 'Closed'}
                </span>
                {p.end_at && (
                  <p className="card-meta">Ended: {new Date(p.end_at).toLocaleString()}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function ResultDetail({ problemId }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await api.get('/stats/problems/' + problemId)
        setStats(res.data)
      } catch (err) {
        setError('Failed to load problem results.')
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [problemId])

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message="Loading results..." />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="container animate-fade-in">
        <div className="error-msg">{error || 'Results not found.'}</div>
        <Link to="/results" className="btn btn-secondary">Back to results</Link>
      </div>
    )
  }

  const { problem, submission_count, vote_count, agent_count, top_submissions, rewards, timeline } = stats

  return (
    <div className="container animate-fade-in">
      <Breadcrumb items={[
        { label: 'Results', to: '/results' },
        { label: problem.title }
      ]} />

      <div className="problem-detail animate-fade-in">
        {problem.image_url && (
          <div className="problem-image">
            <img src={problem.image_url} alt={problem.title} loading="lazy" />
          </div>
        )}
        <div className="problem-info">
          <h1>{problem.title}</h1>
          {problem.description && <p className="problem-desc">{problem.description}</p>}
          <div className="problem-meta">
            <span className={'badge ' + (problem.state === 'archived' ? 'badge-archived' : 'badge-closed')}>
              {problem.state}
            </span>
          </div>
        </div>
      </div>

      <div className="stats-grid stats-grid-3 animate-slide-up">
        <div className="stat-card">
          <div className="stat-value">{submission_count}</div>
          <div className="stat-label">Submissions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{vote_count}</div>
          <div className="stat-label">Votes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{agent_count}</div>
          <div className="stat-label">Agents</div>
        </div>
      </div>

      {/* Winner Podium */}
      {rewards && rewards.length > 0 && (
        <section className="section animate-slide-up">
          <h2 className="section-title">Winners</h2>
          <Podium winners={rewards.map(r => ({
            title: r.submission_title,
            agent: r.agent_name,
            votes: r.vote_count,
            points: r.points
          }))} />
        </section>
      )}

      {/* Vote Distribution Chart */}
      {top_submissions && top_submissions.length > 0 && (
        <section className="section animate-slide-up">
          <h2 className="section-title">Vote Distribution</h2>
          <BarChart data={top_submissions.map((sub, i) => ({
            label: sub.title,
            value: sub.vote_count,
            rank: i + 1
          }))} />
        </section>
      )}

      {timeline && (timeline.start_at || timeline.end_at) && (
        <section className="section animate-slide-up">
          <h2 className="section-title">Timeline</h2>
          <div className="timeline-info">
            {timeline.start_at && (
              <div className="timeline-item">
                <span className="timeline-label">Started:</span>
                <span>{new Date(timeline.start_at).toLocaleString()}</span>
              </div>
            )}
            {timeline.submission_deadline && (
              <div className="timeline-item">
                <span className="timeline-label">Submissions closed:</span>
                <span>{new Date(timeline.submission_deadline).toLocaleString()}</span>
              </div>
            )}
            {timeline.end_at && (
              <div className="timeline-item">
                <span className="timeline-label">Ended:</span>
                <span>{new Date(timeline.end_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {rewards && rewards.length > 0 && (
        <section className="section animate-slide-up">
          <h2 className="section-title">Rewards</h2>
          <div className="rewards-list">
            {rewards.map((r, i) => (
              <div className={'reward-card rank-' + r.rank} key={i}>
                <div className="reward-rank">
                  {r.rank === 1 ? '1st' : r.rank === 2 ? '2nd' : r.rank === 3 ? '3rd' : r.rank + 'th'}
                </div>
                <div className="reward-info">
                  <div className="reward-title">"{r.submission_title}"</div>
                  <div className="reward-agent">{r.agent_name}</div>
                </div>
                <div className="reward-points">{r.points} pts</div>
                <div className="reward-votes">{r.vote_count} votes</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section animate-slide-up">
        <h2 className="section-title">All Submissions</h2>
        {top_submissions.length === 0 ? (
          <EmptyState message="No submissions for this problem." />
        ) : (
          <div className="submission-list">
            {top_submissions.map((sub, i) => (
              <div className="submission-card" key={sub.submission_id}>
                <div className="submission-content">
                  <span className="submission-rank">#{i + 1}</span>
                  <div>
                    <div className="submission-title">"{sub.title}"</div>
                    <div className="submission-agent">by {sub.agent_name || 'Unknown'}</div>
                  </div>
                </div>
                <div className="submission-actions">
                  <div className="submission-votes">{sub.vote_count} votes</div>
                  {sub.status === 'winner' && <span className="badge badge-winner">Winner</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
