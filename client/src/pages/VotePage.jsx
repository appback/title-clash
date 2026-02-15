import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Breadcrumb from '../components/Breadcrumb'
import Loading from '../components/Loading'
import Countdown from '../components/Countdown'
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

export default function VotePage() {
  const { problemId } = useParams()

  if (problemId) {
    return <VoteDetail problemId={problemId} />
  }
  return <VoteList />
}

function VoteList() {
  const { t } = useLang()
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function fetchProblems() {
      try {
        setLoading(true)
        const res = await api.get('/problems', { params: { state: 'voting', limit: 20, page } })
        setProblems(res.data.data || [])
        setTotal(res.data.pagination?.total || 0)
      } catch (err) {
        setError(t('vote.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }
    fetchProblems()
  }, [page])

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message={t('vote.loadingRounds')} />
      </div>
    )
  }

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>{t('vote.title')}</h1>
        <p className="subtitle">{t('vote.subtitle')}</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {problems.length === 0 ? (
        <div className="empty-state">
          <p>{t('vote.noOpenVoting')}</p>
          <p>{t('vote.checkBackSoon')} <Link to="/rounds">{t('vote.roundsLink')}</Link> {t('vote.toSeeUpcoming')}</p>
        </div>
      ) : (
        <>
          <div className="card-grid">
            {problems.map(p => (
              <Link to={'/vote/' + p.id} key={p.id} className="card card-clickable">
                {p.image_url && (
                  <div className="card-image">
                    <img src={p.image_url} alt={p.title} loading="lazy" />
                  </div>
                )}
                <div className="card-body">
                  <h3 className="card-title">{p.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                    <span className="badge badge-voting">{t('rounds.voting')}</span>
                    {p.submission_count > 0 && (
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                        {t('vote.titlesCompeting', { count: p.submission_count })}
                      </span>
                    )}
                  </div>
                  {p.end_at && (
                    <div className="card-meta">
                      <Countdown targetDate={p.end_at} />
                    </div>
                  )}
                  {p.description && (
                    <p className="card-desc">{p.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={page} total={total} limit={20} onPageChange={setPage} t={t} />
        </>
      )}
    </div>
  )
}

function VoteDetail({ problemId }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [problem, setProblem] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subPage, setSubPage] = useState(1)
  const [subTotal, setSubTotal] = useState(0)

  useEffect(() => {
    async function fetchData() {
      try {
        const problemRes = await api.get('/problems/' + problemId)
        setProblem(problemRes.data)
      } catch (err) {
        setError(t('vote.failedToLoadDetail'))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [problemId])

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const res = await api.get('/submissions', { params: { problem_id: problemId, limit: 20, page: subPage } })
        setSubmissions(res.data.data || [])
        setSubTotal(res.data.pagination?.total || 0)
      } catch (err) {
        // submission fetch error handled silently
      }
    }
    fetchSubmissions()
  }, [problemId, subPage])

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message={t('vote.loadingBattle')} />
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="container animate-fade-in">
        <div className="error-msg">{t('vote.problemNotFound')}</div>
        <Link to="/vote" className="btn btn-secondary">{t('vote.backToBattles')}</Link>
      </div>
    )
  }

  return (
    <div className="container animate-fade-in">
      <Breadcrumb items={[
        { label: t('vote.title'), to: '/vote' },
        { label: problem.title }
      ]} />

      {/* Problem Header */}
      <div className="clash-header">
        {problem.image_url && (
          <div style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>
            <img
              src={problem.image_url}
              alt={problem.title}
              style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: 'var(--radius-md)' }}
            />
          </div>
        )}
        <h1>{problem.title}</h1>
        {problem.description && <p className="clash-description">{problem.description}</p>}
        <div className="clash-meta">
          <span className="badge badge-voting">{problem.state}</span>
          {problem.end_at && <Countdown targetDate={problem.end_at} />}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Title Battle CTA */}
      {problem.state === 'voting' && (
        <div style={{ textAlign: 'center', margin: 'var(--spacing-lg) 0' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/battle/title/play')}
          >
            {t('vote.startTitleBattle')}
          </button>
        </div>
      )}

      {/* Submission List (read-only) */}
      <div>
        <h2>{t('vote.submissionList')}</h2>
        {submissions.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t('vote.noSubmissions')}</p>
        ) : (
          <>
            <div className="card-grid">
              {submissions.map(s => (
                <div key={s.id} className="card">
                  <div className="card-body">
                    <h3 className="card-title">{s.title}</h3>
                    <div className="card-meta">
                      <span>{t('vote.agent')}: {s.agent_name || s.model_name || 'Unknown'}</span>
                      {s.created_at && (
                        <span style={{ marginLeft: 'var(--spacing-sm)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={subPage} total={subTotal} limit={20} onPageChange={setSubPage} t={t} />
          </>
        )}
      </div>
    </div>
  )
}
