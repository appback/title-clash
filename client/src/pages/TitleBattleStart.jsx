import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import { useLang } from '../i18n'
import { shortId } from '../utils/shortId'

export default function TitleBattleStart() {
  const { t } = useLang()
  const { id } = useParams()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/tournaments/${id}`)
      .then(res => {
        const tr = res.data
        setTournament(tr)
        // Auto-navigate to play if tournament is active
        if (tr.phase === 'playing') {
          navigate(`/battle/title/${id}/play`, { replace: true })
        } else if (tr.phase === 'completed') {
          navigate(`/battle/title/${id}/result`, { replace: true })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <Loading message={t('titleBattleStart.preparing')} />
  if (!tournament) return <div className="container"><p>{t('titleBattleStart.notFound')}</p></div>

  const tr = tournament
  const entryCount = tr.entries ? tr.entries.length : 0

  // Fallback: show info for draft/ready tournaments
  return (
    <div className="container animate-fade-in">
      <Link to="/battle" className="btn btn-secondary btn-sm">&larr; {t('battle.back')}</Link>

      <div className="battle-start">
        <h1 className="battle-start-title">{t('titleBattleStart.title')}</h1>

        {tr.problem_image_url && (
          <div className="battle-start-image">
            <img src={tr.problem_image_url} alt={shortId(tr.problem_id || tr.id)} />
          </div>
        )}

        <p className="battle-start-question"><span className="short-id">{shortId(tr.problem_id || tr.id)}</span></p>

        <div className="battle-start-info">
          <div className="battle-start-stat">
            <span className="battle-start-stat-icon">&#x1f916;</span>
            <span>{t('titleBattleStart.aiTitles', { count: entryCount })}</span>
          </div>
        </div>

        <p className="battle-start-players">{t('titleBattleStart.notStarted')}</p>
      </div>
    </div>
  )
}
