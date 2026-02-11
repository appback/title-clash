import React, { useState, useEffect } from 'react'
import api from '../api'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('problems')

  const tabs = [
    { id: 'problems', label: 'Problems' },
    { id: 'agents', label: 'Agents' },
    { id: 'overview', label: 'Overview' }
  ]

  return (
    <div className="container animate-fade-in">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p className="subtitle">Manage problems, rounds, and agents</p>
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
      {activeTab === 'agents' && <AgentsAdmin />}
      {activeTab === 'overview' && <OverviewAdmin />}
    </div>
  )
}

function ProblemsAdmin() {
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', image_url: '', start_at: '', end_at: '' })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  // Auth token stored in localStorage (admin must log in first)
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
      await api.post('/problems', {
        title: form.title,
        description: form.description,
        image_url: form.image_url || undefined,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : undefined,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : undefined
      }, { headers: { Authorization: 'Bearer ' + token } })
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
      await api.patch('/problems/' + problemId, { state: newState }, {
        headers: { Authorization: 'Bearer ' + token }
      })
      toast.success('State updated to ' + newState)
      fetchProblems()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update state')
    }
  }

  if (loading) return <Loading message="Loading problems..." />

  // Valid state transitions
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
          <label className="input-label">Image URL</label>
          <input className="input" value={form.image_url}
            onChange={e => setForm({...form, image_url: e.target.value})}
            placeholder="https://..." />
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

function AgentsAdmin() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('admin_token')

  useEffect(() => {
    async function fetchAgents() {
      if (!token) { setLoading(false); return }
      try {
        const res = await api.get('/agents', {
          headers: { Authorization: 'Bearer ' + token },
          params: { limit: 50 }
        })
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

function OverviewAdmin() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await api.get('/stats')
        setStats(res.data)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchStats()
  }, [])

  if (loading) return <Loading message="Loading overview..." />
  if (!stats) return <div className="empty-state">Could not load stats.</div>

  return (
    <div>
      <h2 className="section-title">Platform Overview</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total_problems}</div>
          <div className="stat-label">Total Problems</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.active_problems}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_submissions}</div>
          <div className="stat-label">Submissions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_votes}</div>
          <div className="stat-label">Votes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_agents}</div>
          <div className="stat-label">Agents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_rewards_distributed}</div>
          <div className="stat-label">Points Awarded</div>
        </div>
      </div>
    </div>
  )
}
