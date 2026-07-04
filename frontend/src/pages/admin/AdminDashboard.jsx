import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { 
  Users, Monitor, Activity, Server, Clock, Database, CheckCircle, 
  Settings, Layers, Terminal, AlertTriangle, Download, Plus, List, Video
} from 'lucide-react';
import api from '../../services/api';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { useNavigate } from 'react-router-dom';

const CircularGauge = ({ percentage, label, subtext, format = 'percent' }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  let colorClass = 'text-green-500';
  if (percentage > 60) colorClass = 'text-amber-500';
  if (percentage > 80) colorClass = 'text-red-500';

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
          <span className={`text-lg font-bold text-white leading-none`}>
            {format === 'percent' ? `${Math.round(percentage)}%` : Math.round(percentage)}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-slate-300 mt-3">{label}</span>
      {subtext && <span className="text-xs text-slate-500 mt-1">{subtext}</span>}
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
    systemStatus: 'Unknown'
  });
  const [systemStats, setSystemStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data for charts
  const sessionsData = [
    { name: 'Mon', count: 12 }, { name: 'Tue', count: 19 },
    { name: 'Wed', count: 15 }, { name: 'Thu', count: 25 },
    { name: 'Fri', count: 32 }, { name: 'Sat', count: 14 },
    { name: 'Sun', count: 8 }
  ];

  const vmUsageData = [
    { name: 'Mon', created: 20, destroyed: 15 },
    { name: 'Tue', created: 25, destroyed: 20 },
    { name: 'Wed', created: 18, destroyed: 19 },
    { name: 'Thu', created: 30, destroyed: 25 },
    { name: 'Fri', created: 35, destroyed: 30 },
    { name: 'Sat', created: 15, destroyed: 18 },
    { name: 'Sun', created: 10, destroyed: 12 }
  ];

  const recentActivity = [
    { id: 1, action: 'User Created', desc: 'john.doe@example.com registered', time: '10 mins ago', color: 'bg-blue-500' },
    { id: 2, action: 'VM Provisioned', desc: 'VM 104 allocated for User ID 4', time: '15 mins ago', color: 'bg-purple-500' },
    { id: 3, action: 'Session Ended', desc: 'Python 101 session terminated', time: '1 hour ago', color: 'bg-amber-500' },
    { id: 4, action: 'Node Alert', desc: 'High CPU on pve-node-1', time: '3 hours ago', color: 'bg-red-500' }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, poolRes, sysRes, sessionsRes] = await Promise.allSettled([
          api.get('/users/'),
          api.get('/vms/admin/pool/status/'),
          api.get('/vms/admin/system-stats/'),
          api.get('/sessions/live/')
        ]);

        let userCount = 0;
        if (usersRes.status === 'fulfilled' && usersRes.value.data.success) {
          userCount = usersRes.value.data.data.length;
        }

        let liveSessionCount = 0;
        if (sessionsRes.status === 'fulfilled' && sessionsRes.value.data.success) {
          liveSessionCount = sessionsRes.value.data.data.my_hosted?.length || 0;
        }

        let sysData = null;
        let pveStatus = 'Offline';
        if (sysRes.status === 'fulfilled') {
          sysData = sysRes.value.data;
          pveStatus = sysData.proxmox?.status === 'online' ? 'Healthy' : 'Degraded';
        }

        setStats(prev => ({
          ...prev,
          totalUsers: userCount,
          activeVms: sysData?.vms?.running || 0,
          totalVms: sysData?.vms?.total || 0,
          liveSessions: liveSessionCount,
          systemStatus: pveStatus
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white">Welcome back, {user?.first_name}</h2>
        <p className="text-slate-400 mt-1">CloudDesk Administration</p>
      </div>

      {/* SECTION A: Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#1e2d3d]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={64} />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="bg-indigo-500/20 p-3 rounded-xl">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-slate-400 font-medium text-sm">Total Users</p>
          </div>
          <p className="text-3xl font-bold text-white relative z-10">{stats.totalUsers}</p>
          <p className="text-sm text-emerald-400 mt-2 relative z-10 flex items-center gap-1">
            <span>+5 this week</span>
          </p>
        </div>

        <div className="bg-[#1e2d3d]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Monitor size={64} />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="bg-purple-500/20 p-3 rounded-xl">
              <Monitor className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-slate-400 font-medium text-sm">Active VMs</p>
          </div>
          <p className="text-3xl font-bold text-white relative z-10">{stats.activeVms}/{stats.totalVms}</p>
          <p className="text-sm text-slate-400 mt-2 relative z-10 flex items-center gap-1">
            <span>{stats.totalVms > 0 ? Math.round((stats.activeVms / stats.totalVms) * 100) : 0}% used</span>
          </p>
        </div>

        <div className="bg-[#1e2d3d]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Video size={64} />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="bg-blue-500/20 p-3 rounded-xl">
              <Video className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-slate-400 font-medium text-sm">Live Sessions</p>
          </div>
          <p className="text-3xl font-bold text-white relative z-10">{stats.liveSessions}</p>
          <p className="text-sm text-blue-400 mt-2 relative z-10 flex items-center gap-1">
            <span>8 today</span>
          </p>
        </div>

        <div className="bg-[#1e2d3d]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={64} />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="bg-emerald-500/20 p-3 rounded-xl">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-slate-400 font-medium text-sm">System Status</p>
          </div>
          <p className="text-xl font-bold text-white relative z-10 flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${stats.systemStatus === 'Healthy' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}></span>
            {stats.systemStatus}
          </p>
          <p className="text-sm text-slate-400 mt-2 relative z-10">
            {stats.systemStatus === 'Healthy' ? 'All services running' : 'System degraded'}
          </p>
        </div>
      </div>

      {/* SECTION B: System Infrastructure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1e2d3d]/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/5 p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                Proxmox Server — {systemStats?.proxmox?.node || 'pve'}
              </h3>
              <p className="text-sm text-slate-400 mt-1">Resource utilization</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Uptime</p>
              <p className="text-white font-mono">{formatUptime(systemStats?.proxmox?.uptime_seconds)}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <CircularGauge 
              percentage={systemStats?.proxmox?.cpu_usage || 0} 
              label="CPU" 
            />
            <CircularGauge 
              percentage={(systemStats?.proxmox?.ram_used / systemStats?.proxmox?.ram_total * 100) || 0} 
              label="RAM" 
              subtext={`${systemStats?.proxmox?.ram_used || 0} / ${systemStats?.proxmox?.ram_total || 0} GB`} 
            />
            <CircularGauge 
              percentage={45} 
              label="Storage" 
              subtext="120 / 512 GB" 
            />
          </div>
        </div>

        <div className="bg-[#1e2d3d]/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/5 p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Services Health
            </h3>
            <p className="text-sm text-slate-400 mt-1">Core infrastructure components</p>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="pb-3 font-medium">Service</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Port</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { name: 'CloudDesk API', status: true, port: '8000' },
                  { name: 'Proxmox VE', status: systemStats?.proxmox?.status === 'online', port: '8006' },
                  { name: 'Guacamole', status: systemStats?.guacamole?.status === 'online', port: '8080' },
                  { name: 'PostgreSQL', status: true, port: '5432' },
                  { name: 'Redis', status: true, port: '6379' },
                  { name: 'Nginx', status: true, port: '80' }
                ].map(service => (
                  <tr key={service.name} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 text-sm text-white font-medium">{service.name}</td>
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
                    <td className="py-3 text-sm text-slate-400 font-mono">{service.port}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION C: Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1e2d3d]/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/5 p-6 h-96 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">Sessions This Week</h3>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sessionsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#94a3b8" axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1a2332', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSessions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#1e2d3d]/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/5 p-6 h-96 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">VM Usage Over Time</h3>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vmUsageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#94a3b8" axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1a2332', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="created" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="destroyed" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SECTION D: Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1e2d3d]/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/5 flex flex-col min-h-[350px]">
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              Recent Activity
            </h3>
          </div>
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="space-y-6">
              {recentActivity.map((log, i) => (
                <div key={log.id} className="flex gap-4 relative">
                  {i !== recentActivity.length - 1 && (
                    <div className="absolute top-8 bottom-[-24px] left-2 w-px bg-white/10"></div>
                  )}
                  <div className={`w-4 h-4 rounded-full mt-1 shrink-0 ${log.color} ring-4 ring-slate-900 z-10`}></div>
                  <div>
                    <p className="text-white font-medium text-sm">{log.action}</p>
                    <p className="text-slate-400 text-sm mt-0.5">{log.desc}</p>
                    <p className="text-xs text-slate-500 mt-1">{log.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#1e2d3d]/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/5 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              Quick Actions
            </h3>
            <p className="text-sm text-slate-400 mt-1">Shortcuts to common administration tasks</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => navigate('/admin/vm-pool')} 
              className="flex items-center gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-all text-left group"
            >
              <div className="p-2 bg-indigo-500/20 rounded-lg group-hover:scale-110 transition-transform"><Plus size={20} /></div>
              <span className="font-medium">Pre-clone VMs</span>
            </button>
            <button 
              onClick={() => navigate('/admin/users')}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 transition-all text-left group"
            >
              <div className="p-2 bg-white/5 rounded-lg group-hover:scale-110 transition-transform"><Users size={20} /></div>
              <span className="font-medium">Manage Users</span>
            </button>
            <button 
              onClick={() => navigate('/admin/templates')}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 transition-all text-left group"
            >
              <div className="p-2 bg-white/5 rounded-lg group-hover:scale-110 transition-transform"><List size={20} /></div>
              <span className="font-medium">View Templates</span>
            </button>
            <button 
              onClick={() => navigate('/admin/vm-pool')}
              className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-all text-left group"
            >
              <div className="p-2 bg-red-500/20 rounded-lg group-hover:scale-110 transition-transform"><AlertTriangle size={20} /></div>
              <span className="font-medium">Clean Up Errors</span>
            </button>
            <button 
              onClick={() => navigate('/admin/analytics')}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 transition-all text-left sm:col-span-2 group"
            >
              <div className="p-2 bg-white/5 rounded-lg group-hover:scale-110 transition-transform"><Activity size={20} /></div>
              <span className="font-medium">View Analytics</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
