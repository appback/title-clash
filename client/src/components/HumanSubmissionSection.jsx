import React, { useState, useEffect } from 'react'
import api from '../api'
import { useToast } from './Toast'
import { useLang } from '../i18n'
import TranslatedText from './TranslatedText'

export default function HumanSubmissionSection({ problemId }) {
  const { t } = useLang()
  const toast = useToast()
  const [humanData, setHumanData] = useState(null)
  const [humanTitle, setHumanTitle] = useState('')
  const [humanName, setHumanName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!problemId) return
    loadHumanSubmissions()
  }, [problemId])

  function loadHumanSubmissions() {
    api.get(`/problems/${problemId}/human-submissions`)
      .then(res => setHumanData(res.data))
      .catch(() => {})
  }

  async function handleHumanSubmit(e) {
    e.preventDefault()
    if (!humanTitle.trim() || submitting) return
    setSubmitting(true)
    try {
      await api.post(`/problems/${problemId}/human-submit`, {
        title: humanTitle.trim(),
        author_name: humanName.trim() || 'Anonymous'
      })
      setHumanTitle('')
      setHumanName('')
      loadHumanSubmissions()
      toast.success(t('rounds.titleSubmitted'))
    } catch (err) {
      toast.error(err.response?.data?.message || t('rounds.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLike(submissionId) {
    try {
      await api.post(`/problems/${problemId}/human-like`, { submission_id: submissionId })
      loadHumanSubmissions()
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Already liked!')
      }
    }
  }

  if (!humanData) return null

  return (
    <div className="human-section animate-fade-in">
      <h2 className="section-title">{t('rounds.submitYourTitle')}</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-md)' }}>
        {t('rounds.submitDesc')}
      </p>

      {/* Submit form (if not already submitted) */}
      {!humanData.my_submission && (
        <form className="human-form" onSubmit={handleHumanSubmit}>
          <input
            type="text"
            className="human-form-input"
            placeholder={t('rounds.writeTitlePlaceholder')}
            value={humanTitle}
            onChange={e => setHumanTitle(e.target.value)}
            maxLength={100}
          />
          <div className="human-form-row">
            <input
              type="text"
              className="human-form-name"
              placeholder={t('rounds.nicknamePlaceholder')}
              value={humanName}
              onChange={e => setHumanName(e.target.value)}
              maxLength={30}
            />
            <button className="btn btn-primary" type="submit" disabled={submitting || !humanTitle.trim()}>
              {submitting ? t('rounds.submitting') : t('rounds.submit')}
            </button>
          </div>
        </form>
      )}

      {humanData.my_submission && (
        <div className="human-my-submission">
          {t('rounds.yourSubmission')} <strong>"{humanData.my_submission.title}"</strong>
        </div>
      )}

      {/* Human submissions list */}
      <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>
        {t('rounds.humanSubmissions')}
      </h3>
      {humanData.submissions.length > 0 ? (
        <div className="human-list">
          {humanData.submissions.map((hs, i) => (
            <div key={hs.id} className="human-list-item">
              <span className="human-list-rank">{i + 1}.</span>
              <div className="human-list-info">
                <span className="human-list-title">"{hs.title}"</span>
                <TranslatedText text={hs.title} />
                <span className="human-list-author">{t('common.by')} {hs.author_name}</span>
              </div>
              <button
                className={'human-like-btn' + (humanData.liked_ids.includes(hs.id) ? ' human-like-btn-active' : '')}
                onClick={() => handleLike(hs.id)}
              >
                &#x2665; {hs.like_count}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="human-empty">{t('rounds.noHumanSubmissions')}</p>
      )}
    </div>
  )
}
