import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, FolderOpen, Search, Upload, Info, Copy, CheckCircle, 
  Download, Trash2, FileText, File, Video, Archive, Image as ImageIcon,
  Code2, Compass, Presentation, FileSpreadsheet, Plus, Link as LinkIcon, Edit2, X
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function GroupDetailPage() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    
    const [group, setGroup] = useState(null);
    const [resources, setResources] = useState([]);
    const [activeTab, setActiveTab] = useState('resources');
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [copied, setCopied] = useState(false);
    
    // File inputs
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);

    useEffect(() => {
        fetchGroupDetails();
        fetchResources();
    }, [groupId]);

    const fetchGroupDetails = async () => {
        try {
            const res = await api.get(`/groups/${groupId}/`);
            if (res.data?.success) setGroup(res.data.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchResources = async () => {
        try {
            const res = await api.get(`/groups/${groupId}/resources/`);
            if (res.data?.success) setResources(res.data.data);
            setIsLoading(false);
        } catch (err) {
            setIsLoading(false);
        }
    };

    const handleCopyCode = () => {
        if (group?.invite_code) {
            navigator.clipboard.writeText(group.invite_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            setUploadFile(file);
            if (!uploadTitle) setUploadTitle(file.name);
            setShowUploadModal(true);
        }
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadFile) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('title', uploadTitle);
        formData.append('file', uploadFile);
        formData.append('resource_type', 'file');

        try {
            await api.post(`/groups/${groupId}/resources/upload/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setShowUploadModal(false);
            setUploadFile(null);
            setUploadTitle('');
            fetchResources();
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteResource = async (resId) => {
        if (!confirm('Are you sure you want to delete this resource?')) return;
        try {
            await api.delete(`/groups/${groupId}/resources/${resId}/`);
            fetchResources();
        } catch (err) {
            alert('Delete failed');
        }
    };

    const isOwnerOrMod = group?.user_role_in_group === 'owner' || group?.user_role_in_group === 'moderator';

    const getFileIcon = (ext) => {
        ext = ext?.toLowerCase() || '';
        if (['pdf'].includes(ext)) return <FileText className="w-8 h-8 text-red-400" />;
        if (['doc', 'docx'].includes(ext)) return <FileText className="w-8 h-8 text-blue-400" />;
        if (['xls', 'xlsx'].includes(ext)) return <FileSpreadsheet className="w-8 h-8 text-green-400" />;
        if (['ppt', 'pptx'].includes(ext)) return <Presentation className="w-8 h-8 text-orange-400" />;
        if (['dwg', 'dxf'].includes(ext)) return <Compass className="w-8 h-8 text-purple-400" />;
        if (['mp4', 'mov', 'avi'].includes(ext)) return <Video className="w-8 h-8 text-pink-400" />;
        if (['zip', 'rar', '7z'].includes(ext)) return <Archive className="w-8 h-8 text-yellow-400" />;
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return <ImageIcon className="w-8 h-8 text-cyan-400" />;
        if (['py', 'js', 'html', 'css', 'json'].includes(ext)) return <Code2 className="w-8 h-8 text-emerald-400" />;
        return <File className="w-8 h-8 text-slate-400" />;
    };

    if (isLoading && !group) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>;

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
            {/* LEFT SIDEBAR */}
            <div className="w-72 bg-[#0B1120] border-r border-white/5 flex flex-col flex-shrink-0">
                <div className="h-32 bg-gradient-to-r from-indigo-600 to-purple-600 relative">
                    <div className="absolute -bottom-8 left-6 w-16 h-16 bg-slate-800 rounded-2xl border-4 border-[#0B1120] flex items-center justify-center text-2xl shadow-lg">
                        {group?.name?.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div className="px-6 pt-12 pb-6 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white mb-1 truncate">{group?.name}</h2>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-slate-300">
                            {group?.group_type}
                        </span>
                        <span className="text-sm text-slate-400 flex items-center gap-1">
                            <Users className="w-4 h-4" /> {group?.member_count}
                        </span>
                    </div>

                    <div className="bg-[#050B18] rounded-lg p-3 border border-white/5">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Invite Code</div>
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-white tracking-widest">{group?.invite_code}</span>
                            <button onClick={handleCopyCode} className="text-slate-400 hover:text-white transition-colors">
                                {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    <button onClick={() => setActiveTab('resources')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'resources' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
                        <FolderOpen className="w-5 h-5" /> Resources
                    </button>
                    <button onClick={() => setActiveTab('members')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'members' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
                        <Users className="w-5 h-5" /> Members
                    </button>
                    <button onClick={() => setActiveTab('about')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'about' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
                        <Info className="w-5 h-5" /> About
                    </button>
                </div>
            </div>

            {/* RIGHT CONTENT */}
            <div className="flex-1 bg-[#030712] flex flex-col overflow-hidden">
                {activeTab === 'resources' && (
                    <>
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#0B1120]">
                            <h2 className="text-xl font-bold text-white">Group Resources</h2>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input type="text" placeholder="Search files..." className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 w-64 transition-colors" />
                                </div>
                                {isOwnerOrMod && (
                                    <div className="relative group">
                                        <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20">
                                            <Upload className="w-4 h-4" /> Upload File
                                            <input type="file" className="hidden" onChange={handleFileChange} />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {resources.length === 0 && !showUploadModal ? (
                                <label className="block border-2 border-dashed border-indigo-500/30 rounded-2xl p-16 text-center cursor-pointer hover:border-indigo-500/60 hover:bg-indigo-500/5 transition-all duration-300 group">
                                    <input type="file" className="hidden" onChange={handleFileChange} />
                                    <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                                        <Upload className="w-10 h-10 text-indigo-400" />
                                    </div>
                                    <p className="text-xl text-white font-semibold mb-2">Drop files here or click to upload</p>
                                    <p className="text-slate-400 max-w-sm mx-auto mb-4">Share PDF, Word, Excel, PowerPoint, AutoCAD files, Images, Videos, or Archives with your group.</p>
                                    <p className="text-indigo-400/80 text-sm font-medium">Maximum file size: 100MB</p>
                                </label>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {resources.map(res => (
                                        <div key={res.id} className="rounded-xl border border-[#1e293b] bg-[#111827] p-5 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer group flex flex-col h-full relative">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="p-3 bg-[#0B1120] rounded-xl border border-white/5 group-hover:bg-indigo-500/10 transition-colors">
                                                    {getFileIcon(res.file_extension)}
                                                </div>
                                                {res.file_extension && (
                                                    <span className="px-2 py-1 bg-white/5 rounded text-[10px] font-bold text-slate-400 uppercase tracking-wider border border-white/10">
                                                        {res.file_extension}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <h3 className="text-white font-semibold truncate mb-1" title={res.title}>{res.title}</h3>
                                            <div className="text-xs text-slate-400 mb-4 flex items-center justify-between">
                                                <span>{res.file_size_display}</span>
                                                <span>{new Date(res.created_at).toLocaleDateString()}</span>
                                            </div>
                                            
                                            <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                                                        {res.uploaded_by.charAt(0)}
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-300 truncate w-24">{res.uploaded_by}</span>
                                                </div>
                                                
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {(isOwnerOrMod || res.uploaded_by.includes(user?.first_name)) && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteResource(res.id); }} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md text-slate-400 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <a href={res.file_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 rounded-md transition-colors">
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'members' && (
                    <div className="p-8 flex-1 overflow-y-auto">
                        <h2 className="text-2xl font-bold text-white mb-6">Group Members</h2>
                        <div className="bg-[#0B1120] rounded-xl border border-white/5 overflow-hidden">
                            {group?.members?.map((member, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md">
                                            {member.user?.first_name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{member.user?.first_name} {member.user?.last_name}</div>
                                            <div className="text-xs text-slate-400">{member.user?.email}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${member.role_in_group === 'owner' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : member.role_in_group === 'moderator' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                            {member.role_in_group}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'about' && (
                    <div className="p-8 flex-1 overflow-y-auto">
                        <div className="max-w-2xl bg-[#0B1120] rounded-2xl border border-white/5 p-8">
                            <h2 className="text-2xl font-bold text-white mb-6">About this Group</h2>
                            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                                {group?.description || 'No description provided.'}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Created</div>
                                    <div className="text-white font-medium">{new Date(group?.created_at).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Access</div>
                                    <div className="text-white font-medium capitalize">{group?.group_type}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Capacity</div>
                                    <div className="text-white font-medium">{group?.member_count} / {group?.max_members} members</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* UPLOAD MODAL */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-[#0B1120] rounded-2xl w-full max-w-md border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-[scaleIn_0.2s_ease-out]">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Upload className="w-5 h-5 text-indigo-400" /> Upload Resource
                            </h3>
                            <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUploadSubmit} className="p-6">
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-slate-300 mb-2">Resource Title</label>
                                <input 
                                    type="text" 
                                    value={uploadTitle}
                                    onChange={(e) => setUploadTitle(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-[#030712] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                    required
                                />
                            </div>
                            
                            <div className="mb-8 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-lg">
                                    <File className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{uploadFile?.name}</p>
                                    <p className="text-xs text-slate-400">{(uploadFile?.size / (1024*1024)).toFixed(2)} MB</p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-slate-300 hover:text-white transition-colors font-medium">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isUploading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                                    {isUploading ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Uploading...</>
                                    ) : (
                                        'Upload File'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
