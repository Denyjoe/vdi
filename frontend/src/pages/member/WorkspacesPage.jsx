import { useState, useEffect } from 'react'
import { Monitor, Plus, Play, Square,
  Cpu, HardDrive, Search, X,
  CheckCircle, Loader } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [wsName, setWsName] = useState('')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => { fetchWorkspaces() }, [])

  const fetchWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces/')
      setWorkspaces(res.data?.data || [])
    } catch(e) { 
      console.error(e) 
    } finally { 
      setLoading(false) 
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/vms/templates/')
      setTemplates(res.data?.data || [])
    } catch(e) { 
      console.error(e) 
    }
  }

  const openCreate = () => {
    fetchTemplates()
    setShowCreate(true)
    setSelectedTemplate(null)
    setWsName('')
  }

  const handleCreate = async () => {
    if (!selectedTemplate || !wsName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/workspaces/', {
        name: wsName.trim(),
        vm_template_id: selectedTemplate.id
      })
      setWorkspaces(prev => [res.data.data, ...prev])
      setShowCreate(false)
    } catch(e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const handleLaunch = async (ws) => {
    try {
      await api.post(`/workspaces/${ws.id}/launch/`)
      fetchWorkspaces()
    } catch(e) { console.error(e) }
  }

  const handleStop = async (ws) => {
    try {
      await api.post(`/workspaces/${ws.id}/stop/`)
      fetchWorkspaces()
    } catch(e) { console.error(e) }
  }

  const osGradient = (os) => {
    if (os?.includes('Windows')) 
      return 'linear-gradient(135deg, #1e3a5f, #1a3a8f)'
    if (os?.includes('Kali')) 
      return 'linear-gradient(135deg, #2d1b69, #1a0533)'
    return 'linear-gradient(135deg, #1a3a2a, #0f3460)'
  }

  const filtered = workspaces.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{padding: '32px', maxWidth: '1200px', margin: '0 auto'}}>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{color: 'white', fontSize: '26px', fontWeight: 700, margin: 0}}>
            My Workspaces
          </h1>
          <p style={{color: '#475569', fontSize: '14px', margin: '4px 0 0'}}>
            Your persistent cloud desktop environments
          </p>
        </div>
        <button onClick={openCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: 'white',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(99,102,241,0.3)'
          }}>
          <Plus size={18} />
          New Workspace
        </button>
      </div>

      {/* Search (only if has workspaces) */}
      {workspaces.length > 0 && (
        <div style={{
          position: 'relative',
          marginBottom: '24px',
          maxWidth: '400px'
        }}>
          <Search size={16} 
            color="#475569"
            style={{
              position: 'absolute',
              left: '14px', top: '50%',
              transform: 'translateY(-50%)'
            }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search workspaces..."
            style={{
              width: '100%',
              padding: '11px 14px 11px 40px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid #1e293b',
              color: 'white',
              fontSize: '14px',
              outline: 'none'
            }} />
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '80px'
        }}>
          <div style={{
            width: '36px', height: '36px',
            border: '3px solid rgba(99,102,241,0.2)',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      ) : filtered.length === 0 ? (
        /* Empty State */
        <div style={{
          textAlign: 'center',
          padding: '80px 24px',
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: '20px'
        }}>
          <div style={{
            width: '72px', height: '72px',
            borderRadius: '18px',
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <Monitor size={32} color="#6366f1" />
          </div>
          <h2 style={{
            color: 'white', fontSize: '20px',
            fontWeight: 700, margin: '0 0 8px'
          }}>
            No workspaces yet
          </h2>
          <p style={{
            color: '#475569', fontSize: '14px',
            maxWidth: '360px', margin: '0 auto 28px',
            lineHeight: 1.6
          }}>
            Create your first workspace to access AutoCAD, MATLAB, VS Code and 12+ professional tools instantly in your browser.
          </p>
          <button onClick={openCreate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '13px 28px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              fontWeight: 600,
              fontSize: '15px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(99,102,241,0.35)'
            }}>
            <Plus size={18} />
            Create Your First Workspace
          </button>
        </div>
      ) : (
        /* Workspace Grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {filtered.map(ws => (
            <div key={ws.id} style={{
              borderRadius: '18px',
              overflow: 'hidden',
              border: '1px solid #1e293b',
              background: '#111827',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
              e.currentTarget.style.transform = 'translateY(-3px)'
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#1e293b'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}>

              {/* Card Header */}
              <div style={{
                height: '120px',
                background: osGradient(ws.vm_template?.os),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                <Monitor size={44} color="rgba(255,255,255,0.7)" />
                
                {/* Status */}
                <div style={{
                  position: 'absolute',
                  top: '12px', right: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)'
                }}>
                  <div style={{
                    width: '6px', height: '6px',
                    borderRadius: '50%',
                    background: ws.status === 'active' ? '#10b981' : '#475569'
                  }} />
                  <span style={{
                    color: ws.status === 'active' ? '#34d399' : '#94a3b8',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'capitalize'
                  }}>
                    {ws.status}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div style={{padding: '20px'}}>
                <h3 style={{
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 600,
                  margin: '0 0 4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {ws.name}
                </h3>
                <p style={{
                  color: '#475569',
                  fontSize: '13px',
                  margin: '0 0 16px'
                }}>
                  {ws.vm_template?.name} · {ws.vm_template?.os}
                </p>

                {/* Specs */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  marginBottom: '18px'
                }}>
                  {[
                    { icon: Cpu, text: `${ws.vm_template?.cpu_cores} Cores` },
                    { icon: HardDrive, text: `${ws.vm_template?.ram_gb}GB RAM` },
                  ].map((spec, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#64748b',
                      fontSize: '12px'
                    }}>
                      <spec.icon size={13} />
                      {spec.text}
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                {ws.status === 'active' ? (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button
                      onClick={() => navigate(`/session/${ws.vm}`)}
                      style={{
                        flex: 1, padding: '10px',
                        borderRadius: '10px',
                        background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        color: '#34d399',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}>
                      <Monitor size={15} />
                      Connect
                    </button>
                    <button
                      onClick={() => handleStop(ws)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: '#f87171',
                        cursor: 'pointer'
                      }}>
                      <Square size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleLaunch(ws)}
                    style={{
                      width: '100%',
                      padding: '11px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '13px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}>
                    <Play size={15} />
                    Launch Workspace
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE WORKSPACE MODAL */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0d1526',
            border: '1px solid #1e293b',
            borderRadius: '24px',
            padding: '32px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '85vh',
            overflow: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <div>
                <h2 style={{
                  color: 'white', fontSize: '20px',
                  fontWeight: 700, margin: 0
                }}>
                  New Workspace
                </h2>
                <p style={{
                  color: '#475569', fontSize: '13px', margin: '4px 0 0'
                }}>
                  Choose a template and name your workspace
                </p>
              </div>
              <button onClick={() => setShowCreate(false)}
                style={{
                  width: '36px', height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #1e293b',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                <X size={18} />
              </button>
            </div>

            {/* Workspace Name */}
            <div style={{marginBottom: '24px'}}>
              <label style={{
                color: '#94a3b8', fontSize: '13px',
                fontWeight: 500, display: 'block', marginBottom: '8px'
              }}>
                Workspace Name
              </label>
              <input
                value={wsName}
                onChange={e => setWsName(e.target.value)}
                placeholder="e.g. My AutoCAD Project"
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${wsName ? 'rgba(99,102,241,0.5)' : '#1e293b'}`,
                  color: 'white',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }} />
            </div>

            {/* Template Selection */}
            <div style={{marginBottom: '28px'}}>
              <label style={{
                color: '#94a3b8', fontSize: '13px',
                fontWeight: 500, display: 'block', marginBottom: '12px'
              }}>
                Choose VM Template
              </label>
              
              {templates.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '40px', color: '#475569'
                }}>
                  <div style={{
                    width: '32px', height: '32px',
                    border: '3px solid rgba(99,102,241,0.2)',
                    borderTopColor: '#6366f1',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 12px'
                  }} />
                  Loading templates...
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px'
                }}>
                  {templates.map(t => (
                    <div key={t.id}
                      onClick={() => {
                        setSelectedTemplate(t)
                        if (!wsName) setWsName(`My ${t.name}`)
                      }}
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        border: `2px solid ${selectedTemplate?.id === t.id ? '#6366f1' : '#1e293b'}`,
                        background: selectedTemplate?.id === t.id
                          ? 'rgba(99,102,241,0.1)'
                          : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}>
                      
                      {selectedTemplate?.id === t.id && (
                        <CheckCircle 
                          size={16}
                          color="#6366f1"
                          style={{position: 'absolute', top: '10px', right: '10px'}} />
                      )}
                      
                      <p style={{
                        color: 'white', fontWeight: 600, fontSize: '13px',
                        margin: '0 0 4px', paddingRight: '20px'
                      }}>
                        {t.name}
                      </p>
                      <p style={{
                        color: '#64748b', fontSize: '11px', margin: '0 0 8px'
                      }}>
                        {t.os}
                      </p>
                      <div style={{display: 'flex', gap: '10px'}}>
                        {[`${t.cpu_cores} CPU`, `${t.ram_gb}GB RAM`].map(s => (
                          <span key={s} style={{
                            fontSize: '10px', color: '#475569',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '2px 7px', borderRadius: '6px'
                          }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={!selectedTemplate || !wsName.trim() || creating}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: (!selectedTemplate || !wsName.trim())
                  ? '#1e293b'
                  : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: (!selectedTemplate || !wsName.trim())
                  ? '#475569' : 'white',
                fontWeight: 700,
                fontSize: '15px',
                border: 'none',
                cursor: (!selectedTemplate || !wsName.trim())
                  ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: (!selectedTemplate || !wsName.trim())
                  ? 'none'
                  : '0 4px 20px rgba(99,102,241,0.4)'
              }}>
              {creating ? (
                <>
                  <div style={{
                    width: '18px', height: '18px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Create Workspace
                  {selectedTemplate && wsName ? ` — ${selectedTemplate.name}` : ''}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
