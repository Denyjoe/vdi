import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { Play, LogOut, CheckCircle2, ChevronRight, FolderOpen, Tv, CreditCard, Laptop, MoreVertical, Plus, Zap, Users } from 'lucide-react';
import JoinByCodeModal from '../../components/shared/JoinByCodeModal';
import UpgradeModal from '../../components/shared/UpgradeModal';

export default function MemberDashboard() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [workspaces, setWorkspaces] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [isJoinSessionOpen, setIsJoinSessionOpen] = useState(false);
    const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, wsRes, sessionsRes, groupsRes] = await Promise.all([
                api.get('/stats/'),
                api.get('/workspaces/'),
                api.get('/sessions/live/'),
                api.get('/groups/')
            ]);
            
            if (statsRes.data?.success) setStats(statsRes.data.data);
            if (wsRes.data?.success) setWorkspaces(wsRes.data.data.slice(0, 3));
            if (sessionsRes.data?.success) setSessions(sessionsRes.data.data.joined.slice(0, 3));
            if (groupsRes.data?.success) setGroups(groupsRes.data.data.slice(0, 3));
        } catch (err) {
            console.error('Failed to fetch dashboard data', err);
        } finally {
            setIsLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>;
    }

    const planName = user?.subscription?.plan_name || 'free';
    const planDisplayName = user?.subscription?.display_name || 'Free Plan';
    const isPro = planName !== 'free' && planName !== 'starter';
    const hoursUsed = stats?.hours_used_this_month || 0;
    const hoursRemaining = stats?.hours_remaining || 0;
    const hoursTotal = hoursUsed + hoursRemaining;
    const hoursPercentage = hoursTotal > 0 ? (hoursUsed / hoursTotal) * 100 : 0;
    
    let hoursColor = 'text-green-500';
    let progressColor = 'bg-green-500';
    if (hoursPercentage > 80) { hoursColor = 'text-amber-500'; progressColor = 'bg-amber-500'; }
    if (hoursPercentage > 95) { hoursColor = 'text-red-500'; progressColor = 'bg-red-500'; }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.3s_ease-out]">
            {/* TOP ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card p-8 rounded-2xl flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-[var(--text-primary)]">{getGreeting()}, {user?.first_name} 👋</h1>
                        </div>
                        <p className="text-[var(--text-secondary)] text-lg mb-6">Welcome back to your cloud workspace.</p>
                        
                        <button onClick={() => navigate('/pricing')} className="inline-flex items-center px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-colors">
                            <Zap className="w-4 h-4 mr-1.5" />
                            {planDisplayName}
                        </button>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
                    <h3 className="font-semibold text-[var(--text-primary)] mb-4">Compute Hours</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            {planName === 'institution' ? (
                                <div className="text-2xl font-bold text-green-500">Unlimited</div>
                            ) : (
                                <>
                                    <div className="text-3xl font-bold text-[var(--text-primary)] mb-1">
                                        <span className={hoursColor}>{hoursUsed.toFixed(1)}</span> <span className="text-slate-500 text-xl">/ {hoursTotal}h</span>
                                    </div>
                                    <p className="text-sm text-[var(--text-secondary)]">Used this month</p>
                                </>
                            )}
                        </div>
                        {planName !== 'institution' && (
                            <div className="relative w-16 h-16">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path className={hoursColor} strokeDasharray={`${hoursPercentage}, 100`} strokeWidth="3" stroke="currentColor" fill="none" strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                            </div>
                        )}
                    </div>
                    {hoursPercentage > 80 && planName !== 'institution' && (
                        <button onClick={() => setIsUpgradeModalOpen(true)} className="mt-4 w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-medium transition-all text-center border border-indigo-500/20">
                            Upgrade Plan
                        </button>
                    )}
                </div>
            </div>

            {/* MIDDLE ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Workspaces Card */}
                <div className="glass-card p-6 rounded-2xl flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Laptop className="w-5 h-5 text-indigo-400" />
                            <h3 className="font-semibold text-[var(--text-primary)]">My Workspaces</h3>
                            <span className="bg-[var(--bg-card)] text-[var(--text-primary)] text-xs py-0.5 px-2 rounded-full">{stats?.workspaces || 0}</span>
                        </div>
                        <Link to="/member/workspaces" className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center">
                            View All <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-3">
                        {workspaces.length > 0 ? workspaces.map(ws => (
                            <div key={ws.id} className="p-3 bg-[#0D1526] rounded-xl border border-[var(--border-color)] flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                                <div>
                                    <p className="font-medium text-[var(--text-primary)] text-sm">{ws.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${ws.status === 'active' ? 'bg-green-500' : 'bg-slate-500'}`}></span>
                                        <span className="text-xs text-[var(--text-secondary)] capitalize">{ws.status}</span>
                                    </div>
                                </div>
                                <button className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play className="w-4 h-4" />
                                </button>
                            </div>
                        )) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                                <p className="text-sm text-[var(--text-secondary)] mb-4">No workspaces yet.</p>
                                <button onClick={() => navigate('/member/workspaces')} className="text-sm text-indigo-400 font-medium bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20">
                                    Create Workspace
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Joined Sessions Card */}
                <div className="glass-card p-6 rounded-2xl flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Tv className="w-5 h-5 text-indigo-400" />
                            <h3 className="font-semibold text-[var(--text-primary)]">Joined Sessions</h3>
                        </div>
                        <Link to="/sessions" className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center">
                            Discover <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-3">
                        {sessions.length > 0 ? sessions.map(session => (
                            <div key={session.id} className="p-3 bg-[#0D1526] rounded-xl border border-[var(--border-color)]">
                                <p className="font-medium text-[var(--text-primary)] text-sm mb-1">{session.name}</p>
                                <p className="text-xs text-[var(--text-secondary)]">{new Date(session.start_time).toLocaleString()}</p>
                                {session.status === 'active' && (
                                    <button className="mt-2 w-full py-1.5 bg-green-500/10 text-green-500 rounded text-xs font-medium border border-green-500/20">
                                        Join Live Session
                                    </button>
                                )}
                            </div>
                        )) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                                <p className="text-sm text-[var(--text-secondary)] mb-4">No upcoming sessions.</p>
                                <button onClick={() => setIsJoinSessionOpen(true)} className="text-sm text-indigo-400 font-medium bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20">
                                    Join by Code
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* My Groups Card */}
                <div className="glass-card p-6 rounded-2xl flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <FolderOpen className="w-5 h-5 text-indigo-400" />
                            <h3 className="font-semibold text-[var(--text-primary)]">My Groups</h3>
                        </div>
                        <Link to="/member/groups" className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center">
                            View All <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-3">
                        {groups.length > 0 ? groups.map(group => (
                            <div key={group.id} className="p-3 bg-[#0D1526] rounded-xl border border-[var(--border-color)] flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-[var(--text-primary)] text-sm">{group.name}</p>
                                    <p className="text-xs text-[var(--text-secondary)] mt-1">{group.member_count} members</p>
                                </div>
                                <button onClick={() => navigate(`/groups/${group.id}`)} className="text-xs font-medium text-indigo-400 hover:text-[var(--text-primary)] transition-colors">
                                    Open
                                </button>
                            </div>
                        )) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                                <p className="text-sm text-[var(--text-secondary)] mb-4">You haven't joined any groups.</p>
                                <button onClick={() => setIsJoinGroupOpen(true)} className="text-sm text-indigo-400 font-medium bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20">
                                    + Join a Group
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* BOTTOM ROW - Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link to="/templates" className="glass-card p-4 rounded-xl flex flex-col items-center text-center hover:border-indigo-500/40 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Laptop className="w-6 h-6 text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Browse Templates</span>
                </Link>
                <button onClick={() => setIsJoinSessionOpen(true)} className="glass-card p-4 rounded-xl flex flex-col items-center text-center hover:border-indigo-500/40 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Tv className="w-6 h-6 text-cyan-400" />
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Join Session</span>
                </button>
                <Link to="/member/groups" className="glass-card p-4 rounded-xl flex flex-col items-center text-center hover:border-indigo-500/40 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Users className="w-6 h-6 text-purple-400" />
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Browse Groups</span>
                </Link>
                <button onClick={() => setIsUpgradeModalOpen(true)} className="glass-card p-4 rounded-xl flex flex-col items-center text-center hover:border-indigo-500/40 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <CreditCard className="w-6 h-6 text-emerald-400" />
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Upgrade Plan</span>
                </button>
            </div>

            {isJoinSessionOpen && <JoinByCodeModal type="session" onClose={() => setIsJoinSessionOpen(false)} onJoined={fetchDashboardData} />}
            {isJoinGroupOpen && <JoinByCodeModal type="group" onClose={() => setIsJoinGroupOpen(false)} onJoined={fetchDashboardData} />}
            {isUpgradeModalOpen && <UpgradeModal onClose={() => setIsUpgradeModalOpen(false)} />}
        </div>
    );
}
