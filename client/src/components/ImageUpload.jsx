import React, { useState, useRef } from 'react'
import { useToast } from './Toast'
import { useLang } from '../i18n'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export default function ImageUpload({ value, onChange, token }) {
  const { t } = useLang()
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState(value ? 'url' : 'upload') // 'upload' | 'url'
  const fileRef = useRef(null)
  const toast = useToast()

  async function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t('imageUpload.invalidType'))
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error(t('imageUpload.tooLarge'))
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/v1/upload/image', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Upload failed')
      }

      const data = await res.json()
      onChange(data.url)
      toast.success(t('imageUpload.uploaded'))
    } catch (err) {
      toast.error(err.message || t('imageUpload.failed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
        <button
          type="button"
          className={'btn btn-sm ' + (mode === 'upload' ? 'btn-primary' : 'btn-secondary')}
          onClick={() => setMode('upload')}
        >
          {t('imageUpload.uploadFile')}
        </button>
        <button
          type="button"
          className={'btn btn-sm ' + (mode === 'url' ? 'btn-primary' : 'btn-secondary')}
          onClick={() => setMode('url')}
        >
          {t('imageUpload.enterUrl')}
        </button>
      </div>

      {mode === 'upload' ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ width: '100%' }}
          >
            {uploading ? t('imageUpload.uploading') : t('imageUpload.chooseImage')}
          </button>
        </div>
      ) : (
        <input
          className="input"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..."
        />
      )}

      {value && (
        <div style={{
          marginTop: 'var(--spacing-sm)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          maxHeight: '160px'
        }}>
          <img
            src={value}
            alt={t('imageUpload.preview')}
            style={{ width: '100%', height: '160px', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
      )}
    </div>
  )
}
