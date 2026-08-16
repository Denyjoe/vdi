import React, { useState, useEffect, useRef } from 'react';
import { Shield, Eye, Power, AlertTriangle, Search, Activity, RefreshCw, X, Radio, Monitor as Desktop } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import useConfirm from '../../hooks/useConfirm';

function AdminLiveSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const { user } = useAuthStore();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  
  // Modals state
  const [monitorSession, setMonitorSession] = useState(null);
  const [monitorData, setMonitorData] = useState(null);
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  
  const [viewScreenParticipant, setViewScreenParticipant] = useState(null);
  
  const [messageParticipant, setMessageParticipant] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  /**
   * Fetches live sessions from the admin endpoint.
   * @param {boolean} [isManual=false] - If true, shows the visual refresh
   *   indicator and a success toast. Background polls pass false (default)
   *   so data updates silently without UI flicker.
   */
  const fetchSessions = async (isManual = false) => {
    try {
      if (isManual) {
        setRefreshing(true);
        // slight artificial delay to make the refresh visually apparent
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      const res = await api.get('/sessions/admin/live/');
      setSessions(res.data.sessions || []);
      setTotalParticipants(res.data.total_participants || 0);
      if (isManual) {
        toast.success('Sessions refreshed');
      }
    } catch(e) {
      console.error(e);
      if (isManual) toast.error('Failed to load sessions');
    } finally {
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!monitorSession) return;
    
    const fetchMonitorData = async () => {
      try {
        const res = await api.get(`/sessions/admin/${monitorSession.id}/monitor/`);
        setMonitorData(res.data);
        setRecordingEnabled(!!res.data?.session?.restrictions?.session_recording);
      } catch(e) {
        console.error(e);
      }
    };
    
    fetchMonitorData();
    const interval = setInterval(fetchMonitorData, 5000);
    return () => clearInterval(interval);
  }, [monitorSession]);

  const handleForceEnd = async (sessionId) => {
    const ok = await confirm(
      'Force End Session',
      'Are you sure you want to FORCE END this session? All participants will be immediately disconnected and their VMs stopped.',
      true
    );
    if (!ok) return;

    try {
      await api.post(`/sessions/admin/${sessionId}/force-end/`);
      toast.success('Session force ended');
      fetchSessions();
    } catch(e) {
      toast.error('Failed to end session');
    }
  };

  const handleDisconnect = async (participantId) => {
    const ok = await confirm('Force Disconnect', 'Force disconnect this participant? Their VM will be released.', true);
    if (!ok) return;

    try {
      await api.post(`/sessions/admin/${monitorSession.id}/disconnect-participant/`, {
        participant_id: participantId
      });
      toast.success('Participant disconnected');
      // Refresh modal
      const res = await api.get(`/sessions/admin/${monitorSession.id}/monitor/`);
      setMonitorData(res.data);
    } catch(e) {
      toast.error('Failed to disconnect');
    }
  };

  const handleToggleRecording = async () => {
    const newState = !recordingEnabled;
    setRecordingEnabled(newState);
    try {
      await api.put(`/sessions/admin/${monitorSession.id}/recording/`, {
        enabled: newState
      });
      toast.success(newState ? 'Recording force-enabled' : 'Recording disabled');
    } catch(e) {
      toast.error('Failed to update recording');
      setRecordingEnabled(!newState); // revert
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      setSendingMessage(true);
      await api.post(`/sessions/admin/message/`, {
        user_id: messageParticipant.user_id || messageParticipant.id, // Fallback depending on data structure
        message: messageText.trim()
      });
      toast.success('Message sent to participant');
      setMessageParticipant(null);
      setMessageText('');
    } catch(e) {
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const statCardStyle = {
    background: 'var(--bg-card)',
    padding: '20px',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  };

  const statValueStyle = {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: '1.2'
  };

  const statLabelStyle = {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '4px'
  };

  const primaryButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '10px',
    background: 'var(--accent-primary)',
    color: '#ffffff',
    border: 'none',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '20px',
      }}>
        <div>
          <h1 style={{
            color: 'var(--text-primary)',
            fontSize: '24px',
            fontWeight: 700,
          }}>Live Sessions Monitor</h1>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '13px',
            marginTop: '4px',
          }}>
            Real-time view of all active sessions across the platform
          </p>
        </div>
        <button onClick={() => fetchSessions(true)} disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: refreshing ? 0.7 : 1
          }}>
          <RefreshCw size={14} 
            style={{
              animation: refreshing ? 'spin 1s linear infinite' : 'none'
            }} />
          Refresh
        </button>
      </div>
      
      {/* Summary stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={statCardStyle}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <div style={{
              width: '10px', height: '10px',
              borderRadius: '50%',
              background: 'var(--status-online)',
              animation: sessions.length > 0 ? 'pulse 2s infinite' : 'none',
            }} />
            <div>
              <p style={statValueStyle}>{sessions.length}</p>
              <p style={statLabelStyle}>Active Sessions</p>
            </div>
          </div>
        </div>
        <div style={statCardStyle}>
          <p style={statValueStyle}>{totalParticipants}</p>
          <p style={statLabelStyle}>Total Participants</p>
        </div>
        <div style={statCardStyle}>
          <p style={statValueStyle}>
            {new Set(sessions.map(s => s.host_email)).size}
          </p>
          <p style={statLabelStyle}>Active Hosts</p>
        </div>
      </div>

      {sessions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {sessions.map(s => (
            <div key={s.id} style={{
              position: 'relative',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              {/* LED strip border */}
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '16px',
                padding: '1px',
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '16px',
                  opacity: theme === 'light' ? 0.35 : 0.6,
                  filter: theme === 'light' ? 'blur(2px)' : 'blur(1px)',
                  background: 'linear-gradient(90deg, var(--status-online), var(--status-info), var(--accent-purple), var(--status-warning), var(--status-online))',
                  backgroundSize: '300% 100%',
                  animation: 'ledFlow 4s linear infinite',
                }} />
              </div>
              
              <div style={{
                position: 'relative',
                background: 'var(--bg-card)',
                borderRadius: '16px',
                margin: '1px',
                padding: '20px',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <div style={{
                      width: '36px', height: '36px',
                      borderRadius: '10px',
                      background: 'var(--status-online-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Radio size={16} style={{ color: 'var(--status-online)' }} />
                    </div>
                    <div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <h3 style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}>{s.name}</h3>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '9px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: 'var(--status-online-bg)',
                          color: 'var(--status-online)',
                        }}>
                          Live
                        </span>
                        {s.network_locked && (
                          <span title={s.allowed_domains?.length ? `Whitelisted: ${s.allowed_domains.join(', ')}` : 'No domains whitelisted'}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '9px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: 'var(--status-warning-bg)',
                              color: 'var(--status-warning)',
                            }}>
                            <Shield size={9} />
                            Locked
                          </span>
                        )}
                      </div>
                      <p style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                      }}>
                        Hosted by {s.host_name} · {s.participant_count}/{s.max_participants || '\u221E'} participants
                      </p>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-input)',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: 'var(--text-secondary)',
                    }}>
                      {s.invite_code}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={() => setMonitorSession(s)} style={primaryButtonStyle}>
                    <Eye size={14} />
                    Monitor
                  </button>
                  <button onClick={() => handleForceEnd(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      background: 'var(--status-error-bg)',
                      color: 'var(--status-error)',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}>
                    <Power size={14} />
                    Force End
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
        }}>
          <Radio size={32} style={{ color: 'var(--text-faint)', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>No active sessions right now</p>
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '4px' }}>
            Live sessions will appear here as hosts start them
          </p>
        </div>
      )}

      {/* MONITOR MODAL */}
      {monitorSession && (
        <div style={{
          position: 'fixed', inset: 0,
          zIndex: 60,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }} onClick={(e) => {
          if (e.target === e.currentTarget) setMonitorSession(null);
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            width: '900px',
            maxWidth: '92vw',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-xl)',
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {monitorData?.session?.name || 'Loading...'}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Hosted by {monitorData?.session?.host_name} · Code: {monitorData?.session?.invite_code}
                </p>
              </div>
              <button onClick={() => setMonitorSession(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{
              padding: '12px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-input)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Force Session Recording
              </span>
              <button onClick={handleToggleRecording}
                style={{
                  width: '36px', height: '20px',
                  borderRadius: '10px',
                  background: recordingEnabled ? 'var(--accent-primary)' : 'var(--border-strong)',
                  position: 'relative',
                  border: 'none',
                  cursor: 'pointer'
                }}>
                <div style={{
                  width: '16px', height: '16px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  position: 'absolute',
                  top: '2px',
                  left: recordingEnabled ? '18px' : '2px',
                  transition: 'all 0.2s',
                }} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {monitorData?.participants?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {monitorData.participants.map(p => (
                    <div key={p.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px',
                          borderRadius: '50%',
                          background: 'var(--accent-primary-tint)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--accent-primary)',
                        }}>
                          {p.user_name?.[0] || '?'}
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {p.user_name}
                          </p>
                          <p style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                            {p.ip_address || 'No IP'} · {p.vm_status}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {p.guacamole_url && (
                          <button onClick={() => setViewScreenParticipant(p)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: 'var(--accent-primary-soft)',
                              color: 'var(--accent-primary)',
                              border: 'none',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}>
                            View Screen
                          </button>
                        )}
                        <button onClick={() => setMessageParticipant({ id: p.user_id || p.user_email, name: p.user_name })} // Note: I need the actual user ID. The backend returns only `id` which is participant.id
                          // Let's modify the backend to return user_id
                          // Actually, wait, backend didn't return user_id for participants. Let's send a quick POST to backend with participant ID if needed, or I will fix the backend to return user_id. Let me use user_email for now. Wait, I'll fix the backend.
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-card)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}>
                          Message
                        </button>
                        <button onClick={() => handleDisconnect(p.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'var(--status-error-bg)',
                            color: 'var(--status-error)',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}>
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No participants yet
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW SCREEN SUB-MODAL */}
      {viewScreenParticipant && (
        <div style={{
          position: 'fixed', inset: 0,
          zIndex: 70,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '90vw', height: '85vh',
            background: '#000',
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '12px 20px',
              background: 'var(--bg-card)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Viewing: {viewScreenParticipant.user_name}'s screen
              </span>
              <button onClick={() => setViewScreenParticipant(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}>
                <X size={18} />
              </button>
            </div>
            <iframe
              src={viewScreenParticipant.guacamole_url}
              style={{ flex: 1, border: 'none', width: '100%', background: '#000' }}
              title="Live participant screen"
            />
          </div>
        </div>
      )}

      {/* MESSAGE MODAL */}
      {messageParticipant && (
        <div style={{
          position: 'fixed', inset: 0,
          zIndex: 80,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: '400px',
            padding: '20px',
            boxShadow: 'var(--shadow-xl)',
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Send Message
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              To: {messageParticipant.name}
            </p>
            <textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="Type your message here..."
              style={{
                width: '100%',
                height: '100px',
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                resize: 'none',
                marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setMessageParticipant(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                Cancel
              </button>
              <button onClick={handleSendMessage} disabled={sendingMessage || !messageText.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: (sendingMessage || !messageText.trim()) ? 0.6 : 1
                }}>
                {sendingMessage ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal style block for keyframes if needed globally or locally */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes ledFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}

export default AdminLiveSessionsPage;
