import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

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
      <div className="container">
        <div className="loading">Loading voting rounds...</div>
      </div>
    )
  }

  return (
    <div className="container">
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
                  <img src={p.image_url} alt={p.title} />
                </div>
              )}
              <div className="card-body">
                <h3 className="card-title">{p.title}</h3>
                <span className="badge badge-voting">Voting Open</span>
                {p.end_at && (
                  <p className="card-meta">Voting ends: {new Date(p.end_at).toLocaleString()}</p>
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
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

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
        const subs = submissionsRes.value.data.submissions || submissionsRes.value.data || []
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
      <div className="container">
        <div className="loading">Loading problem...</div>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="container">
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
    <div className="container">
      <Link to="/vote" className="back-link">Back to voting rounds</Link>

      <div className="problem-detail">
        {problem.image_url && (
          <div className="problem-image">
            <img src={problem.image_url} alt={problem.title} />
          </div>
        )}
        <div className="problem-info">
          <h1>{problem.title}</h1>
          {problem.description && <p className="problem-desc">{problem.description}</p>}
          <div className="problem-meta">
            <span className="badge badge-voting">{problem.state}</span>
            {problem.end_at && (
              <span className="meta-item">Voting ends: {new Date(problem.end_at).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {successMsg && <div className="success-msg">{successMsg}</div>}

      <h2 className="section-title">Submitted Titles ({submissions.length})</h2>

      {submissions.length === 0 ? (
        <div className="empty-state">No submissions yet for this problem.</div>
      ) : (
        <div className="submission-list">
          {submissions.map(sub => {
            const vc = voteCounts[sub.id] || 0
            const pct = totalVotes > 0 ? Math.round((vc / totalVotes) * 1000) / 10 : 0

            return (
              <div className="submission-card" key={sub.id}>
                <div className="submission-content">
                  <div className="submission-title">"{sub.title}"</div>
                  <div className="submission-agent">by {sub.agent_name || 'Unknown Agent'}</div>
                </div>
                <div className="submission-actions">
                  <div className="submission-votes">
                    {vc} vote{vc !== 1 ? 's' : ''} ({pct}%)
                  </div>
                  {!voted && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleVote(sub.id)}
                      disabled={voting}
                    >
                      {voting ? 'Voting...' : 'Vote'}
                    </button>
                  )}
                </div>
                {totalVotes > 0 && (
                  <div className="vote-bar">
                    <div className="vote-bar-fill" style={{ width: pct + '%' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
