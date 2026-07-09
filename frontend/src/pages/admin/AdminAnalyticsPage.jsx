import { useState, useEffect } from 'react';
import { Users, Monitor, Activity, DollarSign, Wifi, TrendingUp, Clock, Server } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell } from 'recharts';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminAnalyticsPage() {
  const getVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVms: 0,
    totalSessions: 0,
    revenue: 0,
  });
  const [vmTemplates, setVmTemplates] = useState([]);
  const [topUsers, setTopUsers] = useState([]);

  // Flat lines for honest empty data
  const sessionTrends = [
    { day: 'Mon', sessions: 0, unique_users: 0 },
    { day: 'Tue', sessions: 0, unique_users: 0 },
    { day: 'Wed', sessions: 0, unique_users: 0 },
    { day: 'Thu', sessions: 0, unique_users: 0 },
    { day: 'Fri', sessions: 0, unique_users: 0 },
    { day: 'Sat', sessions: 0, unique_users: 0 },
    { day: 'Sun', sessions: 0, unique_users: 0 },
  ];

  const userGrowth = [
    { month: 'Jan', users: 0 },
    { month: 'Feb', users: 0 },
    { month: 'Mar', users: 0 },
    { month: 'Apr', users: 0 },
    { month: 'May', users: 0 },
    { month: 'Jun', users: 0 },
  ];

  const revenueData = [
    { month: 'Jan', revenue: 0 },
    { month: 'Feb', revenue: 0 },
    { month: 'Mar', revenue: 0 },
    { month: 'Apr', revenue: 0 },
    { month: 'May', revenue: 0 },
    { month: 'Jun', revenue: 0 },
  ];

  const peakHours = [
    { hour: '00:00', sessions: 0 },
    { hour: '04:00', sessions: 0 },
    { hour: '08:00', sessions: 0 },
    { hour: '12:00', sessions: 0 },
    { hour: '16:00', sessions: 0 },
    { hour: '20:00', sessions: 0 },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, sessionsRes, paymentsRes, sysRes, templatesRes, usersListRes] = await Promise.allSettled([
          api.get('/users/admin/stats/'),
          api.get('/sessions/admin/stats/'),
          api.get('/payments/admin/stats/'),
          api.get('/vms/admin/system-stats/'),
          api.get('/vms/admin/templates/'),
          api.get('/users/admin/list/')
        ]);

        setStats({
          totalUsers: usersRes.status === 'fulfilled' && usersRes.value.data.success ? usersRes.value.data.data.total_users : 0,
          totalVms: sysRes.status === 'fulfilled' ? (sysRes.value.data.vms?.total || 0) : 0,
          totalSessions: sessionsRes.status === 'fulfilled' && sessionsRes.value.data.success ? sessionsRes.value.data.data.total_sessions : 0,
          revenue: paymentsRes.status === 'fulfilled' && paymentsRes.value.data.success ? paymentsRes.value.data.data.total_revenue_tzs : 0,
        });

        if (templatesRes.status === 'fulfilled' && templatesRes.value.data.success) {
          const templates = templatesRes.value.data.data.map(t => ({
            name: t.name,
            count: t.pool_count || 0
          }));
          setVmTemplates(templates);
        }

        if (usersListRes.status === 'fulfilled' && usersListRes.value.data.success) {
          // just taking the top 5 recently joined as active users for now (since we don't have usage hours in user list)
          const usersList = usersListRes.value.data.data.slice(0, 5).map(u => ({
            name: `${u.first_name} ${u.last_name}`,
            email: u.email,
            vms: 0,
            hours: 0
          }));
          setTopUsers(usersList);
        }

      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Activity className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const maxSessionsHour = Math.max(...peakHours.map(h => h.sessions), 1); // Avoid division by zero styling

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[var(--text-primary)] font-inter">Platform Analytics</h2>
        <p className="text-[var(--text-secondary)] mt-1">Real-time usage and revenue statistics</p>
      </div>

      {/* Row 1: Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[var(--bg-card)] rounded-xl p-6 shadow-md border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-indigo-500/20 p-4 rounded-lg">
            <Users className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <p className="text-[var(--text-secondary)] text-sm font-medium">Total Users</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalUsers.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl p-6 shadow-md border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-purple-500/20 p-4 rounded-lg">
            <Server className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-[var(--text-secondary)] text-sm font-medium">Total VMs</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalVms.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl p-6 shadow-md border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-emerald-500/20 p-4 rounded-lg">
            <Activity className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-[var(--text-secondary)] text-sm font-medium">Total Sessions</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalSessions.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl p-6 shadow-md border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-green-500/20 p-4 rounded-lg">
            <DollarSign className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-[var(--text-secondary)] text-sm font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">TZS {stats.revenue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Row 2: Charts - Sessions & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Sessions (Last 7 Days)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sessionTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={getVar('--chart-line')} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={getVar('--chart-line')} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={getVar('--chart-grid')} vertical={false} />
                <XAxis dataKey="day" stroke={getVar('--chart-text')} />
                <YAxis stroke={getVar('--chart-text')} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Area type="monotone" dataKey="sessions" name="Total Sessions" stroke={getVar('--chart-line')} strokeWidth={3} fillOpacity={1} fill="url(#colorSessions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Revenue Over Time</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={getVar('--chart-grid')} vertical={false} />
                <XAxis dataKey="month" stroke={getVar('--chart-text')} />
                <YAxis stroke={getVar('--chart-text')} allowDecimals={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  formatter={(value) => [`TZS ${value}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill={getVar('--chart-bar')} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Charts - User Growth & Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">User Growth (6 Months)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={getVar('--chart-grid')} vertical={false} />
                <XAxis dataKey="month" stroke={getVar('--chart-text')} />
                <YAxis stroke={getVar('--chart-text')} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Line type="monotone" dataKey="users" name="Total Users" stroke={getVar('--accent')} strokeWidth={3} dot={{ r: 4, fill: getVar('--accent'), strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Template Popularity</h3>
          <div className="h-[300px]">
            {vmTemplates.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={vmTemplates} margin={{ top: 10, right: 10, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={getVar('--chart-grid')} horizontal={false} />
                  <XAxis type="number" stroke={getVar('--chart-text')} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke={getVar('--chart-text')} width={100} tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Bar dataKey="count" name="Pool Count" fill={getVar('--info')} radius={[0, 4, 4, 0]} maxBarSize={30}>
                    {vmTemplates.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? getVar('--accent') : getVar('--info')} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-[var(--border-color)] rounded-xl">
                <div className="text-center text-[var(--text-secondary)]">
                  <Monitor className="w-8 h-8 mx-auto mb-2 text-muted" />
                  <p>No templates available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Peak Hours & Top Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Active Hours Heatmap</h3>
            <p className="text-sm text-[var(--text-secondary)]">Peak platform usage times</p>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={getVar('--chart-grid')} vertical={false} />
                <XAxis dataKey="hour" stroke={getVar('--chart-text')} tick={{ fontSize: 11 }} interval={0} />
                <YAxis stroke={getVar('--chart-text')} allowDecimals={false} />
                <RechartsTooltip cursor={{ fill: 'var(--border-color)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Bar dataKey="sessions" name="Active Sessions" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {peakHours.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.sessions === maxSessionsHour && maxSessionsHour > 0 ? getVar('--warning') : getVar('--accent')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-[var(--border-color)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recent Users</h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-primary)]/50 text-[var(--text-primary)]">
                <tr>
                  <th className="px-6 py-4 font-medium w-16 text-center">#</th>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium text-center">VMs</th>
                  <th className="px-6 py-4 font-medium text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-[var(--text-primary)]">
                {topUsers.length > 0 ? (
                  topUsers.map((user, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-card-hover)]/30 transition-colors">
                      <td className="px-6 py-4 text-center font-bold text-muted">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[var(--text-primary)]">{user.name}</p>
                        <p className="text-xs text-muted">{user.email}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-[var(--text-primary)] font-medium">{user.vms}</td>
                      <td className="px-6 py-4 text-right text-indigo-400 font-medium">{user.hours}h</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-muted">
                      No activity recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
