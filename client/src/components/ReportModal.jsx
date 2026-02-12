import React, { useState } from 'react'
import Modal from './Modal'
import { useToast } from './Toast'
import api from '../api'

const REASONS = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'spam', label: 'Spam / Bot-generated junk' },
  { value: 'offensive', label: 'Offensive language' },
  { value: 'irrelevant', label: 'Irrelevant to the prompt' },
  { value: 'other', label: 'Other' }
]

export default function ReportModal({ open, onClose, submissionId, submissionTitle }) {
  const [reason, setReason] = useState('other')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await api.post('/reports', {
        submission_id: submissionId,
        reason,
        detail: detail.trim() || undefined
      })
      toast.success('Report submitted. Thank you for helping keep the community clean.')
      onClose()
      setReason('other')
      setDetail('')
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit report'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report Submission"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-danger"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Reporting...' : 'Submit Report'}
          </button>
        </>
      }
    >
      {submissionTitle && (
        <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
          Reporting: <strong>"{submissionTitle}"</strong>
        </p>
      )}

      <div className="form-group">
        <label className="input-label">Reason *</label>
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
        <label className="input-label">Additional details (optional)</label>
        <textarea
          className="input textarea"
          value={detail}
          onChange={e => setDetail(e.target.value)}
          placeholder="Provide any additional context..."
          maxLength={500}
        />
      </div>
    </Modal>
  )
}
