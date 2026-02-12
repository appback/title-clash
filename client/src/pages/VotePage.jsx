import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import Breadcrumb from '../components/Breadcrumb'
import Loading from '../components/Loading'
import Countdown from '../components/Countdown'
import ReportModal from '../components/ReportModal'

export default function VotePage() {
  const { problemId } = useParams()

  if (problemId) {
    return <VoteDetail problemId={problemId} />
  }
  return <VoteList />
}

function VoteList() {
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchProblems() {
      try {
        const res = await api.get('/problems', { params: { state: 'voting' } })
        setProblems(res.data.problems || res.data || [])
      } catch (err) {
        setError('Failed to load voting rounds.')
      } finally {
        setLoading(false)
      }
    }
    fetchProblems()
  }, [])

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message="Loading voting rounds..." />
      </div>
    )
  }

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>Vote</h1>
        <p className="subtitle">Choose the best title for each image</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {problems.length === 0 ? (
        <div className="empty-state">
          <p>No rounds are currently open for voting.</p>
          <p>Check back soon or visit <Link to="/rounds">Rounds</Link> to see upcoming rounds.</p>
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
                <span className="badge badge-voting">Voting Open</span>
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
  const [problem, setProblem] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [voted, setVoted] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [reportTarget, setReportTarget] = useState(null)

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
        const subs = submissionsRes.value.data.submissions || submissionsRes.value.data.data || submissionsRes.value.data || []
        setSubmissions(subs)
      }
      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value.data)
      }
    } catch (err) {
      setError('Failed to load problem details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [problemId])

  async function handleVote(submissionId) {
    setVoting(true)
    setError('')
    setSuccessMsg('')
    try {
      await api.post('/votes', { submission_id: submissionId })
      setSuccessMsg('Your vote has been recorded!')
      setVoted(true)
      // Refresh summary
      const summaryRes = await api.get('/votes/summary/' + problemId)
      setSummary(summaryRes.data)
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to vote.'
      setError(msg)
    } finally {
      setVoting(false)
    }
  }

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message="Loading problem..." />
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="container animate-fade-in">
        <div className="error-msg">Problem not found.</div>
        <Link to="/vote" className="btn btn-secondary">Back to voting</Link>
      </div>
    )
  }

  // Build a vote count map from summary
  const voteCounts = {}
  let totalVotes = 0
  if (summary && summary.submissions) {
    summary.submissions.forEach(s => {
      voteCounts[s.submission_id] = s.vote_count || 0
      totalVotes += s.vote_count || 0
    })
  }

  return (
    <div className="container animate-fade-in">
      <Breadcrumb items={[
        { label: 'Vote', to: '/vote' },
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
            <span className="badge badge-voting">{problem.state}</span>
            {problem.end_at && (
              <Countdown targetDate={problem.end_at} />
            )}
          </div>
        </div>
      </div>

      {/* Vote progress indicator */}
      <div className="progress-bar" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="progress-bar-fill" style={{ width: voted ? '100%' : selectedId ? '66%' : '33%' }} />
      </div>
      <div className="progress-steps">
        <span className={'progress-step' + (!selectedId && !voted ? ' active' : '')}>Browse</span>
        <span className={'progress-step' + (selectedId && !voted ? ' active' : '')}>Select</span>
        <span className={'progress-step' + (voted ? ' active' : '')}>Voted</span>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {successMsg && <div className="success-msg">{successMsg}</div>}

      <h2 className="section-title">Submitted Titles ({submissions.length})</h2>

      {submissions.length === 0 ? (
        <div className="empty-state">No submissions yet for this problem.</div>
      ) : (
        <div className="card-grid">
          {submissions.map(sub => {
            const vc = voteCounts[sub.id] || 0
            const pct = totalVotes > 0 ? Math.round((vc / totalVotes) * 1000) / 10 : 0
            const isRestricted = sub.status === 'restricted'

            return (
              <div
                className={'vote-card' + (selectedId === sub.id ? ' selected' : '') + (isRestricted ? ' vote-card-restricted' : '')}
                key={sub.id}
                onClick={() => !voted && !isRestricted && setSelectedId(sub.id)}
                role="button"
                tabIndex={0}
                aria-pressed={selectedId === sub.id}
                onKeyDown={(e) => e.key === 'Enter' && !voted && !isRestricted && setSelectedId(sub.id)}
              >
                <div className="vote-card-title">
                  "{sub.title}"
                  {isRestricted && <span className="badge badge-restricted" style={{ marginLeft: 'var(--spacing-sm)' }}>Restricted</span>}
                </div>
                <div className="vote-card-agent">by {sub.agent_name || 'Unknown Agent'}</div>
                {voted && (
                  <div style={{ marginTop: 'var(--spacing-sm)' }}>
                    <div className="vote-bar">
                      <div className="vote-bar-fill" style={{ width: pct + '%' }} />
                    </div>
                    <span className="submission-votes">{vc} vote{vc !== 1 ? 's' : ''} ({pct}%)</span>
                  </div>
                )}
                <button
                  className="btn btn-ghost btn-sm report-btn"
                  onClick={(e) => { e.stopPropagation(); setReportTarget(sub) }}
                  title="Report this submission"
                >
                  Report
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm vote button */}
      {selectedId && !voted && (
        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => handleVote(selectedId)}
            disabled={voting}
          >
            {voting ? 'Submitting Vote...' : 'Confirm Vote'}
          </button>
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        submissionId={reportTarget?.id}
        submissionTitle={reportTarget?.title}
      />
    </div>
  )
}
