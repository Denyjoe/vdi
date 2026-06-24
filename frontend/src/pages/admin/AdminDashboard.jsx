import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalUsers: 0,
    vmTemplates: 0,
    activeSessions: 0,
    systemStatus: 'Online'
  });
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

        setStats({
          totalUsers: usersRes.data.success ? usersRes.data.data.length : 0,
          vmTemplates: vmTemplatesCount,
          activeSessions: 0,
          systemStatus: 'Online'
        });

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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-blue-500/20 p-4 rounded-lg text-2xl">👥</div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total Users</p>
            <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-purple-500/20 p-4 rounded-lg text-2xl">🖥️</div>
          <div>
            <p className="text-slate-400 text-sm font-medium">VM Templates</p>
            <p className="text-2xl font-bold text-white">{stats.vmTemplates}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-emerald-500/20 p-4 rounded-lg text-2xl">🔗</div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Active Sessions</p>
            <p className="text-2xl font-bold text-white">{stats.activeSessions}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-emerald-500/20 p-4 rounded-lg text-2xl">✅</div>
          <div>
            <p className="text-slate-400 text-sm font-medium">System Status</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.systemStatus}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        </div>
        
        <div className="p-6">
          {logs.length > 0 ? (
            <div className="space-y-4">
              {logs.slice(0, 5).map((log) => (
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
            <div className="text-center py-10">
              <span className="text-4xl block mb-3">📭</span>
              <p className="text-slate-400">No recent activity found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
