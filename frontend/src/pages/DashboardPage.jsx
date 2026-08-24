import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Monitor, Video, Zap, Clock, Users, Play, ArrowUp, ArrowDown, 
  Search, Power, MonitorPlay, Activity, Eye, Radio,
  Cpu, HardDrive, Server, AppWindow, Code, Database, Compass, Terminal, Palette, Network, Shield, Smartphone, Globe, Film, Smile
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import useThemeStore from "../store/themeStore"
import api from '../services/api'
import useLiveSession from '../hooks/useLiveSession'
import JoinByCodeModal from '../components/shared/JoinByCodeModal'
import useBreakpoint from '../hooks/useBreakpoint'
import NetworkGlobe from '../components/shared/NetworkGlobe'
import useContextStore from '../store/contextStore'

import { getOsIcon } from '../utils/osIcons';

const TEMPLATE_ICONS = {
  Code: Code, Code2: Code, Compass: Compass, Terminal: Terminal, Palette: Palette,
  Network: Network, Database: Database, Shield: Shield, Cpu: Cpu,
  Monitor: Monitor, Globe: Globe, Film: Film, Smartphone: Smartphone,
  HardDrive: HardDrive, Server: Server, AppWindow: AppWindow
}

// Real OS icon (react-icons/Simple Icons) when we know the OS family;
// otherwise the manually-picked lucide icon for non-OS templates.
const TemplateIcon = ({ icon, className, size, osFamily }) => {
  if (osFamily) {
    const Icon = getOsIcon(osFamily);
    return <span className={className} style={{ display: 'inline-flex' }}><Icon size={size} color="currentColor" /></span>
  }
  const Icon = TEMPLATE_ICONS[icon] || Monitor
  return <Icon className={className} size={size} />
}

