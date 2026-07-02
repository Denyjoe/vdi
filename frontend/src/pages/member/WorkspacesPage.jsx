import { useState, useEffect } from 'react';
import { Plus, Laptop, Play, Square, Settings, Trash2, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import CreateWorkspaceModal from '../../components/member/CreateWorkspaceModal';

export default function WorkspacesPage() {
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [launchingId, setLaunchingId] = useState(null);

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    const fetchWorkspaces = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const res = await api.get('/workspaces/');
            if (res.data?.success) {
                setWorkspaces(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch workspaces', err);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    const handleLaunch = async (id) => {
        setLaunchingId(id);
        try {
            await api.post(`/workspaces/${id}/launch/`);
            fetchWorkspaces(false);
            
            // Poll for status
            const interval = setInterval(async () => {
                const res = await api.get('/workspaces/');
                if (res.data?.success) {
                    const ws = res.data.data.find(w => w.id === id);
                    if (ws && ws.status === 'active') {
                        clearInterval(interval);
                        setLaunchingId(null);
                        fetchWorkspaces(false);
                    }
                }
            }, 3000);
            
            // Cleanup interval after 30 seconds just in case
            setTimeout(() => clearInterval(interval), 30000);
            
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to launch workspace');
            setLaunchingId(null);
        }
    };

    const handleStop = async (id) => {
        try {
            await api.post(`/workspaces/${id}/stop/`);
            fetchWorkspaces();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to stop workspace');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) return;
        try {
            await api.delete(`/workspaces/${id}/`);
            fetchWorkspaces();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete workspace');
        }
    };

    const filteredWorkspaces = workspaces.filter(ws => ws.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Laptop className="w-6 h-6 text-indigo-400" />
                        My Workspaces
                    </h1>
                    <p className="text-slate-400 mt-1">Manage your cloud desktop environments.</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Search workspaces..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm w-full md:w-64"
                        />
                    </div>
                    <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors whitespace-nowrap">
                        <Plus className="w-4 h-4" /> New Workspace
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>
            ) : filteredWorkspaces.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredWorkspaces.map(ws => (
                        <div key={ws.id} className="glass-card rounded-xl overflow-hidden border border-white/5 hover:border-indigo-500/30 transition-all flex flex-col">
                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-semibold text-white text-lg">{ws.name}</h3>
                                        <p className="text-slate-400 text-sm mt-1">{ws.vm_template_details?.name || 'Custom VM'}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${
                                        ws.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                                        'bg-slate-800 text-slate-400 border border-white/10'
                                    }`}>
                                        {ws.status}
                                    </span>
                                </div>
                                
                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Compute Used</span>
                                        <span className="text-slate-300">{ws.compute_hours_used.toFixed(1)} hrs</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Last Accessed</span>
                                        <span className="text-slate-300">
                                            {ws.last_accessed_at ? new Date(ws.last_accessed_at).toLocaleDateString() : 'Never'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-[#0D1526] p-3 flex gap-2 border-t border-white/5">
                                {ws.status === 'active' ? (
                                    <>
                                        <button onClick={() => navigate(`/session/${ws.id}`)} className="flex-1 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg text-sm font-medium transition-colors border border-green-500/20">
                                            Connect
                                        </button>
                                        <button onClick={() => handleStop(ws.id)} className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg transition-colors border border-amber-500/20" title="Stop">
                                            <Square className="w-5 h-5 fill-current" />
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={() => handleLaunch(ws.id)} 
                                        disabled={launchingId === ws.id}
                                        className="flex-1 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-medium transition-colors border border-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {launchingId === ws.id ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
                                        ) : (
                                            <><Play className="w-4 h-4 fill-current" /> Launch</>
                                        )}
                                    </button>
                                )}
                                
                                <button className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition-colors" title="Settings">
                                    <Settings className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleDelete(ws.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Delete">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-12 glass-card rounded-2xl text-center border-dashed border-2 border-white/10">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Laptop className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2">No Workspaces Found</h3>
                    <p className="text-slate-400 max-w-sm mx-auto mb-6">You haven't created any workspaces yet. Start by creating your first cloud environment.</p>
                    <button className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all inline-flex items-center gap-2">
                        <Plus className="w-5 h-5" /> Create Workspace
                    </button>
                </div>
            )}
            {isCreateModalOpen && <CreateWorkspaceModal onClose={() => setIsCreateModalOpen(false)} onCreated={fetchWorkspaces} />}
        </div>
    );
}
