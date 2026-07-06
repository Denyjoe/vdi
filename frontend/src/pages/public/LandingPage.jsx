import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Monitor, Plus, CheckCircle, ArrowRight, Zap, Shield, Users 
} from 'lucide-react';
import JoinByCodeModal from '../../components/shared/JoinByCodeModal';
import NetworkGlobe from '../../components/shared/NetworkGlobe';
import api from '../../services/api';

export default function LandingPage() {
  const navigate = useNavigate();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [plans, setPlans] = useState([]);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [activeSection, setActiveSection] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await api.get('/pricing/');
        if (res.data.success) {
          setPlans(res.data.data.plans);
        }
      } catch (err) {
        console.error('Failed to fetch pricing', err);
      } finally {
        setLoadingPricing(false);
      }
    };
    fetchPricing();

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, { threshold: 0.5 });

    const hero = document.getElementById('hero');
    const features = document.getElementById('features');
    const pricing = document.getElementById('pricing');
    
    if (hero) observer.observe(hero);
    if (features) observer.observe(features);
    if (pricing) observer.observe(pricing);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#050B18] overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${isScrolled ? 'bg-[#050B18]/80 backdrop-blur-md border-b border-[var(--border-color)] py-0' : 'bg-transparent border-b border-transparent py-2'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" onClick={(e) => scrollToSection(e, 'hero')} className="flex items-center gap-2">
            <Monitor className="w-8 h-8 text-indigo-500" />
            <span className="text-xl font-bold text-white tracking-tight">CloudDesk</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a 
              href="#features" 
              onClick={(e) => scrollToSection(e, 'features')}
              className={`text-sm font-medium transition-all pb-1 border-b-2 ${activeSection === 'features' ? 'text-white border-indigo-500' : 'text-slate-400 border-transparent hover:text-white'}`}
            >
              Features
            </a>
            <a 
              href="#pricing" 
              onClick={(e) => scrollToSection(e, 'pricing')}
              className={`text-sm font-medium transition-all pb-1 border-b-2 ${activeSection === 'pricing' ? 'text-white border-indigo-500' : 'text-slate-400 border-transparent hover:text-white'}`}
            >
              Pricing
            </a>
            <div className="flex items-center gap-4 ml-4">
              <Link to="/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Sign in</Link>
              <button 
                onClick={() => setShowJoinModal(true)}
                className="px-5 py-2.5 rounded-full border border-transparent bg-transparent hover:border-indigo-500/50 hover:bg-indigo-500/10 text-slate-300 hover:text-indigo-300 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                Join Session
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div id="hero" className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                The modern virtual desktop platform
              </div>
              
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-extrabold text-[var(--text-primary)] tracking-tight mb-8 leading-[1.1]">
                Browser-based <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
                  Virtual Workspaces
                </span>
              </h1>
              
              <p className="text-xl text-[var(--text-secondary)] mb-12 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Launch powerful CAD, Data Science, and Programming environments instantly. Join live sessions for free, or upgrade to host your own.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-[var(--text-primary)] rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 hover:scale-105">
                  Start for Free <ArrowRight size={20} />
                </Link>
                <button 
                  onClick={() => setShowJoinModal(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  Join with Code
                </button>
              </div>
            </div>
            <div className="flex-1 w-full relative group perspective-1000">
               <div style={{
                 position: 'absolute',
                 right: '5%',
                 top: '50%',
                 transform: 'translateY(-50%)',
                 opacity: 0.6,
                 pointerEvents: 'none',
                 zIndex: -1
               }}>
                 <NetworkGlobe size={450} />
               </div>
               <img src="/images/hero_workspace.png" alt="CloudDesk Workspace" className="w-full rounded-[2rem] shadow-2xl border border-[var(--border-color)] transform transition-transform duration-700 hover:rotate-y-2 hover:rotate-x-2" />
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div id="features" className="py-24 bg-[#080E1C] relative border-y border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">Everything you need</h2>
            <p className="text-[var(--text-secondary)]">Simple, powerful, and built for modern teams and educators.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-indigo-500/30 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-6">
                <Zap className="text-indigo-400" size={28} />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">Instant Provisioning</h3>
              <p className="text-[var(--text-secondary)]">Launch a cloud desktop in seconds. No complex setup or configuration. Just click and start working.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-cyan-500/30 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 mb-6">
                <Users className="text-cyan-400" size={28} />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">Live Sessions</h3>
              <p className="text-[var(--text-secondary)]">Host interactive workshops where every participant gets their own pre-configured environment.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-emerald-500/30 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-6">
                <Shield className="text-emerald-400" size={28} />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">Exam Mode</h3>
              <p className="text-[var(--text-secondary)]">Lock down internet access, disable copy-paste, and monitor participants during exams.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">Simple, transparent pricing</h2>
            <p className="text-[var(--text-secondary)]">Join for free, upgrade to host sessions.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {loadingPricing ? (
               <div className="col-span-full flex justify-center py-12"><div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div></div>
            ) : (
               plans.map(plan => (
                 <div key={plan.id} className="p-8 rounded-3xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-indigo-500/30 transition-colors relative flex flex-col">
                   {plan.name === 'pro_host' && (
                      <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-indigo-500 to-cyan-500 text-[var(--text-primary)] text-xs font-bold rounded-full uppercase tracking-wider">
                        Most Popular
                      </div>
                   )}
                   <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{plan.display_name}</h3>
                   <p className="text-[var(--text-secondary)] mb-6 capitalize">{plan.name.replace('_', ' ')} plan</p>
                   <div className="text-4xl font-bold text-[var(--text-primary)] mb-8">${plan.price_usd} <span className="text-lg text-slate-500 font-normal">/mo</span></div>
                   
                   <ul className="space-y-4 mb-8 flex-1">
                     <li className="flex items-center gap-3 text-[var(--text-primary)]">
                       <CheckCircle size={20} className="text-indigo-400" /> {plan.can_host_sessions ? `Host up to ${plan.max_session_participants} users` : 'Join unlimited sessions'}
                     </li>
                     <li className="flex items-center gap-3 text-[var(--text-primary)]">
                       <CheckCircle size={20} className="text-indigo-400" /> {plan.compute_hours_per_month} workspace hours/mo
                     </li>
                     <li className="flex items-center gap-3 text-[var(--text-primary)]">
                       <CheckCircle size={20} className="text-indigo-400" /> Access to VM templates
                     </li>
                   </ul>
                   
                   <Link to="/register" className={`block w-full py-3 text-center rounded-xl font-bold transition-all ${plan.name === 'pro_host' ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-[var(--text-primary)] shadow-lg shadow-indigo-500/25' : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border border-[var(--border-color)]'}`}>
                     Get Started
                   </Link>
                 </div>
               ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-[#050B18] border-t border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Monitor className="w-6 h-6 text-indigo-500" />
            <span className="text-lg font-bold text-[var(--text-primary)]">CloudDesk</span>
          </div>
          <div className="flex gap-6">
            <Link to="/terms" className="text-sm text-[var(--text-secondary)] hover:text-indigo-400 transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="text-sm text-[var(--text-secondary)] hover:text-indigo-400 transition-colors">Privacy Policy</Link>
            <a href="mailto:support@clouddesk.io" className="text-sm text-[var(--text-secondary)] hover:text-indigo-400 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {showJoinModal && (
        <JoinByCodeModal onClose={() => setShowJoinModal(false)} />
      )}
    </div>
  );
}
