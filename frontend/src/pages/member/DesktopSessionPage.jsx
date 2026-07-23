import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  Monitor, Maximize2, Minimize2, LayoutGrid, Compass, BarChart2, AlertCircle, 
  Code2, Palette, Network, Box, Wifi, Battery, Volume2, 
  Menu, X, Check, PanelRightOpen, PanelRightClose, Power
} from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import api from '../../services/api';
import ConfirmModal from '../../components/shared/ConfirmModal';
import Toast from '../../components/shared/Toast';

export default function DesktopSessionPage() {
  const { id: sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
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
      sessionService.getActiveSession().then(res => {
        if (res.data.success && res.data.data && String(res.data.data.id) === String(sessionId)) {
          // It's active
          const sData = res.data.data;
          setSessionData({
            session_id: sData.id,
            session_token: "retrieved-token",
            vm_name: sData.vm.name,
            template_name: sData.vm.template_name,
            os: sData.vm.os,
            resolution: "1920x1080",
            connected_at: sData.started_at,
            restrictions: { internet: true, copy_paste: true }
          });
        } else {
          // Missing or not active
          navigate('/workspaces');
        }
      }).catch(() => navigate('/workspaces'));
    }
  }, [sessionData, sessionId, navigate, type]);

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
           if (!wsData.vm_template_details?.is_real || wsData.vm_details?.guacamole_url) {
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
        const res = await sessionService.getActiveSession();
        if (!res.data.success || !res.data.data || String(res.data.data.id) !== String(sessionId)) {
          setDisconnectedByAdmin(true);
        }
      } catch (err) {
        setDisconnectedByAdmin(true);
      }
    };
    
    intervalId = setInterval(fetchSessionStatus, 8000);
    return () => clearInterval(intervalId);
  }, [type, sessionId]);

  // Sync workspace data to sessionData for simulated fallback
  useEffect(() => {
    if (type === 'workspace' && workspace && !wsLoading && !workspace.vm_details?.guacamole_url && workspace.vm_details?.status !== 'error') {
      setSessionData({
        session_id: workspace.id,
        session_token: "workspace-token",
        vm_name: workspace.name,
        template_name: workspace.vm_template_details?.name,
        os: workspace.vm_template_details?.os,
        resolution: "1920x1080",
        connected_at: workspace.last_accessed_at || new Date().toISOString(),
        restrictions: { internet: true, copy_paste: true }
      });
      setVmData({
        template: workspace.vm_template_details
      });
    }
  }, [type, workspace, wsLoading]);

  // Session timer
  useEffect(() => {
    if (!sessionData?.connected_at) return;
    const start = new Date(sessionData.connected_at).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      setTimer(Math.floor((now - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionData]);

  // Current time clock (for simulated desktop)
  useEffect(() => {
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // CPU/RAM simulation drift every 5s
  useEffect(() => {
    const driftInterval = setInterval(() => {
      setCpu(prev => Math.max(1, Math.min(100, prev + (Math.random() * 10 - 5))));
      setRam(prev => Math.max(10, Math.min(95, prev + (Math.random() * 4 - 2))));
    }, 5000);
    return () => clearInterval(driftInterval);
  }, []);

  const formatTimer = (totalSeconds) => {
    if (totalSeconds < 0) totalSeconds = 0;
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

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

  const isWindows = sessionData.os?.toLowerCase().includes('windows');
  const osType = isWindows ? 'windows' : 'linux';
  const softwareList = vmData?.template?.software_list || ['Basic Tools'];

  const getSoftwareIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('autocad')) return <Compass className="w-10 h-10 mb-1" />;
    if (n.includes('matlab')) return <BarChart2 className="w-10 h-10 mb-1" />;
    if (n.includes('code') || n.includes('programming')) return <Code2 className="w-10 h-10 mb-1" />;
    if (n.includes('photoshop') || n.includes('graphic')) return <Palette className="w-10 h-10 mb-1" />;
    if (n.includes('wireshark') || n.includes('network')) return <Network className="w-10 h-10 mb-1" />;
    return <Box className="w-10 h-10 mb-1" />;
  };

  return (
    <div ref={containerRef} className="flex flex-col h-screen w-screen overflow-hidden bg-black font-inter select-none">
      {/* ── Top Bar ── */}
      <div className="h-12 bg-[var(--bg-primary)] border-b border-[var(--border-color)] flex items-center justify-between px-4 shrink-0 shadow-md relative z-50">
        <div className="flex items-center gap-4">
          <Monitor className="w-5 h-5 text-indigo-400" />
          <span className="text-[var(--text-primary)] font-medium text-sm sm:text-base hidden sm:block">
            {sessionData.vm_name}
          </span>
          
          <div className="h-5 w-px bg-[var(--bg-card-hover)] hidden sm:block" />
          
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 text-sm font-medium">Connected</span>
          </div>
          
          <div className="h-5 w-px bg-[var(--bg-card-hover)]" />
          
          <span className="text-[var(--text-primary)] font-mono text-sm tracking-wider">
            {formatTimer(timer)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className={`text-xs font-mono hidden md:block ${getMetricColor(cpu)}`}>
            CPU: {cpu.toFixed(1)}%
          </span>
          <span className={`text-xs font-mono hidden md:block ${getMetricColor(ram)}`}>
            RAM: {ram.toFixed(1)}%
          </span>
          
          <div className="h-5 w-px bg-[var(--bg-card-hover)] hidden md:block" />
          
          <button 
            onClick={() => setShowConfirm(true)}
            className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-primary px-3 py-1.5 rounded text-xs font-medium transition-colors border border-red-500/30 flex items-center gap-1.5"
          >
            <Power className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
          
          <button 
            onClick={toggleFullscreen}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ml-1"
            title="Session Info"
          >
            {isPanelOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {/* ── Desktop Viewport ── */}
        {vmData?.guacamole_url ? (
          <iframe
            src={vmData.guacamole_url}
            title="CloudDesk Virtual Machine"
            className="w-full h-full border-0 bg-black"
            allowFullScreen
          />
        ) : (
          <div 
            className="flex-1 relative flex flex-col"
            style={{
              background: osType === 'windows' 
                ? 'linear-gradient(to bottom, #1a1a2e, #16213e)' 
                : 'linear-gradient(to bottom, #1e1e2e, #2d2d3d)'
            }}
          >
          {/* Simulation Badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg flex items-center gap-2">
              
              <span>Simulation Mode — Connect Proxmox for live desktop</span>
            </div>
          </div>

          {/* Linux Top Panel */}
          {osType === 'linux' && (
            <div className="h-8 bg-black/50 backdrop-blur-md flex items-center justify-between px-4 text-xs text-[var(--text-primary)] shadow-sm shrink-0">
              <div className="font-semibold cursor-default hover:bg-white/10 px-2 py-1 rounded">Activities</div>
              <div className="font-semibold cursor-default hover:bg-white/10 px-2 py-1 rounded">
                {currentTime.toLocaleTimeString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="flex items-center gap-3">
                <Network className="w-3.5 h-3.5" />
                <Volume2 className="w-3.5 h-3.5" />
                <Battery className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

          {/* Desktop Icons Area */}
          <div className="flex-1 p-6 relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-fit h-fit">
              {softwareList.map((sw, idx) => (
                <div key={idx} className="flex flex-col items-center justify-center w-24 p-2 rounded hover:bg-white/10 cursor-pointer text-[var(--text-primary)]/90 group transition-colors">
                  <div className="drop-shadow-lg group-hover:scale-105 transition-transform">
                    {getSoftwareIcon(sw)}
                  </div>
                  <span className="text-xs text-center leading-tight drop-shadow-md line-clamp-2 mt-1">
                    {sw}
                  </span>
                </div>
              ))}
            </div>

            {/* Watermark */}
            <div className="absolute bottom-6 right-8 opacity-10 pointer-events-none text-right">
              <p className="text-4xl font-bold text-[var(--text-primary)] tracking-widest uppercase">CloudDesk</p>
              <p className="text-xl text-[var(--text-primary)] mt-1 tracking-wide">{sessionData.os}</p>
            </div>
          </div>

          {/* Linux Dock */}
          {osType === 'linux' && (
            <div className="w-full flex justify-center pb-4">
              <div className="bg-white/10 backdrop-blur-lg border border-[var(--border-color)] rounded-2xl px-4 py-2 flex gap-4 shadow-xl">
                <div className="w-10 h-10 bg-orange-500/80 rounded-xl flex items-center justify-center cursor-pointer hover:bg-orange-500 hover:-translate-y-1 transition-all"><Box className="w-6 h-6 text-[var(--text-primary)]"/></div>
                <div className="w-10 h-10 bg-indigo-500/80 rounded-xl flex items-center justify-center cursor-pointer hover:bg-indigo-500 hover:-translate-y-1 transition-all"><LayoutGrid className="w-6 h-6 text-white"/></div>
                <div className="w-10 h-10 bg-emerald-500/80 rounded-xl flex items-center justify-center cursor-pointer hover:bg-emerald-500 hover:-translate-y-1 transition-all"><Monitor className="w-6 h-6 text-white"/></div>
                <div className="w-10 h-10 bg-purple-500/80 rounded-xl flex items-center justify-center cursor-pointer hover:bg-purple-500 hover:-translate-y-1 transition-all"><Code2 className="w-6 h-6 text-[var(--text-primary)]"/></div>
              </div>
            </div>
          )}

          {/* Windows Taskbar */}
          {osType === 'windows' && (
            <div className="h-11 bg-[#111111]/95 backdrop-blur-md flex items-center justify-between px-2 text-[var(--text-primary)] border-t border-[var(--border-color)] shrink-0 relative z-20 shadow-2xl">
              <div className="flex items-center h-full gap-2">
                <div className="h-full px-3 flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors">
                  <LayoutGrid className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="h-7 w-48 bg-white/10 border border-[var(--border-color)] rounded-full flex items-center px-3 text-xs text-[var(--text-secondary)] ml-2">
                  Type here to search
                </div>
              </div>
              
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center h-full gap-1">
                <div className="h-full w-10 flex items-center justify-center hover:bg-white/10 cursor-pointer border-b-2 border-indigo-400"><Compass className="w-5 h-5 text-primary" /></div>
                <div className="h-full w-10 flex items-center justify-center hover:bg-white/10 cursor-pointer"><Box className="w-5 h-5 text-primary" /></div>
              </div>

              <div className="flex items-center h-full text-[11px]">
                <div className="h-full px-2 flex items-center justify-center hover:bg-white/10 cursor-pointer gap-2 text-[var(--text-primary)]">
                  <Wifi className="w-3.5 h-3.5" />
                  <Volume2 className="w-3.5 h-3.5" />
                  <Battery className="w-3.5 h-3.5" />
                </div>
                <div className="h-full px-3 flex flex-col items-end justify-center hover:bg-white/10 cursor-pointer">
                  <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{currentTime.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ── Session Info Panel (Collapsible) ── */}
        <div 
          className={`bg-[var(--bg-primary)] border-l border-[var(--border-color)] flex flex-col transition-all duration-300 overflow-hidden shadow-2xl z-40 ${
            isPanelOpen ? 'w-72' : 'w-0'
          }`}
        >
          <div className="p-5 flex-1 overflow-y-auto w-72">
            <h3 className="text-[var(--text-primary)] font-semibold text-lg mb-6">Session Info</h3>
            
            <div className="space-y-6">
              {/* General Info */}
              <div>
                <h4 className="text-xs uppercase text-muted font-bold mb-3 tracking-wider">Connection</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Session ID</span>
                    <span className="text-[var(--text-primary)] font-mono">#{sessionData.session_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Resolution</span>
                    <span className="text-[var(--text-primary)]">{sessionData.resolution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Client IP</span>
                    <span className="text-[var(--text-primary)] font-mono text-xs">{vmData?.ip_address || '127.0.0.1'}</span>
                  </div>
                </div>
              </div>

              {/* VM Specs */}
              <div>
                <h4 className="text-xs uppercase text-muted font-bold mb-3 tracking-wider">Specifications</h4>
                <div className="bg-[var(--bg-card)] rounded-lg p-3 space-y-2 text-sm border border-[var(--border-color)]">
                  <div className="flex justify-between border-b border-[var(--border-color)]/50 pb-2">
                    <span className="text-[var(--text-secondary)]">OS</span>
                    <span className="text-[var(--text-primary)] text-right">{sessionData.os}</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border-color)]/50 pb-2">
                    <span className="text-[var(--text-secondary)]">CPU</span>
                    <span className="text-[var(--text-primary)] font-mono">{vmData?.template?.cpu_cores || 4} vCPUs</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border-color)]/50 pb-2">
                    <span className="text-[var(--text-secondary)]">RAM</span>
                    <span className="text-[var(--text-primary)] font-mono">{vmData?.template?.ram_gb || 8} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Storage</span>
                    <span className="text-[var(--text-primary)] font-mono">{vmData?.template?.storage_gb || 60} GB</span>
                  </div>
                </div>
              </div>

              {/* Software */}
              <div>
                <h4 className="text-xs uppercase text-muted font-bold mb-3 tracking-wider">Software</h4>
                <div className="flex flex-wrap gap-2">
                  {softwareList.map((sw, i) => (
                    <span key={i} className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded text-xs font-medium">
                      {sw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Restrictions */}
              <div>
                <h4 className="text-xs uppercase text-muted font-bold mb-3 tracking-wider">Restrictions</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-[var(--bg-card)] p-2.5 rounded-lg border border-[var(--border-color)]">
                    <span className="text-sm text-[var(--text-primary)]">Internet Access</span>
                    {sessionData.restrictions?.internet ? (
                      <div className="flex items-center text-emerald-400 text-xs font-medium gap-1"><Check className="w-3.5 h-3.5"/> Allowed</div>
                    ) : (
                      <div className="flex items-center text-red-400 text-xs font-medium gap-1"><X className="w-3.5 h-3.5"/> Blocked</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between bg-[var(--bg-card)] p-2.5 rounded-lg border border-[var(--border-color)]">
                    <span className="text-sm text-[var(--text-primary)]">Copy & Paste</span>
                    {sessionData.restrictions?.copy_paste ? (
                      <div className="flex items-center text-emerald-400 text-xs font-medium gap-1"><Check className="w-3.5 h-3.5"/> Allowed</div>
                    ) : (
                      <div className="flex items-center text-red-400 text-xs font-medium gap-1"><X className="w-3.5 h-3.5"/> Blocked</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Modal */}
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
