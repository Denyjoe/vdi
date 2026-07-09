import { useState, useEffect } from 'react';
import { X, CheckCircle, Copy, Link as LinkIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function CreateLiveSessionModal({ onClose, onCreated }) {
    const navigate = useNavigate();
    const [groups, setGroups] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [formData, setFormData] = useState({
        name: '',
        session_type: 'Lecture',
        group_id: '',
        vm_template_id: '',
        start_time: '',
        end_time: '',
        max_participants: 50,
        is_public: false,
        instructions: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [groupsRes, templatesRes] = await Promise.all([
                    api.get('/groups/'),
                    api.get('/vms/templates/')
                ]);
                if (groupsRes.data?.success) setGroups(groupsRes.data.data);
                if (templatesRes.data?.success) setTemplates(templatesRes.data.data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
        
        // Set default dates
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const start = now.toISOString().slice(0, 16);
        now.setHours(now.getHours() + 2);
        const end = now.toISOString().slice(0, 16);
        setFormData(prev => ({ ...prev, start_time: start, end_time: end }));
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            // Need to convert to ISO string for backend
            const payload = { ...formData };
            if (payload.start_time) payload.start_time = new Date(payload.start_time).toISOString();
            if (payload.end_time) payload.end_time = new Date(payload.end_time).toISOString();
            if (!payload.group_id) delete payload.group_id;
            if (!payload.vm_template_id) delete payload.vm_template_id;

            const res = await api.post('/sessions/live/create/', payload);
            if (res.data?.success) {
                setSuccessData(res.data.data);
                if (onCreated) onCreated();
            } else {
                setError(res.data?.message || 'Failed to create session');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create session');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyCode = () => {
        if (successData?.invite_code) {
            navigator.clipboard.writeText(successData.invite_code);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        }
    };

    const handleCopyLink = () => {
        if (successData?.invite_code) {
            navigator.clipboard.writeText(`https://app.clouddesk.io/join/session/${successData.invite_code}`);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        }
    };

    if (successData) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                <div className="bg-[#0D1526] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Session Created!</h2>
                        <p className="text-[var(--text-secondary)] mb-6">Share this code with your students to join.</p>
                        
                        <div className="bg-[#050B18] p-6 rounded-xl border border-[var(--border-color)] mb-6">
                            <div className="text-sm text-muted font-medium uppercase tracking-wider mb-2">Invite Code</div>
                            <div className="text-4xl font-mono font-bold text-[var(--text-primary)] tracking-widest mb-4">
                                {successData.invite_code}
                            </div>
                            <button onClick={handleCopyCode} className="mx-auto flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-[var(--text-primary)] transition-colors">
                                {copiedCode ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                {copiedCode ? 'Copied!' : 'Copy Code'}
                            </button>
                        </div>
                        
                        <div className="flex items-center justify-between bg-[#050B18] p-3 rounded-lg border border-[var(--border-color)] mb-8">
                            <span className="text-xs text-[var(--text-secondary)] truncate max-w-[200px]">
                                app.clouddesk.io/join/session/{successData.invite_code}
                            </span>
                            <button onClick={handleCopyLink} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1">
                                {copiedLink ? <CheckCircle className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                                Copy Link
                            </button>
                        </div>
                        
                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-[var(--text-primary)] rounded-xl font-medium transition-colors border border-[var(--border-color)]">
                                Start Later
                            </button>
                            <button onClick={() => { onClose(); navigate(`/instructor/sessions/${successData.id}/monitor`); }} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-[var(--text-primary)] rounded-xl font-medium transition-colors shadow-lg shadow-green-500/20">
                                Start Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-[#0B1120] border border-[var(--border-color)] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Create Live Session</h2>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Setup a new interactive session for your students.</p>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>
                    ) : (
                        <form id="create-session-form" onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Session Name</label>
                                <input 
                                    type="text" 
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="e.g. AutoCAD Week 4 Lab"
                                    className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-muted focus:outline-none focus:border-indigo-500/50"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Session Type</label>
                                    <select 
                                        name="session_type"
                                        value={formData.session_type}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                                    >
                                        <option value="Lecture">Lecture</option>
                                        <option value="Workshop">Workshop</option>
                                        <option value="Lab">Lab</option>
                                        <option value="Exam/Assessment">Exam/Assessment</option>
                                        <option value="Training">Training</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Link to Group (Optional)</label>
                                    <select 
                                        name="group_id"
                                        value={formData.group_id}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                                    >
                                        <option value="">Standalone (no group)</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Required VM Template</label>
                                <select 
                                    name="vm_template_id"
                                    value={formData.vm_template_id}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                                >
                                    <option value="">Any template</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Start Date & Time</label>
                                    <input 
                                        type="datetime-local" 
                                        name="start_time"
                                        value={formData.start_time}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">End Date & Time</label>
                                    <input 
                                        type="datetime-local" 
                                        name="end_time"
                                        value={formData.end_time}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-6 p-4 bg-white/5 border border-[var(--border-color)] rounded-xl">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Public Session</label>
                                    <p className="text-xs text-[var(--text-secondary)]">If ON, anyone can discover and join. If OFF, invite code only.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="is_public" checked={formData.is_public} onChange={handleChange} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-[var(--bg-card-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Max Participants</label>
                                <input 
                                    type="number" 
                                    name="max_participants"
                                    value={formData.max_participants}
                                    onChange={handleChange}
                                    min="1"
                                    className="w-full md:w-1/3 bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Instructions (Optional)</label>
                                <textarea 
                                    name="instructions"
                                    value={formData.instructions}
                                    onChange={handleChange}
                                    rows="3"
                                    className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-muted focus:outline-none focus:border-indigo-500/50"
                                    placeholder="Add any instructions for students before they join..."
                                ></textarea>
                            </div>
                        </form>
                    )}
                </div>

                <div className="p-6 border-t border-[var(--border-color)] flex justify-end gap-3 bg-[var(--bg-primary)]/50 rounded-b-2xl">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        form="create-session-form"
                        disabled={isSubmitting || isLoading}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-[var(--bg-card-hover)] disabled:text-[var(--text-secondary)] text-primary rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Session'}
                    </button>
                </div>
            </div>
        </div>
    );
}
