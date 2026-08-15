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
import LoadingLogo from '../../components/shared/LoadingLogo';
import PowerOnAnimation from '../../components/shared/PowerOnAnimation';

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

  // Raw, unfiltered "does Guacamole currently have a live tunnel for this
  // VM" signal from the backend (apps.vms.services.guacamole_service
  // .get_active_connection_id), passed straight through to GuacamoleEmbed
  // so its own cover only ever lifts on positive confirmation.
  const [tunnelActive, setTunnelActive] = useState(false);
  // Debounced, page-level "the connection was healthy and just broke"
  // overlay — distinct from the initial-connect window, which is handled
  // entirely by GuacamoleEmbed's own minimum-cover timer.
  const [tunnelDown, setTunnelDown] = useState(false);
  // A guest-initiated Power Off (unlike Restart) leaves the VM genuinely
  // off — nothing in this app currently syncs VirtualMachine.status from
  // Proxmox's live state for an externally-triggered shutdown (confirmed:
  // the only periodic VM-status task, cleanup_stale_vms, only handles VMs
  // stuck in 'provisioning'), so there is no backend signal that
  // distinguishes "will come back" from "gone for good". Retrying forever
  // would show "Reconnecting automatically…" indefinitely for a VM that's
  // never coming back. After a reasonable window, stop retrying and tell
  // the user honestly instead of guessing which case it is.
  const [reconnectGaveUp, setReconnectGaveUp] = useState(false);
  const guacDownStrikesRef = useRef(0);
  const guacUpStrikesRef = useRef(0);
  const everGuacConnectedRef = useRef(false);
  const lastReconnectAttemptRef = useRef(0);
  const tunnelDownSinceRef = useRef(null);
  const RECONNECT_GIVE_UP_MS = 90000;
  // Tracks is_being_controlled independently of sessionData, since the
  // takeover branch below short-circuits before ever calling
  // setSessionData — needed to detect the true->false "control released"
  // transition and trigger a reconnect.
  const wasControlledRef = useRef(false);

  const CONFIRM_STRIKES = 2;

  // Confirmed by direct testing (rebooting/powering off a live VM's guest
  // OS via the qemu-guest-agent, equivalent to using Ubuntu/Zorin's own
  // power menu): Proxmox VM status stays 'running' for the entire reboot
  // (so vm_status alone can never detect it), and — separately — a dead
  // Guacamole tunnel never comes back on its own; the only way to get a
  // live one again is a fresh client actually opening the connection URL.
  //
  // Also confirmed by testing against a genuinely powered-off VM: a single
  // positive guac_connected reading is NOT reliable on its own — Guacamole
  // marks a tunnel "active" the instant guacd accepts a client, before the
  // RDP handshake to the actual VM has succeeded OR failed. Our own retry
  // attempts against a dead VM produced several of these doomed, briefly
  // "active" tunnels. So confirmation requires CONFIRM_STRIKES consecutive
  // positive polls before ever revealing the iframe — a single reading in
  // either direction is not trusted, except a single negative reading
  // immediately re-hides the iframe (fail fast on the way down; the more
  // conservative direction).
  const evaluateTunnelHealth = (guacConnectedNow, freshUrl) => {
    if (guacConnectedNow) {
      guacDownStrikesRef.current = 0;
      guacUpStrikesRef.current += 1;
      if (guacUpStrikesRef.current < CONFIRM_STRIKES) return;

      everGuacConnectedRef.current = true;
      tunnelDownSinceRef.current = null;
      setTunnelActive(true);
      setTunnelDown(false);
      setReconnectGaveUp(false);
      return;
    }

    guacUpStrikesRef.current = 0;
    setTunnelActive(false);

    // Still doing the initial connect — GuacamoleEmbed's own minimum-cover
    // timer already keeps the iframe hidden during this window, and a
    // false reading here is expected, not a failure.
    if (!everGuacConnectedRef.current) return;

    guacDownStrikesRef.current += 1;
    // Require 2 consecutive unhealthy polls (~5s at the 2.5-3s interval
    // below) before showing the page-level "Connection Interrupted"
    // message, so a single transient hiccup reaching Guacamole's own API
    // doesn't flash it on an otherwise-fine session — the iframe itself is
    // already hidden immediately above regardless of this debounce.
    if (guacDownStrikesRef.current < CONFIRM_STRIKES) return;

    setTunnelDown(true);
    if (tunnelDownSinceRef.current === null) {
      tunnelDownSinceRef.current = Date.now();
    }

    // A guest-initiated Restart typically reconnects well within this
    // window; a genuine Power Off never will, since there's nothing to
    // reconnect to. Once we've been down this long, stop guessing and
    // stop retrying — give the user an honest, actionable state instead
    // of silently hammering a target that may be gone for good.
    if (Date.now() - tunnelDownSinceRef.current > RECONNECT_GIVE_UP_MS) {
      setReconnectGaveUp(true);
      return;
    }

    const now = Date.now();
    if (now - lastReconnectAttemptRef.current > 12000) {
      lastReconnectAttemptRef.current = now;
      if (freshUrl) {
        setSessionData(prev => (prev ? { ...prev, guacamole_url: freshUrl } : prev));
        setWorkspace(prev => (prev ? {
          ...prev,
          vm_details: { ...(prev.vm_details || {}), guacamole_url: freshUrl },
        } : prev));
      }
      setReconnectGeneration(g => g + 1);
    }
  };

  // "Try Again" after giving up — resets the give-up window and forces an
  // immediate fresh reconnect attempt rather than waiting for the next
  // poll cycle.
  const handleManualReconnectRetry = () => {
    tunnelDownSinceRef.current = Date.now();
    lastReconnectAttemptRef.current = 0;
    setReconnectGaveUp(false);
    setReconnectGeneration(g => g + 1);
  };

  // Consolidated Polling Loop
  useEffect(() => {
    let intervalId;
    let hardTimeoutId;

    // Poll every 2-3s across the board — fast enough to catch a dead
    // tunnel (guest-OS reboot, network failure) before it lingers on
    // screen, per the debounce above.
    const pollInterval = (type === 'workspace' && wsLoading) ? 3000 : (type === 'workspace' ? 3000 : 2000);

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
             evaluateTunnelHealth(wsData.vm_details?.guac_connected, url);
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

             if (pStatus === 'removed' || (pStatus === 'disconnected' && !beingControlled) || (vmStatus === 'stopped' && !beingControlled)) {
                setDisconnectedByAdmin(true);
                wasControlledRef.current = false;
                return;
             }

             if (beingControlled) {
                // The host opens a second, simultaneous Guacamole connection
                // to the SAME xrdp target to take control. xrdp only allows
                // one active graphical session per account, so this kicks
                // the participant's own RDP session out from under them —
                // confirmed via the "confirmed xrdp protocol constraint"
                // takeover work earlier today. That means Guacamole's raw
                // "disconnected" UI is about to render inside the iframe.
                //
                // This branch used to be gated behind pStatus === 'disconnected',
                // which the backend never actually sets during a takeover (only
                // is_being_controlled flips) — so takenOverByHost never fired in
                // practice and the only visible indicator was the small amber
                // banner below, leaving the killed iframe fully visible. Cover
                // immediately and unconditionally on is_being_controlled instead.
                setTakenOverByHost(true);
                setTunnelActive(false);
                wasControlledRef.current = true;
                setSessionData(prev => (prev ? {
                  ...prev,
                  session_scheduled_end_at: sData.scheduled_end_at,
                  is_being_controlled: true,
                } : prev));
                return;
             }

             if (wasControlledRef.current) {
                // Host released control — reconnect automatically.
                wasControlledRef.current = false;
                setTakenOverByHost(false);
                setReconnecting(false);
                setSessionData(prev => (prev ? {
                  ...prev,
                  session_scheduled_end_at: sData.scheduled_end_at,
                  is_being_controlled: false,
                  guacamole_url: myParticipant.guacamole_url || prev.guacamole_url,
                } : prev));
                // Force a remount even if the URL string is byte-identical
                // to the stale one (same connection_id + cached token both
                // commonly unchanged) — GuacamoleEmbed's key is tied to
                // this, so React tears down the dead iframe and creates a
                // fresh one that actually re-navigates.
                setReconnectGeneration(g => g + 1);
                // Skip the tunnel-health check this cycle — the freshly
                // remounted iframe needs its own grace period first.
                return;
             }

             setSessionData(prev => {
                if (!prev) return prev;

                const newState = {
                   ...prev,
                   session_scheduled_end_at: sData.scheduled_end_at,
                   is_being_controlled: false,
                };

                if (!prev.guacamole_url && myParticipant.guacamole_url) {
                    newState.guacamole_url = myParticipant.guacamole_url;
                }

                if (vmStatus !== lastKnownStatus.current) {
                  lastKnownStatus.current = vmStatus;
                  newState.vm_status = vmStatus;
               }

                return newState;
             });

             evaluateTunnelHealth(myParticipant.guac_connected, myParticipant.guacamole_url);

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
        // A failed poll means we have no current information about
        // whether the connection is healthy — that's not the same as
        // confirmed-healthy, so it feeds the same debounced tunnel-health
        // path as an explicit guac_connected:false reading rather than
        // being silently ignored. A single transient blip is absorbed by
        // the existing 2-strike debounce; only sustained failures actually
        // raise the overlay.
        evaluateTunnelHealth(false, null);
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
    const elem = containerRef.current;
    const inFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!inFullscreen) {
      if (elem?.requestFullscreen) {
        elem.requestFullscreen().catch(e => {
          console.error('Fullscreen request failed:', e);
        });
      } else if (elem?.webkitRequestFullscreen) {
        // Safari/iOS
        elem.webkitRequestFullscreen();
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  };

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
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
      // VM power-up/boot stage specifically — orbit animation. Once the VM
      // is running and guacamole_url is available, the flow below hands
      // off to GuacamoleEmbed's own LoadingLogo cover for the separate
      // "connecting to the desktop stream" stage.
      return (
        <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-canvas, #050B18)' }}>
          <PowerOnAnimation statusText={workspace?.vm_details?.notes || 'Starting virtual machine...'} />
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

          {!disconnectedByAdmin && tunnelDown && !reconnectGaveUp && (
            <div style={{
              position: 'absolute', inset: 0,
              zIndex: 100,
              background: '#050B18',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '32px',
            }}>
              <RefreshCw size={40} className="text-indigo-400 mb-4 animate-spin" />
              <h2 className="text-slate-300 text-xl font-semibold mb-2">Connection Interrupted</h2>
              <p className="text-slate-500 mb-2 max-w-sm">
                The desktop stream was interrupted — this can happen if the machine restarts. Reconnecting automatically…
              </p>
            </div>
          )}

          {!disconnectedByAdmin && reconnectGaveUp && (
            <div style={{
              position: 'absolute', inset: 0,
              zIndex: 100,
              background: '#050B18',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '32px',
            }}>
              <AlertCircle size={40} className="text-amber-400 mb-4" />
              <h2 className="text-slate-300 text-xl font-semibold mb-2">Still Having Trouble Reconnecting</h2>
              <p className="text-slate-500 mb-6 max-w-sm">
                We're having trouble reconnecting to your workspace. It may have been shut down. You can try again or head back to your workspaces.
              </p>
              <div className="flex gap-3">
                <button onClick={() => navigate('/workspaces')} className="px-6 py-3 bg-transparent text-[var(--text-primary)] rounded-xl font-medium hover:bg-white/5 transition-colors border border-[var(--border-color)]">
                  Back to Workspaces
                </button>
                <button onClick={handleManualReconnectRetry} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg">
                  Try Again
                </button>
              </div>
            </div>
          )}

          <GuacamoleEmbed key={reconnectGeneration} url={workspace.vm_details.guacamole_url} loadingText={workspace?.vm_details?.notes || "Connecting to your workspace..."} tunnelActive={tunnelActive} />
        </div>
      );
    }
  }

  if (!sessionData) return null;

  if (!sessionData.guacamole_url) {
    // Two distinct real stages: the VM itself booting (power-up, orbit
    // animation) vs. an already-running VM whose desktop stream hasn't
    // been wired up yet (connecting, LoadingLogo — same as GuacamoleEmbed's
    // own cover uses once guacamole_url is present).
    if (sessionData.vm_status === 'provisioning') {
      return (
        <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-canvas, #050B18)' }}>
          <PowerOnAnimation statusText="Starting virtual machine..." />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-canvas, #050B18)' }}>
        <LoadingLogo statusText="Waiting for virtual desktop to be ready..." />
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

      {/* Tunnel-down overlay — the connection was genuinely healthy and
          just broke (e.g. a restart/shutdown triggered from inside the
          guest OS itself), distinct from the takeover and admin-disconnect
          cases above which have their own more specific messaging. */}
      {!disconnectedByAdmin && !takenOverByHost && tunnelDown && !reconnectGaveUp && (
        <div style={{
          position: 'absolute', inset: 0,
          zIndex: 100,
          background: '#050B18',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '32px',
        }}>
          <RefreshCw size={40} className="text-indigo-400 mb-4 animate-spin" />
          <h2 className="text-slate-300 text-xl font-semibold mb-2">Connection Interrupted</h2>
          <p className="text-slate-500 mb-2 max-w-sm">
            The desktop stream was interrupted — this can happen if the machine restarts. Reconnecting automatically…
          </p>
        </div>
      )}

      {/* Give-up state — a genuine guest-initiated Power Off leaves the VM
          off for good, and nothing currently syncs that back to us, so we
          can't tell restart-recovering from powered-off-forever. After a
          reasonable window, stop guessing and stop retrying. */}
      {!disconnectedByAdmin && !takenOverByHost && reconnectGaveUp && (
        <div style={{
          position: 'absolute', inset: 0,
          zIndex: 100,
          background: '#050B18',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '32px',
        }}>
          <AlertCircle size={40} className="text-amber-400 mb-4" />
          <h2 className="text-slate-300 text-xl font-semibold mb-2">Still Having Trouble Reconnecting</h2>
          <p className="text-slate-500 mb-6 max-w-sm">
            We're having trouble reconnecting to your session. It may have been shut down. You can try again or head back to your workspaces.
          </p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/workspaces')} className="px-6 py-3 bg-transparent text-[var(--text-primary)] rounded-xl font-medium hover:bg-white/5 transition-colors border border-[var(--border-color)]">
              Back to Workspaces
            </button>
            <button onClick={handleManualReconnectRetry} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg">
              Try Again
            </button>
          </div>
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

      <GuacamoleEmbed key={reconnectGeneration} url={sessionData.guacamole_url} loadingText="Connecting to your session..." tunnelActive={tunnelActive} />
      {/* Live-session participants don't have a per-VM `.notes` field like
          personal workspaces do (SessionParticipant/VirtualMachine here
          isn't populated with staged provisioning notes), so this stays a
          real, honest static label rather than fabricating fake stages. */}
      
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

