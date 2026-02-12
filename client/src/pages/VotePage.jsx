import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import Breadcrumb from '../components/Breadcrumb'
import Loading from '../components/Loading'
import Countdown from '../components/Countdown'
import ClashArena from '../components/ClashArena'
import { useLang } from '../i18n'

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

  useEffect(() => {
    async function fetchProblems() {
      try {
        const res = await api.get('/problems', { params: { state: 'voting' } })
        setProblems(res.data.data || [])
      } catch (err) {
        setError(t('vote.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }
    fetchProblems()
  }, [])

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
      )}
    </div>
  )
}

function VoteDetail({ problemId }) {
  const { t } = useLang()
  const [problem, setProblem] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const [problemRes, submissionsRes, summaryRes] = await Promise.allSettled([
          api.get('/problems/' + problemId),
          api.get('/submissions', { params: { problem_id: problemId } }),
          api.get('/votes/summary/' + problemId)
        ])

        if (problemRes.status === 'fulfilled') {
          setProblem(problemRes.value.data)
        }
        if (submissionsRes.status === 'fulfilled') {
          setSubmissions(submissionsRes.value.data.data || [])
        }
        if (summaryRes.status === 'fulfilled') {
          setSummary(summaryRes.value.data)
        }
      } catch (err) {
        setError(t('vote.failedToLoadDetail'))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [problemId])

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
        <h1>{problem.title}</h1>
        {problem.description && <p className="clash-description">{problem.description}</p>}
        <div className="clash-meta">
          <span className="badge badge-voting">{problem.state}</span>
          {problem.end_at && <Countdown targetDate={problem.end_at} />}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Clash Arena */}
      <ClashArena
        problem={problem}
        submissions={submissions}
        summary={summary}
      />
    </div>
  )
}
