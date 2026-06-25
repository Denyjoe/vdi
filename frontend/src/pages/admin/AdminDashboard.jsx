import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { Users, Monitor, Activity, CheckCircle, ScrollText } from 'lucide-react';
import api from '../../services/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Cell 
} from 'recharts';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalUsers: 0,
    vmTemplates: 0,
    activeSessions: 0,
    systemStatus: 'Online'
  });
  const [usersData, setUsersData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [usersRes, logsRes] = await Promise.all([
          api.get('/admin/users/'),
          api.get('/admin/logs/')
        ]);

        let vmTemplatesCount = 0;
        try {
          const vmsRes = await api.get('/admin/vms/templates/');
          if (vmsRes.data.success) {
            vmTemplatesCount = vmsRes.data.data.length;
          }
        } catch (e) {
          // Endpoint might not exist yet
          vmTemplatesCount = 0;
        }

        if (usersRes.data.success) {
          const users = usersRes.data.data;
          setStats(prev => ({ ...prev, totalUsers: users.length }));
          
          let students = 0, lecturers = 0, admins = 0;
          users.forEach(u => {
            if (u.role === 'student') students++;
            if (u.role === 'lecturer') lecturers++;
            if (u.role === 'admin') admins++;
          });
          
          setUsersData([
            { name: 'Students', count: students, color: '#3b82f6' }, // blue-500
            { name: 'Lecturers', count: lecturers, color: '#a855f7' }, // purple-500
            { name: 'Admins', count: admins, color: '#ef4444' } // red-500
          ]);
        }

        setStats(prev => ({
          ...prev,
          vmTemplates: vmTemplatesCount,
          activeSessions: 0,
          systemStatus: 'Online'
        }));

        if (logsRes.data.success) {
          setLogs(logsRes.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Activity className="animate-spin text-blue-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white font-inter">Welcome back, {user?.first_name}</h2>
        <p className="text-slate-400 mt-1">DIT Virtual Desktop Infrastructure — Administration Panel</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-blue-500/20 p-4 rounded-lg">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total Users</p>
            <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-purple-500/20 p-4 rounded-lg">
            <Monitor className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">VM Templates</p>
            <p className="text-2xl font-bold text-white">{stats.vmTemplates}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-emerald-500/20 p-4 rounded-lg">
            <Activity className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Active Sessions</p>
            <p className="text-2xl font-bold text-white">{stats.activeSessions}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-emerald-500/20 p-4 rounded-lg">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">System Status</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.systemStatus}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-8">
        {/* Left column — Recent Activity Feed */}
        <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 flex flex-col lg:col-span-3 min-h-[400px]">
          <div className="px-6 py-5 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto max-h-[320px]">
            {logs.length > 0 ? (
              <div className="space-y-4">
                {logs.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                    <div className="bg-slate-700 px-3 py-1 rounded-md text-xs font-medium text-slate-300">
                      {log.action}
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm">{log.description}</p>
                      <p className="text-slate-500 text-xs mt-1">{log.user}</p>
                    </div>
                    <div className="text-slate-400 text-xs whitespace-nowrap">
                      {formatTimeAgo(log.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <ScrollText className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-slate-400">No recent activity found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Quick Stats Chart */}
        <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 flex flex-col lg:col-span-2 min-h-[400px]">
          <div className="px-6 py-5 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Platform Users by Role</h3>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <div className="flex-1 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usersData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                    cursor={{ fill: '#334155', opacity: 0.4 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {usersData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
