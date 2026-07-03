import { useState, useEffect } from 'react';
import { Tv, Clock, Calendar, ChevronRight, Play } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import JoinByCodeModal from '../../components/shared/JoinByCodeModal';

export default function MemberSessionsPage() {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState({ joined: [], active: null });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            const res = await api.get('/sessions/live/');
            if (res.data?.success) {
                setSessions(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch sessions', err);
        } finally {
            setIsLoading(false);
        }
    };

    const upcomingSessions = sessions.joined.filter(s => s.status === 'scheduled');
    const pastSessions = sessions.joined.filter(s => s.status === 'ended');
    const activeSession = sessions.joined.find(s => s.status === 'active') || sessions.active;

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Tv className="w-6 h-6 text-indigo-400" />
                        My Sessions
                    </h1>
                    <p className="text-slate-400 mt-1">Live VM sessions you have joined or are hosting</p>
                </div>
            </div>

            <div className="flex gap-4 border-b border-white/10">
                <button 
                    onClick={() => setActiveTab('upcoming')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'upcoming' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                >
                    Upcoming & Active
                </button>
                <button 
                    onClick={() => setActiveTab('past')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'past' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                >
                    Past Sessions
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>
            ) : activeTab === 'upcoming' ? (
                <div className="space-y-6">
                    {activeSession && (
                        <div className="glass-card p-6 rounded-2xl border border-green-500/30 relative overflow-hidden animate-[pulse_3s_ease-in-out_infinite]">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="flex h-2.5 w-2.5 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                        </span>
                                        <span className="text-green-500 font-bold text-sm tracking-wider">LIVE NOW</span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-1">{activeSession.name}</h2>
                                    <p className="text-slate-300">Host: {activeSession.instructor?.first_name || 'Instructor'}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden md:block">
                                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Time Remaining</div>
                                        <div className="text-xl font-mono text-white">--:--:--</div>
                                    </div>
                                    <button className="px-6 py-3 bg-green-500 hover:bg-green-400 text-slate-900 rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center gap-2">
                                        <Play className="w-5 h-5 fill-current" /> Rejoin Session
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {upcomingSessions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {upcomingSessions.map(session => (
                                <div key={session.id} className="glass-card p-5 rounded-xl border border-white/5 flex flex-col h-full hover:border-indigo-500/30 transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-semibold text-white text-lg leading-tight">{session.name}</h3>
                                        <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-1 rounded border border-indigo-500/20">
                                            {session.session_type || 'Session'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                                        <Users className="w-4 h-4" /> Host: {session.instructor?.first_name || 'Instructor'}
                                    </p>
                                    
                                    <div className="space-y-2 mb-6">
                                        <div className="flex items-center gap-3 text-sm text-slate-300">
                                            <Calendar className="w-4 h-4 text-slate-500" />
                                            {new Date(session.start_time).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-300">
                                            <Clock className="w-4 h-4 text-slate-500" />
                                            {new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-auto">
                                        <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Required VM</div>
                                        <div className="bg-slate-800 text-slate-300 text-xs px-3 py-2 rounded-lg border border-white/5 mb-4">
                                            {session.vm_template?.name || 'Any template'}
                                        </div>
                                        <button disabled className="w-full py-2 bg-slate-800 text-slate-500 rounded-lg text-sm font-medium border border-white/5 cursor-not-allowed">
                                            Session not started yet
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        !activeSession && (
                            <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center border-dashed border-2 border-white/10">
                                <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                                    <Tv className="w-8 h-8 text-indigo-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">No sessions yet</h3>
                                <p className="text-slate-400 max-w-md mb-6">Join a session using an invite code shared by the host.</p>
                                <div className="flex gap-4">
                                    <button onClick={() => setIsJoinModalOpen(true)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20">
                                        Enter Invite Code
                                    </button>
                                </div>
                            </div>
                        )
                    )}
                </div>
            ) : (
                <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                    {pastSessions.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5 text-slate-400 text-sm">
                                    <th className="p-4 font-medium">Session Name</th>
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">Duration</th>
                                    <th className="p-4 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pastSessions.map(session => (
                                    <tr key={session.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-white font-medium">{session.name}</td>
                                        <td className="p-4 text-slate-300">{new Date(session.start_time).toLocaleDateString()}</td>
                                        <td className="p-4 text-slate-300">--</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded border border-white/10 uppercase tracking-wider">Ended</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-12 text-center text-slate-400">
                            No past sessions found.
                        </div>
                    )}
                </div>
            )}
            
            {isJoinModalOpen && <JoinByCodeModal type="session" onClose={() => setIsJoinModalOpen(false)} onJoined={fetchSessions} />}
        </div>
    );
}
