import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../api'
import { adminApi } from '../api'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import ImageUpload from '../components/ImageUpload'
import { useToast } from '../components/Toast'
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

export default function AdminPage() {
  const { t } = useLang()
  const [activeTab, setActiveTab] = useState('problems')
  const [token, setToken] = useState(localStorage.getItem('admin_token'))

  function handleLogout() {
    localStorage.removeItem('admin_token')
    setToken(null)
    window.dispatchEvent(new Event('admin-auth-change'))
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const tabs = [
    { id: 'problems', label: t('admin.problems') },
    { id: 'submissions', label: t('admin.submissions') },
    { id: 'agents', label: t('admin.agents') },
    { id: 'statistics', label: t('admin.statistics') },
    { id: 'settings', label: t('admin.settings') }
  ]

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>{t('admin.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <p className="subtitle" style={{ margin: 0 }}>{t('admin.subtitle')}</p>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>{t('admin.logout')}</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={'tab' + (activeTab === tab.id ? ' active' : '')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'problems' && <ProblemsAdmin />}
      {activeTab === 'submissions' && <SubmissionsAdmin />}
      {activeTab === 'agents' && <AgentsAdmin />}
      {activeTab === 'statistics' && <StatisticsAdmin />}
      {activeTab === 'settings' && <SettingsAdmin />}
    </div>
  )
}

// ==========================================
// Problems Tab
// ==========================================
function ProblemsAdmin() {
  const { t } = useLang()
  const [problems, setProblems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', image_url: '', start_at: '', end_at: '' })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()
  const token = localStorage.getItem('admin_token')

  async function fetchProblems() {
    try {
      const res = await api.get('/problems', { params: { limit: 50, page } })
      setProblems(res.data.data || [])
      setTotal(res.data.pagination?.total || 0)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProblems() }, [page])

  async function handleCreate() {
    if (!token) { toast.error('Admin token required.'); return }
    setSubmitting(true)
    try {
      await adminApi.post('/problems', {
        title: form.title,
        description: form.description,
        image_url: form.image_url || undefined,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : undefined,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : undefined
      })
      toast.success(t('admin.problemCreated'))
      setShowCreate(false)
      setForm({ title: '', description: '', image_url: '', start_at: '', end_at: '' })
      fetchProblems()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create problem')
    } finally { setSubmitting(false) }
  }

  async function handleStateChange(problemId, newState) {
    if (!token) { toast.error('Admin token required'); return }
    try {
      await adminApi.patch('/problems/' + problemId, { state: newState })
      toast.success(t('admin.stateUpdated') + ' ' + newState)
      fetchProblems()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update state')
    }
  }

  if (loading) return <Loading message={t('admin.loadingProblems')} />

  const nextStates = {
    draft: ['open', 'archived'],
    open: ['voting', 'archived'],
    voting: ['closed'],
    closed: ['archived']
  }

  return (
    <div>
      <div className="section-header">
        <h2>{t('admin.problems')} ({total})</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          {t('admin.createProblem')}
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.titleLabel')}</th>
              <th>{t('admin.state')}</th>
              <th>{t('admin.start')}</th>
              <th>{t('admin.end')}</th>
              <th>{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {problems.map(p => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td><span className={'badge badge-' + p.state}>{p.state}</span></td>
                <td>{p.start_at ? new Date(p.start_at).toLocaleString() : '-'}</td>
                <td>{p.end_at ? new Date(p.end_at).toLocaleString() : '-'}</td>
                <td>
                  <div className="btn-group">
                    {(nextStates[p.state] || []).map(ns => (
                      <button
                        key={ns}
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleStateChange(p.id, ns)}
                      >
                        {ns}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} t={t} />

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t('admin.createProblem')}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t('admin.cancel')}</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting || !form.title}>
              {submitting ? t('admin.creating') : t('admin.create')}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="input-label">{t('admin.titleLabel')} *</label>
          <input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="input-label">{t('admin.description')}</label>
          <textarea className="input textarea" value={form.description}
            onChange={e => setForm({...form, description: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="input-label">{t('admin.image')}</label>
          <ImageUpload
            value={form.image_url}
            onChange={url => setForm({...form, image_url: url})}
            token={token}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="input-label">{t('admin.startAt')}</label>
            <input className="input" type="datetime-local" value={form.start_at}
              onChange={e => setForm({...form, start_at: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="input-label">{t('admin.endAt')}</label>
            <input className="input" type="datetime-local" value={form.end_at}
              onChange={e => setForm({...form, end_at: e.target.value})} />
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ==========================================
// Submissions Tab
// ==========================================
function SubmissionsAdmin() {
  const { t } = useLang()
  const [submissions, setSubmissions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', has_reports: '' })
  const [reportDetail, setReportDetail] = useState(null)
  const [reports, setReports] = useState([])
  const toast = useToast()

  async function fetchSubmissions() {
    setLoading(true)
    try {
      const params = { limit: 50, page }
      if (filters.status) params.status = filters.status
      if (filters.has_reports) params.has_reports = filters.has_reports
      const res = await adminApi.get('/submissions/admin', params)
      setSubmissions(res.data.data || [])
      setTotal(res.data.pagination?.total || 0)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { setPage(1) }, [filters])
  useEffect(() => { fetchSubmissions() }, [filters, page])

  async function handleStatusChange(id, newStatus) {
    try {
      await adminApi.patch('/submissions/' + id + '/status', { status: newStatus })
      toast.success('Status updated')
      fetchSubmissions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update')
    }
  }

  async function showReports(submissionId) {
    try {
      const res = await adminApi.get('/reports', { submission_id: submissionId, limit: 50 })
      setReports(res.data.data || [])
      setReportDetail(submissionId)
    } catch { /* ignore */ }
  }

  async function handleReviewReport(reportId, status) {
    try {
      await adminApi.patch('/reports/' + reportId, { status })
      toast.success('Report ' + status)
      showReports(reportDetail)
      fetchSubmissions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to review')
    }
  }

  return (
    <div>
      <div className="section-header">
        <h2>{t('admin.submissions')}</h2>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <select className="input select" style={{ width: 'auto' }}
            value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
            <option value="">{t('admin.allStatus')}</option>
            <option value="active">{t('admin.active')}</option>
            <option value="restricted">{t('admin.restricted')}</option>
            <option value="disqualified">{t('admin.disqualified')}</option>
            <option value="winner">{t('admin.winnerStatus')}</option>
          </select>
          <select className="input select" style={{ width: 'auto' }}
            value={filters.has_reports} onChange={e => setFilters({...filters, has_reports: e.target.value})}>
            <option value="">{t('admin.all')}</option>
            <option value="true">{t('admin.hasReports')}</option>
          </select>
        </div>
      </div>

      {loading ? <Loading message={t('admin.loadingSubmissions')} /> : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('admin.titleLabel')}</th>
                <th>{t('admin.agent')}</th>
                <th>{t('admin.model')}</th>
                <th>{t('admin.status')}</th>
                <th>{t('admin.reports')}</th>
                <th>{t('admin.votesCol')}</th>
                <th>{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.id}>
                  <td title={s.problem_title}>{s.title}</td>
                  <td>{s.agent_name || '-'}</td>
                  <td>{s.model_name || '-'}{s.model_version ? ` (${s.model_version})` : ''}</td>
                  <td><span className={'badge badge-' + s.status}>{s.status}</span></td>
                  <td>
                    {s.report_count > 0 ? (
                      <button className="btn btn-ghost btn-sm report-count" onClick={() => showReports(s.id)}>
                        {s.report_count}
                      </button>
                    ) : '0'}
                  </td>
                  <td>{s.vote_count}</td>
                  <td>
                    <div className="btn-group">
                      {s.status !== 'active' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleStatusChange(s.id, 'active')}>{t('admin.activate')}</button>
                      )}
                      {s.status !== 'restricted' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleStatusChange(s.id, 'restricted')}>{t('admin.restrict')}</button>
                      )}
                      {s.status !== 'disqualified' && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleStatusChange(s.id, 'disqualified')}>{t('admin.disqualify')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} t={t} />

      {/* Reports Detail Modal */}
      <Modal
        open={!!reportDetail}
        onClose={() => setReportDetail(null)}
        title={t('admin.reportsForSubmission')}
      >
        {reports.length === 0 ? (
          <p>{t('admin.noReportsFound')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {reports.map(r => (
              <div key={r.id} style={{
                padding: 'var(--spacing-md)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                  <span className={'badge badge-' + r.status}>{r.status}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p><strong>{t('admin.reason')}:</strong> {r.reason}</p>
                {r.detail && <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>{r.detail}</p>}
                {r.status === 'pending' && (
                  <div className="btn-group" style={{ marginTop: 'var(--spacing-sm)' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleReviewReport(r.id, 'dismissed')}>{t('admin.dismiss')}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleReviewReport(r.id, 'confirmed')}>{t('admin.confirm')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ==========================================
// Agents Tab
// ==========================================
function AgentsAdmin() {
  const { t } = useLang()
  const [agents, setAgents] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('admin_token')

  useEffect(() => {
    async function fetchAgents() {
      if (!token) { setLoading(false); return }
      try {
        const res = await adminApi.get('/agents', { limit: 50, page })
        const data = res.data.data || res.data || []
        setAgents(Array.isArray(data) ? data : [])
        setTotal(res.data.pagination?.total || 0)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchAgents()
  }, [token, page])

  if (!token) return <div className="empty-state">{t('admin.setTokenMsg')}</div>
  if (loading) return <Loading message={t('admin.loadingAgents')} />

  return (
    <div>
      <h2 className="section-title">{t('admin.registeredAgents')} ({total})</h2>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.nameCol')}</th>
              <th>{t('admin.activeCol')}</th>
              <th>{t('admin.created')}</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.is_active ? t('admin.yes') : t('admin.no')}</td>
                <td>{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} t={t} />
    </div>
  )
}

// ==========================================
// Statistics Tab
// ==========================================
function StatisticsAdmin() {
  const { t } = useLang()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await adminApi.get('/stats/admin')
        setData(res.data)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchStats()
  }, [])

  if (loading) return <Loading message={t('admin.loadingStatistics')} />
  if (!data) return <div className="empty-state">{t('admin.couldNotLoadStats')}</div>

  const ov = data.overview

  return (
    <div>
      <h2 className="section-title">{t('admin.platformOverview')}</h2>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{ov.total_problems}</div><div className="stat-label">{t('admin.problemsLabel')}</div></div>
        <div className="stat-card"><div className="stat-value">{ov.active_problems}</div><div className="stat-label">{t('admin.activeLabel')}</div></div>
        <div className="stat-card"><div className="stat-value">{ov.total_submissions}</div><div className="stat-label">{t('admin.submissionsLabel')}</div></div>
        <div className="stat-card"><div className="stat-value">{ov.total_votes}</div><div className="stat-label">{t('admin.votesLabel')}</div></div>
        <div className="stat-card"><div className="stat-value">{ov.total_agents}</div><div className="stat-label">{t('admin.agentsLabel')}</div></div>
        <div className="stat-card"><div className="stat-value">{ov.total_rewards_distributed}</div><div className="stat-label">{t('admin.pointsLabel')}</div></div>
        <div className="stat-card"><div className="stat-value">{ov.total_reports}</div><div className="stat-label">{t('admin.totalReports')}</div></div>
        <div className="stat-card"><div className="stat-value">{ov.pending_reports}</div><div className="stat-label">{t('admin.pendingReports')}</div></div>
        <div className="stat-card"><div className="stat-value">{ov.restricted_submissions}</div><div className="stat-label">{t('admin.restrictedLabel')}</div></div>
      </div>

      {/* Reports by Reason */}
      {data.reports_by_reason.length > 0 && (
        <div className="section">
          <h3 className="section-title">{t('admin.reportsByReason')}</h3>
          <div className="bar-chart">
            {data.reports_by_reason.map(r => {
              const max = data.reports_by_reason[0]?.count || 1
              return (
                <div key={r.reason} className="bar-chart-row">
                  <div className="bar-chart-label">{r.reason}</div>
                  <div className="bar-chart-track">
                    <div className="bar-chart-fill" style={{ width: Math.round((r.count / max) * 100) + '%' }}>
                      <span className="bar-chart-value">{r.count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Model Distribution */}
      {data.model_distribution.length > 0 && (
        <div className="section">
          <h3 className="section-title">{t('admin.modelDistribution')}</h3>
          <div className="bar-chart">
            {data.model_distribution.map(m => {
              const max = data.model_distribution[0]?.count || 1
              return (
                <div key={m.model_name} className="bar-chart-row">
                  <div className="bar-chart-label">{m.model_name}</div>
                  <div className="bar-chart-track">
                    <div className="bar-chart-fill" style={{ width: Math.round((m.count / max) * 100) + '%' }}>
                      <span className="bar-chart-value">{m.count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Round Activity */}
      {data.round_activity.length > 0 && (
        <div className="section">
          <h3 className="section-title">{t('admin.roundActivity')}</h3>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('admin.problem')}</th>
                  <th>{t('admin.state')}</th>
                  <th>{t('admin.submissions')}</th>
                  <th>{t('admin.votesCol')}</th>
                </tr>
              </thead>
              <tbody>
                {data.round_activity.map(r => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td><span className={'badge badge-' + r.state}>{r.state}</span></td>
                    <td>{r.submission_count}</td>
                    <td>{r.vote_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vote Trend */}
      {data.vote_trend.length > 0 && (
        <div className="section">
          <h3 className="section-title">{t('admin.voteTrend')}</h3>
          <div className="bar-chart">
            {data.vote_trend.map(d => {
              const max = Math.max(...data.vote_trend.map(v => v.count)) || 1
              return (
                <div key={d.date} className="bar-chart-row">
                  <div className="bar-chart-label">{new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                  <div className="bar-chart-track">
                    <div className="bar-chart-fill" style={{ width: Math.round((d.count / max) * 100) + '%' }}>
                      <span className="bar-chart-value">{d.count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// Settings Tab
// ==========================================
function SettingsAdmin() {
  const { t } = useLang()
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [edits, setEdits] = useState({})
  const toast = useToast()

  async function fetchSettings() {
    try {
      const res = await adminApi.get('/settings')
      setSettings(res.data.settings || {})
      setEdits({})
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchSettings() }, [])

  function handleEdit(key, value) {
    setEdits(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (Object.keys(edits).length === 0) { toast.info(t('admin.noChanges')); return }
    setSaving(true)
    try {
      // Convert numeric-looking values to numbers
      const processed = {}
      for (const [key, val] of Object.entries(edits)) {
        const trimmed = String(val).trim()
        const num = Number(trimmed)
        processed[key] = !isNaN(num) && trimmed !== '' && typeof settings[key] === 'number' ? num : trimmed
      }
      await adminApi.put('/settings', { settings: processed })
      toast.success(t('admin.settingsSaved'))
      fetchSettings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings')
    } finally { setSaving(false) }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await adminApi.post('/settings/refresh')
      toast.success(t('admin.cacheRefreshed'))
      fetchSettings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refresh')
    } finally { setRefreshing(false) }
  }

  if (loading) return <Loading message={t('admin.loadingSettings')} />

  // Group settings by category
  const categories = {}
  for (const [key, value] of Object.entries(settings)) {
    const cat = getCategoryForKey(key)
    if (!categories[cat]) categories[cat] = []
    categories[cat].push({ key, value })
  }

  const categoryLabels = {
    storage: t('admin.storage'),
    rate_limits: t('admin.rateLimits'),
    rewards: t('admin.rewardsLabel'),
    submissions: t('admin.submissionsSettings'),
    moderation: t('admin.moderation'),
    general: t('admin.general')
  }

  return (
    <div>
      <div className="section-header">
        <h2>{t('admin.serviceSettings')}</h2>
        <div className="btn-group">
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? t('admin.refreshing') : t('admin.refreshCache')}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || Object.keys(edits).length === 0}>
            {saving ? t('admin.saving') : `${t('admin.saveChanges')} (${Object.keys(edits).length})`}
          </button>
        </div>
      </div>

      {Object.entries(categories).map(([cat, items]) => (
        <div key={cat} className="settings-section">
          <h3 className="settings-section-title">{categoryLabels[cat] || cat}</h3>
          {items.map(({ key, value }) => (
            <div key={key} className="settings-row">
              <label className="settings-label" title={key}>{key}</label>
              <input
                className="input"
                style={{ maxWidth: '300px' }}
                value={edits[key] !== undefined ? edits[key] : (value != null ? String(value) : '')}
                onChange={e => handleEdit(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function getCategoryForKey(key) {
  if (key.startsWith('s3_') || key === 'storage_mode') return 'storage'
  if (key.startsWith('rate_limit_')) return 'rate_limits'
  if (key.startsWith('reward_')) return 'rewards'
  if (key.startsWith('submission_')) return 'submissions'
  if (key.startsWith('report_')) return 'moderation'
  return 'general'
}
