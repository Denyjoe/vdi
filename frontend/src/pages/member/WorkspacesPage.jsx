import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Monitor, Plus, Cpu, MemoryStick, HardDrive,
  Search, Globe, Copy, Power, MonitorPlay,
  AlertCircle, Trash2, Loader2, Database, X,
  Terminal, AppWindow, Clock, Crown
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'
import useThemeStore from '../../store/themeStore'
import useBreakpoint from '../../hooks/useBreakpoint'
import CheckoutModal from '../../components/shared/CheckoutModal'
import PowerOnAnimation from '../../components/shared/PowerOnAnimation'

import OsIcon, { OS_ICONS } from '../../components/shared/OsIcon'

// Maps backend icon name → lucide-react component
const iconMap = {
  'Monitor': Monitor,
  'Cpu': Cpu,
  'Database': Database,
  'HardDrive': HardDrive,
  'Terminal': Terminal,
  'AppWindow': AppWindow
}

const TemplateIcon = ({ iconName, templateName, size = 20, color, className }) => {
  if (templateName && OS_ICONS[templateName]) {
    return <span className={className} style={{ display: 'inline-flex', color }}><OsIcon templateName={templateName} size={size} color="currentColor" /></span>
  }
  const IconComponent = iconMap[iconName] || Monitor
  return <IconComponent size={size} color={color} className={className} />
}

