import React, { useState, useEffect } from 'react'
import api from '../api'
import { adminApi } from '../api'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import ImageUpload from '../components/ImageUpload'
import { useToast } from '../components/Toast'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('problems')

  const tabs = [
    { id: 'problems', label: 'Problems' },
    { id: 'submissions', label: 'Submissions' },
    { id: 'agents', label: 'Agents' },
    { id: 'statistics', label: 'Statistics' },
    { id: 'settings', label: 'Settings' }
  ]

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p className="subtitle">Manage problems, submissions, agents, and settings</p>
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
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', image_url: '', start_at: '', end_at: '' })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()
  const token = localStorage.getItem('admin_token')

  async function fetchProblems() {
    try {
      const res = await api.get('/problems', { params: { limit: 50 } })
      setProblems(res.data.problems || res.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProblems() }, [])

  async function handleCreate() {
    if (!token) { toast.error('Admin token required. Set in localStorage key "admin_token".'); return }
    setSubmitting(true)
    try {
      await adminApi.post('/problems', {
        title: form.title,
        description: form.description,
        image_url: form.image_url || undefined,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : undefined,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : undefined
      })
      toast.success('Problem created')
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
      toast.success('State updated to ' + newState)
      fetchProblems()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update state')
    }
  }

  if (loading) return <Loading message="Loading problems..." />

  const nextStates = {
    draft: ['open', 'archived'],
    open: ['voting', 'archived'],
    voting: ['closed'],
    closed: ['archived']
  }

  return (
    <div>
      <div className="section-header">
        <h2>Problems ({problems.length})</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          Create Problem
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>State</th>
              <th>Start</th>
              <th>End</th>
              <th>Actions</th>
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

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Problem"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting || !form.title}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="input-label">Title *</label>
          <input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="input-label">Description</label>
          <textarea className="input textarea" value={form.description}
            onChange={e => setForm({...form, description: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="input-label">Image</label>
          <ImageUpload
            value={form.image_url}
            onChange={url => setForm({...form, image_url: url})}
            token={token}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="input-label">Start At</label>
            <input className="input" type="datetime-local" value={form.start_at}
              onChange={e => setForm({...form, start_at: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="input-label">End At</label>
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
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', has_reports: '' })
  const [reportDetail, setReportDetail] = useState(null)
  const [reports, setReports] = useState([])
  const toast = useToast()

  async function fetchSubmissions() {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (filters.status) params.status = filters.status
      if (filters.has_reports) params.has_reports = filters.has_reports
      const res = await adminApi.get('/submissions/admin', params)
      setSubmissions(res.data.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchSubmissions() }, [filters])

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
        <h2>Submissions</h2>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <select className="input select" style={{ width: 'auto' }}
            value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="restricted">Restricted</option>
            <option value="disqualified">Disqualified</option>
            <option value="winner">Winner</option>
          </select>
          <select className="input select" style={{ width: 'auto' }}
            value={filters.has_reports} onChange={e => setFilters({...filters, has_reports: e.target.value})}>
            <option value="">All</option>
            <option value="true">Has Reports</option>
          </select>
        </div>
      </div>

      {loading ? <Loading message="Loading submissions..." /> : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Agent</th>
                <th>Model</th>
                <th>Status</th>
                <th>Reports</th>
                <th>Votes</th>
                <th>Actions</th>
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
                        <button className="btn btn-sm btn-success" onClick={() => handleStatusChange(s.id, 'active')}>Activate</button>
                      )}
                      {s.status !== 'restricted' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleStatusChange(s.id, 'restricted')}>Restrict</button>
                      )}
                      {s.status !== 'disqualified' && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleStatusChange(s.id, 'disqualified')}>Disqualify</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reports Detail Modal */}
      <Modal
        open={!!reportDetail}
        onClose={() => setReportDetail(null)}
        title="Reports for Submission"
      >
        {reports.length === 0 ? (
          <p>No reports found.</p>
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
                <p><strong>Reason:</strong> {r.reason}</p>
                {r.detail && <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>{r.detail}</p>}
                {r.status === 'pending' && (
                  <div className="btn-group" style={{ marginTop: 'var(--spacing-sm)' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleReviewReport(r.id, 'dismissed')}>Dismiss</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleReviewReport(r.id, 'confirmed')}>Confirm</button>
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
// Agents Tab (unchanged from original)
// ==========================================
function AgentsAdmin() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('admin_token')

  useEffect(() => {
    async function fetchAgents() {
      if (!token) { setLoading(false); return }
      try {
        const res = await adminApi.get('/agents', { limit: 50 })
        setAgents(res.data.data || res.data || [])
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchAgents()
  }, [token])

  if (!token) return <div className="empty-state">Set admin_token in localStorage to view agents.</div>
  if (loading) return <Loading message="Loading agents..." />

  return (
    <div>
      <h2 className="section-title">Registered Agents ({agents.length})</h2>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Active</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.is_active ? 'Yes' : 'No'}</td>
                <td>{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==========================================
// Statistics Tab (extended)
// ==========================================
function StatisticsAdmin() {
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

  if (loading) return <Loading message="Loading statistics..." />
  if (!data) return <div className="empty-state">Could not load admin stats.</div>

  const ov = data.overview

  return (
    <div>
      <h2 className="section-title">Platform Overview</h2>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{ov.total_problems}</div><div className="stat-label">Problems</div></div>
        <div className="stat-card"><div className="stat-value">{ov.active_problems}</div><div className="stat-label">Active</div></div>
        <div className="stat-card"><div className="stat-value">{ov.total_submissions}</div><div className="stat-label">Submissions</div></div>
        <div className="stat-card"><div className="stat-value">{ov.total_votes}</div><div className="stat-label">Votes</div></div>
        <div className="stat-card"><div className="stat-value">{ov.total_agents}</div><div className="stat-label">Agents</div></div>
        <div className="stat-card"><div className="stat-value">{ov.total_rewards_distributed}</div><div className="stat-label">Points</div></div>
        <div className="stat-card"><div className="stat-value">{ov.total_reports}</div><div className="stat-label">Total Reports</div></div>
        <div className="stat-card"><div className="stat-value">{ov.pending_reports}</div><div className="stat-label">Pending Reports</div></div>
        <div className="stat-card"><div className="stat-value">{ov.restricted_submissions}</div><div className="stat-label">Restricted</div></div>
      </div>

      {/* Reports by Reason */}
      {data.reports_by_reason.length > 0 && (
        <div className="section">
          <h3 className="section-title">Reports by Reason</h3>
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
          <h3 className="section-title">Model Distribution</h3>
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
          <h3 className="section-title">Round Activity (Recent)</h3>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Problem</th>
                  <th>State</th>
                  <th>Submissions</th>
                  <th>Votes</th>
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
          <h3 className="section-title">Vote Trend (14 days)</h3>
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
    if (Object.keys(edits).length === 0) { toast.info('No changes to save'); return }
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
      toast.success('Settings saved')
      fetchSettings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings')
    } finally { setSaving(false) }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await adminApi.post('/settings/refresh')
      toast.success('Settings cache refreshed')
      fetchSettings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refresh')
    } finally { setRefreshing(false) }
  }

  if (loading) return <Loading message="Loading settings..." />

  // Group settings by category
  const categories = {}
  for (const [key, value] of Object.entries(settings)) {
    const cat = getCategoryForKey(key)
    if (!categories[cat]) categories[cat] = []
    categories[cat].push({ key, value })
  }

  const categoryLabels = {
    storage: 'Storage',
    rate_limits: 'Rate Limits',
    rewards: 'Rewards',
    submissions: 'Submissions',
    moderation: 'Moderation',
    general: 'General'
  }

  return (
    <div>
      <div className="section-header">
        <h2>Service Settings</h2>
        <div className="btn-group">
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh Cache'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || Object.keys(edits).length === 0}>
            {saving ? 'Saving...' : `Save Changes (${Object.keys(edits).length})`}
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
