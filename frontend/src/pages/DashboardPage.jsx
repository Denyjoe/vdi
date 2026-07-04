import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Monitor, Video, Zap, Clock,
  Users, Play, ArrowRight, Plus,
  Cpu, HardDrive, Globe, Shield,
  TrendingUp, Star } from 'lucide-react'
import useAuthStore from '../store/authStore'
import api from '../services/api'
import JoinByCodeModal from '../components/shared/JoinByCodeModal'
import CreateSessionModal from '../components/shared/CreateSessionModal'
import UpgradeModal from '../components/shared/UpgradeModal'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState([])
  const [stats, setStats] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const firstName = user?.first_name 
    || user?.email?.split('@')[0] || 'there'
  
  const hour = new Date().getHours()
  const greeting = hour < 12 
    ? 'Good morning' 
    : hour < 17 
    ? 'Good afternoon' 
    : 'Good evening'

  const motivational = [
    "What will you build today?",
    "Your cloud workspace is ready.",
    "Ready to get productive?",
    "Heavy software, lightweight browser.",
    "Your powerful computer in the cloud.",
  ]
  const subtitle = motivational[
    new Date().getDay() % motivational.length]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [wsRes, statsRes, settingsRes] =
        await Promise.all([
          api.get('/workspaces/').catch(() => ({ data: {} })),
          api.get('/auth/profile/stats/').catch(() => ({ data: {} })),
          api.get('/settings/public/').catch(() => ({ data: {} }))
        ])
      setWorkspaces(
        wsRes.data?.data?.slice(0, 3) || [])
      setStats(statsRes.data?.data || {})
      setAnnouncement(
        settingsRes.data?.data?.system_announcement || '')
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const subscription = user?.subscription || {}
  const plan = subscription?.plan_name || 'free'
  const hoursUsed = subscription?.compute_hours_used || 0
  const hoursTotal = subscription?.compute_hours_per_month || 5
  const hoursRemaining = hoursTotal === -1 
    ? '∞' 
    : Math.max(0, hoursTotal - hoursUsed).toFixed(1)
  const usagePct = hoursTotal === -1 
    ? 0 
    : Math.min(100, (hoursUsed / hoursTotal) * 100)

  const planColors = {
    free: '#6366f1',
    personal_host: '#06b6d4',
    pro_host: '#8b5cf6',
    institution: '#f59e0b'
  }
  const planColor = planColors[plan] || '#6366f1'

  if (loading) return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        width: '40px', height: '40px',
        border: '3px solid rgba(99,102,241,0.2)',
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{color: '#475569', fontSize: '14px'}}>
        Loading your workspace...
      </p>
    </div>
  )

  return (
    <div style={{
      padding: '32px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>

      {/* Announcement Banner */}
      {announcement && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>📢</span>
          <p style={{color: '#fcd34d', fontSize: '14px', margin: 0}}>
            {announcement}
          </p>
        </div>
      )}

      {/* HERO WELCOME SECTION */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(6,182,212,0.06) 100%)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: '20px',
        padding: '32px',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative orb */}
        <div style={{
          position: 'absolute',
          top: '-60px', right: '-60px',
          width: '200px', height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          position: 'relative',
          zIndex: 1,
          flexWrap: 'wrap',
          gap: '24px'
        }}>
          {/* Left: Welcome text */}
          <div style={{flex: 1}}>
            <h1 style={{
              color: 'white',
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '6px',
              margin: '0 0 6px 0'
            }}>
              {greeting}, {firstName} ✨
            </h1>
            <p style={{
              color: 'var(--text-muted)',
              fontSize: '15px',
              margin: '0 0 20px 0'
            }}>
              {subtitle}
            </p>

            {/* Plan badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: `rgba(${
                plan === 'pro_host' ? '139,92,246' : '99,102,241'
              }, 0.15)`,
              border: `1px solid rgba(${
                plan === 'pro_host' ? '139,92,246' : '99,102,241'
              }, 0.3)`,
              marginBottom: '16px'
            }}>
              <Zap size={12} color={planColor} />
              <span style={{
                color: planColor,
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'capitalize'
              }}>
                {plan.replace('_', ' ')} Plan
              </span>
              {!user?.is_host && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  style={{
                    color: '#6366f1',
                    fontSize: '12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}>
                  Upgrade →
                </button>
              )}
            </div>

            {/* CTA Buttons */}
            <div style={{
              display: 'flex', 
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => navigate('/workspaces')}
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
                <Monitor size={16} />
                Launch Workspace
              </button>

              <button
                onClick={() => setShowJoinModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-input)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}>
                <Video size={16} />
                Join Session
              </button>

              {user?.is_host && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#34d399',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}>
                  <Plus size={16} />
                  Host Session
                </button>
              )}
            </div>
          </div>

          {/* Right: Hours Gauge */}
          <div style={{textAlign: 'center'}}>
            <div style={{
              position: 'relative',
              width: '120px',
              height: '120px'
            }}>
              <svg width="120" height="120"
                style={{transform: 'rotate(-90deg)'}}>
                <circle cx="60" cy="60" 
                  r="50" fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="8" />
                <circle cx="60" cy="60" 
                  r="50" fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - usagePct/100)}`}
                  style={{
                    transition: 'stroke-dashoffset 1s ease'
                  }} />
                <defs>
                  <linearGradient 
                    id="gaugeGrad"
                    x1="0%" y1="0%" 
                    x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1"/>
                    <stop offset="100%" stopColor="#06b6d4"/>
                  </linearGradient>
                </defs>
              </svg>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{
                  color: 'white',
                  fontSize: '22px',
                  fontWeight: 700,
                  lineHeight: 1
                }}>
                  {hoursRemaining}
                </span>
                <span style={{
                  color: '#475569',
                  fontSize: '11px',
                  marginTop: '2px'
                }}>
                  hrs left
                </span>
              </div>
            </div>
            <p style={{
              color: '#475569',
              fontSize: '12px',
              marginTop: '8px'
            }}>
              {hoursTotal === -1 
                ? 'Unlimited hours' 
                : `${hoursUsed.toFixed(1)} of ${hoursTotal}h used`}
            </p>
          </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {[
          { 
            icon: Monitor,
            label: 'My Workspaces',
            value: stats?.workspaces || 0,
            color: '#6366f1',
            bg: 'rgba(99,102,241,0.1)',
            onClick: () => navigate('/workspaces')
          },
          { 
            icon: Video,
            label: 'Sessions Joined',
            value: stats?.sessions_joined || 0,
            color: '#06b6d4',
            bg: 'rgba(6,182,212,0.1)',
            onClick: () => navigate('/sessions/my')
          },
          { 
            icon: Clock,
            label: 'Hours This Month',
            value: `${hoursUsed.toFixed(1)}h`,
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.1)',
            onClick: null
          },
        ].map((stat, i) => (
          <div key={i}
            onClick={stat.onClick}
            style={{
              background: '#111827',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              padding: '20px',
              cursor: stat.onClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}
            onMouseEnter={e => {
              if (stat.onClick) {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#1e293b'
              e.currentTarget.style.transform = 'translateY(0)'
            }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: stat.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <stat.icon size={22} color={stat.color} />
            </div>
            <div>
              <p style={{
                color: 'white',
                fontSize: '24px',
                fontWeight: 700,
                margin: 0,
                lineHeight: 1
              }}>
                {stat.value}
              </p>
              <p style={{
                color: '#475569',
                fontSize: '13px',
                margin: '4px 0 0 0'
              }}>
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px'
      }}>

        {/* MY WORKSPACES */}
        <div style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: '20px',
          padding: '24px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Monitor size={18} color="#6366f1" />
              My Workspaces
            </h2>
            <button
              onClick={() => navigate('/workspaces')}
              style={{
                color: '#6366f1',
                fontSize: '13px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
              View All 
              <ArrowRight size={14} />
            </button>
          </div>

          {workspaces.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px 16px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Monitor size={28} color="#6366f1" />
              </div>
              <p style={{
                color: 'white',
                fontWeight: 600,
                marginBottom: '8px',
                fontSize: '15px'
              }}>
                No workspaces yet
              </p>
              <p style={{
                color: '#475569',
                fontSize: '13px',
                marginBottom: '20px',
                lineHeight: 1.5
              }}>
                Launch AutoCAD, MATLAB, 
                VS Code and 12+ more tools 
                instantly in your browser.
                No installation needed.
              </p>
              <button
                onClick={() => navigate('/workspaces')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}>
                Create First Workspace
              </button>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {workspaces.map(ws => (
                <div key={ws.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid #1e293b'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(6,182,212,0.2))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Monitor size={18} color="#818cf8" />
                  </div>
                  <div style={{flex: 1}}>
                    <p style={{
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 500,
                      margin: 0
                    }}>
                      {ws.name}
                    </p>
                    <p style={{
                      color: '#475569',
                      fontSize: '12px',
                      margin: '2px 0 0 0'
                    }}>
                      {ws.vm_template_details?.name || 'Unknown'}
                    </p>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: ws.status === 'active' ? '#10b981' : '#475569'
                    }} />
                    <span style={{
                      color: ws.status === 'active' ? '#10b981' : '#475569',
                      fontSize: '12px',
                      textTransform: 'capitalize'
                    }}>
                      {ws.status}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate('/workspaces')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      background: ws.status === 'active'
                        ? 'rgba(16,185,129,0.15)'
                        : 'rgba(99,102,241,0.15)',
                      border: `1px solid ${
                        ws.status === 'active'
                          ? 'rgba(16,185,129,0.3)'
                          : 'rgba(99,102,241,0.3)'
                      }`,
                      color: ws.status === 'active' ? '#34d399' : '#818cf8',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none'
                    }}>
                    {ws.status === 'active' ? 'Connect' : 'Launch'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* JOIN SESSION / HOST SECTION */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Join Session Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(99,102,241,0.05))',
            border: '1px solid rgba(6,182,212,0.2)',
            borderRadius: '20px',
            padding: '24px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flex: 1
          }}
          onClick={() => setShowJoinModal(true)}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(6,182,212,0.15)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(6,182,212,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Video size={22} color="#06b6d4" />
              </div>
              <div>
                <p style={{
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '16px',
                  margin: 0
                }}>
                  Join a Session
                </p>
                <p style={{
                  color: '#06b6d4',
                  fontSize: '12px',
                  margin: '2px 0 0 0'
                }}>
                  Always free to join
                </p>
              </div>
            </div>
            <p style={{
              color: '#475569',
              fontSize: '13px',
              lineHeight: 1.5,
              margin: '0 0 16px 0'
            }}>
              Enter an invite code to join 
              a live session. You'll get 
              your own VM instance instantly.
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#06b6d4',
              fontSize: '14px',
              fontWeight: 600
            }}>
              Enter invite code
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Host Section */}
          {user?.is_host ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(6,182,212,0.05))',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '20px',
              padding: '24px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flex: 1
            }}
            onClick={() => setShowCreateModal(true)}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(16,185,129,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Plus size={22} color="#10b981" />
                </div>
                <div>
                  <p style={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '16px',
                    margin: 0
                  }}>
                    Host a Session
                  </p>
                  <p style={{
                    color: '#10b981',
                    fontSize: '12px',
                    margin: '2px 0 0 0'
                  }}>
                    Up to {user?.subscription?.max_participants || 50} participants
                  </p>
                </div>
              </div>
              <p style={{
                color: '#475569',
                fontSize: '13px',
                lineHeight: 1.5,
                margin: '0 0 16px 0'
              }}>
                Create a live session, 
                share the invite code, 
                and monitor all participant 
                VMs in real time.
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#10b981',
                fontSize: '14px',
                fontWeight: 600
              }}>
                Create session now
                <ArrowRight size={14} />
              </div>
            </div>
          ) : (
            /* Upgrade to Host Card */
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: '20px',
              padding: '24px',
              flex: 1,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: '-30px', right: '-30px',
                width: '100px', height: '100px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent)',
                pointerEvents: 'none'
              }} />
              
              <Zap size={28} color="#818cf8" style={{marginBottom: '12px'}} />
              
              <p style={{
                color: 'white',
                fontWeight: 700,
                fontSize: '18px',
                margin: '0 0 8px 0'
              }}>
                Start Hosting Sessions
              </p>
              <p style={{
                color: 'var(--text-muted)',
                fontSize: '13px',
                lineHeight: 1.6,
                margin: '0 0 20px 0'
              }}>
                Run live VM sessions for 
                your students or team. 
                Everyone gets their own 
                virtual desktop. 
                Monitor them all in 
                real time.
              </p>
              
              {/* Feature pills */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginBottom: '20px'
              }}>
                {[
                  '50+ participants',
                  'Real-time monitoring',
                  'Exam mode',
                  'Custom VM templates',
                  'Full analytics'
                ].map(f => (
                  <span key={f} style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    color: '#a5b4fc',
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    ✓ {f}
                  </span>
                ))}
              </div>
              
              <button
                onClick={() => setShowUpgradeModal(true)}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '15px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                <Zap size={16} />
                Upgrade to Host — from $9/month
              </button>
              
              <p style={{
                color: '#475569',
                fontSize: '11px',
                textAlign: 'center',
                margin: '10px 0 0 0'
              }}>
                Cancel anytime · No contracts
              </p>
            </div>
          )}
        </div>
      </div>

      {/* WHY CLOUDDESK SECTION */}
      {/* Show to free users who have not yet created a workspace */}
      {workspaces.length === 0 && (
        <div style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: '20px',
          padding: '32px'
        }}>
          <h2 style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: '8px'
          }}>
            Your computer in the cloud ☁️
          </h2>
          <p style={{
            color: '#475569',
            fontSize: '14px',
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            Access heavy software from any browser. No installation. No expensive hardware.
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px'
          }}>
            {[
              {
                icon: Cpu,
                color: '#6366f1',
                bg: 'rgba(99,102,241,0.1)',
                title: 'AutoCAD, MATLAB & More',
                desc: 'Run professional software that your laptop cannot handle. 12+ templates ready instantly.'
              },
              {
                icon: Globe,
                color: '#06b6d4',
                bg: 'rgba(6,182,212,0.1)',
                title: 'Works on Any Device',
                desc: 'Old laptop, Chromebook, tablet — if it has a browser, it works. No downloads.'
              },
              {
                icon: Shield,
                color: '#10b981',
                bg: 'rgba(16,185,129,0.1)',
                title: 'Isolated & Secure',
                desc: 'Every workspace is completely isolated. Your files are private and protected.'
              },
            ].map((item, i) => (
              <div key={i} style={{
                textAlign: 'center',
                padding: '24px 16px'
              }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: item.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <item.icon size={24} color={item.color} />
                </div>
                <p style={{
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '15px',
                  marginBottom: '8px'
                }}>
                  {item.title}
                </p>
                <p style={{
                  color: '#475569',
                  fontSize: '13px',
                  lineHeight: 1.6
                }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      {showJoinModal && (
        <JoinByCodeModal
          onClose={() => setShowJoinModal(false)}
          onJoined={(session) => {
            setShowJoinModal(false)
          }}
        />
      )}

      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(session) => {
            setShowCreateModal(false)
          }}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          onUpgraded={() => {
            setShowUpgradeModal(false)
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
