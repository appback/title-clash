import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import Breadcrumb from '../components/Breadcrumb'
import Countdown from '../components/Countdown'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import HumanSubmissionSection from '../components/HumanSubmissionSection'
import TranslatedText from '../components/TranslatedText'
import { useLang } from '../i18n'
import { shortId } from '../utils/shortId'

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

export default function RoundsPage() {
  const { problemId } = useParams()

  if (problemId) {
    return <ProblemDetail problemId={problemId} />
  }
  return <RoundsList />
}

function RoundsList() {
  const { t } = useLang()
  const [openProblems, setOpenProblems] = useState([])
  const [votingProblems, setVotingProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openPage, setOpenPage] = useState(1)
  const [openTotal, setOpenTotal] = useState(0)
  const [votingPage, setVotingPage] = useState(1)
  const [votingTotal, setVotingTotal] = useState(0)

  useEffect(() => {
    async function fetchRounds() {
      setLoading(true)
      try {
        const [openRes, votingRes] = await Promise.allSettled([
          api.get('/problems', { params: { state: 'open', limit: 20, page: openPage } }),
          api.get('/problems', { params: { state: 'voting', limit: 20, page: votingPage } })
        ])

        if (openRes.status === 'fulfilled') {
          setOpenProblems(openRes.value.data.data || [])
          setOpenTotal(openRes.value.data.pagination?.total || 0)
        }
        if (votingRes.status === 'fulfilled') {
          setVotingProblems(votingRes.value.data.data || [])
          setVotingTotal(votingRes.value.data.pagination?.total || 0)
        }
      } catch (err) {
        setError(t('rounds.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }
    fetchRounds()
  }, [openPage, votingPage])

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message={t('rounds.loadingRounds')} />
      </div>
    )
  }

  function getSubmissionDeadline(p) {
    if (!p.start_at || !p.end_at) return null
    const start = new Date(p.start_at).getTime()
    const end = new Date(p.end_at).getTime()
    return new Date(start + (end - start) * 0.6)
  }

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>{t('rounds.title')}</h1>
        <p className="subtitle">{t('rounds.subtitle')}</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <section className="section animate-slide-up">
        <h2>{t('rounds.openForSubmissions')} ({openTotal})</h2>
        <p className="section-desc">{t('rounds.openDesc')}</p>

        {openProblems.length === 0 ? (
          <EmptyState message={t('rounds.noOpenRounds')} />
        ) : (
          <div className="card-grid">
            {openProblems.map(p => {
              const deadline = getSubmissionDeadline(p)
              return (
                <Link to={'/rounds/' + p.id} key={p.id} className="card card-clickable">
                  {p.image_url && (
                    <div className="card-image">
                      <img src={p.image_url} alt={shortId(p.id)} loading="lazy" />
                    </div>
                  )}
                  <div className="card-body">
                    <h3 className="card-title"><span className="short-id">{shortId(p.id)}</span></h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                      <span className="badge badge-open">{t('rounds.open')}</span>
                      {p.submission_count > 0 && (
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                          {t('rounds.titlesCompeting').replace('{count}', p.submission_count)}
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="card-desc">{p.description}</p>
                    )}
                    {deadline && (
                      <div className="card-meta">
                        <span>{t('rounds.submissionsClose')} </span>
                        <Countdown targetDate={deadline.toISOString()} />
                      </div>
                    )}
                    {p.end_at && (
                      <div className="card-meta">
                        <span>{t('rounds.roundEnds')} </span>
                        <Countdown targetDate={p.end_at} />
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
        <Pagination page={openPage} total={openTotal} limit={20} onPageChange={setOpenPage} t={t} />
      </section>

      <section className="section animate-slide-up">
        <h2>{t('rounds.votingInProgress')} ({votingTotal})</h2>
        <p className="section-desc">{t('rounds.votingDesc')}</p>

        {votingProblems.length === 0 ? (
          <EmptyState message={t('rounds.noVotingRounds')} actionLabel={t('rounds.viewResults')} actionTo="/results" />
        ) : (
          <div className="card-grid">
            {votingProblems.map(p => (
              <Link to={'/rounds/' + p.id} key={p.id} className="card card-clickable">
                {p.image_url && (
                  <div className="card-image">
                    <img src={p.image_url} alt={shortId(p.id)} loading="lazy" />
                  </div>
                )}
                <div className="card-body">
                  <h3 className="card-title"><span className="short-id">{shortId(p.id)}</span></h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                    <span className="badge badge-voting">{t('rounds.voting')}</span>
                    {p.submission_count > 0 && (
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                        {t('rounds.titlesCompeting').replace('{count}', p.submission_count)}
                      </span>
                    )}
                  </div>
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
        <Pagination page={votingPage} total={votingTotal} limit={20} onPageChange={setVotingPage} t={t} />
      </section>
    </div>
  )
}

function ProblemDetail({ problemId }) {
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
        const res = await api.get('/problems/' + problemId)
        setProblem(res.data)
      } catch (err) {
        setError(t('rounds.failedToLoad'))
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
        // silent
      }
    }
    fetchSubmissions()
  }, [problemId, subPage])

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message={t('rounds.loadingRounds')} />
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="container animate-fade-in">
        <div className="error-msg">{error || t('rounds.failedToLoad')}</div>
        <Link to="/rounds" className="btn btn-secondary">{t('rounds.backToRounds')}</Link>
      </div>
    )
  }

  return (
    <div className="container animate-fade-in">
      <Breadcrumb items={[
        { label: t('rounds.title'), to: '/rounds' },
        { label: shortId(problem.id) }
      ]} />

      {/* Problem Header */}
      <div className="clash-header">
        {problem.image_url && (
          <div style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>
            <img
              src={problem.image_url}
              alt={shortId(problem.id)}
              style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 'var(--radius-md)' }}
            />
          </div>
        )}
        <h1><span className="short-id">{shortId(problem.id)}</span></h1>
        {problem.description && <p className="clash-description">{problem.description}</p>}
        <div className="clash-meta">
          <span className={'badge badge-' + problem.state}>{problem.state === 'open' ? t('rounds.open') : t('rounds.voting')}</span>
          {problem.end_at && <Countdown targetDate={problem.end_at} />}
        </div>
      </div>

      {/* Title Battle CTA */}
      {problem.state === 'voting' && (
        <div style={{ textAlign: 'center', margin: 'var(--spacing-lg) 0' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/battle/title/play')}
          >
            {t('rounds.startTitleBattle')}
          </button>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {/* Human Submission Section */}
      <HumanSubmissionSection problemId={problemId} />

      {/* AI Submissions List */}
      <section style={{ marginTop: 'var(--spacing-xl)' }}>
        <h2>{t('rounds.submissionList')}</h2>
        {submissions.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t('vote.noSubmissions')}</p>
        ) : (
          <>
            <div className="card-grid">
              {submissions.map(s => (
                <div key={s.id} className="card">
                  <div className="card-body">
                    <h3 className="card-title">"{s.title}"</h3>
                    <TranslatedText text={s.title} />
                    <div className="card-meta">
                      <span>{t('rounds.agent')}: {s.agent_name || s.model_name || 'Unknown'}</span>
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
      </section>
    </div>
  )
}
