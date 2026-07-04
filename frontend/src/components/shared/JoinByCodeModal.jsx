import React, { useState } from 'react';
import { X, CheckCircle, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function JoinByCodeModal({ onClose, onJoined }) {
    const navigate = useNavigate();
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);

    const handleCodeChange = (e) => {
        let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (val.length <= 8) setCode(val);
        setError('');
        setRequiresPassword(false);
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
            const payload = { invite_code: code };
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
                setError('This session requires a password');
            } else if (errorMsg.includes('Already joined')) {
                // If they already joined, let's treat it as success for UI flow
                api.get('/sessions/live/').then(res => {
                    const joined = res.data?.data?.joined || [];
                    const session = joined.find(s => s.invite_code === code);
                    if (session) {
                        setSuccessData(session);
                        if (onJoined) onJoined();
                    } else {
                        setError('You are already joined but session details could not be loaded.');
                    }
                });
            } else {
                setError(errorMsg || 'Invalid code or join failed.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[var(--bg-primary)]/80 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">Join a Session</h3>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    {successData ? (
                        <div className="text-center animate-fade-in">
                            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                <CheckCircle size={40} className="text-emerald-400" />
                            </div>
                            <h4 className="text-xl font-bold text-[var(--text-primary)] mb-2">{successData.name}</h4>
                            <p className="text-[var(--text-secondary)] mb-8">You've successfully joined this session!</p>
                            
                            {successData.status === 'active' ? (
                                <button onClick={() => { onClose(); navigate(`/session/${successData.id}`); }} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-[var(--text-primary)] rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25">
                                    Enter Session Now →
                                </button>
                            ) : (
                                <button onClick={() => { onClose(); navigate('/sessions/my'); }} className="w-full py-3 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] rounded-xl font-medium transition-colors border border-[var(--border-color)]">
                                    View My Sessions
                                </button>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="text-center mb-8">
                                <p className="text-[var(--text-secondary)]">Enter the 8-character invite code provided by the session host.</p>
                            </div>

                            <div>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={code}
                                        onChange={handleCodeChange}
                                        placeholder="e.g. A1B2C3D4"
                                        className="w-full bg-[var(--bg-card)]/50 border border-[var(--border-color)] focus:border-indigo-500 rounded-xl px-4 py-4 text-center text-3xl tracking-[0.5em] font-mono text-[var(--text-primary)] placeholder-slate-600 transition-colors outline-none"
                                        autoFocus
                                        required
                                        disabled={requiresPassword}
                                    />
                                </div>
                                {error && !requiresPassword && <p className="text-red-400 text-sm mt-3 text-center bg-red-400/10 py-2 rounded-lg">{error}</p>}
                            </div>

                            {requiresPassword && (
                                <div className="animate-fade-in">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Lock size={18} className="text-[var(--text-secondary)]" />
                                        </div>
                                        <input 
                                            type="password" 
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                setError('');
                                            }}
                                            placeholder="Enter session password"
                                            className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] focus:border-indigo-500 rounded-xl pl-11 pr-4 py-3 text-[var(--text-primary)] transition-colors outline-none"
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    {error && <p className="text-red-400 text-sm mt-3 text-center bg-red-400/10 py-2 rounded-lg">{error}</p>}
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={isLoading || code.length !== 8 || (requiresPassword && !password)}
                                className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
                            >
                                {isLoading ? 'Joining...' : 'Join Session'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
