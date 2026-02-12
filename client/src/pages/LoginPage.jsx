import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n'

export default function LoginPage() {
  const { t } = useLang()
  const navigate = useNavigate()
  const toast = useToast()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Already logged in
  if (localStorage.getItem('admin_token')) {
    navigate('/admin', { replace: true })
    return null
  }

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await api.post('/auth/register', {
          email: form.email,
          password: form.password,
          name: form.name || undefined
        })
        toast.success(t('login.accountCreated'))
        setMode('login')
      } else {
        const res = await api.post('/auth/login', form)
        const { token, user } = res.data
        localStorage.setItem('admin_token', token)
        window.dispatchEvent(new Event('admin-auth-change'))
        if (user.role === 'admin') {
          navigate('/admin', { replace: true })
        } else {
          toast.success(t('login.loggedIn'))
          navigate('/', { replace: true })
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container animate-fade-in">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1>{mode === 'login' ? t('login.loginTitle') : t('login.signUpTitle')}</h1>
        <p className="page-subtitle">
          {mode === 'login' ? t('login.loginSubtitle') : t('login.signUpSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
        {error && <div className="alert alert-error">{error}</div>}

        {mode === 'register' && (
          <div className="form-group">
            <label className="input-label">{t('login.name')}</label>
            <input className="input" type="text" placeholder={t('login.namePlaceholder')}
              value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
        )}

        <div className="form-group">
          <label className="input-label">{t('login.email')}</label>
          <input className="input" type="email" required autoFocus
            value={form.email} onChange={e => update('email', e.target.value)} />
        </div>

        <div className="form-group">
          <label className="input-label">{t('login.password')}</label>
          <input className="input" type="password" required
            value={form.password} onChange={e => update('password', e.target.value)} />
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? t('login.pleaseWait') : (mode === 'login' ? t('login.signIn') : t('login.createAccount'))}
        </button>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px' }}>
          {mode === 'login' ? (
            <>{t('login.noAccount')}{' '}
              <button type="button" className="link-btn" onClick={() => { setMode('register'); setError('') }}>
                {t('login.signUp')}
              </button>
            </>
          ) : (
            <>{t('login.haveAccount')}{' '}
              <button type="button" className="link-btn" onClick={() => { setMode('login'); setError('') }}>
                {t('login.loginLink')}
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  )
}
