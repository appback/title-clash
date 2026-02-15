import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Countdown from '../components/Countdown'
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

export default function RoundsPage() {
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

  // Calculate submission deadline from start_at and end_at
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
                <div className="card" key={p.id}>
                  {p.image_url && (
                    <div className="card-image">
                      <img src={p.image_url} alt={p.title} loading="lazy" />
                    </div>
                  )}
                  <div className="card-body">
                    <h3 className="card-title">{p.title}</h3>
                    <span className="badge badge-open">{t('rounds.open')}</span>
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
                </div>
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
              <Link to={'/vote/' + p.id} key={p.id} className="card card-clickable">
                {p.image_url && (
                  <div className="card-image">
                    <img src={p.image_url} alt={p.title} loading="lazy" />
                  </div>
                )}
                <div className="card-body">
                  <h3 className="card-title">{p.title}</h3>
                  <span className="badge badge-voting">{t('rounds.voting')}</span>
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
