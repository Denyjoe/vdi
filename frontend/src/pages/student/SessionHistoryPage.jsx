import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Monitor, Terminal, Activity, Search } from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import EmptyState from '../../components/shared/EmptyState';

export default function SessionHistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await sessionService.getMySessions();
      if (res.data.success) {
        setSessions(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-medium border border-emerald-500/20">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            Active
          </span>
        );
      case 'disconnected':
        return (
          <span className="inline-flex items-center gap-1.5 bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-600">
            Disconnected
          </span>
        );
      case 'terminated':
        return (
          <span className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full text-xs font-medium border border-red-500/20">
            Terminated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-600">
            {status}
          </span>
        );
    }
  };

  const totalTimeSeconds = sessions.reduce((acc, curr) => acc + curr.duration_seconds, 0);
  const totalH = Math.floor(totalTimeSeconds / 3600);
  const totalM = Math.floor((totalTimeSeconds % 3600) / 60);
  const totalTimeStr = `${totalH}h ${totalM}m`;

  const avgSeconds = sessions.length ? totalTimeSeconds / sessions.length : 0;
  const avgM = Math.floor(avgSeconds / 60);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Activity className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-inter">Session History</h1>
        <p className="text-slate-400 mt-1 text-sm">Review your past virtual machine sessions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-blue-500/20 p-4 rounded-lg">
            <Monitor className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total Sessions</p>
            <p className="text-2xl font-bold text-white">{sessions.length}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-purple-500/20 p-4 rounded-lg">
            <Clock className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total Time</p>
            <p className="text-2xl font-bold text-white">{totalTimeStr}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4">
          <div className="bg-emerald-500/20 p-4 rounded-lg">
            <Activity className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Average Session</p>
            <p className="text-2xl font-bold text-white">{avgM}m</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-md overflow-hidden flex flex-col">
        {sessions.length === 0 ? (
          <EmptyState
            icon={<Terminal className="w-12 h-12 text-slate-500 mx-auto" />}
            title="No Session History"
            description="You haven't connected to any virtual machines yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-300">
              <thead className="text-xs uppercase text-slate-400 bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left font-medium">VM Name</th>
                  <th className="px-6 py-4 text-left font-medium">Status</th>
                  <th className="px-6 py-4 text-left font-medium">Duration</th>
                  <th className="px-6 py-4 text-left font-medium">Started At</th>
                  <th className="px-6 py-4 text-left font-medium">Ended At</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-700/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{session.vm.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{session.vm.template_name}</div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(session.status)}</td>
                    <td className="px-6 py-4 text-slate-300 font-mono text-xs tracking-wider">
                      {session.duration_display}
                    </td>
                    <td className="px-6 py-4">{formatDateTime(session.started_at)}</td>
                    <td className="px-6 py-4">{formatDateTime(session.ended_at)}</td>
                    <td className="px-6 py-4 text-right">
                      {session.status === 'active' ? (
                        <button 
                          onClick={() => navigate(`/session/${session.id}`)}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                        >
                          Resume
                        </button>
                      ) : (
                        <button className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                          View Details
                        </button>
                      )}
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
