import { useState, useEffect, useCallback } from 'react'
import {
  Server, Plus, Trash2, RefreshCw, AlertTriangle,
  CheckCircle, Clock, Cpu, Link2, Unlink, X, Eye, Cloud
} from 'lucide-react'
import api from '../../services/api'
import { toast } from 'react-hot-toast'

const AUTO_REFRESH_INTERVAL_MS = 10000

export default function VMPoolPage() {
  const [stats, setStats] = useState(null)
  const [entries, setEntries] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(null)
  const [createForm, setCreateForm] = useState({ template_id: '', count: 1 })
  const [linkForm, setLinkForm] = useState({ proxmox_template_id: '' })
  const [creating, setCreating] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [poolRes, templatesRes] = await Promise.all([
        api.get('/vms/admin/pool/status/'),
        api.get('/vms/admin/templates/'),
      ])
      if (poolRes.data?.stats) setStats(poolRes.data.stats)
      if (poolRes.data?.entries) setEntries(poolRes.data.entries)
      if (templatesRes.data?.data) setTemplates(templatesRes.data.data)
    } catch (err) {
      console.error('Failed to fetch pool data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const hasCreating = entries.some(e => e.status === 'creating')
    if (!hasCreating) return

    const interval = setInterval(fetchData, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [entries, fetchData, autoRefresh])

  const handleCreate = async () => {
    if (!createForm.template_id) {
      toast.error('Select a template')
      return
    }
    setCreating(true)
    try {
      const res = await api.post('/vms/admin/pool/create/', {
        template_id: parseInt(createForm.template_id),
        count: createForm.count,
      })
      toast.success(res.data?.message || 'VMs being created')
      setShowCreateModal(false)
      setCreateForm({ template_id: '', count: 1 })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create VMs')
    } finally {
      setCreating(false)
    }
  }

  const handleCleanup = async () => {
    try {
      const res = await api.post('/vms/admin/pool/cleanup/')
      toast.success(res.data?.message || 'Cleaned up')
      fetchData()
    } catch (err) {
      toast.error('Cleanup failed')
    }
  }

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Delete this pool VM? This will destroy it from Proxmox.')) return
    try {
      await api.delete(`/vms/admin/pool/${entryId}/`)
      toast.success('Pool entry deleted')
      fetchData()
    } catch (err) {
      toast.error('Delete failed')
    }
  }

  const handleLink = async (templateId) => {
    if (!linkForm.proxmox_template_id) {
      toast.error('Enter a Proxmox template ID')
      return
    }
    try {
      await api.post(`/vms/admin/templates/${templateId}/link/`, {
        proxmox_template_id: parseInt(linkForm.proxmox_template_id),
      })
      toast.success('Template linked to Proxmox')
      setShowLinkModal(null)
      setLinkForm({ proxmox_template_id: '' })
      fetchData()
    } catch (err) {
      toast.error('Link failed')
    }
  }

  const realTemplates = templates.filter(t => t.is_real)

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-400" /> 
            VM Pool Management
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">Pre-clone VMs for instant user assignment</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer mr-2">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded bg-[var(--bg-card)] border-slate-600 text-indigo-500 focus:ring-indigo-500"
            />
            Auto-refresh
          </label>
          <button 
            onClick={fetchData} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-[var(--border-color)] hover:bg-white/10 text-[var(--text-primary)] transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button 
            onClick={handleCleanup}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-transparent border border-red-500/30 hover:bg-red-500/10 text-red-400 transition-colors text-sm font-medium"
          >
            <Trash2 size={16} /> Clean Up Errors
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[var(--text-primary)] transition-colors text-sm font-bold shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} /> Pre-clone VMs
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Ready', value: stats?.ready || 0, color: 'text-emerald-400', border: 'border-l-emerald-400' },
          { label: 'Assigned', value: stats?.assigned || 0, color: 'text-indigo-400', border: 'border-l-indigo-400' },
          { label: 'Creating', value: stats?.creating || 0, color: 'text-amber-400', border: 'border-l-amber-400' },
          { label: 'Error', value: stats?.error || 0, color: 'text-red-400', border: 'border-l-red-400' },
        ].map(card => (
          <div key={card.label} className={`bg-[var(--bg-card)]/80 backdrop-blur-md rounded-xl p-5 border border-[var(--border-color)] border-l-4 ${card.border} shadow-lg`}>
            <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider font-medium mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Pool Entries Table */}
      <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl shadow-lg border border-[var(--border-color)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pool Entries</h2>
        </div>
        
        {entries.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Cloud className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-[var(--text-primary)] font-medium mb-1">No VMs in pool</p>
            <p className="text-[var(--text-secondary)] text-sm">Click "Pre-clone VMs" to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.02] border-b border-[var(--border-color)]">
                  {['VM ID', 'Template', 'IP Address', 'Status', 'Assigned To', 'Created', 'Actions'].map(h => (
                    <th key={h} className="py-3 px-6 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-6">
                      <span className="font-mono text-[var(--text-primary)] text-sm font-medium">{e.proxmox_vmid || '—'}</span>
                    </td>
                    <td className="py-3 px-6 text-[var(--text-primary)] text-sm">{e.template}</td>
                    <td className="py-3 px-6 font-mono text-[var(--text-secondary)] text-sm">{e.ip_address || '—'}</td>
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        e.status === 'ready' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        e.status === 'assigned' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        e.status === 'creating' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {e.status === 'creating' && <Clock className="w-3 h-3 animate-pulse" />}
                        {e.status === 'ready' && <CheckCircle className="w-3 h-3" />}
                        <span className="capitalize">{e.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-6 text-[var(--text-secondary)] text-sm">{e.assigned_to || '—'}</td>
                    <td className="py-3 px-6 text-[var(--text-secondary)] text-sm">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-white/10 transition-colors">
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteEntry(e.id)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-red-400 rounded-lg hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Templates Section */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Template Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(t => (
            <div key={t.id} className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl p-5 border border-[var(--border-color)] shadow-lg flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-lg">{t.name}</h3>
                  <p className="text-[var(--text-secondary)] text-sm">{t.os}</p>
                </div>
                {t.is_real ? (
                  <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                    Linked (ID: {t.proxmox_template_id})
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] text-xs font-medium">
                    Unlinked
                  </span>
                )}
              </div>
              
              <div className="flex gap-4 mb-6">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pool Ready</p>
                  <p className="text-xl font-bold text-emerald-400">{t.pool_ready}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Assigned</p>
                  <p className="text-xl font-bold text-indigo-400">{t.pool_assigned}</p>
                </div>
              </div>
              
              <div className="mt-auto">
                <button 
                  onClick={() => { setShowLinkModal(t.id); setLinkForm({ proxmox_template_id: t.proxmox_template_id || '' }) }}
                  className="w-full py-2.5 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-white/5 border-[var(--border-color)] text-[var(--text-primary)] hover:bg-white/10"
                >
                  {t.is_real ? <><Unlink size={16} /> Manage Link</> : <><Link2 size={16} /> Link to Proxmox</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals remain essentially the same but with updated styling matching AdminDashboard */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Pre-clone VMs</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Template</label>
                <select 
                  value={createForm.template_id}
                  onChange={e => setCreateForm({ ...createForm, template_id: e.target.value })}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select a real template...</option>
                  {realTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (Proxmox {t.proxmox_template_id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Number of VMs (1–5)</label>
                <input 
                  type="number" min="1" max="5" 
                  value={createForm.count}
                  onChange={e => setCreateForm({ ...createForm, count: parseInt(e.target.value) || 1 })}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button 
                onClick={handleCreate} disabled={creating}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {creating ? 'Starting...' : `Clone ${createForm.count} VM(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Link to Proxmox</h3>
              <button onClick={() => setShowLinkModal(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Proxmox Template VM ID</label>
                <input 
                  type="number" 
                  value={linkForm.proxmox_template_id}
                  onChange={e => setLinkForm({ proxmox_template_id: e.target.value })}
                  placeholder="e.g. 9000"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 mt-2">
                <button 
                  onClick={() => handleLink(showLinkModal)}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                >
                  Link
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await api.post(`/vms/admin/templates/${showLinkModal}/link/`, { proxmox_template_id: null })
                      toast.success('Template unlinked')
                      setShowLinkModal(null)
                      fetchData()
                    } catch { toast.error('Unlink failed') }
                  }}
                  className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-medium transition-colors"
                >
                  Unlink
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
