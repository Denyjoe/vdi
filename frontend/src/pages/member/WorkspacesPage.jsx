import { useState, useEffect } from 'react'
import { Monitor, Plus, Play, Square,
  Cpu, HardDrive, Search, X,
  CheckCircle, Zap, Clock,
  Code2, Compass, Terminal, Palette,
  Network, Database, Shield, Globe,
  Film, Smartphone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'

/** Maps backend icon name → lucide-react component. */
const TEMPLATE_ICONS = {
  Code2, Compass, Terminal, Palette,
  Network, Database, Shield, Cpu,
  Monitor, Globe, Film, Smartphone,
  HardDrive,
}

/**
 * Resolve a template's icon field to a React component.
 * Falls back to Monitor if the icon name is unknown.
 */
const getTemplateIcon = (iconName) => TEMPLATE_ICONS[iconName] || Monitor

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [launchingId, setLaunchingId] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [wsName, setWsName] = useState('')
  const [search, setSearch] = useState('')
  const [showLimitModal, setShowLimitModal] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { openUpgradeModal } = useUIStore()

  const subscription = user?.subscription || {}
  const hoursUsed = subscription?.compute_hours_used || 0
  const hoursTotal = subscription?.compute_hours_per_month || 5
  const hoursRemaining = Math.max(0, hoursTotal - hoursUsed).toFixed(1)
  const usagePct = Math.min(100, (hoursUsed / hoursTotal) * 100)

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

  const openCreate = async () => {
    // Check subscription limits
    const plan = user?.subscription?.plan_name || 'free'
    const maxWorkspaces = 
      plan === 'free' ? 1 :
      plan === 'personal_host' ? 3 :
      plan === 'pro_host' ? 10 : -1
    
    if (maxWorkspaces !== -1 && workspaces.length >= maxWorkspaces) {
      setShowLimitModal(true)
      return
    }
    
    fetchTemplates()
    setShowCreate(true)
    setSelectedTemplate(null)
    setWsName('')
  }

  const handleCreate = async () => {
    if (!selectedTemplate || !wsName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/workspaces/create/', {
        name: wsName.trim(),
        vm_template: selectedTemplate.id
      })
      const newWs = res.data.data
      setWorkspaces(prev => [newWs, ...prev])
      setShowCreate(false)
      // Auto-launch after creation
      if (newWs?.id) {
        setLaunchingId(newWs.id)
        try {
          await api.post(`/workspaces/${newWs.id}/launch/`)
          navigate(`/session/${newWs.id}?type=workspace`)
        } catch (launchErr) {
          console.error('Auto-launch failed:', launchErr)
        } finally {
          setLaunchingId(null)
        }
      }
    } catch(e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const handleLaunch = async (ws) => {
    try {
      setLaunchingId(ws.id)
      await api.post(`/workspaces/${ws.id}/launch/`)
      navigate(`/session/${ws.id}?type=workspace`)
    } catch(e) {
      console.error(e)
    } finally {
      setLaunchingId(null)
    }
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

      {hoursTotal !== -1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '12px 16px',
          borderRadius: '12px',
          background: usagePct > 80
            ? 'rgba(239,68,68,0.08)'
            : 'rgba(99,102,241,0.06)',
          border: `1px solid ${usagePct > 80
            ? 'rgba(239,68,68,0.2)'
            : 'rgba(99,102,241,0.15)'}`,
          marginBottom: '24px'
        }}>
          <Clock size={16} color={
            usagePct > 80 ? '#ef4444' : '#6366f1'
          } />
          
          <div style={{flex: 1}}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '4px'
            }}>
              <span style={{
                color: 'var(--text-secondary)', fontSize: '13px'
              }}>
                Free plan: {hoursRemaining}h 
                remaining this month
              </span>
              <span style={{
                color: usagePct > 80 
                  ? '#ef4444' : '#6366f1',
                fontSize: '13px',
                fontWeight: 600
              }}>
                {hoursUsed.toFixed(1)} / 
                {hoursTotal}h used
              </span>
            </div>
            <div style={{
              height: '4px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${usagePct}%`,
                borderRadius: '2px',
                background: usagePct > 80
                  ? 'linear-gradient(to right, #ef4444, #dc2626)'
                  : 'linear-gradient(to right, #6366f1, #06b6d4)',
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>
          
          {usagePct > 60 && (
            <button
              onClick={() => openUpgradeModal()}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: 'white',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}>
              Get More Hours
            </button>
          )}
        </div>
      )}

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
            maxWidth: '380px', 
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Click "+ New Workspace" above to 
            launch AutoCAD, MATLAB, VS Code 
            and 12+ professional tools instantly 
            in your browser. No installation needed.
          </p>
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
                background: osGradient(ws.vm_template_details?.os),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {(() => { const Icon = getTemplateIcon(ws.vm_template_details?.icon); return <Icon size={44} color="rgba(255,255,255,0.7)" />; })()}
                
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
                  {ws.vm_template_details?.name || 'Unknown'} · {ws.vm_template_details?.os || ''}
                </p>

                {/* Specs */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  marginBottom: '18px'
                }}>
                  {[
                    { icon: Cpu, text: `${ws.vm_template_details?.cpu_cores || '?'} Cores` },
                    { icon: HardDrive, text: `${ws.vm_template_details?.ram_gb || '?'}GB RAM` },
                  ].map((spec, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: 'var(--text-muted)',
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
                      onClick={() => navigate(`/session/${ws.id}?type=workspace`)}
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
                    disabled={launchingId === ws.id}
                    style={{
                      width: '100%',
                      padding: '11px',
                      borderRadius: '10px',
                      background: launchingId === ws.id
                        ? '#1e293b'
                        : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '13px',
                      border: 'none',
                      cursor: launchingId === ws.id ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}>
                    {launchingId === ws.id ? (
                      <>
                        <div style={{
                          width: '15px', height: '15px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: 'white',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        Launching...
                      </>
                    ) : (
                      <>
                        <Play size={15} />
                        Launch Workspace
                      </>
                    )}
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
                  color: 'var(--text-secondary)',
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
                color: 'var(--text-secondary)', fontSize: '13px',
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
                color: 'var(--text-secondary)', fontSize: '13px',
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
                        color: 'var(--text-muted)', fontSize: '11px', margin: '0 0 8px'
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

      {showLimitModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: '#0d1526',
            border: '1px solid #1e293b',
            borderRadius: '24px',
            padding: '40px 32px',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center'
          }}>
            {/* Icon */}
            <div style={{
              width: '64px', height: '64px',
              borderRadius: '16px',
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Zap size={28} color="#6366f1" />
            </div>
            
            <h2 style={{
              color: 'white', fontSize: '22px',
              fontWeight: 700, margin: '0 0 8px'
            }}>
              Workspace Limit Reached
            </h2>
            
            <p style={{
              color: 'var(--text-muted)', fontSize: '14px',
              lineHeight: 1.6, margin: '0 0 8px'
            }}>
              Free plan includes 1 workspace 
              and 5 compute hours per month.
            </p>
            
            <p style={{
              color: 'var(--text-secondary)', fontSize: '14px',
              margin: '0 0 28px'
            }}>
              Upgrade to get more workspaces, 
              more hours, and the ability to 
              host live sessions.
            </p>
            
            {/* Plan comparison */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '24px',
              textAlign: 'left'
            }}>
              {[
                { name: 'Personal Host',
                  price: '$9/mo · TZS 23,000',
                  workspaces: 3,
                  hours: 20,
                  plan: 'personal_host' },
                { name: 'Pro Host',
                  price: '$19/mo · TZS 49,000',
                  workspaces: 10,
                  hours: 80,
                  plan: 'pro_host',
                  recommended: true },
              ].map(p => (
                <div key={p.plan} style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${p.recommended 
                    ? 'rgba(99,102,241,0.4)' 
                    : '#1e293b'}`,
                  background: p.recommended
                    ? 'rgba(99,102,241,0.08)'
                    : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onClick={() => {
                  openUpgradeModal()
                  setShowLimitModal(false)
                }}>
                  <div>
                    <p style={{
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '14px',
                      margin: '0 0 2px'
                    }}>
                      {p.name}
                      {p.recommended && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '10px',
                          background: '#6366f1',
                          color: 'white',
                          padding: '2px 7px',
                          borderRadius: '10px'
                        }}>
                          POPULAR
                        </span>
                      )}
                    </p>
                    <p style={{
                      color: 'var(--text-muted)',
                      fontSize: '12px',
                      margin: 0
                    }}>
                      {p.workspaces} workspaces · 
                      {p.hours}h/month
                    </p>
                  </div>
                  <p style={{
                    color: '#6366f1',
                    fontWeight: 700,
                    fontSize: '14px',
                    margin: 0
                  }}>
                    {p.price.split('·')[0]}
                  </p>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => 
                setShowLimitModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid #1e293b',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
              Stay on Free Plan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
