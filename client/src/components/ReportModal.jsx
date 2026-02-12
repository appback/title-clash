import React, { useState } from 'react'
import Modal from './Modal'
import { useToast } from './Toast'
import api from '../api'
import { useLang } from '../i18n'

export default function ReportModal({ open, onClose, submissionId, submissionTitle }) {
  const { t } = useLang()
  const [reason, setReason] = useState('other')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const REASONS = [
    { value: 'inappropriate', label: t('report.inappropriate') },
    { value: 'spam', label: t('report.spam') },
    { value: 'offensive', label: t('report.offensive') },
    { value: 'irrelevant', label: t('report.irrelevant') },
    { value: 'other', label: t('report.other') }
  ]

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await api.post('/reports', {
        submission_id: submissionId,
        reason,
        detail: detail.trim() || undefined
      })
      toast.success(t('report.success'))
      onClose()
      setReason('other')
      setDetail('')
    } catch (err) {
      const msg = err.response?.data?.message || t('report.failed')
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('report.title')}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('report.cancel')}</button>
          <button
            className="btn btn-danger"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? t('report.reporting') : t('report.submitReport')}
          </button>
        </>
      }
    >
      {submissionTitle && (
        <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
          {t('report.reportingLabel')} <strong>"{submissionTitle}"</strong>
        </p>
      )}

      <div className="form-group">
        <label className="input-label">{t('report.reason')} *</label>
        {REASONS.map(r => (
          <label key={r.value} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-sm) 0', cursor: 'pointer', fontSize: 'var(--text-base)'
          }}>
            <input
              type="radio"
              name="report-reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
            />
            {r.label}
          </label>
        ))}
      </div>

      <div className="form-group">
        <label className="input-label">{t('report.additionalDetails')}</label>
        <textarea
          className="input textarea"
          value={detail}
          onChange={e => setDetail(e.target.value)}
          placeholder={t('report.detailPlaceholder')}
          maxLength={500}
        />
      </div>
    </Modal>
  )
}
