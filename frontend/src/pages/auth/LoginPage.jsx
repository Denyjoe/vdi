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
            setError(err.response?.data?.message || err.response?.data?.error?.detail || 'Failed to login. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050B18] flex">
            {/* Left Panel - Features Showcase (Desktop Only) */}
            <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-transparent z-0"></div>
                
                <div className="relative z-10">
                    <Link to="/" className="flex items-center gap-2 mb-16">
                        <Monitor className="w-8 h-8 text-indigo-500" />
                        <span className="text-xl font-bold text-white tracking-tight">CloudDesk</span>
                    </Link>

                    <h1 className="text-4xl font-bold text-white mb-4">Welcome back to CloudDesk</h1>
                    <p className="text-lg text-slate-400 max-w-md mb-12">
                        Your professional cloud workspace is ready. Pick up exactly where you left off.
                    </p>

                    <div className="grid grid-cols-1 gap-6 max-w-lg">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white mb-1">Instant Access</h3>
                                <p className="text-sm text-slate-400">Launch your VMs in seconds from any browser.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white mb-1">Live Collaboration</h3>
                                <p className="text-sm text-slate-400">Join sessions and work together in real-time.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                <Shield className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white mb-1">Secure & Isolated</h3>
                                <p className="text-sm text-slate-400">Your work is private and securely encrypted.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 mt-12">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>Trusted by professionals worldwide</span>
                        <div className="flex gap-2">
                            {/* Decorative dots */}
                            <div className="w-2 h-2 rounded-full bg-indigo-500/40"></div>
                            <div className="w-2 h-2 rounded-full bg-cyan-500/40"></div>
                            <div className="w-2 h-2 rounded-full bg-indigo-500/40"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-[45%] bg-[#0D1526] flex items-center justify-center p-8 sm:p-12 relative">
                {/* Mobile Logo */}
                <div className="absolute top-8 left-8 lg:hidden">
                    <Link to="/" className="flex items-center gap-2">
                        <Monitor className="w-6 h-6 text-indigo-500" />
                        <span className="font-bold text-white tracking-tight">CloudDesk</span>
                    </Link>
                </div>

                <div className="w-full max-w-md">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-white mb-2">Sign in to {publicSettings.institution_name}</h2>
                        <p className="text-slate-400">Welcome back! Please enter your details.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="email">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-slate-300" htmlFor="password">
                                    Password
                                </label>
                                <a href="#" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
                                    Forgot password?
                                </a>
                            </div>
                            <input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
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
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-[#0D1526] text-slate-500">or</span>
                            </div>
                        </div>

                        <GoogleSignInButton />
                    </form>

                    <div className="mt-8 text-center text-sm text-slate-400">
                        New to CloudDesk?{' '}
                        <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
                            Create a free account →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
