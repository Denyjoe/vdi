import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { Monitor, Zap, Shield, Users, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    
    const [publicSettings, setPublicSettings] = useState({
        institution_name: 'CloudDesk'
    });

    useEffect(() => {
        api.get('/settings/public/')
            .then(res => {
                if (res.data?.success && res.data.data.institution_name) {
                    setPublicSettings(prev => ({
                        ...prev,
                        institution_name: res.data.data.institution_name
                    }));
                }
            })
            .catch(err => console.error('Failed to load public settings:', err));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await api.post('/auth/login/', { email, password });
            
            if (response.data.success) {
                const { user, access, refresh } = response.data.data;
                login(user, access, refresh);
                
                // Redirect based on role
                if (user.role === 'admin') navigate('/admin/dashboard');
                else navigate('/dashboard');
            }
        } catch (err) {
            const data = err.response?.data;
            if (data?.needs_verification) {
                navigate(`/verify-email?email=${encodeURIComponent(email)}`);
                return;
            }
            setError(data?.message || err.response?.data?.error?.detail || 'Failed to login. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex">
            {/* Left Panel - Features Showcase (Desktop Only) */}
            <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden border-r border-[#E2E8F0]">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent z-0"></div>
                
                <div className="relative z-10">
                    <Link to="/" className="flex items-center gap-2 mb-16">
                        <Monitor className="w-8 h-8 text-indigo-500" />
                        <span className="text-xl font-bold text-[#334155] tracking-tight">CloudDesk</span>
                    </Link>

                    <h1 className="text-4xl font-bold text-[#334155] mb-4">Welcome back to CloudDesk</h1>
                    <p className="text-lg text-[#0F172A] max-w-md mb-12">
                        Your professional cloud workspace is ready. Pick up exactly where you left off.
                    </p>

                    <div className="grid grid-cols-1 gap-6 max-w-lg">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[#334155] mb-1">Instant Access</h3>
                                <p className="text-sm text-[#0F172A]">Launch your VMs in seconds from any browser.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[#334155] mb-1">Live Collaboration</h3>
                                <p className="text-sm text-[#0F172A]">Join sessions and work together in real-time.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                <Shield className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[#334155] mb-1">Secure & Isolated</h3>
                                <p className="text-sm text-[#0F172A]">Your work is private and securely encrypted.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 flex items-center gap-6 text-sm text-[#0F172A]">
                    <Link to="/terms" className="hover:text-indigo-400 transition-colors">Terms of Service</Link>
                    <Link to="/privacy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-24 bg-[#FFFFFF]">
                <div className="w-full max-w-md mx-auto">
                    <div className="lg:hidden flex items-center gap-2 mb-12">
                        <Monitor className="w-8 h-8 text-indigo-500" />
                        <span className="text-xl font-bold text-[#334155]">CloudDesk</span>
                    </div>

                    <div className="mb-10">
                        <h2 className="text-3xl font-bold text-[#0F172A] mb-2 tracking-tight">Sign In</h2>
                        <p className="text-[#475569]">Enter your details to access your workspaces.</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400">
                            <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                            </svg>
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-[#334155] mb-1.5" htmlFor="email">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl text-[#334155] placeholder-[#94A3B8] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-[#334155]" htmlFor="password">
                                    Password
                                </label>
                                <Link to="/forgot-password" className="text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]">
                                    Forgot password?
                                </Link>
                            </div>
                            <input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl text-[#334155] placeholder-[#94A3B8] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all duration-300 glow-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>

                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-[#E2E8F0]"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-[#FFFFFF] text-[#64748B]">or</span>
                            </div>
                        </div>

                        <GoogleSignInButton />
                    </form>

                    <div className="mt-8 text-center text-sm text-[#0F172A]">
                        New to CloudDesk?{' '}
                        <Link to="/register" className="font-medium text-[#2563EB] hover:text-[#1D4ED8]">
                            Create a free account →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
