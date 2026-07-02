import { useState, useEffect } from 'react';
import { 
  Plus, Video, Clock, Users, Play, Edit, Trash2, StopCircle, 
  Copy, Monitor, ChevronRight, Activity, Calendar
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import CreateLiveSessionModal from '../../components/instructor/CreateLiveSessionModal';

export default function InstructorSessionsPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    
    const [activeTab, setActiveTab] = useState('upcoming');
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/sessions/live/');
            if (res.data?.success) {
                // Filter by created_by / host = current user
                // The API might already filter, but to be safe:
                const mySessions = res.data.data.filter(s => s.host.id === user.id);
                setSessions(mySessions);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartSession = async (id) => {
        try {
            await api.post(`/sessions/live/${id}/start/`);
            fetchSessions();
        } catch (err) {
            alert('Failed to start session');
        }
    };

    const handleDeleteSession = async (id) => {
        if (!confirm('Are you sure you want to delete this session?')) return;
        try {
            await api.delete(`/sessions/live/${id}/`);
            fetchSessions();
        } catch (err) {
            alert('Failed to delete session');
        }
    };

    const activeUpcoming = sessions.filter(s => s.status === 'active' || s.status === 'scheduled');
    const pastSessions = sessions.filter(s => s.status === 'ended' || s.status === 'cancelled');

    return (
        <div className="p-8 max-w-7xl mx-auto animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">My Sessions</h1>
                    <p className="text-slate-400">Manage your live classes, labs, and interactive sessions.</p>
                </div>
                <button onClick={() => setIsCreateModalOpen(true)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2">
                    <Plus className="w-5 h-5" /> Create Session
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/5 mb-8">
                <button 
                    onClick={() => setActiveTab('upcoming')}
                    className={`px-4 py-3 font-medium text-sm transition-all border-b-2 ${activeTab === 'upcoming' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-slate-300'}`}
                >
                    Active & Upcoming
                </button>
                <button 
                    onClick={() => setActiveTab('past')}
                    className={`px-4 py-3 font-medium text-sm transition-all border-b-2 ${activeTab === 'past' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-slate-300'}`}
                >
                    Past Sessions
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>
            ) : activeTab === 'upcoming' ? (
                <div className="space-y-6">
                    {activeUpcoming.length === 0 ? (
                        <div className="text-center py-20 bg-[#0B1120] rounded-2xl border border-white/5">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Video className="w-8 h-8 text-slate-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No Active or Upcoming Sessions</h3>
                            <p className="text-slate-400 max-w-sm mx-auto mb-6">Create a session to start teaching and collaborating live.</p>
                            <button onClick={() => setIsCreateModalOpen(true)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all">
                                Create Session
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {activeUpcoming.map(session => (
                                <div key={session.id} className={`p-6 rounded-2xl border transition-all ${session.status === 'active' ? 'bg-[#0B1120] border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : 'bg-[#0B1120] border-white/5 hover:border-white/10'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-bold text-white">{session.name}</h3>
                                                {session.status === 'active' ? (
                                                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold animate-pulse">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> LIVE
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-medium border border-indigo-500/20">
                                                        {session.session_type}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-400">{session.group?.name || 'Standalone Session'}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <Clock className="w-4 h-4 text-slate-500" />
                                            {session.status === 'active' ? 'Started: ' : 'Starts: '} 
                                            {new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <Users className="w-4 h-4 text-slate-500" />
                                            {session.participants?.length || 0} / {session.max_participants} joined
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 mb-6">
                                        <div className="text-sm">
                                            <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Invite Code</span>
                                            <span className="font-mono text-white font-medium tracking-widest">{session.invite_code}</span>
                                        </div>
                                        <button onClick={() => { navigator.clipboard.writeText(session.invite_code); alert('Code copied!'); }} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {session.status === 'active' ? (
                                            <button onClick={() => navigate(`/instructor/sessions/${session.id}/monitor`)} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                                                Monitor Live <ChevronRight className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <>
                                                <button onClick={() => handleStartSession(session.id)} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                                                    Start Now
                                                </button>
                                                <button className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-colors">
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleDeleteSession(session.id)} className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-[#0B1120] rounded-2xl border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500 bg-white/5">
                                    <th className="p-4 font-medium">Session Name</th>
                                    <th className="p-4 font-medium">Type</th>
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">Participants</th>
                                    <th className="p-4 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {pastSessions.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-slate-400">No past sessions found.</td>
                                    </tr>
                                ) : (
                                    pastSessions.map(session => (
                                        <tr key={session.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4">
                                                <div className="font-medium text-white">{session.name}</div>
                                                <div className="text-xs text-slate-500">{session.group?.name}</div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-300">{session.session_type}</td>
                                            <td className="p-4 text-sm text-slate-300">
                                                {new Date(session.start_time).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-sm text-slate-300">
                                                <div className="flex items-center gap-1.5">
                                                    <Users className="w-4 h-4 text-slate-500" />
                                                    {session.participants?.length || 0}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${session.status === 'ended' ? 'bg-slate-500/20 text-slate-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {session.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isCreateModalOpen && <CreateLiveSessionModal onClose={() => setIsCreateModalOpen(false)} onCreated={fetchSessions} />}
        </div>
    );
}
