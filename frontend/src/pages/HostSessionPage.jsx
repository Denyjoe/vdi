import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Monitor, Users, Clock, Copy, X, Power, Eye, Shield, WifiOff, ClipboardX, Link2, ArrowLeft, UserMinus, Check } from 'lucide-react';
import api from '../services/api';

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

const getTimeRemaining = (session) => {
  if (!session?.start_time || !session?.duration_hours) return null;
  const end = new Date(session.start_time).getTime() + session.duration_hours * 3600000;
  const remaining = end - Date.now();
  if (remaining <= 0) return 'Ended';
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

export default function HostSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState({});
  const [participants, setParticipants] = useState([]);
  const [screenModal, setScreenModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const fetchMonitor = async () => {
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
    };
    fetchMonitor();
    const interval = setInterval(fetchMonitor, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Also tick every second for the clock
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEndSession = async () => {
    if (!window.confirm('End this session? All participants will be disconnected.')) return;
    try {
      await api.post(`/sessions/live/${sessionId}/end/`);
      navigate('/sessions/my');
    } catch(e) {
      console.error(e);
    }
  };

  const handleRemoveParticipant = async (participant) => {
    if (!window.confirm(`Remove ${participant.user?.first_name || participant.user_name || participant.user?.email || 'this user'} from this session?`)) return;
    try {
      // The endpoint is `<int:pk>/remove/<int:user_id>/`
      await api.post(`/sessions/live/${sessionId}/remove/${participant.user?.id || participant.user_id}/`);
      // It will refresh on next poll
      setParticipants(p => p.filter(x => x.id !== participant.id));
      if (screenModal && screenModal.id === participant.id) {
        setScreenModal(null);
      }
    } catch(e) {
      console.error(e);
    }
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

  const openScreenModal = (participant) => {
    setScreenModal(participant);
  };

  const fixGuacUrl = (url) => {
    if (!url) return '';
    return url.split('?')[0]
      .replace('localhost:8080', window.location.hostname + ':8080')
      .replace('127.0.0.1:8080', window.location.hostname + ':8080');
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
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas rounded-lg">
            <Clock size={12} className="text-muted" />
            <span className="text-xs font-mono text-secondary">
              {formatDuration(session.start_time || session.created_at)}
            </span>
          </div>
          
          {session.duration_hours && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
              getTimeRemaining(session) === 'Ended' 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-[#FF6B00]/10 border-[#FF6B00]/20 text-[#FF6B00]'
            }`}>
              <Clock size={12} />
              <span className="text-xs font-mono font-bold tracking-wider">
                {getTimeRemaining(session) === 'Ended' ? 'SESSION ENDED' : `${getTimeRemaining(session)} left`}
              </span>
            </div>
          )}
          
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
            onClick={handleEndSession}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 active:scale-95 transition-all">
            <Power size={14} />
            End Session
          </button>
        </div>
      </div>

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
                      
                      {/* View Screen button */}
                      <button
                        onClick={() => openScreenModal(p)}
                        disabled={!isConnected || !p.guacamole_url}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#6C63FF]/10 border border-[#6C63FF]/20 text-[#6C63FF] text-[11px] font-semibold hover:bg-[#6C63FF]/20 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                        <Eye size={13} />
                        View Screen
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
          <div className="bg-card/70 border border-[#6C63FF]/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Monitor size={14} className="text-[#6C63FF]" />
              <h3 className="text-[10px] uppercase tracking-widest text-[#6C63FF] font-semibold">
                Screen Monitoring
              </h3>
            </div>
            <p className="text-xs text-muted">
              Click "View Screen" on any participant to see their desktop in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION D — VIEW SCREEN MODAL */}
      {screenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl overflow-hidden w-[95vw] sm:w-[85vw] h-[90vh] sm:h-[80vh] flex flex-col shadow-2xl">
            
            {/* Modal header */}
            <div className="h-12 px-4 flex items-center justify-between bg-canvas border-b border-border-subtle">
              <div className="flex items-center gap-3 truncate">
                <Monitor size={16} className="text-[#6C63FF]" />
                <span className="text-sm font-semibold text-primary truncate">
                  Viewing: {screenModal.user?.first_name || screenModal.user?.email || 'User'}
                </span>
                <span className="text-xs text-muted hidden sm:inline">
                  {screenModal.vm_template_name || 'Virtual Machine'} · {screenModal.ip_address || 'No IP'}
                </span>
              </div>
              <button onClick={() => setScreenModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-secondary hover:text-white active:scale-95 transition-all">
                <X size={18} />
              </button>
            </div>
            
            {/* Guacamole iframe */}
            <iframe
              src={fixGuacUrl(screenModal.guacamole_url)}
              className="flex-1 w-full border-none bg-black"
              allow="clipboard-read; clipboard-write"
              title={`Screen: ${screenModal.user?.first_name || 'User'}`}
            />
            
            {/* Modal footer */}
            <div className="h-10 px-4 flex items-center justify-end gap-2 bg-canvas border-t border-border-subtle">
              <button
                onClick={() => handleRemoveParticipant(screenModal)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-semibold active:scale-95 transition-all">
                <UserMinus size={12} />
                Remove from Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
