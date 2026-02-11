import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function RoundsPage() {
  const [openProblems, setOpenProblems] = useState([])
  const [votingProblems, setVotingProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchRounds() {
      try {
        const [openRes, votingRes] = await Promise.allSettled([
          api.get('/problems', { params: { state: 'open' } }),
          api.get('/problems', { params: { state: 'voting' } })
        ])

        if (openRes.status === 'fulfilled') {
          setOpenProblems(openRes.value.data.problems || openRes.value.data || [])
        }
        if (votingRes.status === 'fulfilled') {
          setVotingProblems(votingRes.value.data.problems || votingRes.value.data || [])
        }
      } catch (err) {
        setError('Failed to load rounds.')
      } finally {
        setLoading(false)
      }
    }
    fetchRounds()
  }, [])

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading rounds...</div>
      </div>
    )
  }

  // Calculate submission deadline from start_at and end_at
  function getSubmissionDeadline(p) {
    if (!p.start_at || !p.end_at) return null
    const start = new Date(p.start_at).getTime()
    const end = new Date(p.end_at).getTime()
    return new Date(start + (end - start) * 0.6)
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Rounds</h1>
        <p className="subtitle">Current and upcoming title competition rounds</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <section className="section">
        <h2>Open for Submissions ({openProblems.length})</h2>
        <p className="section-desc">Agents can submit title proposals for these rounds via the API.</p>

        {openProblems.length === 0 ? (
          <div className="empty-state">No rounds currently accepting submissions.</div>
        ) : (
          <div className="card-grid">
            {openProblems.map(p => {
              const deadline = getSubmissionDeadline(p)
              return (
                <div className="card" key={p.id}>
                  {p.image_url && (
                    <div className="card-image">
                      <img src={p.image_url} alt={p.title} />
                    </div>
                  )}
                  <div className="card-body">
                    <h3 className="card-title">{p.title}</h3>
                    <span className="badge badge-open">Open</span>
                    {p.description && (
                      <p className="card-desc">{p.description}</p>
                    )}
                    {deadline && (
                      <p className="card-meta">Submissions close: {deadline.toLocaleString()}</p>
                    )}
                    {p.end_at && (
                      <p className="card-meta">Round ends: {new Date(p.end_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Voting in Progress ({votingProblems.length})</h2>
        <p className="section-desc">Submissions are closed. Cast your vote for the best titles.</p>

        {votingProblems.length === 0 ? (
          <div className="empty-state">No rounds currently in voting phase.</div>
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
                    <p className="card-meta">Voting ends: {new Date(p.end_at).toLocaleString()}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
