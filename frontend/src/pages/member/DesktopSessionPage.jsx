import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Monitor, Maximize2, Minimize2, LayoutGrid, Compass, BarChart2, AlertCircle,
  Code2, Palette, Network, Box, Wifi, Battery, Volume2, Clock, Megaphone,
  Menu, X, Check, PanelRightOpen, PanelRightClose, Power, UserCheck, RefreshCw
} from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import ConfirmModal from '../../components/shared/ConfirmModal';
import Toast from '../../components/shared/Toast';
import GuacamoleEmbed from '../../components/shared/GuacamoleEmbed';

export default function DesktopSessionPage() {
  const { id: sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const searchParams = new URLSearchParams(location.search);
  const type = location.pathname.includes('/workspace/') ? 'workspace' : searchParams.get('type');

  const [workspace, setWorkspace] = useState(null);
  const [wsLoading, setWsLoading] = useState(type === 'workspace');

  const [sessionData, setSessionData] = useState(location.state?.sessionData || null);
  const [vmData, setVmData] = useState(location.state?.vmData || null);
  
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [timer, setTimer] = useState(0);
  const [cpu, setCpu] = useState(5.0);
  const [ram, setRam] = useState(25.0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (type === 'workspace') return;
    
    // If we don't have session data in state (e.g., page refresh), fetch it
    if (!sessionData) {
      sessionService.getLiveSession(sessionId).then(res => {
        if (res.data.success && res.data.data && String(res.data.data.id) === String(sessionId)) {
          // It's active
          const sData = res.data.data;
          const myParticipant = sData.participants?.find(p => p.user?.id === user?.id);
          
          if (!myParticipant && user?.id !== sData.host) {
             navigate('/workspaces');
             return;
          }
          
          setSessionData({
            session_id: sData.id,
            session_token: "retrieved-token",
            vm_name: myParticipant?.vm?.name || 'Virtual Machine',
            template_name: myParticipant?.vm?.template_name || '',
            os: myParticipant?.vm?.os || 'windows',
            resolution: "1920x1080",
            connected_at: sData.start_time || new Date().toISOString(),
            guacamole_url: myParticipant?.guacamole_url,
            vm_status: myParticipant?.vm_status,
            session_scheduled_end_at: sData.scheduled_end_at,
            restrictions: { internet: true, copy_paste: true }
          });
        } else {
          // Missing or not active
          navigate('/workspaces');
        }
      }).catch(() => navigate('/workspaces'));
    }
  }, [sessionData, sessionId, navigate, type, user]);

  const lastKnownStatus = useRef(null);
  const [disconnectedByAdmin, setDisconnectedByAdmin] = useState(false);
  // Separate state for the host-takeover scenario so we show the right message
  const [takenOverByHost, setTakenOverByHost] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [broadcastToast, setBroadcastToast] = useState(null);
  const lastSeenNotifId = useRef(null);
  const broadcastToastTimeoutRef = useRef(null);
  // Guacamole URLs are stable strings when the token hasn't rotated, so
  // just reassigning guacamole_url after a takeover often won't change the
  // iframe's src at all — the browser has no reason to reload it. This
  // counter is bumped on every genuine reconnect so the key on
  // GuacamoleEmbed changes, forcing React to remount the iframe instead of
  // silently leaving Guacamole's own "disconnected" page in place.
  const [reconnectGeneration, setReconnectGeneration] = useState(0);

  // Consolidated Polling Loop
  useEffect(() => {
    let intervalId;
    let hardTimeoutId;

    // For workspaces during provisioning, we poll faster.
    const pollInterval = (type === 'workspace' && wsLoading) ? 3000 : 8000;

    const poll = async () => {
      try {
        if (type === 'workspace') {
          const res = await api.get(`/workspaces/${sessionId}/`);
          const wsData = res.data.data || res.data;
          const status = wsData.vm_details?.status || wsData.status;
          
          if (status === 'error' || status === 'stopped' || status === 'deleted') {
             setDisconnectedByAdmin(true);
             if (wsLoading) setWsLoading(false);
          } else if (status === 'running' || wsData.status === 'active') {
             const url = wsData.vm_details?.guacamole_url;
             if (url && status !== lastKnownStatus.current) {
               lastKnownStatus.current = status;
               setWorkspace(prev => ({
                 ...prev,
                 ...wsData,
                 vm_details: {
                   ...(prev?.vm_details || {}),
                   ...wsData.vm_details,
                   guacamole_url: prev?.vm_details?.guacamole_url || url,
                   status: status
                 }
               }));
               if (wsLoading) setWsLoading(false);
             }
          }
        } else {
          // Session polling
          const res = await sessionService.getLiveSession(sessionId);
          if (!res.data.success || !res.data.data || String(res.data.data.id) !== String(sessionId)) {
            setDisconnectedByAdmin(true);
            return;
          }
          const sData = res.data.data;
          
          if (sData.status === 'ended') {
            setDisconnectedByAdmin(true);
            return;
          }
          
          const myParticipant = sData.participants?.find(p => p.user?.id === user?.id);
          if (myParticipant) {
             const pStatus = myParticipant.status;
             const vmStatus = myParticipant.vm_status;
             const beingControlled = myParticipant.is_being_controlled;
             
             if (pStatus === 'removed' || pStatus === 'disconnected' || vmStatus === 'stopped') {
                // Distinguish takeover-disconnect from a genuine end/remove
                if (beingControlled) {
                  setTakenOverByHost(true);
                } else {
                  setDisconnectedByAdmin(true);
                }
                return;
             }
             
             setSessionData(prev => {
                if (!prev) return prev;
                
                const newState = {
                   ...prev,
                   session_scheduled_end_at: sData.scheduled_end_at
                };

                if (!prev.guacamole_url && myParticipant.guacamole_url) {
                    newState.guacamole_url = myParticipant.guacamole_url;
                }
                
                if (vmStatus !== lastKnownStatus.current) {
                  lastKnownStatus.current = vmStatus;
                  newState.vm_status = vmStatus;
               }
               newState.is_being_controlled = beingControlled;

               // Host released control — reconnect automatically. This must
               // NOT be gated on takenOverByHost: the backend only ever
               // flips is_being_controlled, never participant.status, during
               // a takeover, so takenOverByHost (which needs pStatus ===
               // 'disconnected') never actually becomes true through
               // polling in practice — gating on it here meant this branch
               // was effectively dead code and the participant's killed
               // Guacamole session never got a fresh iframe.
               if (prev.is_being_controlled && !beingControlled) {
                 setTakenOverByHost(false);
                 setReconnecting(false);
                 newState.guacamole_url = myParticipant.guacamole_url || prev.guacamole_url;
                 // Force a remount even if the URL string is byte-identical
                 // to the stale one (same connection_id + cached token both
                 // commonly unchanged) — GuacamoleEmbed's key is tied to
                 // this, so React tears down the dead iframe and creates a
                 // fresh one that actually re-navigates.
                 setReconnectGeneration(g => g + 1);
               }
                
                return newState;
             });

             // Check for a new broadcast/system notification and surface it
             // as a toast over the desktop stream — the bell alone is easy
             // to miss while fully engaged with the VM.
             try {
               const notifRes = await api.get('/notifications/?limit=1');
               const latest = notifRes.data?.data?.[0];
               if (latest) {
                 if (lastSeenNotifId.current === null) {
                   // First check this session — just establish the baseline,
                   // don't toast notifications that predate joining.
                   lastSeenNotifId.current = latest.id;
                 } else if (latest.id !== lastSeenNotifId.current) {
                   lastSeenNotifId.current = latest.id;
                   setBroadcastToast({ title: latest.title, message: latest.message });
                   if (broadcastToastTimeoutRef.current) clearTimeout(broadcastToastTimeoutRef.current);
                   broadcastToastTimeoutRef.current = setTimeout(() => setBroadcastToast(null), 8000);
                 }
               }
             } catch (e) {
               // non-critical — skip this cycle
             }
          } else {
             setDisconnectedByAdmin(true);
          }
        }
      } catch (err) {
        // ignore single transient network errors
      }
    };

    poll(); // Initial immediate poll
    intervalId = setInterval(poll, pollInterval);

    if (type === 'workspace' && wsLoading) {
      hardTimeoutId = setTimeout(() => {
        setWsLoading(false);
        setDisconnectedByAdmin(true);
        setWorkspace(prev => ({
          ...prev,
          vm_details: {
            ...(prev?.vm_details || {}),
            status: 'error',
            isTimeout: true,
            notes: "This workspace is taking longer than expected to start. On current infrastructure, cold starts can take up to 5 minutes."
          }
        }));
      }, 330000);
    }

    return () => {
      clearInterval(intervalId);
      if (hardTimeoutId) clearTimeout(hardTimeoutId);
      if (broadcastToastTimeoutRef.current) clearTimeout(broadcastToastTimeoutRef.current);
    };
  }, [type, sessionId, user, wsLoading]);

  // Session timer (countdown)
  const [timeLeft, setTimeLeft] = useState(null);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const warningShownRef = useRef(false);

  useEffect(() => {
    if (!sessionData?.session_scheduled_end_at) return;

    const interval = setInterval(() => {
      const end = new Date(sessionData.session_scheduled_end_at).getTime();
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
  }, [sessionData?.session_scheduled_end_at]);

  const getMetricColor = (val) => {
    if (val < 50) return 'text-emerald-400';
    if (val < 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleEndSession = async () => {
    setIsDisconnecting(true);
    try {
      if (type === 'workspace') {
        await api.post(`/workspaces/${sessionId}/stop/`);
        navigate('/workspaces');
      } else {
        await sessionService.disconnect(sessionId);
        navigate('/workspaces', { state: { disconnected: true } });
      }
    } catch (e) {
      console.error('Failed to end session:', e);
      alert('Failed to end session: ' + (e.response?.data?.message || e.message));
      setIsDisconnecting(false);
      setShowConfirm(false);
    }
  };

  /**
   * Handles participant reconnecting after host releases control.
   * Re-fetches the session to get a fresh Guacamole URL and clears the takeover state.
   */
  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const res = await sessionService.getLiveSession(sessionId);
      if (res.data.success && res.data.data) {
        const sData = res.data.data;
        const myParticipant = sData.participants?.find(p => p.user?.id === user?.id);
        if (myParticipant && myParticipant.guacamole_url && !myParticipant.is_being_controlled) {
          setSessionData(prev => ({
            ...prev,
            guacamole_url: myParticipant.guacamole_url,
            is_being_controlled: false,
          }));
          setTakenOverByHost(false);
          setReconnecting(false);
          setReconnectGeneration(g => g + 1);
          return;
        }
      }
    } catch (e) {
      // ignore
    }
    // Still under control — tell user to wait
    setReconnecting(false);
    setToast({ show: true, message: 'Session is still under instructor control. Try again in a moment.', type: 'warning' });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(e => {
        console.error('Fullscreen request failed:', e);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcut: Ctrl+Shift+F for fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Removed early return for disconnectedByAdmin, now handled as an overlay

  if (type === 'workspace') {
    if (wsLoading || workspace?.vm_details?.status === 'provisioning') {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-6 bg-[#050B18]">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <div className="text-center">
             <h2 className="text-[var(--text-primary)] text-xl font-semibold mb-2">Connecting to your workspace...</h2>
             <p className="text-[var(--text-secondary)]">{workspace?.vm_details?.notes || 'Starting virtual machine...'}</p>
          </div>
        </div>
      );
    }
    
    if (workspace?.vm_details?.status === 'error') {
       const isTimeout = workspace?.vm_details?.isTimeout;
       return (
        <div className="flex flex-col items-center justify-center h-screen gap-6 bg-[#050B18]">
          <div className="text-center max-w-md">
             <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
             <h2 className="text-red-400 text-xl font-semibold mb-2">
               {isTimeout ? 'Provisioning Taking Longer Than Expected' : 'Error Provisioning Workspace'}
             </h2>
             <p className="text-[var(--text-secondary)] mb-6">
               {workspace.vm_details?.notes || 'Unknown error occurred during provisioning.'}
             </p>
             <div className="flex justify-center gap-4 flex-col sm:flex-row">
                 <button onClick={() => window.location.reload()} className="px-6 py-3 bg-transparent text-[var(--text-primary)] rounded-xl font-medium hover:bg-white/5 transition-colors border border-[var(--border-color)]">
                   {isTimeout ? 'Check Again' : 'Try Again'}
                 </button>
                 <button onClick={() => navigate('/workspaces')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25 text-sm">
                   Back to Workspaces {isTimeout ? '(it may still finish)' : ''}
                 </button>
             </div>
          </div>
        </div>
       );
    }
    
    if (workspace?.vm_details?.guacamole_url) {
      return (
        <div ref={containerRef} className="relative w-screen h-screen overflow-hidden bg-black flex flex-col font-inter">
          <div className="h-12 bg-[var(--bg-primary)] border-b border-[var(--border-color)] flex items-center justify-between px-4 shrink-0 shadow-md relative z-50">
            <div className="flex items-center gap-4">
              <Monitor className="w-5 h-5 text-indigo-400" />
              <span className="text-[var(--text-primary)] font-medium text-sm sm:text-base hidden sm:block">
                {workspace.name}
              </span>
              
              {type !== 'workspace' && timeLeft && (
                  <div className="flex items-center gap-4 border-l border-border pl-4">
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      background: timeLeft.startsWith('00:0') 
                        ? 'var(--status-warning-bg, rgba(245, 158, 11, 0.1))'
                        : 'var(--bg-input, transparent)',
                    }}>
                      <Clock size={12} className={timeLeft.startsWith('00:0') ? "text-[var(--status-warning)]" : "text-secondary"} />
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: timeLeft.startsWith('00:0') ? 'var(--status-warning, #F59E0B)' : 'var(--text-primary)',
                      }}>{timeLeft}</span>
                      <span style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                      }}>left</span>
                    </div>
                  </div>
                )}
              
              <div className="h-5 w-px bg-[var(--border-color)] hidden sm:block" />
              
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 text-sm font-medium">Connected</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleFullscreen}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              
              <button 
                onClick={handleEndSession} 
                disabled={isDisconnecting}
                className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border border-red-500/20 flex items-center gap-2"
              >
                <Power className="w-4 h-4" />
                {isDisconnecting ? 'Disconnecting...' : 'End Session'}
              </button>
            </div>
          </div>
          
          {disconnectedByAdmin && (
            <div style={{
              position: 'absolute', inset: 0,
              zIndex: 100,
              background: '#050B18',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Power size={48} className="text-slate-400 mb-4" />
              <h2 className="text-slate-300 text-xl font-semibold mb-2">Workspace Shut Down</h2>
              <p className="text-slate-500 mb-6">This workspace has been shut down or the session was disconnected.</p>
              <button onClick={() => navigate('/workspaces')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg">
                Back to Workspaces
              </button>
            </div>
          )}

          <GuacamoleEmbed url={workspace.vm_details.guacamole_url} loadingText="Connecting to your workspace..." />
        </div>
      );
    }
  }

  if (!sessionData) return null;

  if (!sessionData.guacamole_url) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 bg-[#050B18]">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <div className="text-center">
           <h2 className="text-[var(--text-primary)] text-xl font-semibold mb-2">Connecting to your session...</h2>
           <p className="text-[var(--text-secondary)]">
             {sessionData.vm_status === 'provisioning' 
                ? 'Starting virtual machine...' 
                : 'Waiting for virtual desktop to be ready...'}
           </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-screen h-screen overflow-hidden bg-black flex flex-col font-inter">
      <div className="h-12 bg-[var(--bg-primary)] border-b border-[var(--border-color)] flex items-center justify-between px-4 shrink-0 shadow-md relative z-50">
        <div className="flex items-center gap-4">
          <Monitor className="w-5 h-5 text-indigo-400" />
          <span className="text-[var(--text-primary)] font-medium text-sm sm:text-base hidden sm:block">
            {sessionData.vm_name}
          </span>
          
          <div className="h-5 w-px bg-[var(--border-color)] hidden sm:block" />
          
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 text-sm font-medium">Connected</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleFullscreen}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          
          <button 
            onClick={handleEndSession} 
            disabled={isDisconnecting}
            className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border border-red-500/20 flex items-center gap-2"
          >
            <Power className="w-4 h-4" />
            {isDisconnecting ? 'Disconnecting...' : 'End Session'}
          </button>
        </div>
      </div>

      {showTimeWarning && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          background: 'var(--status-warning-bg)',
          borderBottom: '1px solid var(--status-warning)',
        }}>
          <Clock size={14} style={{ color: 'var(--status-warning)' }} />
          <span style={{
            fontSize: '12px',
            color: 'var(--status-warning)',
            flex: 1,
          }}>
            5 minutes remaining in this session
          </span>
          <button onClick={() => setShowTimeWarning(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--status-warning)',
            }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Takeover overlay — shown when host is actively controlling this session */}
      {takenOverByHost && (
        <div style={{
          position: 'absolute', inset: 0,
          zIndex: 100,
          background: '#050B18',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          textAlign: 'center',
          padding: '32px',
        }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1.5px solid rgba(245, 158, 11, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 8,
          }}>
            <UserCheck size={28} color="#F59E0B" />
          </div>
          <h2 style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: 700, margin: 0 }}>
            Your instructor has taken control
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
            Your instructor is temporarily using your desktop. Your work is safe — nothing
            will be deleted. You can reconnect once they release control.
          </p>
          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            style={{
              marginTop: 16,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 24px',
              borderRadius: 10,
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              color: '#818cf8',
              fontSize: 14, fontWeight: 600,
              cursor: reconnecting ? 'not-allowed' : 'pointer',
              opacity: reconnecting ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={14} className={reconnecting ? 'animate-spin' : ''} />
            {reconnecting ? 'Checking...' : 'Try Reconnecting'}
          </button>
        </div>
      )}

      {/* Genuine disconnect overlay (session ended / removed by admin) */}
      {disconnectedByAdmin && (
        <div style={{
          position: 'absolute', inset: 0,
          zIndex: 100,
          background: '#050B18',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Power size={48} className="text-slate-400 mb-4" />
          <h2 className="text-slate-300 text-xl font-semibold mb-2">Session Ended</h2>
          <p className="text-slate-500 mb-6">This session has ended or you were removed by the instructor.</p>
          <button onClick={() => navigate('/workspaces')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg">
            Back to Workspaces
          </button>
        </div>
      )}

      {sessionData.is_being_controlled && !takenOverByHost && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-amber-500/90 text-white rounded-full shadow-lg shadow-amber-500/20 backdrop-blur-sm animate-in slide-in-from-top-4">
          <Monitor size={14} className="animate-pulse" />
          <span className="text-xs font-semibold tracking-wide">Your instructor is currently interacting with your screen</span>
        </div>
      )}

      {broadcastToast && (
        <div
          className="animate-in slide-in-from-top-4 fade-in duration-300"
          style={{
            position: 'absolute',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'var(--accent-primary)',
            color: '#fff',
            padding: '14px 24px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '80%',
          }}>
          <Megaphone size={16} />
          <div>
            <div style={{ fontSize: '11px', opacity: 0.9 }}>{broadcastToast.title}</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{broadcastToast.message}</div>
          </div>
          <button onClick={() => setBroadcastToast(null)}
            style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.8, cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      <GuacamoleEmbed key={reconnectGeneration} url={sessionData.guacamole_url} loadingText="Connecting to your session..." />
      
      <ConfirmModal
        isOpen={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleEndSession}
        title="Disconnect Session"
        message="Are you sure you want to disconnect from this virtual machine? Any unsaved work inside the VM may be lost if the VM is stopped later."
        confirmText={isDisconnecting ? "Disconnecting..." : "Disconnect"}
        variant="danger"
      />
      
      {toast.show && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, show: false })} 
        />
      )}
    </div>
  );
}

