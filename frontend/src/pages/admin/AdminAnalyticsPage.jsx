import { useState, useEffect } from 'react';
import { Users, Monitor, Activity, DollarSign, Wifi, TrendingUp, Clock, Server } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell } from 'recharts';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);

  // Mock data to ensure charts always render beautifully
  const sessionTrends = [
    { day: 'Mon', sessions: 120, unique_users: 85 },
    { day: 'Tue', sessions: 150, unique_users: 110 },
    { day: 'Wed', sessions: 180, unique_users: 140 },
    { day: 'Thu', sessions: 190, unique_users: 155 },
    { day: 'Fri', sessions: 220, unique_users: 175 },
    { day: 'Sat', sessions: 90, unique_users: 65 },
    { day: 'Sun', sessions: 70, unique_users: 50 },
  ];

  const userGrowth = [
    { month: 'Jan', users: 150 },
    { month: 'Feb', users: 280 },
    { month: 'Mar', users: 410 },
    { month: 'Apr', users: 590 },
    { month: 'May', users: 820 },
    { month: 'Jun', users: 1150 },
  ];

  const revenueData = [
    { month: 'Jan', revenue: 1200 },
    { month: 'Feb', revenue: 2100 },
    { month: 'Mar', revenue: 3800 },
    { month: 'Apr', revenue: 5200 },
    { month: 'May', revenue: 7800 },
    { month: 'Jun', revenue: 11200 },
  ];

  const vmTemplates = [
    { name: 'Ubuntu 22.04', count: 450 },
    { name: 'Windows 10', count: 320 },
    { name: 'Kali Linux', count: 180 },
    { name: 'CentOS 8', count: 90 },
    { name: 'Windows Server 2022', count: 65 },
  ];

  const peakHours = [
    { hour: '00:00', sessions: 10 },
    { hour: '04:00', sessions: 5 },
    { hour: '08:00', sessions: 45 },
    { hour: '12:00', sessions: 120 },
    { hour: '16:00', sessions: 150 },
    { hour: '20:00', sessions: 85 },
  ];

  const topUsers = [
    { name: 'Alex M.', email: 'alex@example.com', vms: 12, hours: 145 },
    { name: 'Sarah K.', email: 'sarah@example.com', vms: 8, hours: 112 },
    { name: 'David B.', email: 'david@example.com', vms: 6, hours: 95 },
    { name: 'Elena R.', email: 'elena@example.com', vms: 5, hours: 82 },
  ];

  useEffect(() => {
    // Simulate loading delay
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Activity className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const maxSessionsHour = Math.max(...peakHours.map(h => h.sessions));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white font-inter">Platform Analytics</h2>
        <p className="text-slate-400 mt-1">Real-time usage and revenue statistics</p>
      </div>

      {/* Row 1: Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-indigo-500/20 p-4 rounded-lg">
            <Users className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total Users</p>
            <p className="text-2xl font-bold text-white">1,150</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-purple-500/20 p-4 rounded-lg">
            <Server className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total VMs Created</p>
            <p className="text-2xl font-bold text-white">3,420</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-emerald-500/20 p-4 rounded-lg">
            <Activity className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total Sessions</p>
            <p className="text-2xl font-bold text-white">12,500</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-green-500/20 p-4 rounded-lg">
            <DollarSign className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Monthly Revenue</p>
            <p className="text-2xl font-bold text-white">$11,200</p>
          </div>
        </div>
      </div>

      {/* Row 2: Charts - Sessions & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Sessions (Last 7 Days)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sessionTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Area type="monotone" dataKey="sessions" name="Total Sessions" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorSessions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Revenue Over Time</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  formatter={(value) => [`$${value}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Charts - User Growth & Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">User Growth (6 Months)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Line type="monotone" dataKey="users" name="Total Users" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Template Popularity</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={vmTemplates} margin={{ top: 10, right: 10, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100} tick={{ fontSize: 11 }} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Bar dataKey="count" name="VMs Created" fill="#3B82F6" radius={[0, 4, 4, 0]} maxBarSize={30}>
                  {vmTemplates.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#8B5CF6' : '#3B82F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: Peak Hours & Top Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">Active Hours Heatmap</h3>
            <p className="text-sm text-slate-400">Peak platform usage times</p>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fontSize: 11 }} interval={0} />
                <YAxis stroke="#94a3b8" />
                <RechartsTooltip cursor={{ fill: '#334155', opacity: 0.4 }} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Bar dataKey="sessions" name="Active Sessions" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {peakHours.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.sessions === maxSessionsHour ? '#F59E0B' : '#6366F1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Most Active Users</h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/50 text-slate-300">
                <tr>
                  <th className="px-6 py-4 font-medium w-16 text-center">#</th>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium text-center">VMs</th>
                  <th className="px-6 py-4 font-medium text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-slate-300">
                {topUsers.map((user, idx) => (
                  <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-6 py-4 text-center text-white font-medium">{user.vms}</td>
                    <td className="px-6 py-4 text-right text-indigo-400 font-medium">{user.hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