export default function WorkspacesPage() {
  const { user } = useAuthStore()
  const theme = useThemeStore(s => s.theme)
  const { isMobile, isTablet } = useBreakpoint()
  const [workspaces, setWorkspaces] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [launchingId, setLaunchingId] = useState(null)
  
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [wsName, setWsName] = useState('')
  const [templateTab, setTemplateTab] = useState('Desktops')
  
  const [search, setSearch] = useState('')
  const [activeFilter, setFilter] = useState('All Nodes')
  const [sortBy, setSortBy] = useState('Sort: Recent')
  const [wsStats, setWsStats] = useState({})

  // Per-template workspace access state — pricing/balance/subscription are
  // ALL scoped per (user, template), never platform-wide.
  const [templateAccess, setTemplateAccess] = useState({}) // { [templateId]: accessResult }
  const [accessModal, setAccessModal] = useState(null) // { workspaceId, template }
  const [accessModalHours, setAccessModalHours] = useState(1)
  const [accessModalCustomHours, setAccessModalCustomHours] = useState('1')
  const [buyHoursTarget, setBuyHoursTarget] = useState(null) // { workspaceId, template, hours, priceTzs }
  const [subscribeTarget, setSubscribeTarget] = useState(null) // { workspaceId, template }

  const navigate = useNavigate()
  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchAccessFor = async (templateId) => {
    try {
      const res = await api.get('/workspaces/access-check/', { params: { template_id: templateId } })
      if (res.data?.success) {
        setTemplateAccess(prev => ({ ...prev, [templateId]: res.data.data }))
        return res.data.data
      }
    } catch (e) {
      console.error('Failed to fetch access for template', templateId, e)
    }
    return null
  }

  const fetchWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces/')
      const list = Array.isArray(res.data) ? res.data : res.data?.data || []
      setWorkspaces(list)
      // Real per-template access status for every workspace's own template,
      // so each card can show its genuine balance/subscription state.
      const templateIds = [...new Set(list.map(w => w.vm_template_details?.id).filter(Boolean))]
      templateIds.forEach(fetchAccessFor)
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/vms/templates/')
      const list = res.data?.data || []
      setTemplates(list)
      // Per-template access status shown on each template card — fetched
      // for every real template so the picker never shows a stale/guessed
      // price or balance.
      list.filter(t => t.is_real).forEach(t => fetchAccessFor(t.id))
    } catch(e) {
      console.error(e)
    }
  }

  useEffect(() => {
    const fetchStats = async () => {
      const running = workspaces.filter(
        w => w.status === 'active' || w.status === 'running'
      )
      for (const ws of running) {
        try {
          const res = await api.get(`/workspaces/${ws.id}/stats/`)
          setWsStats(prev => ({
            ...prev,
            [ws.id]: res.data
          }))
        } catch(e) {}
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [workspaces])

  // fetchWorkspaces only ever ran once, on mount — a workspace created or
  // removed elsewhere (another tab, the launch flow completing async
  // provisioning) never appeared here without a manual page reload. Poll
  // the actual list on the same 10s cadence as the stats above.
  useEffect(() => {
    const interval = setInterval(fetchWorkspaces, 10000)
    return () => clearInterval(interval)
  }, [])

  const openCreateModal = async () => {
    fetchTemplates()
    setShowCreate(true)
    setSelectedTemplate(null)
    setWsName('')
  }

  const handleCreate = async () => {
    if (!selectedTemplate || !wsName.trim()) return;
    try {
      setCreating(true);

      // Check access BEFORE creating anything, so we know the real
      // per-template state and never surprise the user with a charge.
      const access = await fetchAccessFor(selectedTemplate.id);

      const res = await api.post('/workspaces/create/', {
        vm_template: selectedTemplate.id,
        name: wsName.trim(),
      });
      const wsData = res.data?.data || res.data;
      const wsId = wsData?.id;

      setShowCreate(false);
      setWsName('');
      setSelectedTemplate(null);

      if (wsId && access && !access.can_launch) {
        setAccessModal({ workspaceId: wsId, template: selectedTemplate });
      } else if (wsId) {
        try {
          const launchRes = await api.post(`/workspaces/${wsId}/launch/`);
          notifyLaunchOutcome(launchRes.data);
        } catch(e) {
          console.error('Launch failed:', e);
        }
      }
      fetchWorkspaces();
    } catch(e) {
      console.error('Create failed:', e);
      alert('Failed to create workspace: ' + (e.response?.data?.message || e.message));
    } finally {
      setCreating(false);
    }
  };

  // Launching is honest by construction — the backend already refused with
  // 402 before any VM was touched if payment was required (see catch below).
  // This just makes the balance/subscription case explicit instead of
  // silent, so usage never looks indistinguishable from a skipped charge.
  const notifyLaunchOutcome = (data) => {
    if (data?.access_reason === 'hours_balance') {
      toast.success(`Launched — ${data.hours_remaining}h remaining on this template`)
    } else if (data?.access_reason === 'subscription') {
      toast.success('Launched — included in your template subscription')
    }
  }

  const attemptLaunch = async (workspaceId) => {
    try {
      setLaunchingId(workspaceId)
      const res = await api.post(`/workspaces/${workspaceId}/launch/`)
      notifyLaunchOutcome(res.data)
      fetchWorkspaces()
      return true
    } catch(e) {
      console.error('Launch failed:', e)
      return false
    } finally {
      setLaunchingId(null)
    }
  }

  const handleLaunch = async (ws) => {
    try {
      setLaunchingId(ws.id)
      const res = await api.post(`/workspaces/${ws.id}/launch/`)
      notifyLaunchOutcome(res.data)
      fetchWorkspaces()
    } catch(e) {
      if (e.response?.status === 402 && e.response?.data?.requires_payment) {
        setAccessModal({ workspaceId: ws.id, template: ws.vm_template_details })
      } else {
        console.error(e)
      }
    } finally {
      setLaunchingId(null)
    }
  }

  const handleBuyHoursSuccess = async () => {
    const target = buyHoursTarget
    setBuyHoursTarget(null)
    setAccessModal(null)
    if (target?.template?.id) fetchAccessFor(target.template.id)
    if (target?.workspaceId) await attemptLaunch(target.workspaceId)
    fetchWorkspaces()
  }

  const handleSubscribeSuccess = async () => {
    const target = subscribeTarget
    setSubscribeTarget(null)
    setAccessModal(null)
    if (target?.template?.id) fetchAccessFor(target.template.id)
    if (target?.workspaceId) await attemptLaunch(target.workspaceId)
    fetchWorkspaces()
  }

  const handleStop = async (ws) => {
    try {
      await api.post(`/workspaces/${ws.id}/stop/`)
      fetchWorkspaces()
      if (ws.vm_template_details?.id) fetchAccessFor(ws.vm_template_details.id)
    } catch(e) {
      console.error(e)
    }
  }

  const handleDelete = async (ws) => {
    if (!window.confirm(
      'Permanently delete this workspace? This will destroy the virtual machine and all its data. This cannot be undone.'
    )) return;
    
    try {
      await api.post(`/workspaces/${ws.id}/delete/`);
      fetchWorkspaces();
    } catch(e) {
      alert('Failed to delete: ' + (e.response?.data?.message || e.message));
    }
  };

  const copyToClipboard = (text) => {
    if (text) navigator.clipboard.writeText(text)
  }

  const getCountForFilter = (filter) => {
    if (filter === 'All Nodes') return workspaces.length
    if (filter === 'Online') return workspaces.filter(w => w.status === 'active' || w.status === 'running').length
    if (filter === 'Offline') return workspaces.filter(w => w.status === 'stopped').length
    if (filter === 'Provisioning') return workspaces.filter(w => w.status === 'provisioning').length
    return 0
  }

  // Derive top stats
  const totalCount = workspaces.length
  const onlineCount = workspaces.filter(w => w.status === 'active' || w.status === 'running').length
  const totalCores = workspaces.reduce((sum, w) => sum + (w.vm_template_details?.cpu_cores || 0), 0)
  const totalRam = workspaces.reduce((sum, w) => sum + (w.vm_template_details?.ram_gb || 0), 0)

  // Filter list
  let filtered = workspaces.filter(w => w.name.toLowerCase().includes(search.toLowerCase()))
  if (activeFilter === 'Online') {
    filtered = filtered.filter(w => w.status === 'active' || w.status === 'running')
  } else if (activeFilter === 'Offline') {
    filtered = filtered.filter(w => w.status === 'stopped')
  } else if (activeFilter === 'Provisioning') {
    filtered = filtered.filter(w => w.status === 'provisioning')
  }
  
  if (sortBy === 'Sort: Name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortBy === 'Sort: Status') {
    filtered.sort((a, b) => a.status.localeCompare(b.status))
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 bg-canvas">
      <Loader2 className="w-10 h-10 text-[#00A3FF] animate-spin" />
      <p className="text-muted text-sm">Loading infrastructure...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-canvas p-8 text-primary selection:bg-[#0066FF]/30">
      <style>{`
        @keyframes ledFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulseSubtle {
          0%, 100% { opacity: 1; border-color: rgba(0,163,255,0.4); }
          50% { opacity: 0.8; border-color: rgba(0,163,255,0.1); }
        }
        .led-strip-animation {
          background: linear-gradient(
            90deg, 
            #00FF87, #00A3FF, #6C63FF, 
            #FF6B00, #00FF87
          );
          background-size: 300% 100%;
          animation: ledFlow 4s linear infinite;
        }
        .animate-pulse-subtle {
          animation: pulseSubtle 2s ease-in-out infinite;
        }
      `}</style>

      <div className="border-b border-border transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: isMobile ? 'flex-start' : 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '16px' : '16px', padding: isMobile ? '24px 0' : '24px 0 16px 0' }}>
            <div>
              <h1 className="text-2xl font-bold text-primary tracking-tight">My Workspaces</h1>
              <p className="text-sm text-secondary mt-1">Manage and access your cloud development environments</p>
            </div>
            <div className="relative w-full md:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search workspaces..."
                className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-secondary placeholder-muted outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', paddingBottom: '16px', gap: '16px' }}>
            {/* Real, measured mobile bug (Ospace responsive audit): this
                row used to be flex-nowrap + overflow-x:auto with the
                native scrollbar hidden (scrollbarWidth:'none') — content
                genuinely overflowed its container (442px in a 239px box)
                with zero visible affordance, so "Offline"/"Provisioning"
                were undiscoverable by scrolling blind. On mobile it now
                wraps onto multiple lines instead, so every filter is
                always visible; desktop keeps the original single-row
                scroll behavior unchanged. */}
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              overflowX: isMobile ? 'visible' : 'auto',
              paddingBottom: isMobile ? '0' : '0',
              scrollbarWidth: isMobile ? undefined : 'none',
            }}>
              {['All Nodes', 'Online', 'Offline', 'Provisioning'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 whitespace-nowrap ${
                    activeFilter === tab ? 'bg-[#2563EB] text-[#FFFFFF] shadow-md border border-[#2563EB]' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab}
                  <span className="ml-1.5 text-[10px] opacity-60">({getCountForFilter(tab)})</span>
                </button>
              ))}
            </div>
            <button onClick={openCreateModal} className="w-full md:w-64 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-md shadow-blue-500/20 shrink-0">
              <Plus size={16} />
              New Workspace
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-accent-primary animate-spin mb-4" />
            <p className="text-muted font-medium">Loading your workspaces...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="bg-card/50 border border-border rounded-2xl py-12 px-6 flex items-center justify-center text-center shadow-sm">
            <p className="text-muted text-sm font-medium">No workspaces yet. Create your first cloud environment to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-lg font-bold text-primary">No matching workspaces</h3>
            <p className="text-muted mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
            {filtered.map(ws => {
              const isRunning = ws.status === 'active' || ws.status === 'running'
              const isProvisioning = ws.status === 'provisioning'
              const isOffline = ws.status === 'stopped'
              
              if (isRunning) {
                const cpuUsage = wsStats[ws.id]?.cpu_usage || 0
                const ramUsage = wsStats[ws.id]?.ram_total_mb ? Math.round((wsStats[ws.id].ram_used_mb / wsStats[ws.id].ram_total_mb) * 100) : 0
                
                return (
                  <div key={ws.id} className="relative group overflow-hidden rounded-2xl">
                    <div className="absolute inset-0 rounded-2xl p-[1px] led-strip-animation"></div>
                    <div className="relative bg-card rounded-2xl p-5 m-[1px] h-full flex flex-col">
                      
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${isRunning ? 'bg-[#00FF87]/10' : isProvisioning ? 'bg-[#00A3FF]/10' : 'bg-nav-hover'} flex items-center justify-center shrink-0`}>
                            <TemplateIcon iconName={ws.vm_template_details?.icon} templateName={ws.vm_template_details?.name} size={20} className={isRunning ? "text-[#00FF87]" : isProvisioning ? "text-[#00A3FF]" : "text-secondary"} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-primary uppercase tracking-wide truncate">
                              {ws.name}
                            </h3>
                            <p className="text-xs text-muted mt-0.5 truncate">
                              {ws.vm_template_details?.os || 'Unknown OS'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-2 h-2 rounded-full bg-[#00FF87] animate-pulse shadow-lg shadow-green-500/50" />
                          <span className="text-[10px] font-semibold text-[#00FF87] uppercase tracking-wider">
                            Online
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-4 px-3 py-1.5 bg-canvas rounded-lg w-fit">
                        <Globe size={12} className="text-muted" />
                        <span className="text-xs font-mono text-secondary">
                          {ws.vm_details?.ip_address || '0.0.0.0'}
                        </span>
                        <button onClick={() => copyToClipboard(ws.vm_details?.ip_address)} className="text-faint hover:text-secondary active:scale-90 transition-all">
                          <Copy size={11} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div style={{
                          background: theme === 'light' ? '#F8FAFC' : 'rgba(15, 23, 42, 0.3)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '10px',
                          textAlign: 'center'
                        }}>
                          <Cpu size={14} className="text-[#00A3FF] mx-auto mb-1" />
                          <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '12px' }}>{ws.vm_template_details?.cpu_cores || 0}</p>
                          <p style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '9px' }}>vCPU</p>
                        </div>
                        <div style={{
                          background: theme === 'light' ? '#F8FAFC' : 'rgba(15, 23, 42, 0.3)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '10px',
                          textAlign: 'center'
                        }}>
                          <MemoryStick size={14} className="text-[#6C63FF] mx-auto mb-1" />
                          <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '12px' }}>{ws.vm_template_details?.ram_gb || 0} GB</p>
                          <p style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '9px' }}>RAM</p>
                        </div>
                        <div style={{
                          background: theme === 'light' ? '#F8FAFC' : 'rgba(15, 23, 42, 0.3)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '10px',
                          textAlign: 'center'
                        }}>
                          <HardDrive size={14} className="text-[#FF6B00] mx-auto mb-1" />
                          <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '12px' }}>{ws.vm_template_details?.storage_gb || 0} GB</p>
                          <p style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '9px' }}>SSD</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mb-5 flex-1">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted font-medium">CPU Utilization</span>
                            <span className="text-[10px] font-bold text-[#00A3FF]">{cpuUsage}%</span>
                          </div>
                          <div className="h-1.5 bg-nav-hover rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${cpuUsage}%`, background: 'linear-gradient(90deg, #00A3FF, #00FF87)' }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted font-medium">RAM Footprint</span>
                            <span className="text-[10px] font-bold text-[#6C63FF]">{ramUsage}%</span>
                          </div>
                          <div className="h-1.5 bg-nav-hover rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${ramUsage}%`, background: 'linear-gradient(90deg, #6C63FF, #00FF87)' }} />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-auto">
                        <button onClick={() => handleStop(ws)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 active:scale-95 transition-all duration-200">
                          <Power size={14} /> Shut down
                        </button>
                        <button onClick={() => navigate(`/workspace/${ws.id}`)} className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0066FF] text-white text-xs font-semibold hover:bg-[#0052CC] active:scale-95 transition-all duration-200 shadow-lg shadow-blue-500/20">
                          <MonitorPlay size={14} /> Stream Desktop
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }
              
              if (isProvisioning) {
                return (
                  <div key={ws.id} className="bg-card border border-[#00A3FF]/40 rounded-2xl p-5 flex flex-col animate-pulse-subtle">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#00A3FF]/10 flex items-center justify-center shrink-0">
                          <TemplateIcon iconName={ws.vm_template_details?.icon} templateName={ws.vm_template_details?.name} size={20} className="text-[#00A3FF]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-primary uppercase tracking-wide truncate">{ws.name}</h3>
                          <p className="text-xs text-muted mt-0.5 truncate">{ws.vm_template_details?.os}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-[#00A3FF] animate-pulse" />
                        <span className="text-[10px] font-semibold text-[#00A3FF] uppercase tracking-wider">Provisioning</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4 px-3 py-1.5 bg-canvas rounded-lg w-fit">
                      <Globe size={12} className="text-faint" />
                      <span className="text-xs font-mono text-muted">—.—.—.—</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-canvas/30 rounded-lg p-2.5 text-center opacity-70">
                        <Cpu size={14} className="text-muted mx-auto mb-1" />
                        <p className="text-xs font-bold text-secondary">{ws.vm_template_details?.cpu_cores}</p>
                        <p className="text-[9px] text-faint uppercase">vCPU</p>
                      </div>
                      <div className="bg-canvas/30 rounded-lg p-2.5 text-center opacity-70">
                        <MemoryStick size={14} className="text-muted mx-auto mb-1" />
                        <p className="text-xs font-bold text-secondary">{ws.vm_template_details?.ram_gb} GB</p>
                        <p className="text-[9px] text-faint uppercase">RAM</p>
                      </div>
                      <div className="bg-canvas/30 rounded-lg p-2.5 text-center opacity-70">
                        <HardDrive size={14} className="text-muted mx-auto mb-1" />
                        <p className="text-xs font-bold text-secondary">{ws.vm_template_details?.storage_gb} GB</p>
                        <p className="text-[9px] text-faint uppercase">SSD</p>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center items-center py-6 mt-auto">
                      <PowerOnAnimation size={64} statusText={ws.vm_details?.notes || 'Starting workspace...'} />
                    </div>
                  </div>
                )
              }
              
              // OFFLINE
              return (
                <div key={ws.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/10 flex items-center justify-center shrink-0">
                        <TemplateIcon iconName={ws.vm_template_details?.icon} templateName={ws.vm_template_details?.name} size={20} className="text-[#FF6B00]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-primary uppercase tracking-wide truncate">{ws.name}</h3>
                        <p className="text-xs text-muted mt-0.5 truncate">{ws.vm_template_details?.os}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-[#FF6B00]" />
                      <span className="text-[10px] font-semibold text-[#FF6B00] uppercase tracking-wider">Offline</span>
                    </div>
                  </div>

                  {ws.idle_warning && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 ${
                      ws.idle_warning.level === 'final_warning' ? 'bg-red-500/10 border border-red-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'
                    }`}>
                      <AlertCircle size={13} className={ws.idle_warning.level === 'final_warning' ? 'text-red-400' : 'text-yellow-400'} />
                      <span className={`text-[10px] font-semibold ${ws.idle_warning.level === 'final_warning' ? 'text-red-400' : 'text-yellow-400'}`}>
                        ⚠ Idle — will be deleted in {ws.idle_warning.days_remaining} day{ws.idle_warning.days_remaining === 1 ? '' : 's'} unless used
                      </span>
                    </div>
                  )}

                  {(() => {
                    const acc = templateAccess[ws.vm_template_details?.id]
                    if (!acc) return null
                    if (acc.reason === 'subscription') {
                      return (
                        <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg bg-[#6C63FF]/10 border border-[#6C63FF]/20 w-fit">
                          <Crown size={12} className="text-[#6C63FF]" />
                          <span className="text-[10px] font-semibold text-[#6C63FF]">Unlimited — subscribed</span>
                        </div>
                      )
                    }
                    if (acc.reason === 'hours_balance') {
                      return (
                        <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 w-fit">
                          <Clock size={12} className="text-emerald-400" />
                          <span className="text-[10px] font-semibold text-emerald-400">{acc.hours_remaining}h remaining</span>
                        </div>
                      )
                    }
                    return (
                      <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/20 w-fit">
                        <AlertCircle size={12} className="text-[#FF6B00]" />
                        <span className="text-[10px] font-semibold text-[#FF6B00]">
                          Out of hours — TZS {Number(acc.price_per_hour).toLocaleString()}/hr
                        </span>
                      </div>
                    )
                  })()}

                  <div className="flex items-center gap-2 mb-4 px-3 py-1.5 bg-canvas rounded-lg w-fit">
                    <Globe size={12} className="text-faint" />
                    <span className="text-xs font-mono text-muted">{ws.vm_details?.ip_address || '—.—.—.—'}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-canvas/30 rounded-lg p-2.5 text-center opacity-70">
                      <Cpu size={14} className="text-muted mx-auto mb-1" />
                      <p className="text-xs font-bold text-secondary">{ws.vm_template_details?.cpu_cores}</p>
                      <p className="text-[9px] text-faint uppercase">vCPU</p>
                    </div>
                    <div className="bg-canvas/30 rounded-lg p-2.5 text-center opacity-70">
                      <MemoryStick size={14} className="text-muted mx-auto mb-1" />
                      <p className="text-xs font-bold text-secondary">{ws.vm_template_details?.ram_gb} GB</p>
                      <p className="text-[9px] text-faint uppercase">RAM</p>
                    </div>
                    <div className="bg-canvas/30 rounded-lg p-2.5 text-center opacity-70">
                      <HardDrive size={14} className="text-muted mx-auto mb-1" />
                      <p className="text-xs font-bold text-secondary">{ws.vm_template_details?.storage_gb} GB</p>
                      <p className="text-[9px] text-faint uppercase">SSD</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2 bg-canvas/30 rounded-lg mb-4 flex-1">
                    <AlertCircle size={13} className="text-faint" />
                    <span className="text-[10px] uppercase tracking-wider text-faint font-medium">Hypervisor Suspended</span>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => handleDelete(ws)} className="px-4 py-2.5 rounded-xl bg-nav-hover border border-border-strong text-muted hover:text-red-400 hover:border-red-500/30 active:scale-95 transition-all duration-200">
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => handleLaunch(ws)} disabled={launchingId === ws.id} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00] text-xs font-semibold hover:bg-[#FF6B00]/20 active:scale-95 transition-all duration-200">
                      {launchingId === ws.id ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                      Power up
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SECTION 8 — CREATE WORKSPACE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-primary">Launch New Workspace</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted hover:text-primary transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="mb-6">
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Workspace Name</label>
                <input
                  type="text"
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  placeholder="e.g. My Ubuntu Dev Machine"
                  className="w-full bg-canvas border border-border rounded-xl px-4 py-3 text-primary placeholder-muted outline-none focus:border-blue-500 transition-colors"
                  maxLength={50}
                />
              </div>

              <div className="mb-6">
                <div className="flex gap-2 mb-4">
                  {['Desktops', 'Servers'].map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setTemplateTab(tab)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        templateTab === tab ? 'bg-[var(--bg-elevated)] text-primary' : 'text-muted hover:text-secondary'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                  {templates.filter(t => t.template_type === (templateTab === 'Desktops' ? 'desktop' : 'server')).map(template => {
                    const isSelected = selectedTemplate?.id === template.id
                    
                    return (
                      <div 
                        key={template.id}
                        onClick={() => template.is_real && setSelectedTemplate(template)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                          !template.is_real 
                            ? 'bg-canvas border-border-subtle opacity-60 cursor-not-allowed' 
                            : isSelected 
                              ? 'bg-[#0066FF]/10 border-[#0066FF]' 
                              : 'bg-canvas border-border hover:border-slate-600'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-[#0066FF]/20 text-[#00A3FF]' : 'bg-nav-hover text-secondary'}`}>
                            <TemplateIcon iconName={template.icon} templateName={template.name} size={20} />
                          </div>
                          {!template.is_real && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted bg-canvas px-2 py-1 rounded">Coming Soon</span>
                          )}
                        </div>
                        <h4 className="font-bold text-primary mb-1">{template.name}</h4>
                        <p className="text-xs text-secondary mb-3">{template.cpu_cores} vCPU · {template.ram_gb}GB RAM · {template.storage_gb}GB</p>
                        <div className="text-xs font-semibold text-secondary">
                          {(() => {
                            const acc = templateAccess[template.id]
                            if (!acc) return `TZS ${Number(template.price_per_hour || 0).toLocaleString()}/hr`
                            if (acc.reason === 'subscription') return 'Included in your subscription'
                            if (acc.reason === 'hours_balance') return `${acc.hours_remaining}h remaining`
                            return `TZS ${Number(acc.price_per_hour).toLocaleString()}/hr or TZS ${Number(acc.price_per_month).toLocaleString()}/mo`
                          })()}
                        </div>
                        
                        {isSelected && (
                          <div className="absolute top-0 right-0 w-8 h-8 bg-[#0066FF] rounded-bl-xl flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-border flex justify-end gap-3 bg-black/20">
              <button 
                onClick={() => setShowCreate(false)}
                className="px-5 py-2.5 rounded-xl text-secondary text-sm font-semibold hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!selectedTemplate || !wsName.trim() || creating}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${
                  (!selectedTemplate || !wsName.trim() || creating)
                    ? 'bg-[var(--bg-elevated)] text-muted cursor-not-allowed shadow-none'
                    : 'bg-[#0066FF] text-white hover:bg-[#0052CC] active:scale-95 shadow-blue-500/20'
                }`}
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <MonitorPlay size={16} />}
                Create & Launch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access required — real per-template choice: buy hours or subscribe */}
      {accessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setAccessModal(null); }}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-primary">You're out of hours</h2>
                <p className="text-xs text-muted mt-0.5">for {accessModal.template?.name}</p>
              </div>
              <button onClick={() => setAccessModal(null)} className="text-muted hover:text-primary transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Buy hours</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[1, 2, 3].map(h => (
                  <button key={h}
                    onClick={() => { setAccessModalHours(h); setAccessModalCustomHours(h.toString()); }}
                    className="p-3 rounded-xl border text-center"
                    style={{
                      border: accessModalHours === h ? '2px solid var(--accent-primary, #0066FF)' : '1px solid var(--border-color)',
                      background: accessModalHours === h ? 'var(--accent-primary-soft, rgba(0,102,255,0.1))' : 'var(--bg-input)',
                    }}>
                    <div className="text-lg font-bold text-primary">{h}h</div>
                    <div className="text-[11px] text-muted">
                      TZS {(h * (templateAccess[accessModal.template?.id]?.price_per_hour || accessModal.template?.price_per_hour || 0)).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
              <input type="number" min="0.5" step="0.5" value={accessModalCustomHours}
                onChange={e => { setAccessModalCustomHours(e.target.value); setAccessModalHours(parseFloat(e.target.value) || 0); }}
                className="w-full bg-canvas border border-border rounded-xl px-4 py-2.5 text-primary outline-none focus:border-blue-500 transition-colors mb-4"
                placeholder="Custom hours"
              />

              <button
                onClick={() => setBuyHoursTarget({
                  workspaceId: accessModal.workspaceId,
                  template: accessModal.template,
                  hours: accessModalHours,
                  priceTzs: accessModalHours * (templateAccess[accessModal.template?.id]?.price_per_hour || accessModal.template?.price_per_hour || 0),
                })}
                disabled={!accessModalHours || accessModalHours <= 0}
                className="w-full py-3 rounded-xl bg-[#0066FF] text-white font-semibold hover:bg-[#0052CC] active:scale-95 transition-all disabled:opacity-40 mb-3"
              >
                Buy {accessModalHours || 0}h — TZS {(accessModalHours * (templateAccess[accessModal.template?.id]?.price_per_hour || accessModal.template?.price_per_hour || 0)).toLocaleString()}
              </button>

              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                onClick={() => setSubscribeTarget({ workspaceId: accessModal.workspaceId, template: accessModal.template })}
                className="w-full py-3 rounded-xl border border-[#6C63FF]/40 text-[#6C63FF] font-semibold hover:bg-[#6C63FF]/10 active:scale-95 transition-all"
              >
                Subscribe monthly — TZS {Number(templateAccess[accessModal.template?.id]?.price_per_month || accessModal.template?.price_per_month || 0).toLocaleString()}/mo, unlimited
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hours purchase payment */}
      {buyHoursTarget && (
        <CheckoutModal
          isOpen={true}
          onClose={() => setBuyHoursTarget(null)}
          onSuccess={handleBuyHoursSuccess}
          title={`Buy ${buyHoursTarget.hours}h — ${buyHoursTarget.template?.name}`}
          amountTzs={buyHoursTarget.priceTzs}
          endpoint="/workspaces/purchase-hours/"
          extraPayload={{ template_id: buyHoursTarget.template?.id, hours: buyHoursTarget.hours }}
          successMessage="Hours added!"
        />
      )}

      {/* Template subscription payment */}
      {subscribeTarget && (
        <CheckoutModal
          isOpen={true}
          onClose={() => setSubscribeTarget(null)}
          onSuccess={handleSubscribeSuccess}
          title={`Subscribe — ${subscribeTarget.template?.name}`}
          amountTzs={templateAccess[subscribeTarget.template?.id]?.price_per_month || subscribeTarget.template?.price_per_month}
          endpoint="/workspaces/subscribe-template/"
          extraPayload={{ template_id: subscribeTarget.template?.id }}
          successMessage="Unlimited access active!"
        />
      )}

    </div>
  )
}
