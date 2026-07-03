import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Monitor, Users, Clock, Copy, X, CheckCircle, Play, Square, Wifi, WifiOff, AlertTriangle, LogOut, Video, Lock } from 'lucide-react'
import api from '../services/api'

export default function HostSessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(location.state?.session || null)
  const [loading, setLoading] = useState(!location.state?.session)
  const [participants, setParticipants] = useState([])
  const [summary, setSummary] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [copied, setCopied] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [ending, setEnding] = useState(false)
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
    } catch(e) { 
      console.error(e) 
    } finally {
      setLoading(false)
    }
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
    setEnding(true)
    try {
      await api.post(`/sessions/live/${sessionId}/end/`)
    } catch(e) { 
      console.error('End session error:', e)
    } finally {
      setEnding(false)
      setShowEndConfirm(false)
      navigate('/sessions/my')
    }
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

  if (!session && loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#030712',
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
        <p style={{color: '#475569'}}>
          Loading session...
        </p>
      </div>
    )
  }
  
  if (!session && !loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#030712',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <p style={{color: '#ef4444', fontSize: '18px'}}>
          Session not found
        </p>
        <button 
          onClick={() => navigate('/sessions/my')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            background: '#6366f1',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}>
          Back to Sessions
        </button>
      </div>
    )
  }

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
        <button
          onClick={() => navigate('/sessions/my')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid #1e293b',
            color: '#64748b',
            fontSize: '13px',
            cursor: 'pointer',
            marginRight: '8px'
          }}>
          ← Back to Sessions
        </button>

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
              {participants.map(p => {
                const initials = (p.user_name || p.user_email || 'U')
                  .split(' ')
                  .map(w => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
                
                const headerBg = 
                  p.status === 'active'
                    ? 'linear-gradient(135deg, #064e3b, #065f46)'
                  : p.status === 'provisioning' || p.vm_status === 'provisioning'
                    ? 'linear-gradient(135deg, #78350f, #92400e)'
                  : 'linear-gradient(135deg, #0f172a, #1e293b)'
                
                const connectedTime = p.joined_at
                  ? (() => {
                      const diff = new Date() - new Date(p.joined_at)
                      const m = Math.floor(diff/60000)
                      const s = Math.floor((diff%60000)/1000)
                      return m > 0 ? `${m}m ${s}s` : `${s}s`
                    })()
                  : 'Unknown'

                return (
                  <div key={p.id} style={{
                    borderRadius: '16px',
                    border: '1px solid #1e293b',
                    background: '#111827',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
                  }}>
                    {/* Header */}
                    <div style={{
                      height: '80px',
                      background: headerBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '48px', height: '48px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.15)',
                        border: '2px solid rgba(255,255,255,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'white'
                      }}>
                        {initials}
                      </div>
                      
                      {/* Status dot */}
                      <div style={{
                        position: 'absolute',
                        top: '10px', right: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '20px',
                        background: 'rgba(0,0,0,0.4)'
                      }}>
                        <div style={{
                          width: '5px', height: '5px',
                          borderRadius: '50%',
                          background: 
                            p.status === 'active' 
                              ? '#10b981'
                            : p.status === 'submitted'
                              ? '#6366f1'
                            : '#f59e0b'
                        }} />
                        <span style={{
                          color: 'white',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'capitalize'
                        }}>
                          {p.status === 'active' 
                            ? 'Active'
                          : p.status === 'submitted'
                            ? 'Submitted'
                          : 'Waiting'}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{padding: '14px'}}>
                      
                      {/* Name */}
                      <p style={{
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '14px',
                        margin: '0 0 2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {p.user_name || p.user_email}
                      </p>
                      <p style={{
                        color: '#475569',
                        fontSize: '11px',
                        margin: '0 0 12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {p.user_email}
                      </p>

                      {/* Connected time */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px'
                      }}>
                        <Clock size={12} color="#475569" />
                        <span style={{
                          color: '#64748b',
                          fontSize: '12px'
                        }}>
                          {connectedTime}
                        </span>
                      </div>

                      {/* VM Status */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '12px'
                      }}>
                        <Monitor size={12}
                          color={p.vm_status === 'running'
                            ? '#10b981' : '#475569'} />
                        <span style={{
                          color: p.vm_status === 'running'
                            ? '#34d399' : '#475569',
                          fontSize: '12px'
                        }}>
                          {p.vm_status === 'running'
                            ? `VM Running`
                          : p.vm_status === 'provisioning'
                            ? 'VM Starting...'
                          : 'No VM yet'}
                        </span>
                      </div>
                      
                      {/* VM template name */}
                      {p.vm_status === 'running' && 
                        p.vm_name && (
                        <p style={{
                          color: '#334155',
                          fontSize: '11px',
                          margin: '0 0 12px',
                          paddingLeft: '18px'
                        }}>
                          {p.vm_name}
                        </p>
                      )}

                      {/* Screen Preview */}
                      <div style={{
                        marginTop: '10px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid #1e293b',
                        background: '#0a0f1e'
                      }}>
                        {/* Preview area */}
                        <div style={{
                          height: '80px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          background: 'rgba(99,102,241,0.04)'
                        }}>
                          <Monitor size={20} 
                            color="rgba(99,102,241,0.4)" />
                          <span style={{
                            color: '#334155',
                            fontSize: '10px',
                            textAlign: 'center',
                            lineHeight: 1.4,
                            padding: '0 8px'
                          }}>
                            Screen preview will appear here
                            after Guacamole is connected
                          </span>
                        </div>
                        
                        {/* Action bar below preview */}
                        <div style={{
                          display: 'flex',
                          borderTop: '1px solid #0f172a'
                        }}>
                          <button
                            disabled
                            title="Connect Guacamole to enable screen viewing"
                            style={{
                              flex: 1,
                              padding: '7px',
                              background: 'none',
                              border: 'none',
                              borderRight: '1px solid #0f172a',
                              color: '#1e293b',
                              fontSize: '11px',
                              cursor: 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}>
                            <Monitor size={11} />
                            View Screen
                          </button>
                          <button
                            disabled
                            title="Available with Guacamole"
                            style={{
                              flex: 1,
                              padding: '7px',
                              background: 'none',
                              border: 'none',
                              color: '#1e293b',
                              fontSize: '11px',
                              cursor: 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}>
                            <Video size={11} />
                            Take Control
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{
                        display: 'flex', gap: '8px', marginTop: '12px'
                      }}>
                        
                        <button
                          onClick={() => handleRemoveParticipant(p.user_id)}
                          title="Remove participant"
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.15)',
                            color: '#f87171',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                          <X size={12} />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
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
          {/* 1. INVITE CODE */}
          <div style={{
            padding: '20px 16px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05))',
            border: '1px solid rgba(99,102,241,0.2)',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <p style={{
              color: '#a5b4fc',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              margin: '0 0 8px',
              fontWeight: 600
            }}>
              Invite Code
            </p>
            <p style={{
              color: 'white',
              fontSize: '28px',
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: '0.2em',
              margin: '0 0 16px'
            }}>
              {session?.invite_code || '---'}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={copyCode}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  background: '#6366f1',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}>
                {copied ? '✓ Copied' : 'Copy Code'}
              </button>
              <button
                onClick={() => {
                  const link = `${window.location.origin}/join/${session?.invite_code}`
                  navigator.clipboard.writeText(link)
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #1e293b',
                  color: '#e2e8f0',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}>
                Copy Link
              </button>
            </div>
          </div>

          {/* 2. RESTRICTIONS */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              margin: '0 0 12px'
            }}>
              Restrictions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!session?.is_exam_mode && !session?.restrict_internet && !session?.restrict_copy_paste ? (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  color: '#34d399',
                  fontSize: '13px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle size={14} /> No restrictions
                </div>
              ) : (
                <>
                  {session?.is_exam_mode && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Lock size={14} /> Exam Mode Active
                    </div>
                  )}
                  {session?.restrict_internet && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      color: '#fbbf24',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <WifiOff size={14} /> No Internet
                    </div>
                  )}
                  {session?.restrict_copy_paste && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      color: '#fbbf24',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Copy size={14} /> No Copy/Paste
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={{
            height: '1px',
            background: '#1e293b',
            margin: '20px 0'
          }} />

          {/* 3. SESSION STATS */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              margin: '0 0 12px'
            }}>
              Session Stats
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Joined', value: `${summary.total_joined||0} / ${session?.max_participants||50}`, color: '#6366f1' },
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
                  border: '1px solid #1e293b'
                }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>{s.label}</span>
                  <span style={{ color: s.color, fontSize: '16px', fontWeight: 600 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. GUACAMOLE */}
          <div style={{
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.15)'
          }}>
            <p style={{
              color: '#a5b4fc',
              fontSize: '13px',
              fontWeight: 600,
              margin: '0 0 6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              🖥️ Screen Monitoring
            </p>
            <p style={{
              color: '#475569',
              fontSize: '12px',
              lineHeight: 1.5,
              margin: 0
            }}>
              Live screen viewing and 
              recording will be available 
              once Guacamole is connected 
              to your Proxmox server.
            </p>
          </div>
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
                disabled={ending}
                style={{
                  flex: 1, padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171',
                  fontWeight: 600,
                  cursor: ending ? 'not-allowed' : 'pointer',
                  opacity: ending ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                {ending ? (
                  <>
                    <div style={{
                      width: '14px', height: '14px',
                      border: '2px solid rgba(248,113,113,0.3)',
                      borderTopColor: '#f87171',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Ending...
                  </>
                ) : (
                  'End Session'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
