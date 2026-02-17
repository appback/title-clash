import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import { useLang } from '../i18n'
import { shortId } from '../utils/shortId'

export default function TitleBattleList() {
  const { t } = useLang()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/tournaments', { params: { content_type: 'title_battle', limit: 50 } })
      .then(res => {
        setTournaments(res.data.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading message={t('titleBattleList.loadingBattles')} />

  const playing = tournaments.filter(tr => tr.phase === 'playing')
  const completed = tournaments.filter(tr => tr.phase === 'completed')

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <Link to="/battle" className="btn btn-secondary btn-sm">&larr; {t('common.back')}</Link>
        <h1>{t('titleBattleList.title')}</h1>
        <p className="page-subtitle">{t('titleBattleList.subtitle')}</p>
      </div>

      {tournaments.length === 0 && (
        <EmptyState message={t('titleBattleList.noBattles')} />
      )}

      {playing.length > 0 && (
        <section>
          <h2 className="section-title">{t('titleBattleList.nowPlaying')}</h2>
          <div className="tournament-grid">
            {playing.map(tr => (
              <TournamentCard key={tr.id} tournament={tr} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="section-title">{t('titleBattleList.completed')}</h2>
          <div className="tournament-grid">
            {completed.map(tr => (
              <TournamentCard key={tr.id} tournament={tr} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function TournamentCard({ tournament }) {
  const { t } = useLang()
  const tr = tournament
  const isPlaying = tr.phase === 'playing'

  return (
    <Link to={`/battle/title/${tr.id}`} className="tournament-card">
      {tr.problem_image_url && (
        <div className="tournament-card-img">
          <img src={tr.problem_image_url} alt={shortId(tr.problem_id || tr.id)} loading="lazy" />
        </div>
      )}
      <div className="tournament-card-body">
        <h3><span className="short-id">{shortId(tr.problem_id || tr.id)}</span></h3>
        <div className="tournament-card-meta">
          <span>{tr.entry_count || '?'} {t('titleBattleList.titles')}</span>
          <span>{tr.participant_count || 0} {t('titleBattleList.players')}</span>
        </div>
        <span className={'badge ' + (isPlaying ? 'badge-green' : 'badge-gray')}>
          {isPlaying ? t('titleBattleList.playing') : t('titleBattleList.completedStatus')}
        </span>
      </div>
    </Link>
  )
}
