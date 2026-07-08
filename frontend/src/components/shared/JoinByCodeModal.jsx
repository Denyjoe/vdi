import React, { useState } from 'react';
import { X, Users, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function JoinByCodeModal({ onClose, onJoined }) {
    const navigate = useNavigate();
    const [joinCode, setJoinCode] = useState('');
    const [password, setPassword] = useState('');
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [successData, setSuccessData] = useState(null);

    const handleJoinSession = async (e) => {
        if (e) e.preventDefault();
        setJoinError('');
        
        if (joinCode.length !== 8) {
            setJoinError('Code must be exactly 8 characters');
            return;
        }

        setJoining(true);

        try {
            const payload = { invite_code: joinCode };
            if (requiresPassword) {
                payload.password = password;
            }
            
            const res = await api.post('/sessions/live/join/', payload);
            
            if (res.data?.success) {
                setSuccessData(res.data.data.session);
                if (onJoined) onJoined();
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || '';
            const isPasswordRequired = err.response?.data?.requires_password;
            
            if (isPasswordRequired) {
                setRequiresPassword(true);
                setJoinError('This session requires a password');
            } else if (errorMsg.includes('Already joined')) {
                api.get('/sessions/live/').then(res => {
                    const joined = res.data?.data?.joined || [];
                    const session = joined.find(s => s.invite_code === joinCode);
                    if (session) {
                        setSuccessData(session);
                        if (onJoined) onJoined();
                    } else {
                        setJoinError('You are already joined but session details could not be loaded.');
                    }
                });
            } else {
                setJoinError(errorMsg || 'Invalid code or join failed.');
            }
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}>
            
            <div className="bg-[#0A0E14] border border-slate-800/50 rounded-2xl w-[420px] max-w-[90vw] overflow-hidden shadow-2xl shadow-black/50"
                style={{
                    animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}>
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-800/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#00A3FF]/10 flex items-center justify-center">
                                <Users size={18} className="text-[#00A3FF]" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">
                                    Join a Session
                                </h2>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Enter the invite code from your host
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white active:scale-95 transition-all">
                            <X size={16} />
                        </button>
                    </div>
                </div>
                
                {/* Content */}
                <div className="px-6 py-6">
                    {successData ? (
                        <div className="text-center" style={{ animation: 'scaleIn 0.3s ease-out' }}>
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} className="text-emerald-400" />
                            </div>
                            <h4 className="text-lg font-bold text-white mb-1">{successData.name}</h4>
                            <p className="text-xs text-slate-400 mb-6">You've successfully joined this session!</p>
                            
                            {successData.status === 'active' ? (
                                <button onClick={() => { onClose(); navigate(`/session/${successData.id}`); }} 
                                    className="w-full py-3 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">
                                    Enter Session Now
                                </button>
                            ) : (
                                <button onClick={() => { onClose(); navigate('/sessions/my'); }} 
                                    className="w-full py-3 bg-[#1E293B] border border-slate-700/50 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]">
                                    View My Sessions
                                </button>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleJoinSession}>
                            {/* Code input */}
                            <div className="mb-5">
                                <label className="text-[10px] uppercase tracking-[2px] text-slate-500 font-semibold block mb-3">
                                    Invite Code
                                </label>
                                <input
                                    value={joinCode}
                                    onChange={e => {
                                        setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                                        setJoinError('');
                                        setRequiresPassword(false);
                                    }}
                                    placeholder="e.g. TYVDX0X2"
                                    maxLength={8}
                                    className="w-full bg-[#0F131A] border-2 border-slate-800/50 rounded-xl px-5 py-4 text-center text-2xl font-mono font-bold text-white tracking-[0.5em] placeholder-slate-700 outline-none focus:border-[#00A3FF]/50 transition-all uppercase"
                                    autoFocus
                                    disabled={requiresPassword}
                                />
                                {!requiresPassword && (
                                    <p className="text-[11px] text-slate-600 mt-2 text-center">
                                        8-character code from your host
                                    </p>
                                )}
                            </div>

                            {requiresPassword && (
                                <div className="mb-5" style={{ animation: 'scaleIn 0.2s ease-out' }}>
                                    <label className="text-[10px] uppercase tracking-[2px] text-slate-500 font-semibold block mb-3">
                                        Session Password
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Lock size={16} className="text-slate-500" />
                                        </div>
                                        <input 
                                            type="password" 
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                setJoinError('');
                                            }}
                                            placeholder="Enter password"
                                            className="w-full bg-[#0F131A] border-2 border-slate-800/50 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00A3FF]/50 transition-all"
                                            autoFocus
                                            required
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {/* Error message */}
                            {joinError && (
                                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                                    <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                                    <p className="text-xs text-red-400">{joinError}</p>
                                </div>
                            )}
                            
                            {/* Join button */}
                            <button
                                type="submit"
                                disabled={joinCode.length < 6 || joining || (requiresPassword && !password)}
                                className="w-full py-3 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                {joining ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Joining...
                                    </>
                                ) : (
                                    <>
                                        <Users size={15} />
                                        Join Session
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
                
                {/* Footer note */}
                {!successData && (
                    <div className="px-6 py-4 border-t border-slate-800/30 bg-[#080B10]">
                        <p className="text-[11px] text-slate-600 text-center">
                            Joining is always free. You will get your own isolated desktop.
                        </p>
                    </div>
                )}
            </div>
            
            <style>{`
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
