import React, { useState, useEffect } from 'react';
import { BarChart2, Users, Clock, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useUIStore from '../store/uiStore';

export default function HostAnalyticsPage() {
  const [stats, setStats] = useState({
    total_sessions_hosted: 0,
    total_participants: 0,
    total_session_hours: 0,
    avg_participants_per_session: 0
  });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { openCreateSessionModal } = useUIStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const sessionsRes = await api.get('/sessions/live/');
      if (sessionsRes.data?.success) {
        const sessionsData = sessionsRes.data.data.my_hosted || [];
        setSessions(sessionsData);
        
        const total = sessionsData.length;
        const totalHours = sessionsData.reduce((sum, s) => {
          if (s.start_time && s.end_time) {
            const diff = new Date(s.end_time) - new Date(s.start_time);
            return sum + (diff / 3600000);
          }
          return sum;
        }, 0);

        setStats({
          total_sessions_hosted: total,
          total_participants: 0,
          total_session_hours: totalHours.toFixed(1),
          avg_participants_per_session: 0
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '---';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return '---';
    const diff = new Date(end) - new Date(start);
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">My Analytics</h1>
        <p className="text-slate-400">Track your session performance</p>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions Hosted', value: stats.total_sessions_hosted || 0, icon: Video, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
          { label: 'Total Participants (all time)', value: stats.total_participants || 0, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: 'Total Session Hours', value: stats.total_session_hours || 0, icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
          { label: 'Avg Participants/Session', value: stats.avg_participants_per_session || 0, icon: BarChart2, color: 'text-amber-400', bg: 'bg-amber-400/10' },
        ].map(s => (
          <div key={s.label} className="glass-card p-6 rounded-xl border border-white/5">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.bg}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-slate-400 text-sm font-medium">{s.label}</p>
            </div>
            <p className="text-3xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* SESSIONS TABLE */}
      <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">Recent Sessions</h2>
        </div>
        
        {loading ? (
          <div className="p-12 flex justify-center text-slate-400">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No sessions yet</h3>
            <p className="text-slate-400 mb-6">Create a live session to see your analytics here.</p>
            <button 
              onClick={openCreateSessionModal}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
            >
              Create your first session &rarr;
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Participants</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-white">{s.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">
                        {s.session_type || 'Custom'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {s.start_time ? new Date(s.start_time).toLocaleDateString() : '---'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {s.participants_count || s.max_participants || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {s.start_time && s.end_time
                        ? `${((new Date(s.end_time) - new Date(s.start_time)) / 3600000).toFixed(1)}h`
                        : 'Ongoing'}
                    </td>
                    <td className="px-6 py-4">
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: s.status === 'active'
                          ? 'rgba(16,185,129,0.15)'
                          : 'rgba(99,102,241,0.15)',
                        color: s.status === 'active'
                          ? '#34d399' : '#a5b4fc'
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/host/session/${s.id}`)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          background: 'rgba(99,102,241,0.15)',
                          border: '1px solid rgba(99,102,241,0.2)',
                          color: '#a5b4fc',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}>
                        {s.status === 'active' ? 'Monitor' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
