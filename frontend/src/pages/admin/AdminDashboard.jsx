import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { 
  Users, Monitor, Activity, Server, Clock, Database, CheckCircle, 
  Settings, Layers, Terminal, AlertTriangle, Download, Plus, List, Video,
  RefreshCw, AlertCircle, Power, Receipt, Copy
} from 'lucide-react';
import api from '../../services/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { useNavigate } from 'react-router-dom';

const CircularGauge = ({ percentage, label, subtext, format = 'percent', offline = false }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = offline ? 0 : percentage;
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;
  
  let colorClass = 'text-green-500';
  if (offline) colorClass = 'text-faint';
  else if (percentage > 80) colorClass = 'text-red-500';
  else if (percentage > 60) colorClass = 'text-amber-500';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="48" cy="48" r={radius} className="stroke-slate-700" strokeWidth="8" fill="none" />
          <circle 
            cx="48" cy="48" r={radius} 
            className={`stroke-current ${colorClass} transition-all duration-1000 ease-out`} 
            strokeWidth="8" fill="none" strokeLinecap="round"
            style={{ strokeDasharray: circumference, strokeDashoffset }} 
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`text-lg font-bold text-[var(--text-primary)] leading-none`}>
            {offline ? "—" : (format === 'percent' ? `${Math.round(percentage)}%` : Math.round(percentage))}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-[var(--text-primary)] mt-3">{label}</span>
      {subtext && <span className="text-xs text-muted mt-1">{subtext}</span>}
    </div>
  );
};

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeVms: 0,
    totalVms: 0,
    liveSessions: 0,
    systemStatus: 'Unknown',
    totalSessions: 0,
    revenue: 0
  });
  const [systemStats, setSystemStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attentionIssues, setAttentionIssues] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [isRetrying, setIsRetrying] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Real data from /admin/analytics/sessions-daily/ — the same endpoint
  // the Analytics page's "Sessions (Last 7 Days)" chart uses. Starts
  // empty rather than hardcoded zeros; populated once the request lands.
  const [sessionsData, setSessionsData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, sessionsRes, paymentsRes, poolRes, sysRes, attentionRes, activityRes, dailySessionsRes] = await Promise.allSettled([
          api.get('/users/admin/stats/'),
          api.get('/sessions/admin/stats/'),
          api.get('/payments/admin/stats/'),
          api.get('/vms/admin/pool/status/'),
          api.get('/vms/admin/system-stats/'),
          api.get('/admin/attention/'),
          api.get('/admin/activity/'),
          api.get('/admin/analytics/sessions-daily/')
        ]);

        let userCount = 0;
        if (usersRes.status === 'fulfilled' && usersRes.value.data.success) {
          userCount = usersRes.value.data.data.total_users;
        }

        let liveSessionCount = 0;
        let totalSessionsCount = 0;
        if (sessionsRes.status === 'fulfilled' && sessionsRes.value.data.success) {
          liveSessionCount = sessionsRes.value.data.data.live_sessions;
          totalSessionsCount = sessionsRes.value.data.data.total_sessions;
        }

        let totalRevenue = 0;
        if (paymentsRes.status === 'fulfilled' && paymentsRes.value.data.success) {
          totalRevenue = paymentsRes.value.data.data.total_revenue_tzs;
        }

        let sysData = null;
        let pveStatus = 'Offline';
        if (sysRes.status === 'fulfilled') {
          sysData = sysRes.value.data;
          pveStatus = sysData.proxmox?.status === 'online' ? 'Healthy' : 'Degraded';
        }
        
        if (attentionRes.status === 'fulfilled' && attentionRes.value.data) {
          setAttentionIssues(attentionRes.value.data.issues || []);
        }
        if (activityRes.status === 'fulfilled' && activityRes.value.data) {
          setRecentActivity(activityRes.value.data.activities || []);
        }

        if (dailySessionsRes.status === 'fulfilled' && dailySessionsRes.value.data.sessions) {
          setSessionsData(dailySessionsRes.value.data.sessions.map(d => ({
            name: d.day_label,
            count: d.count,
          })));
        }

        setStats(prev => ({
          ...prev,
          totalUsers: userCount,
          activeVms: sysData?.vms?.running || 0,
          totalVms: sysData?.vms?.total || 0,
          liveSessions: liveSessionCount,
          systemStatus: pveStatus,
          totalSessions: totalSessionsCount,
          revenue: totalRevenue
        }));
        setSystemStats(sysData);

      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRetry = async (serviceId) => {
    setIsRetrying(serviceId);
    try {
      await api.post('/admin/services/retry/', { service: serviceId });
      const sysRes = await api.get('/vms/admin/system-stats/');
      if (sysRes.data) setSystemStats(sysRes.data);
    } catch (err) {
      console.error('Failed to retry service:', err);
    } finally {
      setIsRetrying(null);
    }
  };

  const handleTriggerBackup = async () => {
    if (!window.confirm('Trigger manual backup?')) return;
    setIsBackingUp(true);
    try {
      await api.post('/admin/backup/trigger/');
      alert('Backup triggered successfully');
    } catch (err) {
      alert('Failed to trigger backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '0h 0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Activity className="animate-spin text-indigo-500 w-12 h-12" />
      </div>
    );
  }

  const quickActions = [
    {
      label: 'View Status',
      icon: Activity,
      colorClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20',
      iconColorClass: 'bg-emerald-500/20',
      onClick: () => document.getElementById('services-health-section')?.scrollIntoView({ behavior: 'smooth' })
    },
    {
      label: 'View Payments',
      icon: Receipt,
      colorClass: 'bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20',
      iconColorClass: 'bg-blue-500/20',
      onClick: () => navigate('/admin/analytics')
    },
    {
      label: 'Pre-clone VMs',
      icon: Copy,
      colorClass: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20',
      iconColorClass: 'bg-indigo-500/20',
      onClick: () => navigate('/admin/vm-pool')
    },
    {
      label: 'Manage Users',
      icon: Users,
      colorClass: 'bg-white/5 border-[var(--border-color)] text-[var(--text-primary)] hover:bg-white/10',
      iconColorClass: 'bg-white/5',
      onClick: () => navigate('/admin/users')
    },
    {
      label: 'View Templates',
      icon: List,
      colorClass: 'bg-white/5 border-[var(--border-color)] text-[var(--text-primary)] hover:bg-white/10',
      iconColorClass: 'bg-white/5',
      onClick: () => navigate('/admin/templates')
    },
    {
      label: 'Monitor Sessions',
      icon: Video,
      colorClass: 'bg-white/5 border-[var(--border-color)] text-[var(--text-primary)] hover:bg-white/10',
      iconColorClass: 'bg-white/5',
      onClick: () => navigate('/admin/sessions')
    },
    {
      label: 'Clean Up Errors',
      icon: AlertTriangle,
      colorClass: 'bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20',
      iconColorClass: 'bg-red-500/20',
      onClick: () => navigate('/admin/vm-pool')
    },
    {
      label: isBackingUp ? 'Backing up...' : 'Trigger Backup',
      icon: isBackingUp ? RefreshCw : Database,
      colorClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20',
      iconColorClass: 'bg-emerald-500/20',
      onClick: handleTriggerBackup,
      disabled: isBackingUp,
      spin: isBackingUp
    },
    {
      label: 'Maintenance Mode',
      icon: Power,
      colorClass: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
      iconColorClass: 'bg-amber-500/20',
      onClick: () => alert('Maintenance mode triggered (simulated)')
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Welcome back, {user?.first_name}</h2>
        <p className="text-[var(--text-secondary)] mt-1">Ospace Administration</p>
      </div>

      {/* SECTION A.1: Needs Attention */}
      {attentionIssues.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            <h3 className="text-lg font-semibold text-amber-500">Needs Attention ({attentionIssues.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attentionIssues.map((issue, idx) => (
              <div key={idx} className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-color)]">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 text-xs rounded-md font-medium ${
                    issue.severity === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>{issue.label}</span>
                  <span className="text-lg font-bold text-[var(--text-primary)]">{issue.count}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-4">{issue.description}</p>
                <button 
                  onClick={() => {
                    if (issue.action_label === 'View Status') {
                      document.getElementById('services-health-section')?.scrollIntoView({ behavior: 'smooth' });
                    } else if (issue.action_label === 'View Payments') {
                      navigate('/admin/analytics');
                    } else if (issue.action_label === 'Pre-clone VMs') {
                      navigate('/admin/vm-pool');
                    } else {
                      navigate(issue.action_link);
                    }
                  }}
                  className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {issue.action_label} &rarr;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION A: Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-[var(--border-color)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Users size={64} />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="bg-indigo-500/20 p-3 rounded-xl">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-[var(--text-secondary)] font-medium text-sm">Total Users</p>
          </div>
          <p className="text-3xl font-bold text-[var(--text-primary)] relative z-10">{stats.totalUsers}</p>
          <p className="text-sm text-emerald-400 mt-2 relative z-10 flex items-center gap-1">
            <span>+5 this week</span>
          </p>
        </div>

        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-[var(--border-color)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Monitor size={64} />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="bg-purple-500/20 p-3 rounded-xl">
              <Monitor className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-[var(--text-secondary)] font-medium text-sm">Active VMs</p>
          </div>
          <p className="text-3xl font-bold text-[var(--text-primary)] relative z-10">{stats.activeVms}/{stats.totalVms}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2 relative z-10 flex items-center gap-1">
            <span>{stats.totalVms > 0 ? Math.round((stats.activeVms / stats.totalVms) * 100) : 0}% used</span>
          </p>
        </div>

        <div onClick={() => navigate('/admin/sessions')} className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-[var(--border-color)] relative overflow-hidden group cursor-pointer hover:border-blue-500/30 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Video size={64} />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="bg-blue-500/20 p-3 rounded-xl group-hover:bg-blue-500/30 transition-colors">
              <Video className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-[var(--text-secondary)] font-medium text-sm group-hover:text-blue-400 transition-colors">Live Sessions</p>
          </div>
          <p className="text-3xl font-bold text-[var(--text-primary)] relative z-10">{stats.liveSessions}</p>
          <p className="text-sm text-blue-400 mt-2 relative z-10 flex items-center gap-1">
            <span>Click to monitor</span>
          </p>
        </div>

        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-[var(--border-color)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Activity size={64} />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="bg-emerald-500/20 p-3 rounded-xl">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-[var(--text-secondary)] font-medium text-sm">System Status</p>
          </div>
          <p className="text-xl font-bold text-[var(--text-primary)] relative z-10 flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${stats.systemStatus === 'Healthy' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}></span>
            {stats.systemStatus}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-2 relative z-10">
            {stats.systemStatus === 'Healthy' ? 'All services running' : 'System degraded'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-[var(--border-color)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Activity size={64} />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="bg-orange-500/20 p-3 rounded-xl">
              <Activity className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-[var(--text-secondary)] font-medium text-sm">Total Sessions</p>
          </div>
          <p className="text-3xl font-bold text-[var(--text-primary)] relative z-10">{stats.totalSessions}</p>
          <p className="text-sm text-orange-400 mt-2 relative z-10 flex items-center gap-1">
            <span>All time sessions</span>
          </p>
        </div>

        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-[var(--border-color)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Database size={64} />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="bg-green-500/20 p-3 rounded-xl">
              <Database className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-[var(--text-secondary)] font-medium text-sm">Revenue</p>
          </div>
          <p className="text-3xl font-bold text-[var(--text-primary)] relative z-10">TZS {stats.revenue.toLocaleString()}</p>
          <p className="text-sm text-green-400 mt-2 relative z-10 flex items-center gap-1">
            <span>Total payments received</span>
          </p>
        </div>
      </div>

      {/* SECTION B: System Infrastructure */}
      <div id="services-health-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl shadow-lg border border-[var(--border-color)] p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                Proxmox Server — {systemStats?.proxmox?.node || 'pve'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Resource utilization</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Uptime</p>
              <p className="text-[var(--text-primary)] font-mono">{stats.systemStatus === 'Healthy' ? formatUptime(systemStats?.proxmox?.uptime_seconds) : '—'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CircularGauge
              percentage={systemStats?.proxmox?.cpu_usage || 0}
              label="CPU" 
              offline={stats.systemStatus !== 'Healthy'}
            />
            <CircularGauge 
              percentage={(systemStats?.proxmox?.ram_used / systemStats?.proxmox?.ram_total * 100) || 0} 
              label="RAM" 
              subtext={stats.systemStatus === 'Healthy' ? `${systemStats?.proxmox?.ram_used || 0} / ${systemStats?.proxmox?.ram_total || 0} GB` : '—'} 
              offline={stats.systemStatus !== 'Healthy'}
            />
            <CircularGauge 
              percentage={stats.systemStatus === 'Healthy' && systemStats?.proxmox?.storage_total > 0 ? (systemStats.proxmox.storage_used / systemStats.proxmox.storage_total * 100) : 0} 
              label="Storage" 
              subtext={stats.systemStatus === 'Healthy' && systemStats?.proxmox?.storage_total > 0 ? `${systemStats.proxmox.storage_used} / ${systemStats.proxmox.storage_total} GB` : "—"} 
              offline={stats.systemStatus !== 'Healthy'}
            />
          </div>
        </div>

        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl shadow-lg border border-[var(--border-color)] p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Services Health
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Core infrastructure components</p>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                  <th className="pb-3 font-medium">Service</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Port</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { name: 'Ospace API', status: true, port: '8000', canRetry: false },
                  { name: 'Proxmox VE', status: systemStats?.proxmox?.status === 'online', port: '8006', canRetry: true, id: 'proxmox' },
                  { name: 'Guacamole', status: systemStats?.guacamole?.status === 'online', port: '8080', canRetry: true, id: 'guacamole' },
                  { name: 'PostgreSQL', status: true, port: '5432', canRetry: false },
                  { name: 'Redis', status: true, port: '6379', canRetry: false },
                  { name: 'Nginx', status: true, port: '80', canRetry: false }
                ].map(service => (
                  <tr key={service.name} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 text-sm text-[var(--text-primary)] font-medium">{service.name}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        service.status 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${service.status ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                        {service.status ? 'Up' : 'Down'}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-[var(--text-secondary)] font-mono">{service.port}</td>
                    <td className="py-3 text-right">
                      {service.canRetry && !service.status && (
                        <button 
                          onClick={() => handleRetry(service.id)}
                          disabled={isRetrying === service.id}
                          className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 ml-auto transition-colors"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRetrying === service.id ? 'animate-spin text-indigo-400' : 'text-[var(--text-secondary)]'}`} />
                          {isRetrying === service.id ? 'Retrying...' : 'Reconnect'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION C: Chart Row — VM Usage Over Time (created vs destroyed)
          removed: there's no backend concept matching it. Workspace
          deletion (AdminDeleteWorkspaceView) is a hard delete with no
          timestamp trail, so a "destroyed per day" series can't be built
          from real data without new tracking infrastructure — genuinely
          new work, not a wiring job. The real, working equivalent for
          template/usage breakdown already exists on the Analytics page
          ("Template Popularity", backed by real Workspace counts). */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl shadow-lg border border-[var(--border-color)] p-6 h-96 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Sessions over the last 7 days</h3>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sessionsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-line)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--chart-line)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="name" stroke="var(--chart-text)" axisLine={false} tickLine={false} />
                <YAxis stroke="var(--chart-text)" axisLine={false} tickLine={false} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)' }}
                  itemStyle={{ color: 'var(--accent)' }}
                />
                <Area type="monotone" dataKey="count" stroke="var(--chart-line)" strokeWidth={3} fillOpacity={1} fill="url(#colorSessions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SECTION D: Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl shadow-lg border border-[var(--border-color)] flex flex-col h-[420px]">
          <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              Recent Activity
            </h3>
          </div>
          <div className="p-6 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border-strong)] scrollbar-track-transparent">
            <div className="space-y-6">
              {recentActivity.length > 0 ? recentActivity.map((log, i) => (
                <div key={log.id} className="flex gap-4 relative">
                  {i !== recentActivity.length - 1 && (
                    <div className="absolute top-8 bottom-[-24px] left-2 w-px bg-indigo-500/20"></div>
                  )}
                  <div className={`w-4 h-4 rounded-full mt-1 shrink-0 bg-indigo-500 ring-4 ring-[var(--bg-card)] z-10`}></div>
                  <div>
                    <p className="text-[var(--text-primary)] font-medium text-sm">{log.admin_name} — {log.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    <p className="text-[var(--text-secondary)] text-sm mt-0.5">{log.description}</p>
                    <p className="text-xs text-muted mt-1">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] mt-12">
                  <Activity className="w-8 h-8 mb-2 opacity-50" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md rounded-2xl shadow-lg border border-[var(--border-color)] p-6 h-[420px] flex flex-col">
          <div className="mb-6 shrink-0">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              Quick Actions
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Shortcuts to common administration tasks</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-[var(--border-strong)] scrollbar-track-transparent pr-2">
            {quickActions.map((action, idx) => (
              <button 
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`flex items-center gap-3 p-4 rounded-xl transition-all text-left group border ${action.colorClass}`}
              >
                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${action.iconColorClass}`}>
                  <action.icon size={20} className={action.spin ? "animate-spin" : ""} />
                </div>
                <span className="font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
