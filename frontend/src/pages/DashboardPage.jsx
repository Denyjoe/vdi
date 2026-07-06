import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Monitor, Video, Zap, Clock, Users, Play, ArrowUp, ArrowDown, 
  Search, Power, MonitorPlay, Activity, Eye, Radio,
  Cpu, HardDrive, Server, AppWindow, Code, Database, Compass, Terminal, Palette, Network, Shield, Smartphone, Globe, Film
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import api from '../services/api'
import useLiveSession from '../hooks/useLiveSession'
import JoinByCodeModal from '../components/shared/JoinByCodeModal'
import NetworkGlobe from '../components/shared/NetworkGlobe'

const TEMPLATE_ICONS = {
  Code: Code, Code2: Code, Compass: Compass, Terminal: Terminal, Palette: Palette,
  Network: Network, Database: Database, Shield: Shield, Cpu: Cpu,
  Monitor: Monitor, Globe: Globe, Film: Film, Smartphone: Smartphone,
  HardDrive: HardDrive, Server: Server, AppWindow: AppWindow
}

const TemplateIcon = ({ icon, className, size }) => {
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
      <text x="40" y="37" textAnchor="middle" fill="#E2E8F0" fontSize="14" fontWeight="700">
        {Math.round(pct)}%
      </text>
      <text x="40" y="50" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="500">
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

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [wsRes, statsRes, settingsRes, tempRes, actRes] = await Promise.all([
        api.get('/workspaces/').catch(() => ({ data: {} })),
        api.get('/auth/profile/stats/').catch(() => ({ data: {} })),
        api.get('/settings/public/').catch(() => ({ data: {} })),
        api.get('/vms/templates/').catch(() => ({ data: {} })),
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
  const sessionsCount = 0 // In a real app this would come from profile stats

  const filteredTemplates = (Array.isArray(templates) ? templates : []).filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(templateSearch.toLowerCase()) || 
                          (t.description && t.description.toLowerCase().includes(templateSearch.toLowerCase()))
    
    if (!matchesSearch) return false;
    
    if (templateTab === 'Desktops') return t.template_type === 'desktop'
    if (templateTab === 'Servers') return t.template_type === 'server'
    return true
  })

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 bg-[#080B10]">
      <div className="w-10 h-10 rounded-full border-4 border-[#00A3FF]/20 border-t-[#00A3FF] animate-spin"></div>
      <p className="text-slate-500 text-sm">Initializing dashboard...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080B10] p-6 sm:p-8 text-slate-200 selection:bg-[#0066FF]/30 max-w-[1200px] mx-auto">
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
            <div className="absolute inset-0 rounded-2xl opacity-60 blur-[1px]"
              style={{
                background: 'linear-gradient(90deg, #00FF87, #00A3FF, #6C63FF, #FF6B00, #00FF87)',
                backgroundSize: '300% 100%',
                animation: 'ledFlow 4s linear infinite',
              }}
            />
          </div>
          
          <div className="relative bg-[#0F131A] rounded-2xl p-5 m-[1px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[#00FF87]/10 flex items-center justify-center">
                    <Radio size={22} className="text-[#00FF87]" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#00FF87] animate-pulse shadow-lg shadow-green-500/50" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {liveSession.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#00FF87]/10 text-[9px] font-bold text-[#00FF87] uppercase tracking-wider">
                      Live Now
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {liveSession.participant_count || 0} participants connected · Code: {liveSession.invite_code}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-slate-900/50 rounded-lg">
                  <span className="text-lg font-mono font-bold text-white tracking-[0.2em]">
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
      <div className="relative overflow-hidden rounded-2xl bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 p-8 mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-[#6C63FF]/5 via-transparent to-[#00A3FF]/5 pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              {getGreeting()}, {user.first_name}
            </h1>
            <p className="text-sm text-slate-500 mt-2 max-w-md">
              {getSubtitle()}
            </p>
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-[#6C63FF]/10 border border-[#6C63FF]/20">
              <Zap size={12} className="text-[#6C63FF]" />
              <span className="text-[11px] font-semibold text-[#6C63FF] uppercase tracking-wider">
                {planName}
              </span>
            </div>
            <div className="flex gap-3 mt-5">
              <button 
                onClick={() => navigate('/workspaces', { state: { openCreate: true }})}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-95 transition-all duration-200 shadow-lg shadow-blue-500/20">
                <Monitor size={16} />
                Launch Workspace
              </button>
              <button 
                onClick={() => setShowJoinModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-transparent text-slate-300 text-sm font-semibold border border-slate-700/50 hover:border-slate-500 hover:text-white active:scale-95 transition-all duration-200">
                <Users size={16} />
                Join Session
              </button>
            </div>
          </div>
          <div className="hidden sm:block flex-shrink-0">
            <NetworkGlobe size={260} />
          </div>
        </div>
      </div>

      {/* SECTION 2 — STAT CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-xl p-4 flex items-center gap-4 hover:border-slate-700/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-[#00FF87]/10 flex items-center justify-center">
            <Monitor size={20} className="text-[#00FF87]" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
              ACTIVE WORKSPACES
            </p>
            <p className="text-xl font-bold text-white mt-0.5">
              {activeCount}
            </p>
          </div>
        </div>
        <div className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-xl p-4 flex items-center gap-4 hover:border-slate-700/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-[#00A3FF]/10 flex items-center justify-center">
            <Video size={20} className="text-[#00A3FF]" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
              SESSIONS JOINED
            </p>
            <p className="text-xl font-bold text-white mt-0.5">
              {sessionsCount}
            </p>
          </div>
        </div>
        <div className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-xl p-4 flex items-center gap-4 hover:border-slate-700/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center">
            <Clock size={20} className="text-[#6C63FF]" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
              HOURS THIS MONTH
            </p>
            <p className="text-xl font-bold text-white mt-0.5">
              {hoursUsed}h
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3 — ACTIVE WORKSPACE (CONDITIONAL) */}
      {activeWorkspace && (
        <div className="relative overflow-hidden rounded-2xl mb-8">
          <div className="absolute inset-0 rounded-2xl p-[1px]">
            <div className="absolute inset-0 rounded-2xl opacity-60 blur-[1px]"
              style={{
                background: 'linear-gradient(90deg, #00FF87, #00A3FF, #6C63FF, #FF6B00, #00FF87)',
                backgroundSize: '300% 100%',
                animation: 'ledFlow 4s linear infinite',
              }}
            />
          </div>
          <div className="relative bg-[#0F131A] rounded-2xl p-6 m-[1px]">
            <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00FF87]/10 flex items-center justify-center">
                  <Monitor size={20} className="text-[#00FF87]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                    {activeWorkspace.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeWorkspace.vm_template_details?.name} · {activeWorkspace.vm_template_details?.os}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 ml-4">
                  <div className="w-2 h-2 rounded-full bg-[#00FF87] animate-pulse shadow-lg shadow-green-500/50" />
                  <span className="text-[10px] font-semibold text-[#00FF87] uppercase tracking-wider">
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
              <div className="bg-slate-900/30 rounded-xl p-4 text-center">
                <CircularGauge value={stats?.cpu_usage || 0} max={100} label="CPU" color="#00A3FF" />
                <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wider font-medium">
                  {stats?.cpu_cores || 0} vCPU
                </p>
              </div>
              <div className="bg-slate-900/30 rounded-xl p-4 text-center">
                <CircularGauge value={stats?.ram_used_mb || 0} max={stats?.ram_total_mb || 1} label="RAM" color="#6C63FF" />
                <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wider font-medium">
                  {Math.round((stats?.ram_used_mb || 0) / 1024 * 10) / 10} / {Math.round((stats?.ram_total_mb || 0) / 1024)} GB
                </p>
              </div>
              <div className="bg-slate-900/30 rounded-xl p-4 text-center">
                <CircularGauge value={stats?.disk_used_gb || 0} max={stats?.disk_total_gb || 1} label="SSD" color="#FF6B00" />
                <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wider font-medium">
                  {stats?.disk_used_gb || 0} / {stats?.disk_total_gb || 0} GB
                </p>
              </div>
              <div className="bg-slate-900/30 rounded-xl p-4 flex flex-col justify-center gap-3">
                <div className="flex items-center gap-2">
                  <ArrowUp size={12} className="text-[#00FF87]" />
                  <span className="text-xs text-slate-400">
                    {formatBytes(stats?.network_out || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowDown size={12} className="text-[#00A3FF]" />
                  <span className="text-xs text-slate-400">
                    {formatBytes(stats?.network_in || 0)}
                  </span>
                </div>
                <div className="border-t border-slate-800/50 pt-2 mt-1">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-slate-600" />
                    <span className="text-xs text-slate-500">
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
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
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
                      : 'bg-[#0F131A] text-slate-400 border border-slate-800/50 hover:border-slate-600 hover:text-slate-200'
                  }`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
          
          <div className="relative mb-5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={templateSearch}
              onChange={e => setTemplateSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full bg-[#0F131A] border border-slate-800/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-[#0066FF]/50 transition-colors"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredTemplates.map(t => (
              <div key={t.id} className="group bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-5 hover:border-slate-700/50 transition-all duration-300 cursor-pointer"
                onClick={() => navigate('/workspaces', { state: { openCreate: true, templateId: t.id } })}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      t.template_type === 'server' ? 'bg-[#FF6B00]/10' : 'bg-[#00A3FF]/10'
                    }`}>
                      <TemplateIcon 
                        icon={t.icon}
                        className={t.template_type === 'server' ? 'text-[#FF6B00]' : 'text-[#00A3FF]'}
                        size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {t.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[120px]">
                        {t.os}
                      </p>
                    </div>
                  </div>
                  {t.is_real ? (
                    <span className="flex items-center gap-1 text-[9px] font-semibold text-[#00FF87] uppercase tracking-wider bg-[#00FF87]/10 px-2 py-0.5 rounded-full shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00FF87]" />
                      Live
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider shrink-0">
                      Coming Soon
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-slate-900/30 rounded-lg py-1.5 text-center">
                    <p className="text-[11px] font-bold text-white">{t.cpu_cores}</p>
                    <p className="text-[8px] text-slate-600 uppercase">vCPU</p>
                  </div>
                  <div className="bg-slate-900/30 rounded-lg py-1.5 text-center">
                    <p className="text-[11px] font-bold text-white">{t.ram_gb}GB</p>
                    <p className="text-[8px] text-slate-600 uppercase">RAM</p>
                  </div>
                  <div className="bg-slate-900/30 rounded-lg py-1.5 text-center">
                    <p className="text-[11px] font-bold text-white">{t.storage_gb}GB</p>
                    <p className="text-[8px] text-slate-600 uppercase">SSD</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-slate-500">
                    {t.price_per_hour > 0 ? `TZS ${t.price_per_hour.toLocaleString()}/hr` : 'Free'}
                  </span>
                  <span className="text-[10px] text-[#0066FF] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    Launch <Play size={10} />
                  </span>
                </div>
              </div>
            ))}
            {filteredTemplates.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 text-sm">
                No templates match your search.
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5 — RECENT ACTIVITY */}
        <div className="lg:col-span-1">
          <div className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-6 h-full">
            <h2 className="text-lg font-bold text-slate-100 tracking-tight mb-5">
              Recent Activity
            </h2>
            <div className="space-y-4">
              {activities.slice(0, 10).map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      a.notification_type === 'workspace_ready' ? 'bg-[#00FF87]'
                      : a.notification_type === 'session_invite' ? 'bg-[#00A3FF]'
                      : a.notification_type === 'payment_confirmed' ? 'bg-[#6C63FF]'
                      : a.notification_type === 'workspace_stopped' ? 'bg-[#FF6B00]'
                      : 'bg-slate-600'
                    }`} />
                    {i < activities.slice(0, 10).length - 1 && (
                      <div className="w-[1px] h-full min-h-[32px] bg-slate-800/50 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 flex items-start justify-between pb-4">
                    <div>
                      <p className="text-sm text-slate-300 font-medium">{a.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{a.message}</p>
                    </div>
                    <span className="text-[10px] text-slate-600 whitespace-nowrap ml-4 shrink-0">
                      {formatTimeAgo(a.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              
              {activities.length === 0 && (
                <div className="text-center py-8">
                  <Activity size={24} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No recent activity</p>
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
