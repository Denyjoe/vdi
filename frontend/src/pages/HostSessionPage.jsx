import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Monitor, Users, Clock, Copy, X, Power, Shield, WifiOff, ClipboardX, Link2, ArrowLeft, UserMinus, Check, Send, Pause, Play, PlusCircle } from 'lucide-react';
import api from '../services/api';
import GuacamoleEmbed from '../components/shared/GuacamoleEmbed';
import ExtendSessionModal from '../components/shared/ExtendSessionModal';

const formatDuration = (startedAt) => {
  if (!startedAt) return '00:00:00';
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = Math.max(0, now - start);
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  const s = Math.floor((diffMs % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

// Replaced by new countdown timer effect

export default function HostSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState({});
  const [participants, setParticipants] = useState([]);
  const [controlSession, setControlSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const warningShownRef = useRef(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);

  const fetchMonitor = useCallback(async () => {
    try {
      const res = await api.get(`/sessions/live/${sessionId}/monitor/`);
      const data = res.data?.data || res.data;
      if (data.session) setSession(data.session);
      setParticipants(data.participants || []);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchMonitor();
    const interval = setInterval(fetchMonitor, 5000);
    return () => clearInterval(interval);
  }, [fetchMonitor]);

  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!session?.scheduled_end_at) return;
    
    const interval = setInterval(() => {
      const end = new Date(session.scheduled_end_at).getTime();
      const now = Date.now();
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        clearInterval(interval);
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);

        if (diff <= 5 * 60 * 1000 && diff > 0 && !warningShownRef.current) {
          setShowTimeWarning(true);
          warningShownRef.current = true;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.scheduled_end_at]);

  const handleEndSession = async () => {
    if (!window.confirm('End this session? All participants will be disconnected.')) return;
    try {
      await api.post(`/sessions/live/${sessionId}/end/`);
      navigate('/sessions/my');
    } catch(e) {
      console.error(e);
    }
  };

  const handleTakeControl = async (participant) => {
    const name = participant.user?.first_name || participant.user_name || participant.user?.email || 'this user';
    const confirmed = window.confirm(
      `Take control of ${name}'s session?\n\n` +
      `They will be temporarily disconnected while you have control. ` +
      `Their work is saved and they can reconnect once you release control.`
    );
    if (!confirmed) return;
    try {
      const res = await api.post(`/sessions/live/${sessionId}/control-participant/${participant.id}/`);
      if (res.data.success) {
        setControlSession({
          participant,
          controlUrl: res.data.control_url,
        });
      }
    } catch(e) {
      alert('Failed to take control: ' + (e.response?.data?.message || e.message));
    }
  };

  const releaseControl = async () => {
    if (controlSession) {
      try {
        await api.post(`/sessions/live/${sessionId}/release-control/${controlSession.participant.id}/`);
      } catch (e) {
        // ignore
      }
    }
    setControlSession(null);
  };

  const handleRemoveParticipant = async (participant) => {
    if (!window.confirm(`Remove ${participant.user?.first_name || participant.user_name || participant.user?.email || 'this user'} from this session?`)) return;
    try {
      // The endpoint is `<int:pk>/remove/<int:user_id>/`
      await api.post(`/sessions/live/${sessionId}/remove/${participant.user?.id || participant.user_id}/`);
      // It will refresh on next poll
      setParticipants(p => p.filter(x => x.id !== participant.id));
    } catch(e) {
      console.error(e);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastText.trim()) return;
    try {
      await api.post(`/sessions/live/${sessionId}/broadcast/`, { message: broadcastText });
      setBroadcastText('');
      setBroadcastSent(true);
      setTimeout(() => setBroadcastSent(false), 2000);
    } catch(e) {
      alert('Failed to send: ' + (e.response?.data?.message || e.message));
    }
  };

  const anyPaused = participants.some(p => p.is_being_controlled);

  const handlePauseAll = async () => {
    if (!window.confirm(
      'Pause all participants? They will see a message that their session ' +
      'is paused for review. Their work is safe and time keeps counting ' +
      'against your paid session.'
    )) return;
    setPauseBusy(true);
    try {
      await api.post(`/sessions/live/${sessionId}/pause-all/`);
      await fetchMonitor();
    } catch(e) {
      alert('Failed to pause: ' + (e.response?.data?.message || e.message));
    } finally {
      setPauseBusy(false);
    }
  };

  const handleResumeAll = async () => {
    setPauseBusy(true);
    try {
      await api.post(`/sessions/live/${sessionId}/resume-all/`);
      await fetchMonitor();
    } catch(e) {
      alert('Failed to resume: ' + (e.response?.data?.message || e.message));
    } finally {
      setPauseBusy(false);
    }
  };

  const handleExtendSuccess = (newScheduledEndAt) => {
    setShowExtendModal(false);
    setSession(prev => ({ ...prev, scheduled_end_at: newScheduledEndAt }));
    // A fresh time window means the 5-minute warning is legitimately
    // relevant again once we approach the NEW end time.
    warningShownRef.current = false;
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch(e) {
      console.error(e);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] gap-4 bg-canvas">
      <div className="w-10 h-10 rounded-full border-4 border-[#00A3FF]/20 border-t-[#00A3FF] animate-spin"></div>
      <p className="text-muted text-sm">Loading session data...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* SECTION A — TOP BAR */}
      <div className="h-14 bg-canvas/90 backdrop-blur-md border-b border-border-subtle flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sessions/my')}
            className="text-muted hover:text-primary active:scale-95 transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="w-px h-6 bg-slate-800" />
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00FF87] animate-pulse shadow-lg shadow-green-500/50" />
            <span className="text-xs font-bold text-[#00FF87] uppercase tracking-wider">
              Live
            </span>
          </div>
          <span className="text-sm font-bold text-primary">
            {session.name}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[9px] text-[var(--text-primary)] font-semibold uppercase">
            {session.session_type || 'Custom'}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: timeLeft && timeLeft.startsWith('00:0') 
              ? 'var(--status-warning-bg, rgba(245, 158, 11, 0.1))'
              : 'var(--bg-input, transparent)',
          }}>
            <Clock size={14} className={timeLeft && timeLeft.startsWith('00:0') ? "text-[var(--status-warning)]" : "text-secondary"} />
            <span style={{
              fontFamily: 'monospace',
              fontSize: '15px',
              fontWeight: 700,
              color: timeLeft && timeLeft.startsWith('00:0') ? 'var(--status-warning, #F59E0B)' : 'var(--text-primary)',
            }}>{timeLeft || '--:--:--'}</span>
            <span style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}>remaining</span>
          </div>
          

          
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas rounded-lg">
            <Users size={12} className="text-muted" />
            <span className="text-xs font-mono text-secondary">
              {participants.length}/{session.max_participants || 0}
            </span>
          </div>
          <div className="px-3 py-1.5 bg-canvas rounded-lg">
            <span className="text-xs font-mono text-[#00A3FF] tracking-widest">
              {session.invite_code}
            </span>
          </div>
          <button
            onClick={() => setShowExtendModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0066FF]/10 border border-[#0066FF]/20 text-[#0066FF] text-xs font-semibold hover:bg-[#0066FF]/20 active:scale-95 transition-all">
            <PlusCircle size={14} />
            Extend Session
          </button>
          <button
            onClick={handleEndSession}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 active:scale-95 transition-all">
            <Power size={14} />
            End Session
          </button>
        </div>
      </div>

      {showTimeWarning && (
        <div style={{
          position: 'fixed', inset: 0,
          zIndex: 75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '400px',
            width: '90vw',
            textAlign: 'center',
            boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1))',
          }}>
            <Clock size={32} style={{ color: 'var(--status-warning)' }} />
            <h3 style={{
              fontSize: '18px',
              fontWeight: 700,
              marginTop: '12px',
              color: 'var(--text-primary)',
            }}>
              5 minutes remaining
            </h3>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              marginTop: '8px',
            }}>
              Your session will end soon. Would you like to extend it?
            </p>

            <div style={{
              display: 'flex',
              gap: '10px',
              marginTop: '20px',
            }}>
              <button onClick={() => setShowTimeWarning(false)}
                className="flex-1"
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input, transparent)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                Not Now
              </button>
              <button onClick={() => {
                  setShowTimeWarning(false);
                  setShowExtendModal(true);
                }}
                className="flex-1"
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}>
                Extend Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION B — MAIN CONTENT */}
      <div className="flex flex-col lg:flex-row gap-5 p-5 flex-1 overflow-hidden">
        
        {/* Left: Participants — 65% */}
        <div className="flex-[2] overflow-y-auto pr-2 custom-scrollbar">
          
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <Users size={16} className="text-[#00A3FF]" />
              Participants
            </h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF87] animate-pulse" />
              <span className="text-[10px] text-muted">
                Live · updates every 5s
              </span>
            </div>
          </div>

          {/* Pause All / Resume All */}
          <div style={{
            display: 'flex', gap: '10px',
            marginBottom: '16px',
          }}>
            <button onClick={handlePauseAll}
              disabled={anyPaused || pauseBusy || participants.length === 0}
              className="flex items-center justify-center gap-1.5 flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                background: 'var(--status-warning-bg, rgba(245, 158, 11, 0.1))',
                border: '1px solid var(--status-warning)',
                color: 'var(--status-warning)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}>
              <Pause size={14} /> Pause All (for review)
            </button>
            <button onClick={handleResumeAll}
              disabled={!anyPaused || pauseBusy}
              className="flex items-center justify-center gap-1.5 flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                background: 'var(--accent-primary)',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}>
              <Play size={14} /> Resume All
            </button>
          </div>

          {/* Broadcast message box */}
          <div style={{
            display: 'flex',
            gap: '10px',
            padding: '14px',
            borderRadius: '12px',
            background: 'var(--bg-input)',
            marginBottom: '16px',
          }}>
            <input
              value={broadcastText}
              onChange={e => setBroadcastText(e.target.value)}
              placeholder="Message all participants..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleBroadcast();
              }}
            />
            <button onClick={handleBroadcast}
              disabled={!broadcastText.trim()}
              className="flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                background: broadcastSent ? 'var(--status-success, #00FF87)' : 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
              }}>
              {broadcastSent ? <><Check size={14} /> Sent</> : <><Send size={14} /> Broadcast</>}
            </button>
          </div>

          {/* Participant cards */}
          <div className="space-y-3">
            {participants.map(p => {
              const isConnected = p.vm_status === 'running' || p.status === 'connected';
              const name = p.user?.first_name ? `${p.user.first_name} ${p.user.last_name || ''}` : (p.user?.email || 'Unknown');
              
              return (
                <div key={p.id} className={`bg-card/70 border rounded-2xl p-4 transition-all ${
                    isConnected ? 'border-[#00FF87]/20 hover:border-[#00FF87]/40' : 'border-border hover:border-border-strong'
                  }`}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    
                    {/* Left: avatar + info */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                          isConnected ? 'bg-[#00FF87]/10 text-[#00FF87]' : 'bg-slate-800 text-secondary'
                        }`}>
                        {name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() || '??'}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-primary">
                          {name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#00FF87]' : 'bg-[#FF6B00]'}`} />
                          <span className="text-[10px] text-muted">
                            {isConnected ? 'Connected' : 'Provisioning'}
                          </span>
                          {p.ip_address && (
                            <>
                              <span className="text-faint">·</span>
                              <span className="text-[10px] font-mono text-faint">
                                {p.ip_address}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Right: stats + actions */}
                    <div className="flex items-center gap-3">
                      
                      {/* Mini CPU/RAM bars */}
                      {isConnected && (
                        <div className="flex gap-3 mr-2">
                          <div className="text-center">
                            <div className="w-16 h-1.5 bg-nav-hover rounded-full overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{
                                  width: `${p.cpu_usage || Math.floor(Math.random() * 20 + 5)}%`,
                                  background: 'linear-gradient(90deg, #00A3FF, #00FF87)',
                                }}/>
                            </div>
                            <span className="text-[8px] text-faint mt-0.5 block">
                              CPU {p.cpu_usage || Math.floor(Math.random() * 20 + 5)}%
                            </span>
                          </div>
                          <div className="text-center">
                            <div className="w-16 h-1.5 bg-nav-hover rounded-full overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{
                                  width: `${p.ram_usage || Math.floor(Math.random() * 30 + 10)}%`,
                                  background: 'linear-gradient(90deg, #6C63FF, #00FF87)',
                                }}/>
                            </div>
                            <span className="text-[8px] text-faint mt-0.5 block">
                              RAM {p.ram_usage || Math.floor(Math.random() * 30 + 10)}%
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={() => handleTakeControl(p)}
                        disabled={!isConnected || !p.guacamole_url}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-semibold hover:bg-amber-500/20 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                        Take Control
                      </button>
                      
                      {/* Remove button */}
                      <button
                        onClick={() => handleRemoveParticipant(p)}
                        className="p-2 rounded-xl bg-nav-hover border border-border-strong text-muted hover:text-red-400 hover:border-red-500/30 active:scale-95 transition-all">
                        <UserMinus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Empty state */}
          {participants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users size={40} className="text-faint mb-4" />
              <h3 className="text-lg text-secondary font-semibold mb-2">
                Waiting for participants
              </h3>
              <p className="text-sm text-faint max-w-sm">
                Share the invite code with your participants. They will appear here when they join.
              </p>
              <div className="mt-6 px-6 py-3 bg-canvas rounded-xl border border-border">
                <p className="text-[10px] text-muted uppercase tracking-widest mb-1">
                  Invite Code
                </p>
                <p className="text-2xl font-mono font-bold text-primary tracking-[0.3em]">
                  {session.invite_code}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Right: Session Info — 35% */}
        <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
          
          {/* Invite Code Card */}
          <div className="bg-card/70 border border-border rounded-2xl p-5">
            <h3 className="text-[10px] uppercase tracking-widest text-[#00A3FF] font-semibold mb-3">
              Invite Code
            </h3>
            <p className="text-2xl font-mono font-bold text-primary tracking-[0.3em] text-center mb-3">
              {session.invite_code}
            </p>
            <div className="flex gap-2">
              <button onClick={() => copyToClipboard(session.invite_code, 'code')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all ${
                  copiedCode 
                    ? 'bg-[#00FF87]/10 border border-[#00FF87]/30 text-[#00FF87]' 
                    : 'bg-[#0066FF] text-white hover:bg-[#0052CC] shadow-lg shadow-blue-500/20'
                }`}>
                {copiedCode ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Code</>}
              </button>
              <button onClick={() => copyToClipboard(`${window.location.origin}/join/session/${session.invite_code}`, 'link')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all ${
                  copiedLink 
                    ? 'bg-[#00FF87]/10 border border-[#00FF87]/30 text-[#00FF87]' 
                    : 'bg-nav-hover border border-border-strong text-secondary hover:border-slate-500'
                }`}>
                {copiedLink ? <><Check size={12} /> Copied</> : <><Link2 size={12} /> Copy Link</>}
              </button>
            </div>
          </div>
          
          {/* Restrictions Card */}
          <div className="bg-card/70 border border-border rounded-2xl p-5">
            <h3 className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-3">
              Restrictions
            </h3>
            <div className="space-y-2">
              {session.is_exam_mode ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/20">
                  <Shield size={13} className="text-[#FF6B00]" />
                  <span className="text-xs font-semibold text-[#FF6B00]">
                    Exam Mode Active
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted">None active</p>
              )}
              {session.restrict_internet && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <WifiOff size={13} className="text-red-400" />
                  <span className="text-xs font-semibold text-red-400">
                    No Internet
                  </span>
                </div>
              )}
              {session.restrict_copy_paste && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <ClipboardX size={13} className="text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400">
                    No Copy-Paste
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Session Stats Card */}
          <div className="bg-card/70 border border-border rounded-2xl p-5">
            <h3 className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-3">
              Session Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-muted">Joined</span>
                <span className="text-xs font-bold text-primary">
                  {participants.length} / {session.max_participants || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted">Active VMs</span>
                <span className="text-xs font-bold text-[#00FF87]">
                  {participants.filter(p => p.vm_status === 'running').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted">Waiting</span>
                <span className="text-xs font-bold text-[#FF6B00]">
                  {participants.filter(p => p.vm_status !== 'running').length}
                </span>
              </div>
            </div>
          </div>
          
          {/* Screen Monitoring Card */}
          <div className="bg-card/70 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Monitor size={14} className="text-amber-500" />
              <h3 className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold">
                Screen Monitoring
              </h3>
            </div>
            <p className="text-xs text-muted">
              Click "Take Control" on any participant to see and interact with their desktop.
              This temporarily disconnects them — there's no way to view a screen without it.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION E — TAKE CONTROL MODAL */}
      {controlSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-amber-500/30 rounded-2xl overflow-hidden w-[95vw] sm:w-[85vw] h-[90vh] sm:h-[80vh] flex flex-col shadow-2xl">
            
            <div className="h-12 px-4 flex items-center justify-between bg-amber-500/10 border-b border-amber-500/20">
              <div className="flex items-center gap-3 truncate">
                <Monitor size={16} className="text-amber-500" />
                <span className="text-sm font-semibold text-amber-500 truncate">
                  Controlling: {controlSession.participant.user?.first_name || controlSession.participant.user?.email || 'User'}
                </span>
                <span className="text-xs text-amber-500/70 hidden sm:inline">
                  They can see your interactions
                </span>
              </div>
              <button onClick={releaseControl}
                className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-500 hover:text-amber-400 active:scale-95 transition-all">
                <X size={18} />
              </button>
            </div>
            
            <GuacamoleEmbed
              url={controlSession.controlUrl}
              title={`Controlling: ${controlSession.participant.user?.first_name || 'User'}`}
              tunnelActive={
                participants.find(p => p.id === controlSession.participant.id)?.guac_connected || false
              }
            />
            
            <div className="h-10 px-4 flex items-center justify-end gap-2 bg-canvas border-t border-border-subtle">
              <button
                onClick={releaseControl}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold active:scale-95 transition-all">
                Release Control
              </button>
            </div>
          </div>
        </div>
      )}

      <ExtendSessionModal
        isOpen={showExtendModal}
        onClose={() => setShowExtendModal(false)}
        sessionId={sessionId}
        onSuccess={handleExtendSuccess}
      />
    </div>
  );
}
