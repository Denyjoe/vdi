import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Monitor, Users, Clock, Copy, X, CheckCircle, Play, Square, Wifi, WifiOff, AlertTriangle, LogOut } from 'lucide-react'
import api from '../services/api'

export default function HostSessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(location.state?.session || null)
  const [participants, setParticipants] = useState([])
  const [summary, setSummary] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [copied, setCopied] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const pollRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    fetchSession()
    startPolling()
    return () => {
      clearInterval(pollRef.current)
      clearInterval(timerRef.current)
    }
  }, [sessionId])

  useEffect(() => {
    if (session?.end_time) {
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, new Date(session.end_time) - new Date())
        setTimeLeft(remaining)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [session])

  const fetchSession = async () => {
    try {
      const res = await api.get(`/sessions/live/${sessionId}/`)
      setSession(res.data.data)
    } catch(e) { console.error(e) }
  }

  const fetchMonitor = async () => {
    try {
      const res = await api.get(`/sessions/live/${sessionId}/monitor/`)
      const data = res.data.data
      setParticipants(data.participants || [])
      setSummary(data.summary || {})
    } catch(e) { console.error(e) }
  }

  const startPolling = () => {
    fetchMonitor()
    pollRef.current = setInterval(fetchMonitor, 5000)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(session?.invite_code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEndSession = async () => {
    try {
      await api.post(`/sessions/live/${sessionId}/end/`)
      navigate('/sessions/my')
    } catch(e) { console.error(e) }
  }

  const handleRemoveParticipant = async (userId) => {
    try {
      await api.post(`/sessions/live/${sessionId}/remove/${userId}/`)
      fetchMonitor()
    } catch(e) { console.error(e) }
  }

  const formatTime = (ms) => {
    if (ms <= 0) return '00:00:00'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  const formatDuration = (joinedAt) => {
    if (!joinedAt) return '0m'
    const diff = new Date() - new Date(joinedAt)
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const isEnding = timeLeft > 0 && timeLeft < 600000

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#030712',
      overflow: 'hidden'
    }}>

      {/* TOP BAR */}
      <div style={{
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '16px',
        borderBottom: '1px solid #0f172a',
        background: 'rgba(3,7,18,0.95)',
        flexShrink: 0
      }}>
        {/* Live indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '8px', height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 8px #10b981',
            animation: 'pulse 2s infinite'
          }} />
          <span style={{
            color: '#10b981',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.05em'
          }}>
            LIVE
          </span>
        </div>

        <div style={{
          width: '1px', height: '20px',
          background: '#1e293b'
        }} />

        {/* Session name */}
        <span style={{
          color: 'white',
          fontWeight: 600,
          fontSize: '15px'
        }}>
          {session?.name || 'Loading...'}
        </span>

        {/* Type badge */}
        {session?.session_type && (
          <span style={{
            padding: '3px 10px',
            borderRadius: '20px',
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)',
            color: '#a5b4fc',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'capitalize'
          }}>
            {session.session_type}
          </span>
        )}

        {/* Spacer */}
        <div style={{flex: 1}} />

        {/* Countdown */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '10px',
          background: isEnding
            ? 'rgba(239,68,68,0.1)'
            : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isEnding
            ? 'rgba(239,68,68,0.3)'
            : '#1e293b'}`
        }}>
          <Clock size={14} 
            color={isEnding 
              ? '#ef4444' : '#64748b'} />
          <span style={{
            color: isEnding 
              ? '#ef4444' : 'white',
            fontFamily: 'monospace',
            fontSize: '15px',
            fontWeight: 700
          }}>
            {session?.end_time 
              ? formatTime(timeLeft)
              : '--:--:--'}
          </span>
        </div>

        {/* Participant count */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid #1e293b'
        }}>
          <Users size={14} color="#64748b" />
          <span style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: 600
          }}>
            {summary.total_joined || 0}
          </span>
          <span style={{
            color: '#475569',
            fontSize: '12px'
          }}>
            / {session?.max_participants || 50}
          </span>
        </div>

        {/* Share code button */}
        <button onClick={copyCode}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '10px',
            background: copied
              ? 'rgba(16,185,129,0.15)'
              : 'rgba(99,102,241,0.15)',
            border: `1px solid ${copied
              ? 'rgba(16,185,129,0.3)'
              : 'rgba(99,102,241,0.3)'}`,
            color: copied 
              ? '#34d399' : '#a5b4fc',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
          {copied 
            ? <CheckCircle size={14} />
            : <Copy size={14} />}
          {copied 
            ? 'Copied!' 
            : session?.invite_code 
              || 'Loading...'}
        </button>

        {/* End session button */}
        <button 
          onClick={() => setShowEndConfirm(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}>
          <Square size={14} />
          End Session
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>

        {/* LEFT — Participants */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflow: 'auto'
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
              <Users size={18} 
                color="#6366f1" />
              Participants
              {participants.length > 0 && (
                <span style={{
                  background: '#6366f1',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '10px'
                }}>
                  {participants.length}
                </span>
              )}
            </h2>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div style={{
                width: '6px', height: '6px',
                borderRadius: '50%',
                background: '#10b981',
                animation: 'pulse 2s infinite'
              }} />
              <span style={{
                color: '#64748b',
                fontSize: '12px'
              }}>
                Live · updates every 5s
              </span>
            </div>
          </div>

          {participants.length === 0 ? (
            /* Empty state */
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#111827',
              border: '1px solid #1e293b',
              borderRadius: '20px'
            }}>
              <div style={{
                width: '64px', height: '64px',
                borderRadius: '16px',
                background: 'rgba(99,102,241,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Users size={28} color="#6366f1" />
              </div>
              <h3 style={{
                color: 'white',
                fontWeight: 600,
                margin: '0 0 8px'
              }}>
                Waiting for participants
              </h3>
              <p style={{
                color: '#475569',
                fontSize: '13px',
                margin: '0 0 20px',
                lineHeight: 1.6
              }}>
                Share the invite code with 
                your participants. They will 
                appear here when they join.
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 28px',
                borderRadius: '14px',
                background: 'rgba(99,102,241,0.1)',
                border: '2px solid rgba(99,102,241,0.3)'
              }}>
                <div>
                  <p style={{
                    color: '#64748b',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    margin: '0 0 4px'
                  }}>
                    INVITE CODE
                  </p>
                  <p style={{
                    color: 'white',
                    fontSize: '28px',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    letterSpacing: '0.2em',
                    margin: 0
                  }}>
                    {session?.invite_code || '...'}
                  </p>
                </div>
                <button onClick={copyCode}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: copied
                      ? '#10b981' : '#6366f1',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer'
                  }}>
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          ) : (
            /* Participant grid */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 
                'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '16px'
            }}>
              {participants.map(p => (
                <div key={p.id} style={{
                  borderRadius: '14px',
                  border: '1px solid #1e293b',
                  background: '#111827',
                  overflow: 'hidden'
                }}>
                  {/* Mini VM preview */}
                  <div style={{
                    height: '90px',
                    background: 'linear-gradient(135deg, #1e3a5f, #1a3a8f)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    <Monitor size={28}
                      color="rgba(255,255,255,0.4)" />
                    
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      right: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <div style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: 
                            p.vm_status === 'running'
                              ? '#10b981'
                              : '#f59e0b'
                        }} />
                        <span style={{
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: '10px'
                        }}>
                          {p.vm_status === 'running'
                            ? 'VM Active'
                            : 'Loading...'}
                        </span>
                      </div>
                      {p.vm_status === 'running' && (
                        <div style={{
                          display: 'flex',
                          gap: '4px'
                        }}>
                          <span style={{
                            background: 'rgba(0,0,0,0.5)',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '9px',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            CPU {p.cpu_usage||0}%
                          </span>
                          <span style={{
                            background: 'rgba(0,0,0,0.5)',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '9px',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            RAM {p.ram_usage||0}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Participant info */}
                  <div style={{padding: '12px'}}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div>
                        <p style={{
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '13px',
                          margin: '0 0 2px'
                        }}>
                          {p.user_name || p.user_email}
                        </p>
                        <p style={{
                          color: '#475569',
                          fontSize: '11px',
                          margin: 0
                        }}>
                          {formatDuration(p.joined_at)} ago
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveParticipant(p.user_id)}
                        title="Remove"
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          color: '#f87171',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                        <X size={12} />
                      </button>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: p.status === 'active'
                          ? 'rgba(16,185,129,0.15)'
                          : 'rgba(245,158,11,0.15)',
                      color: p.status === 'active'
                        ? '#34d399' : '#fcd34d',
                      fontWeight: 600
                    }}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Session Info */}
        <div style={{
          width: '280px',
          borderLeft: '1px solid #0f172a',
          padding: '24px',
          overflow: 'auto',
          flexShrink: 0
        }}>
          <h3 style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 16px'
          }}>
            Session Info
          </h3>

          {/* Stats */}
          {[
            { label: 'Joined', value: summary.total_joined||0, color: '#6366f1' },
            { label: 'Active VMs', value: summary.active_vms||0, color: '#10b981' },
            { label: 'Waiting', value: summary.waiting||0, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid #1e293b',
              marginBottom: '8px'
            }}>
              <span style={{
                color: '#64748b',
                fontSize: '13px'
              }}>
                {s.label}
              </span>
              <span style={{
                color: s.color,
                fontSize: '18px',
                fontWeight: 700
              }}>
                {s.value}
              </span>
            </div>
          ))}

          <div style={{
            height: '1px',
            background: '#1e293b',
            margin: '20px 0'
          }} />

          {/* Session details */}
          <h3 style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 12px'
          }}>
            Details
          </h3>

          {[
            { label: 'VM Template', value: session?.required_vm_template?.name || 'Any' },
            { label: 'Max Participants', value: session?.max_participants || 50 },
            { label: 'Internet', value: session?.restrict_internet ? '🚫 Restricted' : '✓ Open' },
            { label: 'Exam Mode', value: session?.is_exam_mode ? '🔒 Active' : 'Off' },
          ].map(d => (
            <div key={d.label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}>
              <span style={{
                color: '#475569',
                fontSize: '12px'
              }}>
                {d.label}
              </span>
              <span style={{
                color: '#94a3b8',
                fontSize: '12px',
                fontWeight: 500
              }}>
                {d.value}
              </span>
            </div>
          ))}

          <div style={{
            height: '1px',
            background: '#1e293b',
            margin: '20px 0'
          }} />

          {/* Invite link */}
          <h3 style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 12px'
          }}>
            Share
          </h3>

          <div style={{
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            marginBottom: '10px',
            textAlign: 'center'
          }}>
            <p style={{
              color: '#64748b',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              margin: '0 0 6px'
            }}>
              Invite Code
            </p>
            <p style={{
              color: 'white',
              fontSize: '22px',
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: '0.2em',
              margin: '0 0 10px'
            }}>
              {session?.invite_code || '---'}
            </p>
            <button onClick={copyCode}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                background: '#6366f1',
                color: 'white',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}>
              {copied ? '✓ Copied!' : 'Copy Code'}
            </button>
          </div>

          <button
            onClick={() => {
              const link = `${window.location.origin}/join/${session?.invite_code}`
              navigator.clipboard.writeText(link)
            }}
            style={{
              width: '100%',
              padding: '9px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid #1e293b',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer'
            }}>
            Copy Invite Link
          </button>
        </div>
      </div>

      {/* END SESSION CONFIRM */}
      {showEndConfirm && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#0d1526',
            border: '1px solid #1e293b',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center'
          }}>
            <AlertTriangle size={40} color="#ef4444" style={{marginBottom: '16px', display: 'inline-block'}} />
            <h2 style={{
              color: 'white',
              fontWeight: 700,
              margin: '0 0 8px'
            }}>
              End Session?
            </h2>
            <p style={{
              color: '#64748b',
              fontSize: '14px',
              margin: '0 0 24px',
              lineHeight: 1.6
            }}>
              This will disconnect all {' '}{participants.length}{' '} participant(s) and end the session permanently.
            </p>
            <div style={{display: 'flex', gap: '12px'}}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{
                  flex: 1, padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #1e293b',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}>
                Cancel
              </button>
              <button
                onClick={handleEndSession}
                style={{
                  flex: 1, padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}>
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
