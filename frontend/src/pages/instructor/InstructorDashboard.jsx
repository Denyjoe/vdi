import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { Play, Copy, FolderOpen, Users, Video, ShieldAlert, ChevronRight, Activity } from 'lucide-react';

export default function InstructorDashboard() {
    const { user } = useAuthStore();
    const [stats, setStats] = useState(null);
    const [sessions, setSessions] = useState({ active: [], upcoming: [] });
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, sessionsRes, groupsRes] = await Promise.all([
                api.get('/stats/'),
                api.get('/sessions/live/'),
                api.get('/groups/')
            ]);
            
            if (statsRes.data?.success) setStats(statsRes.data.data);
            
            if (sessionsRes.data?.success) {
                const hosted = sessionsRes.data.data.my_hosted || [];
                setSessions({
                    active: hosted.filter(s => s.status === 'active'),
                    upcoming: hosted.filter(s => s.status === 'scheduled')
                });
            }
            
            if (groupsRes.data?.success) {
                setGroups(groupsRes.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard data', err);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Toast notification logic here
    };

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>;
    }

    const planName = user?.subscription?.plan_name || 'free';
    const planDisplayName = user?.subscription?.display_name || 'Free Plan';
    const isPro = planName !== 'free' && planName !== 'starter';

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.3s_ease-out]">
            {/* TOP ROW */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl">
                <div>
                    <h1 className="text-2xl font-bold text-white">Welcome back, {user?.first_name}</h1>
                    <p className="text-slate-400 mt-1">Here's what's happening with your sessions and groups.</p>
                </div>
                <div className="inline-flex items-center px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-medium">
                    <ShieldAlert className="w-4 h-4 mr-2" />
                    {planDisplayName}
                </div>
            </div>

            {/* UPGRADE PROMPT */}
            {!isPro && (
                <div className="bg-amber-500/10 border border-amber-500/50 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Pro Plan Required</h3>
                            <p className="text-amber-200/70 text-sm mt-1">You need a Pro plan to create and host live sessions for your students.</p>
                        </div>
                    </div>
                    <Link to="/pricing" className="shrink-0 px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/25">
                        Upgrade Now →
                    </Link>
                </div>
            )}

            {/* STATS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-5 rounded-xl">
                    <p className="text-slate-400 text-sm font-medium mb-1">Groups Created</p>
                    <p className="text-3xl font-bold text-blue-400">{stats?.groups_created || 0}</p>
                </div>
                <div className="glass-card p-5 rounded-xl">
                    <p className="text-slate-400 text-sm font-medium mb-1">Sessions Hosted</p>
                    <p className="text-3xl font-bold text-indigo-400">{stats?.sessions_hosted || 0}</p>
                </div>
                <div className="glass-card p-5 rounded-xl">
                    <p className="text-slate-400 text-sm font-medium mb-1">Total Participants</p>
                    <p className="text-3xl font-bold text-green-400">{stats?.total_participants || 0}</p>
                </div>
                <div className="glass-card p-5 rounded-xl">
                    <p className="text-slate-400 text-sm font-medium mb-1">Total Members</p>
                    <p className="text-3xl font-bold text-cyan-400">{stats?.total_members || 0}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* MY SESSIONS */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Video className="w-5 h-5 text-indigo-400" />
                            My Live Sessions
                        </h2>
                        {isPro && (
                            <button className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                <Plus className="w-4 h-4" /> Create
                            </button>
                        )}
                    </div>

                    {sessions.active.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Now</h3>
                            {sessions.active.map(session => (
                                <div key={session.id} className="p-4 bg-[#0D1526] rounded-xl border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-2 h-full bg-green-500 animate-pulse"></div>
                                    <h4 className="font-semibold text-white mb-1">{session.name}</h4>
                                    <p className="text-xs text-slate-400 mb-4">{session.participant_count} / {session.max_participants} Participants</p>
                                    <Link to={`/instructor/sessions/${session.id}/monitor`} className="w-full py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all">
                                        <Activity className="w-4 h-4" />
                                        Monitor Live
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-3 mt-6">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upcoming</h3>
                        {sessions.upcoming.length > 0 ? sessions.upcoming.map(session => (
                            <div key={session.id} className="p-4 glass-card rounded-xl">
                                <h4 className="font-semibold text-white mb-1">{session.name}</h4>
                                <p className="text-xs text-slate-400 mb-4">Starts: {new Date(session.start_time).toLocaleString()}</p>
                                <button className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-medium transition-all">
                                    Start Session
                                </button>
                            </div>
                        )) : (
                            <div className="p-6 glass-card rounded-xl text-center border-dashed border-2 border-white/10">
                                <p className="text-sm text-slate-400">No upcoming sessions.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* MY GROUPS */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-400" />
                            My Groups
                        </h2>
                        {isPro && (
                            <button className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                <Plus className="w-4 h-4" /> Create Group
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groups.length > 0 ? groups.map(group => (
                            <div key={group.id} className="glass-card p-5 rounded-xl hover:border-indigo-500/30 transition-all flex flex-col h-full">
                                <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-semibold text-white text-lg leading-tight">{group.name}</h4>
                                    <span className="text-xs font-medium px-2 py-1 bg-white/5 text-slate-300 rounded-md capitalize">
                                        {group.group_type}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400 mb-4">{group.member_count} Members</p>
                                
                                <div className="mt-auto pt-4 border-t border-white/5 space-y-3">
                                    <div className="flex items-center justify-between bg-[#0D1526] p-2 rounded-lg border border-white/5">
                                        <span className="text-xs font-mono text-slate-300">Code: {group.invite_code}</span>
                                        <button 
                                            onClick={() => copyToClipboard(group.invite_code)}
                                            className="p-1.5 text-slate-400 hover:text-white bg-white/5 rounded-md hover:bg-white/10 transition-colors"
                                            title="Copy Code"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <Link to={`/instructor/groups/${group.id}`} className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-all">
                                        Manage <ChevronRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-1 md:col-span-2 p-12 glass-card rounded-xl text-center border-dashed border-2 border-white/10">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FolderOpen className="w-8 h-8 text-slate-500" />
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">No Groups Created</h3>
                                <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">Groups help you organize members and manage access to sessions and resources.</p>
                                {isPro && (
                                    <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all">
                                        Create Your First Group
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
