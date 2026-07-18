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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#050B18] overflow-hidden selection:bg-[#1D4ED8]/30 selection:text-indigo-200">
      
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${isScrolled ? 'bg-[#F8FAFC] dark:bg-[#050B18]/80 backdrop-blur-md border-b border-[#E2E8F0] dark:border-slate-800 py-0' : 'bg-transparent border-b border-transparent py-2'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" onClick={(e) => scrollToSection(e, 'hero')} className="flex items-center gap-2">
            <Monitor className="w-8 h-8 text-indigo-500" />
            <span className="text-xl font-bold text-[#334155] dark:text-slate-200 tracking-tight">CloudDesk</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a 
              href="#features" 
              onClick={(e) => scrollToSection(e, 'features')}
              className={`text-sm font-medium transition-colors duration-200 pb-1 border-b-2 ${activeSection === 'features' ? 'text-[#4F46E5] border-[#4F46E5]' : 'text-[#334155] dark:text-slate-200 border-transparent hover:text-[#0F172A] dark:hover:text-white dark:text-white'}`}
            >
              Features
            </a>
            <a 
              href="#pricing" 
              onClick={(e) => scrollToSection(e, 'pricing')}
              className={`text-sm font-medium transition-colors duration-200 pb-1 border-b-2 ${activeSection === 'pricing' ? 'text-[#4F46E5] border-[#4F46E5]' : 'text-[#334155] dark:text-slate-200 border-transparent hover:text-[#0F172A] dark:hover:text-white dark:text-white'}`}
            >
              Pricing
            </a>
            <div className="flex items-center gap-4 ml-4">
              <Link to="/signin" className="text-sm font-medium text-[#334155] dark:text-slate-200 hover:text-[#0F172A] dark:hover:text-white dark:text-white transition-colors">Sign in</Link>
              <button 
                onClick={() => setShowJoinModal(true)}
                className="px-5 py-2.5 rounded-full border border-transparent bg-transparent hover:border-indigo-500/50 hover:bg-[#1D4ED8]/10 text-[#334155] dark:text-slate-200 hover:text-[#0F172A] dark:hover:text-white dark:text-white text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                Join Session
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div id="hero" className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] hidden rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-sm font-medium mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2563EB] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1D4ED8]"></span>
                </span>
                The modern virtual desktop platform
              </div>
              
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-extrabold text-[#0F172A] dark:text-white tracking-tight mb-8 leading-[1.1]">
                Browser-based <br/>
                <span className="text-[#2563EB]">
                  Virtual Workspaces
                </span>
              </h1>
              
              <p className="text-xl text-[#334155] dark:text-slate-200 mb-12 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Launch powerful CAD, Data Science, and Programming environments instantly. Join live sessions for free, or upgrade to host your own.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link to="/signin" className="w-full sm:w-auto px-8 py-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 hover:scale-105">
                  Start for Free <ArrowRight size={20} />
                </Link>
                <button 
                  onClick={() => setShowJoinModal(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#0F172A] dark:text-white border border-[#E2E8F0] dark:border-slate-800 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
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
               <img src="/images/hero_workspace.png" alt="CloudDesk Workspace" className="w-full rounded-[2rem] shadow-2xl border border-[#E2E8F0] dark:border-slate-800 transform transition-transform duration-700 hover:rotate-y-2 hover:rotate-x-2" />
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div id="features" className="py-24 bg-white dark:bg-[#0A1124] relative border-y border-[#E2E8F0] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#0F172A] dark:text-white mb-4">Everything you need</h2>
            <p className="text-[#475569] dark:text-slate-300">Simple, powerful, and built for modern teams and educators.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-white dark:bg-[#0A1124] border border-[#E2E8F0] dark:border-slate-800 hover:border-indigo-500/30 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-[#1D4ED8]/10 flex items-center justify-center border border-indigo-500/20 mb-6">
                <Zap className="text-[#7E22CE]" size={28} />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">Instant Provisioning</h3>
              <p className="text-[#475569] dark:text-slate-300">Launch a cloud desktop in seconds. No complex setup or configuration. Just click and start working.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-white dark:bg-[#0A1124] border border-[#E2E8F0] dark:border-slate-800 hover:border-cyan-500/30 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 mb-6">
                <Users className="text-[#0369A1]" size={28} />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">Live Sessions</h3>
              <p className="text-[#475569] dark:text-slate-300">Host interactive workshops where every participant gets their own pre-configured environment.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-white dark:bg-[#0A1124] border border-[#E2E8F0] dark:border-slate-800 hover:border-emerald-500/30 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-6">
                <Shield className="text-[#15803D]" size={28} />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">Exam Mode</h3>
              <p className="text-[#475569] dark:text-slate-300">Lock down internet access, disable copy-paste, and monitor participants during exams.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#0F172A] dark:text-white mb-4">Simple, transparent pricing</h2>
            <p className="text-[#475569] dark:text-slate-300">Join for free, upgrade to host sessions.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {loadingPricing ? (
               <div className="col-span-full flex justify-center py-12"><div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div></div>
            ) : (
               plans.map(plan => (
                 <div key={plan.id} className="p-8 rounded-3xl bg-white dark:bg-[#0A1124] border border-[#E2E8F0] dark:border-slate-800 hover:border-indigo-500/30 transition-colors relative flex flex-col">
                   {plan.name === 'pro_host' && (
                      <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-indigo-500 to-cyan-500 text-[#0F172A] dark:text-white text-xs font-bold rounded-full uppercase tracking-wider">
                        Most Popular
                      </div>
                   )}
                   <h3 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2">{plan.display_name}</h3>
                   <p className="text-[#475569] dark:text-slate-300 mb-6 capitalize">{plan.name.replace('_', ' ')} plan</p>
                   <div className="text-4xl font-bold text-[#0F172A] dark:text-white mb-8">${plan.price_usd} <span className="text-lg text-muted font-normal">/mo</span></div>
                   
                   <ul className="space-y-4 mb-8 flex-1">
                     <li className="flex items-center gap-3 text-[#0F172A] dark:text-white">
                       <CheckCircle size={20} className="text-[#7E22CE]" /> {plan.can_host_sessions ? `Host up to ${plan.max_session_participants} users` : 'Join unlimited sessions'}
                     </li>
                     <li className="flex items-center gap-3 text-[#0F172A] dark:text-white">
                       <CheckCircle size={20} className="text-[#7E22CE]" /> {plan.compute_hours_per_month} workspace hours/mo
                     </li>
                     <li className="flex items-center gap-3 text-[#0F172A] dark:text-white">
                       <CheckCircle size={20} className="text-[#7E22CE]" /> Access to VM templates
                     </li>
                   </ul>
                   
                   <Link to="/signin" className={`block w-full py-3 text-center rounded-xl font-bold transition-all ${plan.name === 'pro_host' ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-[#0F172A] dark:text-white shadow-lg shadow-indigo-500/25' : 'bg-white dark:bg-[#0A1124] hover:bg-[#F8FAFC] dark:hover:bg-[#050B18] text-[#0F172A] dark:text-white border border-[#E2E8F0] dark:border-slate-800'}`}>
                     Get Started
                   </Link>
                 </div>
               ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-[#F8FAFC] dark:bg-[#050B18] border-t border-[#E2E8F0] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Monitor className="w-6 h-6 text-indigo-500" />
            <span className="text-lg font-bold text-[#0F172A] dark:text-white">CloudDesk</span>
          </div>
          <div className="flex gap-6">
            <Link to="/terms" className="text-sm text-[#475569] dark:text-slate-300 hover:text-[#7E22CE] transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="text-sm text-[#475569] dark:text-slate-300 hover:text-[#7E22CE] transition-colors">Privacy Policy</Link>
            <a href="mailto:support@clouddesk.io" className="text-sm text-[#475569] dark:text-slate-300 hover:text-[#7E22CE] transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {showJoinModal && (
        <JoinByCodeModal onClose={() => setShowJoinModal(false)} />
      )}
    </div>
  );
}
