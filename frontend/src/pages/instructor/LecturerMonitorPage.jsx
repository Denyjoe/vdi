import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Activity, Users, ShieldAlert, Monitor, Eye, X,
    Play, Edit, Trash2, StopCircle, BarChart2, Clock, 
    ArrowLeft, AlertTriangle
} from 'lucide-react';
import api from '../../services/api';

function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

export default function LecturerMonitorPage() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    
    const [sessionData, setSessionData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchMonitorData();
        const interval = setInterval(fetchMonitorData, 5000);
        return () => clearInterval(interval);
    }, [sessionId]);

    const fetchMonitorData = async () => {
        try {
            const res = await api.get(`/sessions/live/${sessionId}/monitor/`);
            if (res.data?.success) {
                setSessionData(res.data.data);
            }
            setError(null);
        } catch (err) {
            setError('Failed to load session monitor data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveParticipant = async (userId) => {
        if (!confirm('Are you sure you want to remove this participant?')) return;
        try {
            await api.post(`/sessions/live/${sessionId}/remove_participant/`, { user_id: userId });
            fetchMonitorData();
        } catch (err) {
            alert('Failed to remove participant');
        }
    };

    const handleEndSession = async () => {
        if (!confirm('Are you sure you want to end this session for everyone?')) return;
        try {
            await api.post(`/sessions/live/${sessionId}/end/`);
            navigate('/instructor/sessions');
        } catch (err) {
            alert('Failed to end session');
        }
    };

    if (isLoading && !sessionData) {
        return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>;
    }

    if (error) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center max-w-md mx-auto">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Error</h2>
                    <p className="text-red-300 mb-6">{error}</p>
                    <button onClick={() => navigate('/instructor/sessions')} className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/instructor/sessions')} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-3xl font-bold text-white">{sessionData?.name || 'Live Session'}</h1>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> LIVE
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm">Monitoring participants in real-time.</p>
                </div>
                <button onClick={handleEndSession} className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-medium transition-all flex items-center gap-2">
                    <StopCircle className="w-5 h-5" /> End Session
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-[#0B1120] rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-400 mb-1">Participants</div>
                        <div className="text-2xl font-bold text-white">{sessionData?.participants?.length || 0}</div>
                    </div>
                </div>
                <div className="bg-[#0B1120] rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-400 mb-1">Status</div>
                        <div className="text-2xl font-bold text-white capitalize">{sessionData?.status}</div>
                    </div>
                </div>
                <div className="bg-[#0B1120] rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-400 mb-1">Uptime</div>
                        <div className="text-2xl font-bold text-white">
                            {formatDuration(sessionData?.duration_seconds || 0)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Participants Table */}
            <div className="bg-[#0B1120] rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                    <h2 className="text-lg font-bold text-white">Connected Students</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs uppercase tracking-wider text-slate-500 bg-white/5 border-b border-white/10">
                                <th className="p-4 font-medium">Student Name</th>
                                <th className="p-4 font-medium">VM Status</th>
                                <th className="p-4 font-medium">Connected Time</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {!sessionData?.participants || sessionData.participants.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400">
                                        No participants connected yet.
                                    </td>
                                </tr>
                            ) : (
                                sessionData.participants.map(p => (
                                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-white">{p.first_name} {p.last_name}</div>
                                            <div className="text-xs text-slate-500">{p.email}</div>
                                        </td>
                                        <td className="p-4">
                                            {p.vm_status === 'running' ? (
                                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold w-max">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Running
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-md bg-white/5 text-slate-300 text-xs font-medium border border-white/10 capitalize w-max inline-block">
                                                    {p.vm_status || 'Pending'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-slate-300">
                                            {formatDuration(p.connected_time_seconds || 0)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button 
                                                onClick={() => handleRemoveParticipant(p.id)}
                                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Remove
                                            </button>
                                        </td>
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
