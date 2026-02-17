import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import TranslatedText from '../components/TranslatedText'
import { useLang } from '../i18n'
import { shortId } from '../utils/shortId'

function StarSelector({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0)

  return (
    <div className="star-selector" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          className={'star-btn' + (star <= (hover || value) ? ' star-filled' : '')}
          onClick={() => !disabled && onChange(star)}
          onMouseEnter={() => !disabled && setHover(star)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && !disabled && onChange(star)}
          aria-label={star + ' stars'}
        >
          {star <= (hover || value) ? '\u2605' : '\u2606'}
        </span>
      ))}
    </div>
  )
}

export default function TitleRatingPage() {
  const { t } = useLang()

  const [item, setItem] = useState(null)
  const [stars, setStars] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [result, setResult] = useState(null)

  const fetchNext = useCallback(async () => {
    setLoading(true)
    setStars(0)
    setResult(null)
    try {
      const res = await api.get('/ratings/next', { params: { count: 1 } })
      const items = res.data.items || []
      if (items.length === 0) {
        setAllDone(true)
        setItem(null)
      } else {
        setItem(items[0])
        setAllDone(false)
      }
    } catch {
      setAllDone(true)
      setItem(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNext()
  }, [fetchNext])

  async function handleRate() {
    if (!item || stars === 0 || submitting) return
    setSubmitting(true)
    try {
      const res = await api.post('/ratings', {
        submission_id: item.submission_id,
        stars
      })
      setResult(res.data)
      // Show result briefly, then load next
      setTimeout(() => {
        fetchNext()
      }, 1500)
    } catch {
      // On error, still allow retry
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container animate-fade-in">
        <Loading message={t('common.loading')} />
      </div>
    )
  }

  if (allDone) {
    return (
      <div className="container animate-fade-in">
        <div className="battle-complete">
          <h2>{t('rating.allDone')}</h2>
          <p>{t('rating.thankYou')}</p>
          <Link to="/battle" className="btn btn-primary">&larr; {t('battle.back')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container animate-fade-in">
      <div className="battle-play-header">
        <Link to="/battle" className="btn btn-ghost btn-sm">&larr; {t('battle.back')}</Link>
        <span className="battle-round-badge">{t('rating.title')}</span>
      </div>

      {item && (
        <div className="rating-card animate-fade-in">
          {item.problem && item.problem.image_url && (
            <div className="rating-image">
              <img src={item.problem.image_url} alt={shortId(item.problem.id)} loading="lazy" />
            </div>
          )}

          <div className="rating-content">
            {item.problem && item.problem.id && (
              <div className="rating-problem-title"><span className="short-id">{shortId(item.problem.id)}</span></div>
            )}

            <blockquote className="rating-title-text">"{item.title}"</blockquote>
            <TranslatedText text={item.title} className="translated-text" />

            <div className="rating-stars-section">
              <label className="rating-stars-label">{t('rating.stars')}</label>
              <StarSelector value={stars} onChange={setStars} disabled={submitting || !!result} />
            </div>

            {result && (
              <div className="rating-result animate-fade-in">
                <div className="stat-card stat-card-sm" style={{ display: 'inline-flex', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) var(--spacing-lg)' }}>
                  <div>
                    <div className="stat-value">{parseFloat(result.avg_rating).toFixed(1)}</div>
                    <div className="stat-label">{t('rating.avgRating')}</div>
                  </div>
                  <div>
                    <div className="stat-value">{result.rating_count}</div>
                    <div className="stat-label">{t('rating.ratingCount').replace('{count}', result.rating_count)}</div>
                  </div>
                </div>
              </div>
            )}

            {!result && (
              <div className="rating-actions">
                <button
                  className={'btn btn-primary' + (submitting ? ' btn-loading' : '')}
                  onClick={handleRate}
                  disabled={stars === 0 || submitting}
                >
                  {submitting ? t('common.loading') : t('rating.next')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
