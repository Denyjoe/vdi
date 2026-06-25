import { useState, useEffect } from 'react';
import {
  Users, Monitor, Activity, ClipboardList, Wifi,
  Calendar, TrendingUp, Clock
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { analyticsService } from '../../services/analyticsService';
import toast from 'react-hot-toast';

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [sessionTrends, setSessionTrends] = useState([]);
  const [vmUsage, setVmUsage] = useState(null);
  const [activityStats, setActivityStats] = useState(null);
  const [assignmentStats, setAssignmentStats] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [
          overviewRes,
          trendsRes,
          vmUsageRes,
          activityRes,
          assignmentRes
        ] = await Promise.all([
          analyticsService.getOverview(),
          analyticsService.getSessionTrends(),
          analyticsService.getVMUsage(),
          analyticsService.getActivity(),
          analyticsService.getAssignmentStats()
        ]);

        if (overviewRes.data.success) setOverview(overviewRes.data.data);
        if (trendsRes.data.success) setSessionTrends(trendsRes.data.data);
        if (vmUsageRes.data.success) setVmUsage(vmUsageRes.data.data);
        if (activityRes.data.success) setActivityStats(activityRes.data.data);
        if (assignmentRes.data.success) setAssignmentStats(assignmentRes.data.data);
      } catch (error) {
        console.error("Failed to fetch analytics data", error);
        console.error('Full error:', error);
        console.error('Response:', error.response?.data);
        toast.error("Failed to load analytics dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Activity className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  // --- Helpers ---
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const getRankBadge = (index) => {
    switch(index) {
      case 0: return <span className="text-xl">🥇</span>;
      case 1: return <span className="text-xl">🥈</span>;
      case 2: return <span className="text-xl">🥉</span>;
      default: return <span className="text-sm font-bold text-slate-500 px-2">{index + 1}</span>;
    }
  };

  const ACTION_COLORS = {
    'VM_REQUESTED': '#3B82F6',
    'VM_RUNNING': '#10B981',
    'VM_STOPPED': '#6B7280',
    'SESSION_CONNECTED': '#8B5CF6',
    'SESSION_DISCONNECTED': '#6B7280',
    'SESSION_TERMINATED': '#EF4444',
    'USER_LOGIN': '#F59E0B',
    'FILE_UPLOADED': '#06B6D4',
    'ASSIGNMENT_SUBMITTED': '#EC4899',
    'Other': '#374151'
  };

  // --- SECTION 1: Overview Cards ---
  const submissionRateColor = overview?.assignments.submission_rate > 60 
    ? 'text-emerald-400' 
    : (overview?.assignments.submission_rate >= 30 ? 'text-amber-400' : 'text-red-400');

  // Peak Hour calculation
  const maxSessionsHour = activityStats?.peak_hours 
    ? Math.max(...activityStats.peak_hours.map(h => h.sessions)) 
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white font-inter">Platform Analytics</h2>
        <p className="text-slate-400 mt-1">Real-time usage statistics</p>
      </div>

      {/* --- SECTION 1: Overview Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Row 1 */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-blue-500/20 p-4 rounded-lg">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total Users</p>
            <p className="text-2xl font-bold text-white">{overview?.users.total}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-purple-500/20 p-4 rounded-lg">
            <Monitor className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total VMs</p>
            <p className="text-2xl font-bold text-white">{overview?.vms.total}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-emerald-500/20 p-4 rounded-lg">
            <Activity className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total Sessions</p>
            <p className="text-2xl font-bold text-white">{overview?.sessions.total}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-amber-500/20 p-4 rounded-lg">
            <ClipboardList className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total Assignments</p>
            <p className="text-2xl font-bold text-white">{overview?.assignments.total}</p>
          </div>
        </div>

        {/* Row 2 */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-emerald-500/20 p-4 rounded-lg">
            <Wifi className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Active Sessions</p>
            <p className="text-2xl font-bold text-white">{overview?.sessions.active}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-blue-500/20 p-4 rounded-lg">
            <Calendar className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Sessions Today</p>
            <p className="text-2xl font-bold text-white">{overview?.sessions.today}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-slate-700/50 p-4 rounded-lg">
            <TrendingUp className={`w-6 h-6 ${submissionRateColor}`} />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Submission Rate</p>
            <p className={`text-2xl font-bold ${submissionRateColor}`}>{overview?.assignments.submission_rate}%</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-blue-500/20 p-4 rounded-lg">
            <Clock className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Avg Session</p>
            <p className="text-2xl font-bold text-white">{overview?.sessions.avg_duration_minutes} min</p>
          </div>
        </div>
      </div>

      {/* --- SECTION 2: Session Trends Chart --- */}
      <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Session Activity — Last 14 Days</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sessionTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="day" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="sessions" name="Total Sessions" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorSessions)" />
              <Area type="monotone" dataKey="unique_users" name="Unique Users" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- SECTION 3: Two Charts Side by Side --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left - VM Usage by Template */}
        <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">VM Usage by Template</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={vmUsage?.by_template} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="template_name" type="category" stroke="#94a3b8" width={120} tick={{ fontSize: 12 }} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  cursor={{ fill: '#334155', opacity: 0.4 }}
                  formatter={(value, name, props) => {
                    if (name === "vm_count") return [value, "VMs Created"];
                    return [value, name];
                  }}
                />
                <Bar dataKey="vm_count" name="vm_count" radius={[0, 4, 4, 0]}>
                  {vmUsage?.by_template.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#barGradient-${index})`} />
                  ))}
                </Bar>
                <defs>
                  {vmUsage?.by_template.map((entry, index) => (
                    <linearGradient id={`barGradient-${index}`} key={index} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  ))}
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right - Actions Breakdown */}
        <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-6">Actions Breakdown (30 Days)</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activityStats?.actions_breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="action"
                >
                  {activityStats?.actions_breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={ACTION_COLORS[entry.action] || ACTION_COLORS['Other']} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- SECTION 4: Peak Hours Chart --- */}
      <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white">Peak Usage Hours</h3>
          <p className="text-sm text-slate-400">When students are most active</p>
        </div>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityStats?.peak_hours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} interval={1} />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                cursor={{ fill: '#334155', opacity: 0.4 }}
              />
              <Bar dataKey="sessions" name="Sessions Started" radius={[4, 4, 0, 0]}>
                {activityStats?.peak_hours.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.sessions === maxSessionsHour && maxSessionsHour > 0 ? '#F59E0B' : '#3B82F6'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- SECTION 5: Assignment Stats --- */}
      <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Assignment & Submission Stats</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left - Assignments by Class table */}
          <div>
            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">By Class</h4>
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Class</th>
                    <th className="px-4 py-3 font-medium">Assignments</th>
                    <th className="px-4 py-3 font-medium">Submissions</th>
                    <th className="px-4 py-3 font-medium">Late</th>
                    <th className="px-4 py-3 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-slate-300 bg-slate-800/50">
                  {assignmentStats?.assignments_by_class.length === 0 ? (
                    <tr><td colSpan="5" className="px-4 py-6 text-center text-slate-500">No assignment data available</td></tr>
                  ) : (
                    assignmentStats?.assignments_by_class.map((cls, idx) => (
                      <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{cls.class_name}</td>
                        <td className="px-4 py-3">{cls.total_assignments}</td>
                        <td className="px-4 py-3">{cls.total_submissions}</td>
                        <td className="px-4 py-3">{cls.late_submissions}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            cls.submission_rate >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            cls.submission_rate >= 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {cls.submission_rate}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right - Recent Submissions feed */}
          <div>
            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Recent Submissions</h4>
            <div className="space-y-3">
              {assignmentStats?.recent_submissions.length === 0 ? (
                <div className="text-center py-6 text-slate-500 border border-dashed border-slate-700 rounded-lg">
                  No recent submissions
                </div>
              ) : (
                assignmentStats?.recent_submissions.map((sub) => (
                  <div key={sub.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <div>
                      <p className="text-white font-medium text-sm">{sub.student_name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{sub.assignment_title}</p>
                      <p className="text-slate-500 text-xs mt-1">{formatTimeAgo(sub.submitted_at)}</p>
                    </div>
                    <div>
                      {sub.is_late ? (
                        <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-medium">Late</span>
                      ) : (
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs font-medium">On Time</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 6: Top VM Users --- */}
      <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Most Active Students</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-300">
              <tr>
                <th className="px-6 py-4 font-medium w-24 text-center">Rank</th>
                <th className="px-6 py-4 font-medium">Student</th>
                <th className="px-6 py-4 font-medium text-center">VMs Created</th>
                <th className="px-6 py-4 font-medium text-right">Total Session Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-slate-300">
              {vmUsage?.top_users.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No active students found</td></tr>
              ) : (
                vmUsage?.top_users.map((user, idx) => (
                  <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 mx-auto border border-slate-700">
                        {getRankBadge(idx)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-6 py-4 text-center text-white font-medium">{user.vm_count}</td>
                    <td className="px-6 py-4 text-right text-blue-400 font-medium">{user.total_session_hours} hrs</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
