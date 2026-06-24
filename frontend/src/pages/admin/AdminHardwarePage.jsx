import { useState, useEffect } from 'react';
import { Server, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend
} from 'recharts';
import api from '../../services/api';

export default function AdminHardwarePage() {
  const [stats, setStats] = useState(null);
  const [cpuHistory, setCpuHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHardwareData = async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        api.get('/admin/hardware/'),
        api.get('/admin/hardware/cpu-history/')
      ]);
      setStats(statsRes.data.data);
      setCpuHistory(historyRes.data.data);
    } catch (error) {
      console.error("Failed to fetch hardware stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHardwareData();
    const interval = setInterval(fetchHardwareData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex justify-center items-center h-64">
        <Activity className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const getGaugeColor = (percent) => {
    if (percent < 50) return '#10B981'; // emerald-500
    if (percent < 75) return '#F59E0B'; // yellow-500
    return '#EF4444'; // red-500
  };

  const cpuData = [{ name: 'CPU', value: stats.cpu_percent, fill: getGaugeColor(stats.cpu_percent) }];
  const ramData = [{ name: 'RAM', value: stats.ram_percent, fill: getGaugeColor(stats.ram_percent) }];

  const vmStatusData = [
    { name: 'Running', value: stats.vm_summary.running, color: '#10B981' },
    { name: 'Stopped', value: stats.vm_summary.stopped, color: '#6B7280' },
    { name: 'Provisioning', value: stats.vm_summary.provisioning, color: '#F59E0B' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white font-inter">Hardware & Resources</h1>

      {/* ROW 1 — Server Status Bar */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-wrap items-center justify-between text-sm shadow-md">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
          <span className="text-white font-medium">proxmox-node-1 Online</span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-slate-700"></div>
        <div className="text-slate-400">
          Proxmox VE {stats.proxmox_version}
        </div>
        <div className="hidden sm:block w-px h-4 bg-slate-700"></div>
        <div className="text-slate-400">
          Uptime: {stats.uptime_days} days
        </div>
        <div className="hidden sm:block w-px h-4 bg-slate-700"></div>
        <div className="text-slate-400">
          VMs: <span className="text-white font-medium">{stats.vm_summary.running}</span> running / {stats.vm_summary.total} total
        </div>
      </div>

      {/* ROW 2 — 3 Gauge/Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Gauge */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-md flex flex-col items-center relative">
          <h3 className="text-slate-400 font-medium mb-2">CPU Utilization</h3>
          <div className="h-40 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart 
                cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={15} data={cpuData} startAngle={180} endAngle={0}
              >
                <RadialBar background={{ fill: '#334155' }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-end justify-center pb-6">
              <span className="text-3xl font-bold text-white">{stats.cpu_percent}%</span>
            </div>
          </div>
        </div>

        {/* RAM Gauge */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-md flex flex-col items-center relative">
          <h3 className="text-slate-400 font-medium mb-2">RAM Usage</h3>
          <div className="h-40 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart 
                cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={15} data={ramData} startAngle={180} endAngle={0}
              >
                <RadialBar background={{ fill: '#334155' }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
              <span className="text-2xl font-bold text-white">{stats.ram_used_gb} GB <span className="text-sm font-normal text-slate-400">/ {stats.ram_total_gb} GB</span></span>
              <span className="text-sm text-slate-400">{stats.ram_percent}%</span>
            </div>
          </div>
        </div>

        {/* Network I/O */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-md flex flex-col justify-center">
          <h3 className="text-slate-400 font-medium mb-6 text-center">Network Throughput</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
                  <ChevronDown className="w-4 h-4 text-blue-400" /> IN
                </span>
                <span className="text-lg font-bold text-white">{(stats.network.bytes_in_per_sec / 1024).toFixed(1)} <span className="text-xs text-slate-400 font-normal">KB/s</span></span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '65%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
                  <ChevronUp className="w-4 h-4 text-emerald-400" /> OUT
                </span>
                <span className="text-lg font-bold text-white">{(stats.network.bytes_out_per_sec / 1024).toFixed(1)} <span className="text-xs text-slate-400 font-normal">KB/s</span></span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '40%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3 — Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left chart — CPU & RAM History */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-md lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-6">CPU & RAM — Last 20 Minutes</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpuHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ fontSize: '14px' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line type="monotone" name="CPU %" dataKey="cpu" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" name="RAM %" dataKey="ram" stroke="#a855f7" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right chart — VM Status Distribution */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-md">
          <h3 className="text-lg font-semibold text-white mb-2 text-center">Virtual Machines</h3>
          <p className="text-sm text-slate-400 text-center mb-6">Status Distribution</p>
          <div className="h-64 w-full">
            {vmStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vmStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {vmStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">No VMs created yet</div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 4 — Storage Pools Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-md overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Storage Pools</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-medium">Pool Name</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium text-right">Used</th>
                <th className="px-6 py-4 font-medium text-right">Total</th>
                <th className="px-6 py-4 font-medium min-w-[200px]">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {stats.storage_pools.map((pool, idx) => {
                const percent = (pool.used_gb / pool.total_gb) * 100;
                let colorClass = 'bg-emerald-500';
                if (percent >= 60) colorClass = 'bg-yellow-500';
                if (percent >= 80) colorClass = 'bg-red-500';

                return (
                  <tr key={idx} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                      <Server className="w-4 h-4 text-slate-400" />
                      {pool.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-700 px-2 py-1 rounded text-xs font-medium border border-slate-600">
                        {pool.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">{pool.used_gb} GB</td>
                    <td className="px-6 py-4 text-right text-slate-400">{pool.total_gb} GB</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${percent}%` }}></div>
                        </div>
                        <span className="text-xs text-slate-400 w-8">{percent.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
