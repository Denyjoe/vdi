import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Monitor, Zap, Shield, Users, CheckCircle, Laptop, ArrowLeft, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';

export default function RegisterPage() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        confirm_password: '',
        role: 'member'
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

    const handleNext = () => {
        setError('');
        if (step === 1) {
            if (formData.password !== formData.confirm_password) {
                setError('Passwords do not match');
                return;
            }
            if (formData.password.length < 8) {
                setError('Password must be at least 8 characters long');
                return;
            }
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        setStep(prev => prev - 1);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
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
                role: formData.role
            });
            
            if (response.data.success) {
                navigate('/login', { state: { message: 'Registration successful! Please login.' }});
            }
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error?.detail || 'Failed to register. Please try again.');
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

                    <h1 className="text-4xl font-bold text-white mb-4">Start your journey with CloudDesk</h1>
                    <p className="text-lg text-slate-400 max-w-md mb-12">
                        Get 5 free compute hours every month. No credit card required.
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
            </div>

            {/* Right Panel - Register Form */}
            <div className="w-full lg:w-[45%] bg-[#0D1526] flex items-center justify-center p-8 sm:p-12 relative overflow-y-auto">
                {/* Mobile Logo */}
                <div className="absolute top-8 left-8 lg:hidden">
                    <Link to="/" className="flex items-center gap-2">
                        <Monitor className="w-6 h-6 text-indigo-500" />
                        <span className="font-bold text-white tracking-tight">CloudDesk</span>
                    </Link>
                </div>

                <div className="w-full max-w-md mt-12 lg:mt-0">
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-white">Create Account</h2>
                            <div className="text-sm font-medium text-slate-500">Step {step} of 3</div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-indigo-500 transition-all duration-300"
                                style={{ width: `${(step / 3) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {step === 1 && (
                            <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                                <GoogleSignInButton text="Sign up with Google" />

                                <div className="flex items-center gap-3 my-4">
                                    <div className="flex-1 h-px bg-white/10" />
                                    <span className="text-slate-500 text-sm">or continue with email</span>
                                    <div className="flex-1 h-px bg-white/10" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
                                        <input
                                            type="text"
                                            name="first_name"
                                            required
                                            value={formData.first_name}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
                                        <input
                                            type="text"
                                            name="last_name"
                                            required
                                            value={formData.last_name}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                                    <input
                                        type="password"
                                        name="password"
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
                                    <input
                                        type="password"
                                        name="confirm_password"
                                        required
                                        value={formData.confirm_password}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                                    />
                                </div>
                                <button type="submit" className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all duration-300 glow-primary mt-6">
                                    Continue
                                </button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                                <p className="text-slate-400 text-sm mb-4">How do you plan to use CloudDesk?</p>
                                
                                <label className={`block relative p-4 rounded-xl cursor-pointer border-2 transition-all ${formData.role === 'member' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                                    <input 
                                        type="radio" 
                                        name="role" 
                                        value="member" 
                                        checked={formData.role === 'member'}
                                        onChange={handleChange}
                                        className="sr-only" 
                                    />
                                    <div className="flex gap-4">
                                        <div className={`mt-1 shrink-0 ${formData.role === 'member' ? 'text-indigo-400' : 'text-slate-500'}`}>
                                            <Laptop className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className={`font-semibold ${formData.role === 'member' ? 'text-white' : 'text-slate-300'}`}>I want to learn & work</h3>
                                            <p className="text-sm text-slate-400 mt-1">Access VM templates, join sessions, collaborate in groups</p>
                                        </div>
                                    </div>
                                    {formData.role === 'member' && <div className="absolute top-4 right-4"><CheckCircle className="w-5 h-5 text-indigo-500" /></div>}
                                </label>

                                <label className={`block relative p-4 rounded-xl cursor-pointer border-2 transition-all ${formData.role === 'instructor' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                                    <input 
                                        type="radio" 
                                        name="role" 
                                        value="instructor" 
                                        checked={formData.role === 'instructor'}
                                        onChange={handleChange}
                                        className="sr-only" 
                                    />
                                    <div className="flex gap-4">
                                        <div className={`mt-1 shrink-0 ${formData.role === 'instructor' ? 'text-indigo-400' : 'text-slate-500'}`}>
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className={`font-semibold ${formData.role === 'instructor' ? 'text-white' : 'text-slate-300'}`}>I want to teach & host</h3>
                                            <p className="text-sm text-slate-400 mt-1">Create live sessions, manage groups, share materials with participants</p>
                                            <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300">Requires Pro plan</span>
                                        </div>
                                    </div>
                                    {formData.role === 'instructor' && <div className="absolute top-4 right-4"><CheckCircle className="w-5 h-5 text-indigo-500" /></div>}
                                </label>

                                <div className="flex gap-3 mt-8">
                                    <button type="button" onClick={handleBack} className="w-1/3 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-all duration-300 flex items-center justify-center">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                                    </button>
                                    <button type="submit" className="w-2/3 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all duration-300 glow-primary flex items-center justify-center">
                                        Continue <ArrowRight className="w-4 h-4 ml-2" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                                <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
                                    <h3 className="font-semibold text-white mb-2 border-b border-white/10 pb-2">Account Summary</h3>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Name</span>
                                        <span className="text-white font-medium">{formData.first_name} {formData.last_name}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Email</span>
                                        <span className="text-white font-medium">{formData.email}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Account Type</span>
                                        <span className="text-white font-medium capitalize">{formData.role}</span>
                                    </div>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer">
                                    <div className="mt-1">
                                        <input 
                                            type="checkbox"
                                            checked={agreedToTerms}
                                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 focus:ring-offset-transparent"
                                        />
                                    </div>
                                    <span className="text-sm text-slate-400 leading-relaxed">
                                        I agree to the <a href="#" className="text-indigo-400 hover:underline">Terms of Service</a> and <a href="#" className="text-indigo-400 hover:underline">Privacy Policy</a>, and I acknowledge that this is a simulated demo platform.
                                    </span>
                                </label>

                                <div className="flex gap-3">
                                    <button type="button" onClick={handleBack} className="w-1/3 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-all duration-300 flex items-center justify-center">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={isLoading}
                                        className="w-2/3 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all duration-300 glow-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {isLoading ? 'Creating Account...' : 'Create Account'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>

                    <div className="mt-8 text-center text-sm text-slate-400">
                        Already have an account?{' '}
                        <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
                            Sign in instead →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
