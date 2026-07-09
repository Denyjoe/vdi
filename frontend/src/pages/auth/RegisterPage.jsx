import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Monitor, Zap, Shield, Users, CheckCircle, Laptop, ArrowRight } from 'lucide-react';
import api from '../../services/api';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        confirm_password: ''
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (formData.password !== formData.confirm_password) {
            setError('Passwords do not match');
            return;
        }
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }
        if (!agreedToTerms) {
            setError('You must agree to the Terms of Service');
            return;
        }

        setIsLoading(true);

        try {
            const response = await api.post('/auth/register/', {
                email: formData.email,
                password: formData.password,
                confirm_password: formData.confirm_password,
                first_name: formData.first_name,
                last_name: formData.last_name,
                role: 'user'
            });
            
            if (response.status === 201 || response.data?.success) {
                navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`);
            } else {
                navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`);
            }
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error?.detail || 'Failed to register. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex">
            {/* Left Panel - Features Showcase (Desktop Only) */}
            <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden border-r border-[var(--border-color)]">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-transparent z-0"></div>
                
                <div className="relative z-10">
                    <Link to="/" className="flex items-center gap-2 mb-16">
                        <Monitor className="w-8 h-8 text-indigo-500" />
                        <span className="text-xl font-bold text-[var(--text-primary)] tracking-tight">CloudDesk</span>
                    </Link>

                    <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">Start your journey with CloudDesk</h1>
                    <p className="text-lg text-[var(--text-secondary)] max-w-md mb-12">
                        Get 5 free workspace hours every month. No credit card required.
                    </p>

                    <div className="space-y-8">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                                <Zap className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Instant Access</h3>
                                <p className="text-[var(--text-secondary)]">Launch powerful virtual machines directly in your browser. No downloads, no installation.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0 border border-cyan-500/20">
                                <Users className="w-6 h-6 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Live Sessions</h3>
                                <p className="text-[var(--text-secondary)]">Join interactive workshops and classes led by experts from around the world.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                <Shield className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Enterprise Grade</h3>
                                <p className="text-[var(--text-secondary)]">Secure, isolated environments with guaranteed performance and data protection.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 mt-12 flex items-center justify-between border-t border-[var(--border-color)] pt-8">
                    <p className="text-sm text-muted">&copy; 2026 CloudDesk. All rights reserved.</p>
                    <div className="flex gap-4">
                        <a href="#" className="text-sm text-muted hover:text-[var(--text-primary)] transition-colors">Privacy</a>
                        <a href="#" className="text-sm text-muted hover:text-[var(--text-primary)] transition-colors">Terms</a>
                    </div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 py-12 relative">
                <Link to="/" className="lg:hidden flex items-center gap-2 mb-12">
                    <Monitor className="w-8 h-8 text-indigo-500" />
                    <span className="text-xl font-bold text-[var(--text-primary)] tracking-tight">CloudDesk</span>
                </Link>

                <div className="w-full max-w-md mx-auto">
                    <div className="mb-10">
                        <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Create an account</h2>
                        <p className="text-[var(--text-secondary)]">Join CloudDesk today and start building.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--text-primary)]">First Name</label>
                                <input
                                    type="text"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-[#0A101F] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    placeholder="John"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--text-primary)]">Last Name</label>
                                <input
                                    type="text"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-[#0A101F] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    placeholder="Doe"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-[var(--text-primary)]">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-[#0A101F] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="john@example.com"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-[var(--text-primary)]">Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-[#0A101F] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="Min. 8 characters"
                                required
                                minLength="8"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-[var(--text-primary)]">Confirm Password</label>
                            <input
                                type="password"
                                name="confirm_password"
                                value={formData.confirm_password}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-[#0A101F] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="Re-enter password"
                                required
                            />
                        </div>

                        <div className="flex items-start gap-3 mt-6">
                            <input
                                type="checkbox"
                                id="terms"
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                className="mt-1 w-4 h-4 rounded border-[var(--border-color)] bg-[#0A101F] text-indigo-500 focus:ring-indigo-500"
                            />
                            <label htmlFor="terms" className="text-sm text-[var(--text-secondary)]">
                                I agree to the <a href="#" className="text-indigo-400 hover:text-indigo-300">Terms of Service</a> and <a href="#" className="text-indigo-400 hover:text-indigo-300">Privacy Policy</a>
                            </label>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-primary rounded-xl font-semibold shadow-lg shadow-indigo-600/20 transition-all flex justify-center items-center gap-2 mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-[var(--text-secondary)] text-sm">
                        Already have an account?{' '}
                        <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
