import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  Monitor, Maximize2, Minimize2, LayoutGrid, Compass, BarChart2, AlertCircle, 
  Code2, Palette, Network, Box, Wifi, Battery, Volume2, 
  Menu, X, Check, PanelRightOpen, PanelRightClose, Power
} from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import ConfirmModal from '../../components/shared/ConfirmModal';
import Toast from '../../components/shared/Toast';

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

  // Workspace Polling
  useEffect(() => {
    if (type !== 'workspace') return;
    
    let intervalId;
    let hardTimeoutId;
    let isComplete = false;

    const fetchWs = async () => {
      try {
        const res = await api.get(`/workspaces/${sessionId}/`);
        const wsData = res.data.data || res.data; // Ensure we get the actual workspace object
        setWorkspace(wsData);
        
        const vmStatus = wsData.vm_details?.status;
        if (vmStatus === 'error') {
           setWsLoading(false);
           isComplete = true;
        } else if (vmStatus === 'running' || wsData.status === 'active') {
           if (wsData.vm_details?.guacamole_url) {
              setWsLoading(false);
              isComplete = true;
           }
        }
        
        if (isComplete) {
           clearInterval(intervalId);
           clearTimeout(hardTimeoutId);
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchWs();
    intervalId = setInterval(fetchWs, 3000);
    
    hardTimeoutId = setTimeout(() => {
      clearInterval(intervalId);
      setWsLoading(false);
      setWorkspace(prev => ({
        ...prev,
        vm_details: {
          ...(prev?.vm_details || {}),
          status: 'error',
          isTimeout: true,
          notes: "This workspace is taking longer than expected to start. On current infrastructure, cold starts can take up to 5 minutes."
        }
      }));
    }, 330000); // 330 seconds — matches realistic HDD clone+boot time with safety margin

    return () => {
      clearInterval(intervalId);
      clearTimeout(hardTimeoutId);
    };
  }, [type, sessionId]);

  const [disconnectedByAdmin, setDisconnectedByAdmin] = useState(false);

  // Workspace Polling (Admin status check)
  useEffect(() => {
    if (type !== 'workspace') return;
    
    let wsInterval;
    const fetchWsStatus = async () => {
      try {
        const res = await api.get(`/workspaces/${sessionId}/`);
        if (res.data.success && res.data.data) {
          const status = res.data.data.status;
          if (status === 'stopped' || status === 'error' || status === 'deleted') {
            setDisconnectedByAdmin(true);
          }
        }
      } catch (err) {
        setDisconnectedByAdmin(true);
      }
    };
    
    wsInterval = setInterval(fetchWsStatus, 8000);
    return () => clearInterval(wsInterval);
  }, [type, sessionId]);

    // Session Polling (for participants)
    useEffect(() => {
      if (type === 'workspace') return;
      
      let intervalId;
      const fetchSessionStatus = async () => {
        try {
          const res = await sessionService.getLiveSession(sessionId);
          if (!res.data.success || !res.data.data || String(res.data.data.id) !== String(sessionId)) {
            setDisconnectedByAdmin(true);
            return;
          }
          const sData = res.data.data;
          const myParticipant = sData.participants?.find(p => p.user?.id === user?.id);
          
          if (myParticipant) {
             setSessionData(prev => ({
                ...prev,
                guacamole_url: myParticipant.guacamole_url,
                vm_status: myParticipant.vm_status,
                session_scheduled_end_at: sData.scheduled_end_at
             }));
          }
        } catch (err) {
          setDisconnectedByAdmin(true);
        }
      };
      
      intervalId = setInterval(fetchSessionStatus, 8000);
      return () => clearInterval(intervalId);
    }, [type, sessionId, user]);



  // Session timer (countdown)
  const [timeLeft, setTimeLeft] = useState(null);

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
             <h2 className="text-[var(--text-primary)] text-xl font-semibold mb-2">Preparing your workspace...</h2>
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

          <iframe 
            src={workspace.vm_details.guacamole_url} 
            className="w-full flex-1 border-none bg-black" 
            allow="clipboard-read; clipboard-write; fullscreen" 
            title="Virtual Desktop" 
          />
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
           <h2 className="text-[var(--text-primary)] text-xl font-semibold mb-2">Preparing your session...</h2>
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

      <iframe 
        src={sessionData.guacamole_url} 
        className="w-full flex-1 border-none bg-black" 
        allow="clipboard-read; clipboard-write; fullscreen" 
        title="Virtual Desktop" 
      />
      
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
