import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Search, Filter, Calendar, Users, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import JoinByCodeModal from '../../components/shared/JoinByCodeModal';

export default function SessionsPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isJoinOpen, setIsJoinOpen] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            const res = await api.get('/sessions/live/discover/');
            if (res.data?.success) {
                setSessions(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch public sessions', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async (sessionId) => {
        if (!user) {
            navigate('/login');
            return;
        }
        // In a real app we'd call an endpoint to join by ID here, 
        // or open a modal to confirm. For now we use the code modal as the main way
        setIsJoinOpen(true);
    };

    const filteredSessions = sessions.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        s.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.3s_ease-out]">
            {/* Header Area */}
            <div className="relative rounded-3xl overflow-hidden bg-[#0A101D] border border-[var(--border-color)] p-8 md:p-12">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none"></div>
                
                <div className="relative z-10 max-w-2xl">
                    <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">Discover Live Sessions</h1>
                    <p className="text-[var(--text-secondary)] text-lg mb-8">Join workshops, labs, and study groups hosted by instructors around the world.</p>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input 
                                type="text" 
                                placeholder="Search sessions..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-[#111827] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                            />
                        </div>
                        <button onClick={() => setIsJoinOpen(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-[var(--text-primary)] rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap">
                            Have an Invite Code?
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">Upcoming & Active</h2>
                    <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2 text-sm font-medium transition-colors">
                        <Filter className="w-4 h-4" /> Filter
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>
                ) : filteredSessions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSessions.map(session => (
                            <div key={session.id} className="glass-card rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all group flex flex-col">
                                <div className="p-6 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${
                                            session.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                                            'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                        }`}>
                                            {session.status}
                                        </span>
                                        <span className="text-xs font-medium text-[var(--text-secondary)] bg-white/5 px-2 py-1 rounded capitalize">
                                            {session.session_type}
                                        </span>
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 line-clamp-1">{session.name}</h3>
                                    <p className="text-sm text-[var(--text-secondary)] mb-6 line-clamp-2">{session.description || 'No description provided.'}</p>
                                    
                                    <div className="space-y-3">
                                        <div className="flex items-center text-sm text-[var(--text-primary)]">
                                            <Calendar className="w-4 h-4 text-slate-500 mr-3" />
                                            {new Date(session.start_time).toLocaleString()}
                                        </div>
                                        <div className="flex items-center text-sm text-[var(--text-primary)]">
                                            <Users className="w-4 h-4 text-slate-500 mr-3" />
                                            {session.participant_count} / {session.max_participants} Participants
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-4 border-t border-[var(--border-color)] bg-[#0D1526] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[var(--text-primary)] font-bold text-xs">
                                            {session.host_details?.first_name?.charAt(0) || 'H'}
                                        </div>
                                        <span className="text-sm text-[var(--text-primary)]">{session.host_details?.first_name} {session.host_details?.last_name}</span>
                                    </div>
                                    <button onClick={() => handleJoin(session.id)} className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-[var(--text-primary)] transition-colors">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 glass-card rounded-3xl text-center border-dashed border-2 border-[var(--border-color)]">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Video className="w-8 h-8 text-slate-500" />
                        </div>
                        <h3 className="text-xl font-medium text-[var(--text-primary)] mb-2">No Public Sessions Found</h3>
                        <p className="text-[var(--text-secondary)] max-w-sm mx-auto">There are currently no public sessions scheduled. Check back later or use an invite code to join a private session.</p>
                    </div>
                )}
            </div>

            {isJoinOpen && <JoinByCodeModal type="session" onClose={() => setIsJoinOpen(false)} onJoined={() => navigate('/member/dashboard')} />}
        </div>
    );
}