const CircularGauge = ({ value, max, label, color = '#00A3FF' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const displayColor = pct < 60 ? color : pct < 80 ? '#FF6B00' : '#FF3366';
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={displayColor} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 6px ${displayColor}40)` }} />
      <text x="40" y="37" textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="700">
        {Math.round(pct)}%
      </text>
      <text x="40" y="50" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="500">
        {label}
      </text>
    </svg>
  );
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(1) + ' GB';
};

const formatUptime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatTimeAgo = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { isMobile, isTablet } = useBreakpoint()
  const theme = useThemeStore(s => s.theme)
  const navigate = useNavigate()
  const liveSession = useLiveSession(user)
  
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspace, setActiveWorkspace] = useState(null)
  const [stats, setStats] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const [templates, setTemplates] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateTab, setTemplateTab] = useState('All')

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    if (hour < 21) return 'Good evening'
    return 'Good night'
  }

  const activeCount = workspaces.filter(ws => ws.status === 'active' || ws.status === 'running').length

  const getSubtitle = () => {
    if (activeCount > 0) {
      return `You have ${activeCount} workspace${activeCount === 1 ? '' : 's'} running`
    }
    if (workspaces.length === 0 && !loading) {
      return "Launch a workspace to get started"
    }
    return "Your cloud workspace is ready"
  }

  // Phase 3 (context isolation audit) — this page's own workspace/
  // template summary never respected the account-context switcher
  // (Phase 6): it always showed personal data even while the navbar
  // said "University". Not a leak (it always defaulted to personal,
  // never showed another tenant's data), but genuinely incomplete —
  // fixed by attaching the same real context param the Workspaces/
  // Sessions pages already use, and re-fetching when context changes.
  const contextParam = useContextStore(s => s.contextParam())

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextParam])

  const fetchData = async () => {
    try {
      const ctx = useContextStore.getState().contextParam()
      const [wsRes, statsRes, settingsRes, tempRes, actRes] = await Promise.all([
        api.get('/workspaces/', { params: { context: ctx } }).catch(() => ({ data: {} })),
        api.get('/auth/profile/stats/').catch(() => ({ data: {} })),
        api.get('/settings/public/').catch(() => ({ data: {} })),
        api.get('/vms/templates/', { params: { context: ctx } }).catch(() => ({ data: {} })),
        api.get('/notifications/').catch(() => ({ data: {} }))
      ])
      
      const wsList = wsRes.data?.data || wsRes.data || []
      setWorkspaces(Array.isArray(wsList) ? wsList : [])
      
      const running = Array.isArray(wsList) ? wsList.find(ws => ws.status === 'active' || ws.status === 'running') : null
      setActiveWorkspace(running || null)
      
      setAnnouncement(settingsRes.data?.data?.system_announcement || '')
      setTemplates(tempRes.data?.data || tempRes.data || [])
      setActivities(actRes.data?.data || actRes.data || [])
      
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let interval;
    if (activeWorkspace) {
      const fetchStats = async () => {
        try {
          const res = await api.get(`/workspaces/${activeWorkspace.id}/stats/`);
          setStats(res.data);
        } catch (e) {
          console.error(e)
        }
      }
      fetchStats();
      interval = setInterval(fetchStats, 10000);
    }
    return () => clearInterval(interval);
  }, [activeWorkspace])

  const handleStop = async (ws) => {
    try {
      await api.post(`/workspaces/${ws.id}/stop/`)
      fetchData()
    } catch(e) {
      console.error(e)
    }
  }

  const subscription = user?.subscription || {}
  const planName = (subscription?.plan_name || 'free').replace('_', ' ')
  const hoursUsed = Math.round(subscription?.compute_hours_used || 0)
  const sessionsCount = 0 

  const filteredTemplates = (Array.isArray(templates) ? templates : []).filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(templateSearch.toLowerCase()) || 
                          (t.description && t.description.toLowerCase().includes(templateSearch.toLowerCase()))
    
    if (!matchesSearch) return false;
    
    if (templateTab === 'Desktops') return t.template_type === 'desktop'
    if (templateTab === 'Servers') return t.template_type === 'server'
    return true
  })

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 bg-canvas">
      <div className="w-10 h-10 rounded-full border-4 border-[#00A3FF]/20 border-t-[#00A3FF] animate-spin"></div>
      <p className="text-muted text-sm">Initializing dashboard...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-canvas p-6 sm:p-8 text-primary selection:bg-[#0066FF]/30 max-w-[1200px] mx-auto">
      <style>{`
        @keyframes ledFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      {announcement && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
          <p className="text-amber-400 text-sm m-0 font-medium">{announcement}</p>
        </div>
      )}

      {liveSession && (
        <div className="relative overflow-hidden rounded-2xl mb-6">
          <div className="absolute inset-0 rounded-2xl p-[1px]">
            <div className="absolute inset-0 rounded-2xl "
              style={{
                opacity: 'var(--led-opacity, 0.6)',
                filter: 'blur(var(--led-blur, 1px))',
                background: 'linear-gradient(90deg, #00FF87, #00A3FF, #6C63FF, #FF6B00, #00FF87)',
                backgroundSize: '300% 100%',
                animation: 'ledFlow 4s linear infinite',
              }}
            />
          </div>
          
          <div className="relative bg-card rounded-2xl p-5 m-[1px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[var(--status-online-dot, #16A34A)]/10 flex items-center justify-center">
                    <Radio size={22} className="text-[var(--status-online-text, #16A34A)]" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[var(--status-online-dot, #16A34A)] animate-pulse shadow-lg shadow-green-500/50" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-primary">
                      {liveSession.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--status-online-dot, #16A34A)]/10 text-[9px] font-bold text-[var(--status-online-text, #16A34A)] uppercase tracking-wider">
                      Live Now
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-1">
                    {liveSession.participant_count || 0} participants connected · Code: {liveSession.invite_code}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-canvas rounded-lg">
                  <span className="text-lg font-mono font-bold text-primary tracking-[0.2em]">
                    {liveSession.invite_code}
                  </span>
                </div>
                <button
                  onClick={() => navigate(`/host/session/${liveSession.id}`)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
                  <Eye size={15} />
                  Resume Monitoring
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1 — WELCOME BANNER */}
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Welcome Banner */}
        {isMobile ? (
          // Real, measured mobile bug (Ospace responsive audit): the desktop
          // banner reused verbatim on mobile measured 712px tall - 87.7% of
          // a 375x812 viewport - for just a heading, a 4-line-wrapping
          // subtitle, two buttons, and a decorative globe graphic that alone
          // accounted for a large share of that height plus the empty space
          // around it. This mobile-specific layout drops the globe, tightens
          // type sizes/spacing, and shortens the subtitle so the card is
          // proportionate to a small screen instead of reading as a
          // full-screen splash.
          <div className="relative bg-gradient-to-br from-indigo-500/10 to-blue-500/5 border border-indigo-500/20 rounded-2xl overflow-hidden shadow-sm" style={{ padding: '20px' }}>
            <h1 className="text-2xl font-extrabold text-primary tracking-tight mb-2 flex items-center flex-wrap gap-2">
              Welcome back, {user?.first_name || 'Student'}
              <Smile className="text-yellow-500" size={24} strokeWidth={2.5} />
            </h1>
            <p className="text-sm text-secondary mb-5 leading-relaxed">
              Your virtual lab is ready. Pick up where you left off.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => navigate('/workspaces', { state: { openCreate: true }})}
                className="w-full px-6 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center justify-center gap-2">
                <Monitor size={18} />
                Launch Workspace
              </button>
              <button onClick={() => setShowJoinModal(true)}
                className="w-full px-6 py-3 bg-canvas border border-border text-primary hover:bg-nav-hover rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2">
                <Video size={18} />
                Join Session
              </button>
            </div>
          </div>
        ) : (
        <div className="relative bg-gradient-to-br from-indigo-500/10 to-blue-500/5 border border-indigo-500/20 rounded-2xl p-6 sm:p-10 overflow-hidden shadow-sm">
        <div style={{ display: 'flex', flexDirection: 'row', gap: '0', minHeight: '220px' }}>

          <div style={{ flex: '0 0 60%', padding: '24px 4px', zIndex: 10 }}>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-primary tracking-tight mb-3 flex items-center flex-wrap gap-2">
              Welcome back, {user?.first_name || 'Student'}
              <Smile className="text-yellow-500 animate-bounce" size={36} strokeWidth={2.5} />
            </h1>
            <p className="text-lg text-secondary mb-8 max-w-xl leading-relaxed">
              Your virtual lab environment is ready. Pick up right where you left off or start a new session.
            </p>

            <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', width: 'auto', paddingTop: '16px' }}>
              <button onClick={() => navigate('/workspaces', { state: { openCreate: true }})}
                className="px-6 py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                <Monitor size={18} />
                Launch Workspace
              </button>
              <button onClick={() => setShowJoinModal(true)}
                className="px-6 py-3.5 bg-canvas border border-border text-primary hover:bg-nav-hover rounded-xl font-bold transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                <Video size={18} />
                Join Session
              </button>
            </div>
          </div>

          <div style={{ flex: '0 0 40%', display: 'flex', justifyContent: 'flex-end', overflow: 'hidden', opacity: 0.9, position: 'absolute', right: 0, top: 0, bottom: 0 }}>
            <NetworkGlobe size={260} />
          </div>
        </div>
        </div>
        )}
      </div>

      {/* SECTION 2 — STAT CARDS ROW */}
      <div className="mt-6 mb-8">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: '12px',
            padding: isMobile ? '12px' : '16px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '10px' : '16px'
          }}>
            <div style={{
              width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', borderRadius: '8px',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: theme === 'light' ? '#DBEAFE' : 'rgba(0, 102, 255, 0.1)',
              color: theme === 'light' ? '#2563EB' : '#0066FF'
            }}>
              <Monitor size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                ACTIVE
              </p>
              <p className="text-xl font-bold text-primary mt-0.5">
                {activeCount}
              </p>
            </div>
          </div>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: '12px',
            padding: isMobile ? '12px' : '16px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '10px' : '16px'
          }}>
            <div style={{
              width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', borderRadius: '8px',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: theme === 'light' ? '#DBEAFE' : 'rgba(0, 102, 255, 0.1)',
              color: theme === 'light' ? '#2563EB' : '#0066FF'
            }}>
              <Video size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                SESSIONS
              </p>
              <p className="text-xl font-bold text-primary mt-0.5">
                {sessionsCount}
              </p>
            </div>
          </div>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: '12px',
            padding: isMobile ? '12px' : '16px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '10px' : '16px'
          }}>
            <div style={{
              width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', borderRadius: '8px',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: theme === 'light' ? '#DBEAFE' : 'rgba(0, 102, 255, 0.1)',
              color: theme === 'light' ? '#2563EB' : '#0066FF'
            }}>
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                HOURS
              </p>
              <p className="text-xl font-bold text-primary mt-0.5">
                {hoursUsed}h
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3 — ACTIVE WORKSPACE (CONDITIONAL) */}
      {activeWorkspace && (
        <div className="relative overflow-hidden rounded-2xl mb-8">
          <div className="absolute inset-0 rounded-2xl p-[1px]">
            <div className="absolute inset-0 rounded-2xl "
              style={{
                opacity: 'var(--led-opacity, 0.6)',
                filter: 'blur(var(--led-blur, 1px))',
                background: 'linear-gradient(90deg, #00FF87, #00A3FF, #6C63FF, #FF6B00, #00FF87)',
                backgroundSize: '300% 100%',
                animation: 'ledFlow 4s linear infinite',
              }}
            />
          </div>
          <div className="relative bg-card rounded-2xl p-6 m-[1px]">
            <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--status-online-dot, #16A34A)]/10 flex items-center justify-center">
                  <Monitor size={20} className="text-[var(--status-online-text, #16A34A)]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-primary uppercase tracking-wide">
                    {activeWorkspace.name}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    {activeWorkspace.vm_template_details?.name} · {activeWorkspace.vm_template_details?.os}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 ml-4">
                  <div className="w-2 h-2 rounded-full bg-[var(--status-online-dot, #16A34A)] animate-pulse shadow-lg shadow-green-500/50" />
                  <span className="text-[10px] font-semibold text-[var(--status-online-text, #16A34A)] uppercase tracking-wider">
                    Online
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/workspace/${activeWorkspace.id}`)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0066FF] text-white text-xs font-semibold hover:bg-[#0052CC] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
                  <MonitorPlay size={14} />
                  Stream Desktop
                </button>
                <button
                  onClick={() => handleStop(activeWorkspace)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 active:scale-95 transition-all">
                  <Power size={14} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl p-4 text-center">
                <CircularGauge value={stats?.cpu_usage || 0} max={100} label="CPU" color="#00A3FF" />
                <p className="text-[10px] text-[#64748B] mt-2 uppercase tracking-wider font-medium">
                  {stats?.cpu_cores || 0} vCPU
                </p>
              </div>
              <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl p-4 text-center">
                <CircularGauge value={stats?.ram_used_mb || 0} max={stats?.ram_total_mb || 1} label="RAM" color="#6C63FF" />
                <p className="text-[10px] text-[#64748B] mt-2 uppercase tracking-wider font-medium">
                  {Math.round((stats?.ram_used_mb || 0) / 1024 * 10) / 10} / {Math.round((stats?.ram_total_mb || 0) / 1024)} GB
                </p>
              </div>
              <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl p-4 text-center">
                <CircularGauge value={stats?.disk_used_gb || 0} max={stats?.disk_total_gb || 1} label="SSD" color="#FF6B00" />
                <p className="text-[10px] text-[#64748B] mt-2 uppercase tracking-wider font-medium">
                  {stats?.disk_used_gb || 0} / {stats?.disk_total_gb || 0} GB
                </p>
              </div>
              <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col justify-center gap-3">
                <div className="flex items-center gap-2">
                  <ArrowUp size={12} className="text-[var(--status-online-text, #16A34A)]" />
                  <span className="text-xs text-secondary">
                    {formatBytes(stats?.network_out || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowDown size={12} className="text-[#00A3FF]" />
                  <span className="text-xs text-secondary">
                    {formatBytes(stats?.network_in || 0)}
                  </span>
                </div>
                <div className="border-t border-border pt-2 mt-1">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-faint" />
                    <span className="text-xs text-muted">
                      {formatUptime(stats?.uptime_seconds || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid Layout for Templates & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SECTION 4 — BROWSE TEMPLATES */}
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <h2 className="text-lg font-bold text-primary tracking-tight">
              Browse Templates
            </h2>
            <div className="flex gap-2">
              {['All', 'Desktops', 'Servers'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setTemplateTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 ${
                    templateTab === tab
                      ? 'bg-[#0066FF] text-white shadow-lg shadow-blue-500/30'
                      : 'bg-card text-secondary border border-border hover:border-slate-600 hover:text-[var(--text-primary)]'
                  }`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
          
          <div className="relative mb-5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={templateSearch}
              onChange={e => setTemplateSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-secondary placeholder-muted outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filteredTemplates.map(t => (
              <div key={t.id} className="group bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-5 hover:border-border-strong transition-all duration-300 cursor-pointer"
                onClick={() => navigate('/workspaces', { state: { openCreate: true, templateId: t.id } })}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      t.template_type === 'server' ? 'bg-[#FF6B00]/10' : 'bg-[#00A3FF]/10'
                    }`}>
                      <TemplateIcon
                        icon={t.icon}
                        osFamily={t.os_family}
                        className={t.template_type === 'server' ? 'text-[#FF6B00]' : 'text-[#00A3FF]'}
                        size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-primary">
                        {t.name}
                      </h3>
                      <p className="text-[11px] text-muted mt-0.5 truncate max-w-[120px]">
                        {t.os}
                      </p>
                    </div>
                  </div>
                  {t.is_real ? (
                    <span className="flex items-center gap-1 text-[9px] font-semibold text-[var(--status-online-text, #16A34A)] uppercase tracking-wider bg-[var(--status-online-dot, #16A34A)]/10 px-2 py-0.5 rounded-full shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--status-online-dot, #16A34A)]" />
                      Live
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold text-faint uppercase tracking-wider shrink-0">
                      Coming Soon
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div style={{
                    background: theme === 'light' ? '#F8FAFC' : 'rgba(15, 23, 42, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '6px 0',
                    textAlign: 'center'
                  }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px' }}>{t.cpu_cores}</p>
                    <p style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '8px' }}>vCPU</p>
                  </div>
                  <div style={{
                    background: theme === 'light' ? '#F8FAFC' : 'rgba(15, 23, 42, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '6px 0',
                    textAlign: 'center'
                  }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px' }}>{t.ram_gb}GB</p>
                    <p style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '8px' }}>RAM</p>
                  </div>
                  <div style={{
                    background: theme === 'light' ? '#F8FAFC' : 'rgba(15, 23, 42, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '6px 0',
                    textAlign: 'center'
                  }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px' }}>{t.storage_gb}GB</p>
                    <p style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '8px' }}>SSD</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted">
                    {t.price_per_hour > 0 ? `TZS ${t.price_per_hour.toLocaleString()}/hr` : 'Free'}
                  </span>
                  <span className="text-[10px] text-[#0066FF] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    Launch <Play size={10} />
                  </span>
                </div>
              </div>
            ))}
            {filteredTemplates.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted text-sm">
                No templates match your search.
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5 — RECENT ACTIVITY */}
        <div className="lg:col-span-1">
          <div className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-6 h-full">
            <h2 className="text-lg font-bold text-primary tracking-tight mb-5">
              Recent Activity
            </h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[var(--border-strong)] scrollbar-track-transparent">
              {activities.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      a.notification_type === 'workspace_ready' ? 'bg-[var(--status-online-dot, #16A34A)]'
                      : a.notification_type === 'session_invite' ? 'bg-[#00A3FF]'
                      : a.notification_type === 'payment_confirmed' ? 'bg-[#6C63FF]'
                      : a.notification_type === 'workspace_stopped' ? 'bg-[#FF6B00]'
                      : 'bg-slate-600'
                    }`} />
                    {i < activities.length - 1 && (
                      <div className="w-[1px] h-full min-h-[32px] bg-nav-hover mt-1" />
                    )}
                  </div>
                  <div className="flex-1 flex items-start justify-between pb-4">
                    <div>
                      <p className="text-sm text-secondary font-medium">{a.title}</p>
                      <p className="text-xs text-muted mt-0.5">{a.message}</p>
                    </div>
                    <span className="text-[10px] text-faint whitespace-nowrap ml-4 shrink-0">
                      {formatTimeAgo(a.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              
              {activities.length === 0 && (
                <div className="text-center py-8">
                  <Activity size={24} className="text-faint mx-auto mb-2" />
                  <p className="text-sm text-faint">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {showJoinModal && (
        <JoinByCodeModal onClose={() => setShowJoinModal(false)} />
      )}
    </div>
  )
}
