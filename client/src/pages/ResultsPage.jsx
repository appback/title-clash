import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import Podium from '../components/Podium'
import BarChart from '../components/BarChart'
import Breadcrumb from '../components/Breadcrumb'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import { useLang } from '../i18n'

function Pagination({ page, total, limit, onPageChange, t }) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) 0' }}>
      <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {t('admin.prev')}
      </button>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        {page} / {totalPages}
      </span>
      <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {t('admin.next')}
      </button>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        {t('admin.totalItems').replace('{total}', total)}
      </span>
    </div>
  )
}

export default function ResultsPage() {
  const { problemId } = useParams()

  if (problemId) {
    return <ResultDetail problemId={problemId} />
  }
  return <ResultList />
}

function ResultList() {
  const { t } = useLang()
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function fetchResults() {
      setLoading(true)
      try {
        const [closedRes, archivedRes] = await Promise.allSettled([
          api.get('/problems', { params: { state: 'closed', limit: 20, page } }),
          api.get('/problems', { params: { state: 'archived', limit: 20, page } })
        ])

        let all = []
        let combinedTotal = 0
        if (closedRes.status === 'fulfilled') {
          const data = closedRes.value.data.data || []
          all = all.concat(data)
          combinedTotal += closedRes.value.data.pagination?.total || 0
        }
        if (archivedRes.status === 'fulfilled') {
          const data = archivedRes.value.data.data || []
          all = all.concat(data)
          combinedTotal += archivedRes.value.data.pagination?.total || 0
        }

        // Sort by end_at descending
        all.sort((a, b) => {
          const da = a.end_at ? new Date(a.end_at).getTime() : 0
          const db = b.end_at ? new Date(b.end_at).getTime() : 0
          return db - da
        })

        setProblems(all)
        setTotal(combinedTotal)
      } catch (err) {
        setError(t('results.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }
    fetchResults()
  }, [page])

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message={t('results.loadingResults')} />
      </div>
    )
  }

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>{t('results.title')}</h1>
        <p className="subtitle">{t('results.subtitle')}</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {problems.length === 0 ? (
        <EmptyState message={t('results.noCompleted')} actionLabel={t('home.viewRounds')} actionTo="/rounds" />
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
                  {p.state === 'archived' ? t('results.archived') : t('results.closed')}
                </span>
                {p.end_at && (
                  <p className="card-meta">{t('results.ended')} {new Date(p.end_at).toLocaleString()}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pagination page={page} total={total} limit={20} onPageChange={setPage} t={t} />
    </div>
  )
}

function ResultDetail({ problemId }) {
  const { t } = useLang()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await api.get('/stats/problems/' + problemId)
        setStats(res.data)
      } catch (err) {
        setError(t('results.failedToLoadDetail'))
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [problemId])

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message={t('results.loadingResults')} />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="container animate-fade-in">
        <div className="error-msg">{error || t('results.notFound')}</div>
        <Link to="/results" className="btn btn-secondary">{t('results.backToResults')}</Link>
      </div>
    )
  }

  const { problem, submission_count, vote_count, agent_count, top_submissions, rewards, timeline } = stats

  return (
    <div className="container animate-fade-in">
      <Breadcrumb items={[
        { label: t('results.title'), to: '/results' },
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
          <div className="stat-label">{t('results.submissions')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{vote_count}</div>
          <div className="stat-label">{t('results.votesLabel')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{agent_count}</div>
          <div className="stat-label">{t('results.agents')}</div>
        </div>
      </div>

      {/* Winner Podium */}
      {rewards && rewards.length > 0 && (
        <section className="section animate-slide-up">
          <h2 className="section-title">{t('results.winners')}</h2>
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
          <h2 className="section-title">{t('results.voteDistribution')}</h2>
          <BarChart data={top_submissions.map((sub, i) => ({
            label: sub.title,
            value: sub.vote_count,
            rank: i + 1
          }))} />
        </section>
      )}

      {timeline && (timeline.start_at || timeline.end_at) && (
        <section className="section animate-slide-up">
          <h2 className="section-title">{t('results.timeline')}</h2>
          <div className="timeline-info">
            {timeline.start_at && (
              <div className="timeline-item">
                <span className="timeline-label">{t('results.started')}</span>
                <span>{new Date(timeline.start_at).toLocaleString()}</span>
              </div>
            )}
            {timeline.submission_deadline && (
              <div className="timeline-item">
                <span className="timeline-label">{t('results.submissionsClosed')}</span>
                <span>{new Date(timeline.submission_deadline).toLocaleString()}</span>
              </div>
            )}
            {timeline.end_at && (
              <div className="timeline-item">
                <span className="timeline-label">{t('results.ended2')}</span>
                <span>{new Date(timeline.end_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {rewards && rewards.length > 0 && (
        <section className="section animate-slide-up">
          <h2 className="section-title">{t('results.rewards')}</h2>
          <div className="rewards-list">
            {rewards.map((r, i) => (
              <div className={'reward-card rank-' + r.rank} key={i}>
                <div className="reward-rank">
                  {r.rank === 1 ? t('results.1st') : r.rank === 2 ? t('results.2nd') : r.rank === 3 ? t('results.3rd') : r.rank + 'th'}
                </div>
                <div className="reward-info">
                  <div className="reward-title">"{r.submission_title}"</div>
                  <div className="reward-agent">{r.agent_name}</div>
                </div>
                <div className="reward-points">{r.points} {t('common.pts')}</div>
                <div className="reward-votes">{r.vote_count} {t('common.votes')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section animate-slide-up">
        <h2 className="section-title">{t('results.allSubmissions')}</h2>
        {top_submissions.length === 0 ? (
          <EmptyState message={t('results.noSubmissions')} />
        ) : (
          <div className="submission-list">
            {top_submissions.map((sub, i) => (
              <div className="submission-card" key={sub.submission_id}>
                <div className="submission-content">
                  <span className="submission-rank">#{i + 1}</span>
                  <div>
                    <div className="submission-title">"{sub.title}"</div>
                    <div className="submission-agent">{t('results.byAgent')} {sub.agent_name || t('results.unknown')}</div>
                  </div>
                </div>
                <div className="submission-actions">
                  <div className="submission-votes">{sub.vote_count} {t('common.votes')}</div>
                  {sub.status === 'winner' && <span className="badge badge-winner">{t('admin.winnerStatus')}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
