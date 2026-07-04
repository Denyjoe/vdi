/**
 * VMPoolPage — Admin VM pool management dashboard.
 *
 * Features:
 *   - Pool status cards (total, ready, assigned, creating, error)
 *   - Template management with Proxmox linking
 *   - Pre-clone VM creation with background processing
 *   - Pool entries table with auto-refresh
 *   - Delete/cleanup actions
 *
 * Data sources:
 *   - GET    /api/vms/admin/pool/status/
 *   - POST   /api/vms/admin/pool/create/
 *   - POST   /api/vms/admin/pool/cleanup/
 *   - DELETE /api/vms/admin/pool/:id/
 *   - GET    /api/vms/admin/templates/
 *   - POST   /api/vms/admin/templates/:id/link/
 *
 * @returns {JSX.Element}
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Server, Plus, Trash2, RefreshCw, AlertTriangle,
  CheckCircle, Clock, Cpu, Link2, Unlink, X
} from 'lucide-react'
import api from '../../services/api'
import { toast } from 'react-hot-toast'

/** Auto-refresh interval when creating VMs (ms) */
const AUTO_REFRESH_INTERVAL_MS = 10000

/** Status badge color mapping */
const STATUS_COLORS = {
  ready: { bg: 'rgba(16,185,129,0.15)', text: '#34d399', border: 'rgba(16,185,129,0.3)' },
  assigned: { bg: 'rgba(99,102,241,0.15)', text: '#a5b4fc', border: 'rgba(99,102,241,0.3)' },
  creating: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  error: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },
}

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

  // Auto-refresh when there are VMs being created
  useEffect(() => {
    const hasCreating = entries.some(e => e.status === 'creating')
    if (!hasCreating) return

    const interval = setInterval(fetchData, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [entries, fetchData])

  /**
   * Handle pre-clone VM creation request.
   * Sends request to backend which processes in background.
   */
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

  /**
   * Clean up all pool entries in error state.
   */
  const handleCleanup = async () => {
    try {
      const res = await api.post('/vms/admin/pool/cleanup/')
      toast.success(res.data?.message || 'Cleaned up')
      fetchData()
    } catch (err) {
      toast.error('Cleanup failed')
    }
  }

  /**
   * Delete a specific pool entry by ID.
   * @param {number} entryId - Pool entry ID to delete.
   */
  const handleDeleteEntry = async (entryId) => {
    if (!confirm('Delete this pool VM? This will destroy it from Proxmox.')) return
    try {
      await api.delete(`/vms/admin/pool/${entryId}/`)
      toast.success('Pool entry deleted')
      fetchData()
    } catch (err) {
      toast.error('Delete failed')
    }
  }

  /**
   * Link a template to a Proxmox template ID.
   * @param {number} templateId - CloudDesk template ID.
   */
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
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid rgba(99,102,241,0.2)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '32px',
      }}>
        <div>
          <h1 style={{
            color: 'white', fontSize: '24px', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Server size={24} color="#6366f1" /> VM Pool Management
          </h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
            Pre-clone VMs for instant user assignment
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchData} style={{
            padding: '10px 16px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b',
            color: '#94a3b8', cursor: 'pointer', display: 'flex',
            alignItems: 'center', gap: '6px', fontSize: '13px',
          }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowCreateModal(true)} style={{
            padding: '10px 20px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            border: 'none', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', fontWeight: 600,
          }}>
            <Plus size={14} /> Pre-clone VMs
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '16px', marginBottom: '32px',
      }}>
        {[
          { label: 'Total', value: stats?.total || 0, color: '#94a3b8', icon: Server },
          { label: 'Ready', value: stats?.ready || 0, color: '#10b981', icon: CheckCircle },
          { label: 'Assigned', value: stats?.assigned || 0, color: '#6366f1', icon: Cpu },
          { label: 'Creating', value: stats?.creating || 0, color: '#f59e0b', icon: Clock },
          { label: 'Error', value: stats?.error || 0, color: '#ef4444', icon: AlertTriangle },
        ].map(card => (
          <div key={card.label} style={{
            padding: '20px', borderRadius: '16px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px',
            }}>
              <card.icon size={16} color={card.color} />
              <span style={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {card.label}
              </span>
            </div>
            <p style={{ color: card.color, fontSize: '28px', fontWeight: 700, margin: 0 }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Templates Section */}
      <div style={{
        padding: '24px', borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b',
        marginBottom: '32px',
      }}>
        <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Template Management
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Name', 'OS', 'Specs', 'Proxmox ID', 'Pool Ready', 'Pool Assigned', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left', color: '#64748b',
                    fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '12px', color: 'white', fontWeight: 500, fontSize: '13px' }}>{t.name}</td>
                  <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>{t.os}</td>
                  <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>
                    {t.cpu_cores} CPU / {t.ram_gb}GB RAM
                  </td>
                  <td style={{ padding: '12px' }}>
                    {t.is_real ? (
                      <span style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                        background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)',
                      }}>
                        VM {t.proxmox_template_id}
                      </span>
                    ) : (
                      <span style={{ color: '#475569', fontSize: '12px' }}>Simulated</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: '#10b981', fontWeight: 600, fontSize: '14px' }}>{t.pool_ready}</td>
                  <td style={{ padding: '12px', color: '#6366f1', fontWeight: 600, fontSize: '14px' }}>{t.pool_assigned}</td>
                  <td style={{ padding: '12px' }}>
                    <button onClick={() => { setShowLinkModal(t.id); setLinkForm({ proxmox_template_id: t.proxmox_template_id || '' }) }}
                      style={{
                        padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                        background: t.is_real ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
                        border: `1px solid ${t.is_real ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)'}`,
                        color: t.is_real ? '#fbbf24' : '#a5b4fc',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                      {t.is_real ? <><Unlink size={12} /> Edit Link</> : <><Link2 size={12} /> Link Proxmox</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pool Entries Table */}
      <div style={{
        padding: '24px', borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b',
        marginBottom: '32px',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px',
        }}>
          <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>Pool Entries</h2>
          {(stats?.error || 0) > 0 && (
            <button onClick={handleCleanup} style={{
              padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Trash2 size={12} /> Clean Up Errors ({stats.error})
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <div style={{
            padding: '40px', textAlign: 'center', color: '#475569', fontSize: '14px',
          }}>
            No pool entries yet. Click "Pre-clone VMs" to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  {['VM ID', 'Template', 'IP Address', 'Status', 'Assigned To', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 12px', textAlign: 'left', color: '#64748b',
                      fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const sc = STATUS_COLORS[e.status] || STATUS_COLORS.error
                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px', color: 'white', fontFamily: 'monospace', fontWeight: 600, fontSize: '13px' }}>
                        {e.proxmox_vmid || '—'}
                      </td>
                      <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>{e.template}</td>
                      <td style={{ padding: '12px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '13px' }}>
                        {e.ip_address || '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                        }}>
                          {e.status === 'creating' && '⏳ '}{e.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>
                        {e.assigned_to || '—'}
                      </td>
                      <td style={{ padding: '12px', color: '#475569', fontSize: '12px' }}>
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={() => handleDeleteEntry(e.id)} style={{
                          padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                          color: '#f87171',
                        }}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#0d1526', border: '1px solid #1e293b', borderRadius: '20px',
            padding: '32px', maxWidth: '440px', width: '90%',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px',
            }}>
              <h3 style={{ color: 'white', fontWeight: 700, fontSize: '18px', margin: 0 }}>Pre-clone VMs</h3>
              <button onClick={() => setShowCreateModal(false)} style={{
                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
              }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px', fontWeight: 500 }}>
                Template
              </label>
              <select value={createForm.template_id}
                onChange={e => setCreateForm({ ...createForm, template_id: e.target.value })}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px',
                  background: '#1e293b', border: '1px solid #334155', color: 'white', outline: 'none',
                }}>
                <option value="">Select a real template...</option>
                {realTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Proxmox {t.proxmox_template_id})
                  </option>
                ))}
              </select>
              {realTemplates.length === 0 && (
                <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '8px' }}>
                  No real templates linked. Link a template to Proxmox first.
                </p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px', fontWeight: 500 }}>
                Number of VMs (1–5)
              </label>
              <input type="number" min="1" max="5" value={createForm.count}
                onChange={e => setCreateForm({ ...createForm, count: parseInt(e.target.value) || 1 })}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px',
                  background: '#1e293b', border: '1px solid #334155', color: 'white', outline: 'none',
                }} />
            </div>

            <button onClick={handleCreate} disabled={creating} style={{
              width: '100%', padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
              background: creating ? '#334155' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              border: 'none', color: 'white', cursor: creating ? 'not-allowed' : 'pointer',
            }}>
              {creating ? 'Starting...' : `Clone ${createForm.count} VM(s)`}
            </button>

            <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px', textAlign: 'center' }}>
              ⏱️ Each VM takes ~5 min to clone. They will appear as "Creating" and change to "Ready" when done.
            </p>
          </div>
        </div>
      )}

      {/* Link Template Modal */}
      {showLinkModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#0d1526', border: '1px solid #1e293b', borderRadius: '20px',
            padding: '32px', maxWidth: '400px', width: '90%',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px',
            }}>
              <h3 style={{ color: 'white', fontWeight: 700, fontSize: '18px', margin: 0 }}>Link to Proxmox</h3>
              <button onClick={() => setShowLinkModal(null)} style={{
                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
              }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px', fontWeight: 500 }}>
                Proxmox Template VM ID
              </label>
              <input type="number" value={linkForm.proxmox_template_id}
                onChange={e => setLinkForm({ proxmox_template_id: e.target.value })}
                placeholder="e.g. 9000"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px',
                  background: '#1e293b', border: '1px solid #334155', color: 'white', outline: 'none',
                }} />
              <p style={{ color: '#475569', fontSize: '11px', marginTop: '8px' }}>
                Enter the VM ID of the Proxmox template you want to clone from.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => handleLink(showLinkModal)} style={{
                flex: 1, padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: 'none', color: 'white', cursor: 'pointer',
              }}>
                Link Template
              </button>
              <button onClick={async () => {
                try {
                  await api.post(`/vms/admin/templates/${showLinkModal}/link/`, { proxmox_template_id: null })
                  toast.success('Template unlinked')
                  setShowLinkModal(null)
                  fetchData()
                } catch { toast.error('Unlink failed') }
              }} style={{
                padding: '12px 16px', borderRadius: '10px', fontSize: '13px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171', cursor: 'pointer',
              }}>
                Unlink
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
