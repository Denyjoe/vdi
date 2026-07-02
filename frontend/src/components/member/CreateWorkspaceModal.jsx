import { useState, useEffect } from 'react';
import { X, Search, Laptop, Check } from 'lucide-react';
import api from '../../services/api';

export default function CreateWorkspaceModal({ onClose, onCreated }) {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    
    const [name, setName] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/vms/templates/');
            if (res.data?.success) {
                setTemplates(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch templates', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !selectedTemplate) {
            setError('Please provide a name and select a template.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const res = await api.post('/workspaces/', {
                name,
                vm_template_id: selectedTemplate
            });
            if (res.data?.success) {
                onCreated(res.data.data);
                onClose();
            } else {
                setError(res.data?.message || 'Failed to create workspace');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create workspace');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-[#0B1120] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white">Create New Workspace</h2>
                        <p className="text-sm text-slate-400 mt-1">Select an environment and give it a name.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Workspace Name</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. AutoCAD Project Alpha"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                            required
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <label className="block text-sm font-medium text-slate-300">Select Template</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    type="text" 
                                    placeholder="Search..." 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 pr-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div></div>
                        ) : filteredTemplates.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredTemplates.map(t => (
                                    <div 
                                        key={t.id}
                                        onClick={() => setSelectedTemplate(t.id)}
                                        className={`cursor-pointer p-4 rounded-xl border transition-all relative ${selectedTemplate === t.id ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                                    >
                                        {selectedTemplate === t.id && (
                                            <div className="absolute top-3 right-3 bg-indigo-500 rounded-full p-0.5">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                                <Laptop className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-white text-sm">{t.name}</h4>
                                                <p className="text-xs text-slate-400 capitalize">{t.os_type}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-1 rounded">
                                                {t.cpu_cores} Cores
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-1 rounded">
                                                {t.memory_mb / 1024}GB RAM
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400 text-sm">No templates found.</div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-slate-900/50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !name || !selectedTemplate}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Workspace'}
                    </button>
                </div>
            </div>
        </div>
    );
}
