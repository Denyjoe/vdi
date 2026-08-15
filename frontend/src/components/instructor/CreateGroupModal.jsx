import { useState } from 'react';
import { X, CheckCircle, Copy, Link as LinkIcon, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function CreateGroupModal({ onClose, onCreated }) {
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        group_type: 'private', // Can be public or private
        max_members: 100,
        tags: []
    });

    const [tagInput, setTagInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!formData.tags.includes(tagInput.trim())) {
                setFormData(prev => ({
                    ...prev,
                    tags: [...prev.tags, tagInput.trim()]
                }));
            }
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t !== tagToRemove)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const res = await api.post('/groups/create/', formData);
            if (res.data?.success) {
                setSuccessData(res.data.data);
                if (onCreated) onCreated();
            } else {
                setError(res.data?.message || 'Failed to create group');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create group');
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
            navigator.clipboard.writeText(`https://app.ospace.io/join/group/${successData.invite_code}`);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        }
    };

    if (successData) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                <div className="bg-[#0D1526] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-indigo-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Group Created!</h2>
                        <p className="text-[var(--text-secondary)] mb-6">Share this code with members to let them join.</p>
                        
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
                                app.ospace.io/join/group/{successData.invite_code}
                            </span>
                            <button onClick={handleCopyLink} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1">
                                {copiedLink ? <CheckCircle className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                                Copy Link
                            </button>
                        </div>
                        
                        <button onClick={() => { onClose(); navigate(`/instructor/groups/${successData.id}`); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-primary rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20">
                            Open Group &rarr;
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-[#0B1120] border border-[var(--border-color)] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Create Group</h2>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Organize students and manage shared access.</p>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <form id="create-group-form" onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Group Name</label>
                            <input 
                                type="text" 
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. AutoCAD 101 - Fall 2026"
                                className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-muted focus:outline-none focus:border-indigo-500/50"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Description (Optional)</label>
                            <textarea 
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows="3"
                                className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-muted focus:outline-none focus:border-indigo-500/50"
                                placeholder="What is this group for?"
                            ></textarea>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Visibility Type</label>
                                <select 
                                    name="group_type"
                                    value={formData.group_type}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                                >
                                    <option value="private">Private (Invite code only)</option>
                                    <option value="public">Public (Anyone can discover)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Max Members</label>
                                <input 
                                    type="number" 
                                    name="max_members"
                                    value={formData.max_members}
                                    onChange={handleChange}
                                    min="1"
                                    className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Tags (Press Enter to add)</label>
                            <div className="w-full bg-white/5 border border-[var(--border-color)] rounded-xl p-2 flex flex-wrap gap-2 min-h-[52px]">
                                {formData.tags.map(tag => (
                                    <span key={tag} className="inline-flex items-center gap-1 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-lg text-sm">
                                        {tag}
                                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-[var(--text-primary)]">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <input 
                                    type="text" 
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    placeholder={formData.tags.length === 0 ? "e.g. engineering, autocad" : ""}
                                    className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] text-sm min-w-[120px] px-2 py-1"
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-[var(--border-color)] flex justify-end gap-3 bg-[var(--bg-primary)]/50 rounded-b-2xl">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        form="create-group-form"
                        disabled={isSubmitting || !formData.name}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-[var(--bg-card-hover)] disabled:text-[var(--text-secondary)] text-primary rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Group'}
                    </button>
                </div>
            </div>
        </div>
    );
}
