import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Monitor, Plus, Cpu, MemoryStick, HardDrive, 
  Search, Globe, Copy, Power, MonitorPlay, 
  AlertCircle, Trash2, Loader2, Database, X 
} from 'lucide-react'
import api from '../../services/api'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'
import useThemeStore from '../../store/themeStore'

// Maps backend icon name → lucide-react component
const iconMap = {
  'Monitor': Monitor,
  'Cpu': Cpu,
  'Database': Database,
  'HardDrive': HardDrive
}

const getTemplateIcon = (iconName) => iconMap[iconName] || Monitor

export default function WorkspacesPage() {
  const { user } = useAuthStore()
  const theme = useThemeStore(s => s.theme)
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
  
  const navigate = useNavigate()
  useEffect(() => { 
    fetchWorkspaces() 
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces/')
      setWorkspaces(Array.isArray(res.data) ? res.data : res.data?.data || [])
    } catch(e) { 
      console.error(e) 
    } finally { 
      setLoading(false) 
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/vms/templates/')
      setTemplates(res.data?.data || [])
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
      const res = await api.post('/workspaces/create/', {
        vm_template: selectedTemplate.id,
        name: wsName.trim(),
      });
      const wsData = res.data?.data || res.data;
      const wsId = wsData?.id;
      if (wsId) {
        try {
          await api.post(`/workspaces/${wsId}/launch/`);
        } catch(e) {
          console.error('Launch failed:', e);
        }
      }
      setShowCreate(false);
      setWsName('');
      setSelectedTemplate(null);
      fetchWorkspaces();
    } catch(e) {
      console.error('Create failed:', e);
      alert('Failed to create workspace: ' + (e.response?.data?.message || e.message));
    } finally {
      setCreating(false);
    }
  };

  const handleLaunch = async (ws) => {
    try {
      setLaunchingId(ws.id)
      await api.post(`/workspaces/${ws.id}/launch/`)
      fetchWorkspaces()
    } catch(e) {
      console.error(e)
    } finally {
      setLaunchingId(null)
    }
  }

  const handleStop = async (ws) => {
    try {
      await api.post(`/workspaces/${ws.id}/stop/`)
      fetchWorkspaces()
    } catch(e) { 
      console.error(e) 
    }
  }

  const handleDelete = async (ws) => {
    if (!window.confirm('Delete this workspace? This cannot be undone.')) return
    try {
      await api.post(`/workspaces/${ws.id}/delete/`)
      fetchWorkspaces()
    } catch(e) {
      console.error(e)
    }
  }

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

      <div className="max-w-[1200px] mx-auto">
        
        {/* SECTION 1 — PAGE HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">
              My Workspaces
            </h1>
            <p className="text-sm text-muted mt-1">
              Manage your cloud desktops and servers
            </p>
          </div>
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-95 transition-all duration-200 shadow-lg shadow-blue-500/20">
            <Plus size={18} />
            New Workspace
          </button>
        </div>

        {/* SECTION 2 — TOP STATS HEADER BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-card/70 backdrop-blur-sm border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#00A3FF]/10 flex items-center justify-center">
              <Monitor size={20} className="text-[#00A3FF]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted font-medium">TOTAL WORKSTATIONS</p>
              <p className="text-xl font-bold text-primary mt-0.5">{totalCount}</p>
            </div>
          </div>
          <div className="bg-card/70 backdrop-blur-sm border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#00FF87]/10 flex items-center justify-center">
              <Power size={20} className="text-[#00FF87]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted font-medium">NODES ONLINE</p>
              <p className="text-xl font-bold text-primary mt-0.5">{onlineCount}</p>
            </div>
          </div>
          <div className="bg-card/70 backdrop-blur-sm border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center">
              <Cpu size={20} className="text-[#6C63FF]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted font-medium">TOTAL VIRTUAL CORES</p>
              <p className="text-xl font-bold text-primary mt-0.5">{totalCores}</p>
            </div>
          </div>
          <div className="bg-card/70 backdrop-blur-sm border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#FF6B00]/10 flex items-center justify-center">
              <Database size={20} className="text-[#FF6B00]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted font-medium">DEDICATED MEMORY</p>
              <p className="text-xl font-bold text-primary mt-0.5">{totalRam} GB</p>
            </div>
          </div>
        </div>

        {/* SECTION 3 — FILTER & SEARCH BAR */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {['All Nodes', 'Online', 'Offline', 'Provisioning'].map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 ${
                  activeFilter === tab ? 'bg-[#2563EB] text-[#FFFFFF] shadow-md border border-[#2563EB]' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab}
                <span className="ml-1.5 text-[10px] opacity-60">({getCountForFilter(tab)})</span>
              </button>
            ))}
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search workspace..."
                className="bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-secondary placeholder-muted outline-none focus:border-blue-500 transition-colors w-full md:w-56"
              />
            </div>
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value)} 
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-secondary outline-none"
            >
              <option>Sort: Recent</option>
              <option>Sort: Name</option>
              <option>Sort: Status</option>
            </select>
          </div>
        </div>

        {/* SECTION 4 — WORKSPACE CARDS GRID */}
        {workspaces.length === 0 ? (
          /* SECTION 5 — EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-20 border border-border rounded-2xl bg-card">
            <div className="w-16 h-16 rounded-2xl bg-nav-hover flex items-center justify-center mb-4">
              <Monitor size={28} className="text-faint" />
            </div>
            <h3 className="text-lg font-semibold text-secondary mb-2">
              No workspaces yet
            </h3>
            <p className="text-sm text-muted text-center max-w-md mb-6">
              Launch your first cloud desktop or server. Choose from pre-configured templates with professional tools pre-installed.
            </p>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
              <Plus size={18} />
              Create First Workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                          <div className="w-10 h-10 rounded-xl bg-[#00FF87]/10 flex items-center justify-center shrink-0">
                            <Monitor size={20} className="text-[#00FF87]" />
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
                          <Monitor size={20} className="text-[#00A3FF]" />
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
                      <Loader2 className="w-8 h-8 text-[#00A3FF] animate-spin mb-3" />
                      <p className="text-xs text-[#00A3FF] font-medium tracking-wide">Starting virtual machine...</p>
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
                        <Monitor size={20} className="text-[#FF6B00]" />
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
              <button onClick={() => setShowCreate(false)} className="text-muted hover:text-white transition-colors">
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
                        templateTab === tab ? 'bg-[var(--bg-elevated)] text-white' : 'text-muted hover:text-secondary'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {templates.filter(t => t.template_type === (templateTab === 'Desktops' ? 'desktop' : 'server')).map(template => {
                    const Icon = getTemplateIcon(template.icon)
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
                            <Icon size={20} />
                          </div>
                          {!template.is_real && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted bg-canvas px-2 py-1 rounded">Coming Soon</span>
                          )}
                        </div>
                        <h4 className="font-bold text-primary mb-1">{template.name}</h4>
                        <p className="text-xs text-secondary mb-3">{template.cpu_cores} vCPU · {template.ram_gb}GB RAM · {template.storage_gb}GB</p>
                        <div className="text-xs font-semibold text-secondary">{template.hourly_cost_tzs > 0 ? `TZS ${template.hourly_cost_tzs}/hr` : 'Free'}</div>
                        
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
                className="px-5 py-2.5 rounded-xl text-secondary text-sm font-semibold hover:text-white transition-colors"
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

    </div>
  )
}
