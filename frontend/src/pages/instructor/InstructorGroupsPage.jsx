import { useState, useEffect } from 'react';
import { Plus, Users, Copy, Share2, Settings, FileText, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import CreateGroupModal from '../../components/instructor/CreateGroupModal';

export default function InstructorGroupsPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [copiedId, setCopiedId] = useState(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/groups/');
            if (res.data?.success) {
                // Filter by created_by = current user
                const myGroups = res.data.data.filter(g => g.created_by.id === user.id);
                setGroups(myGroups);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (code, id) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleShare = (code) => {
        const link = `https://app.clouddesk.io/join/group/${code}`;
        navigator.clipboard.writeText(link);
        alert('Invite link copied to clipboard!');
    };

    // Helper for random gradients
    const getGradient = (index) => {
        const gradients = [
            'from-indigo-500 to-purple-600',
            'from-emerald-500 to-teal-600',
            'from-blue-500 to-cyan-600',
            'from-rose-500 to-pink-600',
            'from-amber-500 to-orange-600',
        ];
        return gradients[index % gradients.length];
    };

    return (
        <div className="p-8 max-w-7xl mx-auto animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">My Groups</h1>
                    <p className="text-slate-400">Organize students, manage access, and share materials.</p>
                </div>
                <button onClick={() => setIsCreateModalOpen(true)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2">
                    <Plus className="w-5 h-5" /> Create Group
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>
            ) : groups.length === 0 ? (
                <div className="text-center py-20 bg-[#0B1120] rounded-2xl border border-white/5">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">No Groups Yet</h3>
                    <p className="text-slate-400 max-w-sm mx-auto mb-6">Create your first group to start organizing your students and sessions.</p>
                    <button onClick={() => setIsCreateModalOpen(true)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all">
                        Create Group
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group, idx) => (
                        <div key={group.id} className="bg-[#0B1120] rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-colors flex flex-col">
                            {/* Gradient Header */}
                            <div className={`h-24 bg-gradient-to-r ${getGradient(idx)} relative`}>
                                <div className="absolute inset-0 bg-black/20"></div>
                                <div className="absolute bottom-0 left-0 w-full p-4">
                                    <h3 className="text-xl font-bold text-white truncate drop-shadow-md">{group.name}</h3>
                                </div>
                            </div>

                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="px-2.5 py-1 rounded-md bg-white/5 text-slate-300 text-xs font-medium border border-white/10 capitalize">
                                        {group.group_type || 'Private'}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                                        <Users className="w-4 h-4" />
                                        {group.members?.length || 0} members
                                    </div>
                                </div>

                                {/* Invite Section */}
                                <div className="bg-[#050B18] rounded-xl p-3 border border-white/5 mb-6">
                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Invite Code</div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-lg font-bold text-white tracking-widest">{group.invite_code}</span>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleCopy(group.invite_code, group.id)}
                                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                title="Copy Code"
                                            >
                                                {copiedId === group.id ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                            <button 
                                                onClick={() => handleShare(group.invite_code)}
                                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-indigo-400 hover:text-indigo-300 transition-colors"
                                                title="Share Link"
                                            >
                                                <Share2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
                                    <button onClick={() => navigate(`/instructor/groups/${group.id}`)} className="w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                        <Settings className="w-4 h-4 text-slate-400" /> Manage Members →
                                    </button>
                                    <button onClick={() => navigate('/instructor/materials')} className="w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-400" /> Post Material →
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isCreateModalOpen && <CreateGroupModal onClose={() => setIsCreateModalOpen(false)} onCreated={fetchGroups} />}
        </div>
    );
}
