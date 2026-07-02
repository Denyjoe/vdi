import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function JoinByCodeModal({ type = 'session', onClose, onJoined }) {
    const navigate = useNavigate();
    const [code, setCode] = useState('');
    const [link, setLink] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);

    const isSession = type === 'session';
    const title = isSession ? 'Join a Session' : 'Join a Group';

    const handleCodeChange = (e) => {
        let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (val.length <= 8) setCode(val);
        setError('');
    };

    const handleLinkChange = (e) => {
        setLink(e.target.value);
        setError('');
        
        // Extract code if it's a URL
        try {
            const match = e.target.value.match(/\/join\/(group|session)\/([A-Z0-9]{8})/i);
            if (match && match[2]) {
                setCode(match[2].toUpperCase());
            }
        } catch (err) {}
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (code.length !== 8) {
            setError('Code must be exactly 8 characters');
            return;
        }

        setIsLoading(true);

        try {
            const endpoint = isSession ? '/sessions/live/join/' : '/groups/join/';
            const res = await api.post(endpoint, { invite_code: code });
            
            if (res.data?.success) {
                setSuccessData(isSession ? res.data.data.session : res.data.data);
                if (onJoined) onJoined();
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || '';
            if (errorMsg.includes('already a member')) {
                setError('You are already in this group');
            } else {
                setError('Invalid code. Check and try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative bg-[#0D1526] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-[fadeIn_0.2s_ease-out]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h3 className="text-xl font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    {successData ? (
                        <div className="text-center animate-[fadeIn_0.3s_ease-out]">
                            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-10 h-10 text-green-500" />
                            </div>
                            <h4 className="text-2xl font-bold text-white mb-2">{successData.name}</h4>
                            <p className="text-slate-400 mb-8">You've successfully joined this {isSession ? 'session' : 'group'}!</p>
                            
                            {isSession ? (
                                successData.status === 'active' ? (
                                    <button onClick={() => { onClose(); navigate(`/session/${successData.id}`); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all glow-primary">
                                        Enter Session &rarr;
                                    </button>
                                ) : (
                                    <button onClick={() => { onClose(); navigate('/member/sessions'); }} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all">
                                        View My Sessions &rarr;
                                    </button>
                                )
                            ) : (
                                <button onClick={() => { onClose(); navigate('/member/groups'); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all glow-primary">
                                    Open Group
                                </button>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col items-center">
                            <input
                                type="text"
                                value={code}
                                onChange={handleCodeChange}
                                placeholder="ENTER CODE"
                                className={`text-4xl text-center tracking-widest bg-[#050B18] text-white rounded-2xl p-6 w-full mb-6 border-2 transition-all outline-none uppercase font-mono placeholder:text-slate-700
                                    ${error ? 'border-red-500/50 focus:border-red-500' : 'border-indigo-500/30 focus:border-indigo-500 focus:shadow-[0_0_20px_rgba(99,102,241,0.2)]'}`}
                            />
                            
                            {error && (
                                <div className="text-red-400 text-sm mb-4 text-center">{error}</div>
                            )}

                            <div className="w-full relative py-4 mb-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/5"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-[#0D1526] text-slate-500">Or paste an invite link</span>
                                </div>
                            </div>

                            <input
                                type="url"
                                value={link}
                                onChange={handleLinkChange}
                                placeholder="https://clouddesk.io/join/..."
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm mb-8"
                            />

                            <button
                                type="submit"
                                disabled={code.length !== 8 || isLoading}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-medium transition-all text-lg disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Joining...' : 'Join Now'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
