import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useLang } from '../i18n'

export default function BattlePage() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [humanAvailable, setHumanAvailable] = useState(null)

  useEffect(() => {
    api.get('/battle/human-vs-ai/play')
      .then(res => setHumanAvailable(res.data.available))
      .catch(() => setHumanAvailable(false))
  }, [])

  async function quickPlay() {
    if (loading) return
    setLoading(true)
    try {
      const res = await api.get('/games/play')
      if (res.data.game) {
        navigate('/battle/title/play')
      } else {
        navigate('/battle')
      }
    } catch {
      navigate('/battle')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>{t('battle.title')}</h1>
        <p className="page-subtitle">{t('battle.subtitle')}</p>
      </div>

      <div className="battle-hub">
        <div className="battle-hub-card" onClick={() => navigate('/battle/rating')} role="button" tabIndex={0}>
          <div className="battle-hub-icon">&#x2B50;</div>
          <h2>{t('rating.title')}</h2>
          <p>{t('rating.subtitle')}</p>
          <span className="btn btn-primary">{t('battle.playNow')}</span>
        </div>

        <div className="battle-hub-card" onClick={quickPlay} role="button" tabIndex={0}>
          <div className="battle-hub-icon">&#x1f3af;</div>
          <h2>{t('battle.titleBattle')}</h2>
          <p>{t('battle.titleBattleDesc')}</p>
          <span className={'btn btn-primary' + (loading ? ' btn-loading' : '')}>
            {loading ? t('battle.loading') : t('battle.playNow')}
          </span>
        </div>

        <div className="battle-hub-card" onClick={() => navigate('/battle/image/play')} role="button" tabIndex={0}>
          <div className="battle-hub-icon">&#x1f5bc;</div>
          <h2>{t('battle.imageBattle')}</h2>
          <p>{t('battle.imageBattleDesc')}</p>
          <span className="btn btn-primary">{t('battle.playNow')}</span>
        </div>

        {humanAvailable === false ? (
          <div className="battle-hub-card battle-hub-card-locked">
            <div className="battle-hub-icon">&#x1f91c;</div>
            <h2>{t('battle.humanVsAi')}</h2>
            <p>{t('battle.humanVsAiDesc')}</p>
            <span className="btn btn-secondary">{t('battle.notEnoughData')}</span>
          </div>
        ) : (
          <div className="battle-hub-card" onClick={() => navigate('/battle/human-vs-ai/play')} role="button" tabIndex={0}>
            <div className="battle-hub-icon">&#x1f91c;</div>
            <h2>{t('battle.humanVsAi')}</h2>
            <p>{t('battle.humanVsAiDesc')}</p>
            <span className="btn btn-primary">{t('battle.playNow')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
