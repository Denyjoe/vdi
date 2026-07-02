import { useState, useEffect } from 'react';
import { Users, Search, ChevronRight, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import JoinByCodeModal from '../../components/shared/JoinByCodeModal';

export default function MemberGroupsPage() {
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [copiedId, setCopiedId] = useState(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await api.get('/groups/');
            if (res.data?.success) {
                setGroups(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch groups', err);
        } finally {
            setIsLoading(false);
        }
    };

    const copyCode = (code, id) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

    const gradients = [
        'from-blue-500/20 to-purple-500/20',
        'from-emerald-500/20 to-teal-500/20',
        'from-orange-500/20 to-red-500/20',
        'from-indigo-500/20 to-cyan-500/20',
        'from-pink-500/20 to-rose-500/20'
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-400" />
                        My Groups
                    </h1>
                    <p className="text-slate-400 mt-1">Collaborate and access shared resources.</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Search groups..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm w-full md:w-64"
                        />
                    </div>
                    <button onClick={() => setIsJoinModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors whitespace-nowrap">
                        + Join a Group
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>
            ) : filteredGroups.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredGroups.map((group, idx) => {
                        const gradient = gradients[idx % gradients.length];
                        return (
                            <div key={group.id} className="glass-card rounded-xl overflow-hidden border border-white/5 hover:border-indigo-500/30 transition-all flex flex-col">
                                <div className={`h-24 bg-gradient-to-r ${gradient} relative`}>
                                    <div className="absolute top-4 right-4">
                                        <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${group.is_public ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-slate-800/80 text-slate-300 border border-white/10 backdrop-blur-sm'}`}>
                                            {group.is_public ? 'Public' : 'Private'}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-5 flex-1 flex flex-col -mt-6">
                                    <div className="bg-[#0D1526] w-12 h-12 rounded-xl flex items-center justify-center border border-white/10 mb-3 shadow-lg">
                                        <Users className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg leading-tight">{group.name}</h3>
                                    <p className="text-sm text-slate-400 mt-1">Created by {group.created_by?.first_name || 'Instructor'}</p>
                                    
                                    <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                                        <span>{group.member_count || 0} members</span>
                                        {group.invite_code && (
                                            <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded border border-white/5">
                                                <span className="font-mono text-xs">{group.invite_code}</span>
                                                <button onClick={() => copyCode(group.invite_code, group.id)} className="text-slate-400 hover:text-white transition-colors">
                                                    {copiedId === group.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="mt-6 pt-4 border-t border-white/5 flex-1 flex items-end">
                                        <button className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                                            Open Group <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center border-dashed border-2 border-white/10">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                        <Users className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">You haven't joined any groups yet</h3>
                    <p className="text-slate-400 max-w-md mb-6">Join a group with an invite code to collaborate with others and access shared materials.</p>
                    <button onClick={() => setIsJoinModalOpen(true)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20">
                        Join a Group
                    </button>
                </div>
            )}
            
            {isJoinModalOpen && <JoinByCodeModal type="group" onClose={() => setIsJoinModalOpen(false)} onJoined={fetchGroups} />}
        </div>
    );
}
