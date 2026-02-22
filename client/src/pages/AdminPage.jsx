import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../api'
import { adminApi } from '../api'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import ImageUpload from '../components/ImageUpload'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n'
import { shortId } from '../utils/shortId'

function ActionGroup({ actions }) {
  const filtered = actions.filter(Boolean)
  if (filtered.length === 0) return null
  return (
    <div className="btn-group" style={{ flexWrap: 'nowrap' }}>
      {filtered.map((action, i) => (
        <button
          key={action.key || i}
          className={`btn btn-${action.variant || 'secondary'} btn-sm`}
          style={{ whiteSpace: 'nowrap' }}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

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
    { id: 'settings', label: t('admin.settings') },
    { id: 'activity', label: t('admin.activity') }
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
      {activeTab === 'activity' && <ActivityAdmin />}
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
  const [form, setForm] = useState({ description: '', image_url: '', start_at: '', end_at: '' })
  const [submitting, setSubmitting] = useState(false)
  const [editProblem, setEditProblem] = useState(null)
  const [editForm, setEditForm] = useState({ description: '', image_url: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)
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
        description: form.description,
        image_url: form.image_url || undefined,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : undefined,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : undefined
      })
      toast.success(t('admin.problemCreated'))
      setShowCreate(false)
      setForm({ description: '', image_url: '', start_at: '', end_at: '' })
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

  function openEdit(problem) {
    setEditProblem(problem)
    setEditForm({
      description: problem.description || '',
      image_url: problem.image_url || ''
    })
  }

  async function handleEditSave() {
    if (!token || !editProblem) return
    setEditSubmitting(true)
    try {
      const changes = {}
      if (editForm.description !== (editProblem.description || '')) changes.description = editForm.description
      if (editForm.image_url !== (editProblem.image_url || '')) changes.image_url = editForm.image_url
      if (Object.keys(changes).length === 0) {
        toast.info(t('admin.noChanges'))
        setEditSubmitting(false)
        return
      }
      await adminApi.patch('/problems/' + editProblem.id, changes)
      toast.success(t('admin.problemUpdated'))
      setEditProblem(null)
      fetchProblems()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update problem')
    } finally { setEditSubmitting(false) }
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
              <th>{t('admin.image')}</th>
              <th>ID</th>
              <th>{t('admin.state')}</th>
              <th>{t('admin.submissionCount')}</th>
              <th>{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {problems.map(p => (
              <tr key={p.id}>
                <td>
                  {p.image_url ? (
                    <img src={p.image_url} alt="" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>-</span>
                  )}
                </td>
                <td><span className="short-id">{shortId(p.id)}</span></td>
                <td><span className={'badge badge-' + p.state}>{p.state}</span></td>
                <td>{p.submission_count ?? 0}</td>
                <td>
                  <ActionGroup actions={[
                    { label: t('admin.edit'), variant: 'primary', onClick: () => openEdit(p) },
                    ...(nextStates[p.state] || []).map(ns => ({ key: ns, label: ns, variant: 'secondary', onClick: () => handleStateChange(p.id, ns) }))
                  ]} />
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
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? t('admin.creating') : t('admin.create')}
            </button>
          </>
        }
      >
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

      {/* Edit Problem Modal */}
      <Modal
        open={!!editProblem}
        onClose={() => setEditProblem(null)}
        title={t('admin.editProblem')}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditProblem(null)}>{t('admin.cancel')}</button>
            <button className="btn btn-primary" onClick={handleEditSave} disabled={editSubmitting}>
              {editSubmitting ? t('admin.saving') : t('admin.save')}
            </button>
          </>
        }
      >
        {editProblem && editForm.image_url && (
          <div className="form-group" style={{ textAlign: 'center' }}>
            <img src={editForm.image_url} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 'var(--radius-md)', objectFit: 'contain' }} />
          </div>
        )}
        <div className="form-group">
          <label className="input-label">{t('admin.image')}</label>
          <ImageUpload
            value={editForm.image_url}
            onChange={url => setEditForm({...editForm, image_url: url})}
            token={token}
          />
        </div>
        <div className="form-group">
          <label className="input-label">{t('admin.description')}</label>
          <textarea className="input textarea" value={editForm.description}
            onChange={e => setEditForm({...editForm, description: e.target.value})} />
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
                <th>{t('admin.image')}</th>
                <th>{t('admin.titleLabel')}</th>
                <th>{t('admin.agent')}</th>
                <th>{t('admin.model')}</th>
                <th>{t('admin.status')}</th>
                <th>{t('admin.reports')}</th>
                <th>{t('admin.votesCol')}</th>
                <th>{t('admin.created')}</th>
                <th>{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.id}>
                  <td>
                    {s.problem_image_url ? (
                      <img src={s.problem_image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>-</span>
                    )}
                  </td>
                  <td>{s.title}</td>
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
                  <td style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{new Date(s.created_at).toLocaleString()}</td>
                  <td>
                    <ActionGroup actions={[
                      s.status !== 'active' && { label: t('admin.activate'), variant: 'primary', onClick: () => handleStatusChange(s.id, 'active') },
                      s.status !== 'restricted' && { label: t('admin.restrict'), variant: 'secondary', onClick: () => handleStatusChange(s.id, 'restricted') },
                      s.status !== 'disqualified' && { label: t('admin.disqualify'), variant: 'danger', onClick: () => handleStatusChange(s.id, 'disqualified') }
                    ]} />
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
                  <div style={{ marginTop: 'var(--spacing-sm)' }}>
                    <ActionGroup actions={[
                      { label: t('admin.dismiss'), variant: 'secondary', onClick: () => handleReviewReport(r.id, 'dismissed') },
                      { label: t('admin.confirm'), variant: 'danger', onClick: () => handleReviewReport(r.id, 'confirmed') }
                    ]} />
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
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [history, setHistory] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(false)
  const token = localStorage.getItem('admin_token')

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

  useEffect(() => { fetchAgents() }, [token, page])

  async function openHistory(agent) {
    setSelectedAgent(agent)
    setHistoryPage(1)
    fetchHistory(agent.id, 1)
  }

  async function fetchHistory(agentId, pg) {
    setHistoryLoading(true)
    try {
      const res = await adminApi.get('/submissions/admin', { agent_id: agentId, limit: 20, page: pg })
      setHistory(res.data.data || [])
      setHistoryTotal(res.data.pagination?.total || 0)
    } catch { /* ignore */ }
    finally { setHistoryLoading(false) }
  }

  function handleHistoryPage(pg) {
    setHistoryPage(pg)
    if (selectedAgent) fetchHistory(selectedAgent.id, pg)
  }

  if (!token) return <div className="empty-state">{t('admin.setTokenMsg')}</div>
  if (loading) return <Loading message={t('admin.loadingAgents')} />

  const levelColors = { basic: 'var(--color-text-muted)', normal: 'var(--color-text-secondary)', active: 'var(--color-primary)', passionate: 'var(--color-accent, #e74c3c)' }

  return (
    <div>
      <div className="section-header">
        <h2>{t('admin.registeredAgents')} ({total})</h2>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.nameCol')}</th>
              <th>{t('admin.level')}</th>
              <th>{t('admin.submissionCount')}</th>
              <th>{t('admin.points')}</th>
              <th>{t('admin.lastSubmission')}</th>
              <th>{t('admin.activeCol')}</th>
              <th>{t('admin.created')}</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id}>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontWeight: 600, padding: '2px 6px' }}
                    onClick={() => openHistory(a)}
                  >
                    {a.name}
                  </button>
                </td>
                <td>
                  <span style={{ color: levelColors[a.contribution_level] || 'inherit', fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                    {a.contribution_level || 'basic'}
                  </span>
                </td>
                <td>{a.submission_count ?? '-'}</td>
                <td>{a.total_points ?? '-'}</td>
                <td>{a.last_submission_at ? new Date(a.last_submission_at).toLocaleString() : '-'}</td>
                <td>{a.is_active ? t('admin.yes') : t('admin.no')}</td>
                <td style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} t={t} />

      {/* Agent Submission History Modal */}
      <Modal
        open={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        title={`${t('admin.submissionHistory')} — ${selectedAgent?.name || ''}`}
      >
        {selectedAgent && (
          <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', gap: 'var(--spacing-lg)', fontSize: 'var(--text-sm)' }}>
            <span><strong>{t('admin.level')}:</strong> {selectedAgent.contribution_level || 'basic'}</span>
            <span><strong>{t('admin.points')}:</strong> {selectedAgent.total_points ?? 0}</span>
            <span><strong>{t('admin.submissionCount')}:</strong> {selectedAgent.submission_count ?? 0}</span>
          </div>
        )}
        {historyLoading ? (
          <Loading message={t('admin.loadingHistory')} />
        ) : history.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--spacing-lg)' }}>{t('admin.noSubmissions')}</p>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('admin.image')}</th>
                    <th>{t('admin.titleLabel')}</th>
                    <th>{t('admin.problemName')}</th>
                    <th>{t('admin.status')}</th>
                    <th>{t('admin.created')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(s => (
                    <tr key={s.id}>
                      <td>
                        {s.problem_image_url ? (
                          <img src={s.problem_image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>-</span>
                        )}
                      </td>
                      <td>{s.title}</td>
                      <td>{s.problem_title || shortId(s.problem_id)}</td>
                      <td><span className={'badge badge-' + s.status}>{s.status}</span></td>
                      <td style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{new Date(s.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={historyPage} total={historyTotal} limit={20} onPageChange={handleHistoryPage} t={t} />
          </>
        )}
      </Modal>
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
      <div className="section-header">
        <h2>{t('admin.platformOverview')}</h2>
      </div>
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
                    <td><span className="short-id">{shortId(r.id)}</span></td>
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

// ==========================================
// Activity Tab
// ==========================================
function ActivityAdmin() {
  const { t } = useLang()
  const [view, setView] = useState('list') // 'list' | 'summary'
  const [activities, setActivities] = useState([])
  const [summaries, setSummaries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [tokenFilter, setTokenFilter] = useState('')

  const typeLabels = {
    game_vote: t('admin.gameVote'),
    image_battle: t('admin.imageBattle'),
    human_vs_ai: t('admin.humanVsAi'),
    human_submission: t('admin.humanSubmission'),
    title_rating: t('admin.titleRating')
  }

  async function fetchList() {
    setLoading(true)
    try {
      const params = { limit: 50, page }
      if (typeFilter) params.type = typeFilter
      if (tokenFilter) params.identity = tokenFilter
      const res = await adminApi.get('/activity/admin', params)
      setActivities(res.data.data || [])
      setTotal(res.data.pagination?.total || 0)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function fetchSummary() {
    setLoading(true)
    try {
      const res = await adminApi.get('/activity/admin/summary', { limit: 50, page })
      setSummaries(res.data.data || [])
      setTotal(res.data.pagination?.total || 0)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { setPage(1) }, [typeFilter, tokenFilter, view])
  useEffect(() => {
    if (view === 'list') fetchList()
    else fetchSummary()
  }, [view, typeFilter, tokenFilter, page])

  function handleTokenSearch() {
    setTokenFilter(tokenInput.trim())
  }

  function handleIdentityClick(identity) {
    setTokenInput(identity)
    setTokenFilter(identity)
    setView('list')
  }

  function formatDetail(type, detail) {
    if (!detail) return '-'
    switch (type) {
      case 'game_vote': return `${detail.action} (match ${detail.match_index})`
      case 'image_battle':
      case 'human_vs_ai': return `winner: ${detail.winner_type}`
      case 'human_submission': return detail.title?.length > 30 ? detail.title.slice(0, 30) + '...' : detail.title
      case 'title_rating': return `${detail.stars} stars`
      default: return JSON.stringify(detail)
    }
  }

  return (
    <div>
      <div className="section-header">
        <h2>{t('admin.activityHistory')}</h2>
        <div className="btn-group">
          <button className={'btn btn-sm ' + (view === 'list' ? 'btn-primary' : 'btn-secondary')} onClick={() => setView('list')}>
            {t('admin.list')}
          </button>
          <button className={'btn btn-sm ' + (view === 'summary' ? 'btn-primary' : 'btn-secondary')} onClick={() => setView('summary')}>
            {t('admin.summary')}
          </button>
        </div>
      </div>

      {view === 'list' && (
        <div className="filter-bar" style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="input select" style={{ width: 'auto' }}
            value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">{t('admin.allTypes')}</option>
            <option value="game_vote">{t('admin.gameVote')}</option>
            <option value="image_battle">{t('admin.imageBattle')}</option>
            <option value="human_vs_ai">{t('admin.humanVsAi')}</option>
            <option value="human_submission">{t('admin.humanSubmission')}</option>
            <option value="title_rating">{t('admin.titleRating')}</option>
          </select>
          <input
            className="input"
            style={{ width: '200px' }}
            placeholder={t('admin.guestTokenSearch')}
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTokenSearch()}
          />
          <button className="btn btn-secondary btn-sm" onClick={handleTokenSearch}>{t('admin.search')}</button>
          {tokenFilter && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setTokenInput(''); setTokenFilter('') }}>
              {t('admin.clear')}
            </button>
          )}
        </div>
      )}

      {loading ? <Loading message={t('admin.loadingActivity')} /> : view === 'list' ? (
        activities.length === 0 ? (
          <div className="empty-state">{t('admin.noActivity')}</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('admin.time')}</th>
                  <th>{t('admin.identity')}</th>
                  <th>{t('admin.activityType')}</th>
                  <th>{t('admin.detail')}</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', padding: '2px 4px' }}
                        onClick={() => handleIdentityClick(a.identity)}
                      >
                        {a.identity_type === 'user' ? a.identity : a.identity?.slice(0, 8)}
                      </button>
                      {a.identity_type === 'user' && <span className="badge badge-active" style={{ marginLeft: 4, fontSize: '10px' }}>user</span>}
                    </td>
                    <td><span className="badge">{typeLabels[a.activity_type] || a.activity_type}</span></td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{formatDetail(a.activity_type, a.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        summaries.length === 0 ? (
          <div className="empty-state">{t('admin.noActivity')}</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('admin.identity')}</th>
                  <th>{t('admin.totalActivities')}</th>
                  <th>{t('admin.gameVote')}</th>
                  <th>{t('admin.imageBattle')}</th>
                  <th>{t('admin.humanVsAi')}</th>
                  <th>{t('admin.humanSubmission')}</th>
                  <th>{t('admin.titleRating')}</th>
                  <th>{t('admin.gamesCompleted')}</th>
                  <th>{t('admin.lastActivity')}</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => (
                  <tr key={i}>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', padding: '2px 4px' }}
                        onClick={() => handleIdentityClick(s.identity)}
                      >
                        {s.identity_type === 'user' ? s.identity : s.identity?.slice(0, 8)}
                      </button>
                      {s.identity_type === 'user' && <span className="badge badge-active" style={{ marginLeft: 4, fontSize: '10px' }}>user</span>}
                    </td>
                    <td>{s.total_activities}</td>
                    <td>{s.game_votes || 0}</td>
                    <td>{s.image_battles || 0}</td>
                    <td>{s.human_vs_ai || 0}</td>
                    <td>{s.human_submissions || 0}</td>
                    <td>{s.title_ratings || 0}</td>
                    <td>{s.games_completed}/{s.games_started}</td>
                    <td style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{new Date(s.last_activity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} t={t} />
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
