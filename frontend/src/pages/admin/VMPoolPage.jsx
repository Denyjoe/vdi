import { useState, useEffect, useCallback } from 'react'
import useBreakpoint from '../../hooks/useBreakpoint'
import {
  Server, Plus, Trash2, RefreshCw, AlertTriangle,
  CheckCircle, Clock, Eye, Cloud, Link2, Unlink, X
} from 'lucide-react'
import api from '../../services/api'
import { toast } from 'react-hot-toast'
import TemplateLinkModal from '../../components/admin/TemplateLinkModal';
import ConfirmDialog from '../../components/shared/ConfirmDialog'
import useConfirm from '../../hooks/useConfirm'

const AUTO_REFRESH_INTERVAL_MS = 10000

export default function VMPoolPage() {
  const { isMobile } = useBreakpoint()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [stats, setStats] = useState(null)
  const [entries, setEntries] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Link Modal State
  const [linkModalTemplate, setLinkModalTemplate] = useState(null)

  const [createForm, setCreateForm] = useState({ template_id: '', count: 1 })
  const [creating, setCreating] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const [poolEntries, setPoolEntries] = useState([])

  const [refreshing, setRefreshing] = useState(false)

  const fetchPoolStats = async () => {
    try {
      const res = await api.get('/vms/admin/pool/status/')
      setStats(res.data?.stats)
    } catch(e) {
      console.error(e)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/vms/admin/templates/')
      const data = Array.isArray(res.data) ? res.data : res.data?.data || []
      setTemplates(data)
    } catch(e) {
      console.error(e)
    }
  }

  const fetchPoolEntries = async () => {
    try {
      const res = await api.get('/vms/admin/pool/entries/')
      setPoolEntries(res.data.entries || [])
    } catch(e) {
      console.error(e)
    }
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await Promise.all([
        fetchPoolStats(),
        fetchTemplates(),
        fetchPoolEntries(),
      ])
    } catch(e) {
      console.error('Refresh failed:', e)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    handleRefresh()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchPoolStats()
      fetchPoolEntries()
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const handlePreCloneClick = async () => {
    if (!createForm.template_id) {
      toast.error('Select a template')
      return
    }
    
    setCreating(true)
    try {
      const capRes = await api.get('/vms/admin/pool/capacity/')
      const cap = capRes.data
      
      if (!cap.can_clone) {
        toast(
          `Warning: Low server capacity. ` +
          `Free RAM: ${cap.free_ram_gb}GB, ` +
          `Free Storage: ${cap.free_storage_gb}GB. ` +
          `Proceeding may cause issues.`,
          { duration: 6000 }
        )
      }
      
      const res = await api.post('/vms/admin/pool/create/', {
        template_id: parseInt(createForm.template_id),
        count: createForm.count,
      })
      toast.success(res.data?.message || 'VMs being created')
      setShowCreateModal(false)
      setCreateForm({ template_id: '', count: 1 })
      handleRefresh()
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
      handleRefresh()
    } catch (err) {
      toast.error('Cleanup failed')
    }
  }

  const handleDeleteEntry = async (entryId) => {
    const ok = await confirm('Delete Pool VM', 'Delete this pool VM? This will destroy it from Proxmox.', true)
    if (!ok) return
    try {
      await api.delete(`/vms/admin/pool/${entryId}/`)
      toast.success('Pool entry deleted')
      handleRefresh()
    } catch (err) {
      toast.error('Delete failed')
    }
  }

  const handlePoolConfigChange = async (templateId, field, value) => {
    try {
      await api.put(`/vms/admin/templates/${templateId}/pool-config/`, { [field]: value })
      handleRefresh()
    } catch(e) {
      console.error(e)
    }
  }

  const handleUnlink = async (templateId) => {
    try {
      await api.post(`/vms/admin/templates/${templateId}/link/`, { proxmox_template_id: null })
      toast.success('Template unlinked')
      handleRefresh()
    } catch { 
      toast.error('Unlink failed') 
    }
  }

  const formatTimeAgo = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    return `${Math.floor(diff/3600)}h ago`;
  };

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
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer mr-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded bg-[var(--bg-card)] border-slate-600 text-indigo-500 focus:ring-indigo-500"
            />
            Auto-refresh
          </label>
          <button onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}>
            <RefreshCw size={14} 
              style={{
                animation: refreshing ? 'spin 1s linear infinite' : 'none'
              }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </button>
          <button 
            onClick={handleCleanup}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-transparent border border-[var(--status-error)]/30 hover:bg-[var(--status-error)]/10 text-[var(--status-error)] transition-colors text-sm font-medium"
          >
            <Trash2 size={16} /> Clean Up Errors
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-indigo-500 text-white transition-colors text-sm font-bold shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} /> Pre-clone VMs
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Ready', value: stats?.ready || 0, color: 'text-[var(--status-online)]', border: 'border-l-[var(--status-online)]' },
          { label: 'Assigned', value: stats?.assigned || 0, color: 'text-[var(--status-info)]', border: 'border-l-[var(--status-info)]' },
          { label: 'Creating', value: stats?.creating || 0, color: 'text-[var(--status-warning)]', border: 'border-l-[var(--status-warning)]' },
          { label: 'Error', value: stats?.error || 0, color: 'text-[var(--status-error)]', border: 'border-l-[var(--status-error)]' },
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
        
        {poolEntries.length > 0 ? (
          isMobile ? (
            // Same established pattern: 7-column table → stacked cards.
            <div className="flex flex-col gap-3 p-3">
              {poolEntries.map(entry => (
                <div key={entry.id} className="border border-[var(--border-color)] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{entry.vm_id || 'N/A'}</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0,
                      background: entry.status === 'ready' ? 'var(--status-online-bg)' : entry.status === 'assigned' ? 'var(--status-info-bg)' : entry.status === 'error' ? 'var(--status-error-bg)' : 'var(--status-warning-bg)',
                      color: entry.status === 'ready' ? 'var(--status-online)' : entry.status === 'assigned' ? 'var(--status-info)' : entry.status === 'error' ? 'var(--status-error)' : 'var(--status-warning)',
                    }}>
                      {entry.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-primary)' }} className="mb-1">{entry.template_name}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-word' }} className="mb-1">Assigned to: {entry.assigned_to || 'N/A'}</p>
                  <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)' }} className="mb-1">{entry.ip_address || 'N/A'}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)' }} className="mb-2">{entry.created_at ? formatTimeAgo(entry.created_at) : 'N/A'}</p>
                  <button onClick={() => handleDeleteEntry(entry.id)}
                    style={{ width: '44px', height: '44px' }}
                    className="flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--status-error)] rounded-lg hover:bg-[var(--status-error-bg)] transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['VM ID', 'Template', 'Status', 'Created', 'Assigned To', 'IP Address', 'Actions'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 16px', fontSize: '10px',
                      textTransform: 'uppercase', letterSpacing: '1px',
                      color: 'var(--text-muted)', fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {poolEntries.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'transparent' }} className="hover:bg-[var(--bg-input)] transition-colors">
                    <td style={{ padding: '10px 16px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {entry.vm_id || 'N/A'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-primary)' }}>
                      {entry.template_name}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                        background: entry.status === 'ready' ? 'var(--status-online-bg)' : entry.status === 'assigned' ? 'var(--status-info-bg)' : entry.status === 'error' ? 'var(--status-error-bg)' : 'var(--status-warning-bg)',
                        color: entry.status === 'ready' ? 'var(--status-online)' : entry.status === 'assigned' ? 'var(--status-info)' : entry.status === 'error' ? 'var(--status-error)' : 'var(--status-warning)',
                      }}>
                        {entry.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {entry.created_at ? formatTimeAgo(entry.created_at) : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {entry.assigned_to || 'N/A'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {entry.ip_address || 'N/A'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDeleteEntry(entry.id)} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--status-error)] rounded-lg hover:bg-[var(--status-error-bg)] transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div className="w-16 h-16 rounded-full bg-[var(--bg-input)] flex items-center justify-center mb-4 mx-auto">
              <Cloud className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>
              No VMs in pool
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
              Click "Pre-clone VMs" to get started
            </p>
          </div>
        )}
      </div>

      {/* Templates Section */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Template Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <div key={template.id} className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl p-5 border border-[var(--border-color)] shadow-lg flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-lg">{template.name}</h3>
                  <p className="text-[var(--text-secondary)] text-sm">{template.os}</p>
                </div>
                {template.is_real && template.proxmox_template_id ? (
                  <span className="px-2.5 py-1 rounded bg-[var(--status-online-bg)] text-[var(--status-online)] border border-[var(--status-online)] text-xs font-medium">
                    Linked (ID: {template.proxmox_template_id})
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border-color)] text-xs font-medium">
                    Unlinked
                  </span>
                )}
              </div>
              
              {template.has_duplicate_link && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
                  borderRadius: '8px', background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning)',
                  marginTop: '8px', marginBottom: '16px'
                }}>
                  <AlertTriangle size={12} style={{ color: 'var(--status-warning)' }} />
                  <span style={{ fontSize: '10px', color: 'var(--status-warning)', fontWeight: 600 }}>
                    Duplicate link. Same Proxmox ID as another template.
                  </span>
                </div>
              )}
              
              <div className="flex gap-4 mb-4">
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Pool Ready</p>
                  <p className="text-xl font-bold text-[var(--status-online)]">{template.pool_ready}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Assigned</p>
                  <p className="text-xl font-bold text-[var(--status-info)]">{template.pool_assigned}</p>
                </div>
              </div>

              {/* Per-Template Pool Config */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Target Pool Size
                  </label>
                  <input type="number" min={0} max={10}
                    value={template.target_pool_size}
                    onChange={e => handlePoolConfigChange(template.id, 'target_pool_size', parseInt(e.target.value))}
                    style={{
                      width: '50px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                      background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'center',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Auto-refill when below target
                  </span>
                  <button 
                    onClick={() => handlePoolConfigChange(template.id, 'auto_refill_enabled', !template.auto_refill_enabled)}
                    style={{
                      width: '36px', height: '20px', borderRadius: '10px',
                      background: template.auto_refill_enabled ? 'var(--accent-primary)' : 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      position: 'relative', transition: 'all 0.2s',
                    }}>
                    <div style={{
                      width: '14px', height: '14px', borderRadius: '50%', background: template.auto_refill_enabled ? '#FFFFFF' : 'var(--text-muted)',
                      position: 'absolute', top: '2px', left: template.auto_refill_enabled ? '18px' : '2px', transition: 'all 0.2s',
                    }} />
                  </button>
                </div>
              </div>
              
              <div className="mt-auto flex gap-2">
                {template.is_real && template.proxmox_template_id ? (
                  <>
                    <button 
                      onClick={() => handleUnlink(template.id)}
                      className="flex-1 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 bg-transparent border-[var(--status-error)] text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
                    >
                      <Unlink size={14} /> Unlink
                    </button>
                    <button 
                      onClick={() => setLinkModalTemplate(template)}
                      className="flex-1 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                    >
                      <Link2 size={14} /> Update
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setLinkModalTemplate(template)}
                    className="w-full py-2.5 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                  >
                    <Link2 size={16} /> Link to Proxmox
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-clone Modal */}
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
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="">Select a template...</option>
                  {realTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Number of VMs (1 to 10)</label>
                <input 
                  type="number" min="1" max="10" 
                  value={createForm.count}
                  onChange={e => setCreateForm({ ...createForm, count: parseInt(e.target.value) || 1 })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <button 
                onClick={handlePreCloneClick} disabled={creating}
                className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg shadow-[var(--accent-primary)]/20"
              >
                {creating ? 'Checking Capacity...' : `Clone ${createForm.count} VM(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      
      <TemplateLinkModal 
        template={linkModalTemplate}
        isOpen={!!linkModalTemplate}
        onClose={() => setLinkModalTemplate(null)}
        onLinked={() => {
          setLinkModalTemplate(null);
          fetchTemplates();
          fetchPoolEntries();
        }}
      />
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
</div>
  )
}
