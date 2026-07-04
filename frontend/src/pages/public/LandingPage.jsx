import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Monitor, Video, Plus, CheckCircle, ArrowRight, Zap, Shield, Users 
} from 'lucide-react';
import JoinByCodeModal from '../../components/shared/JoinByCodeModal';

export default function LandingPage() {
  const navigate = useNavigate();
  const [showJoinModal, setShowJoinModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#050B18] overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 bg-[#050B18]/80 backdrop-blur-md border-b border-[var(--border-color)] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-8 h-8 text-indigo-500" />
            <span className="text-xl font-bold text-[var(--text-primary)] tracking-tight">CloudDesk</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">Pricing</a>
            <div className="flex items-center gap-4 ml-4">
              <Link to="/login" className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">Sign in</Link>
              <button 
                onClick={() => setShowJoinModal(true)}
                className="px-5 py-2.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-sm font-semibold transition-all hover:scale-105"
              >
                Join Session
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              The modern virtual desktop platform
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-extrabold text-[var(--text-primary)] tracking-tight mb-8 leading-[1.1]">
              Browser-based <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
                Virtual Workspaces
              </span>
            </h1>
            
            <p className="text-xl text-[var(--text-secondary)] mb-12 max-w-2xl mx-auto leading-relaxed">
              Launch powerful CAD, Data Science, and Programming environments instantly. Join live sessions for free, or upgrade to host your own.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
              <p className="text-[var(--text-secondary)]">Launch a new VM in seconds. No complex AWS or Azure setup required. Just click and code.</p>
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
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free */}
            <div className="p-8 rounded-3xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Free</h3>
              <p className="text-[var(--text-secondary)] mb-6">For participants and casual users.</p>
              <div className="text-4xl font-bold text-[var(--text-primary)] mb-8">$0 <span className="text-lg text-slate-500 font-normal">/mo</span></div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-[var(--text-primary)]">
                  <CheckCircle size={20} className="text-indigo-400" /> Join unlimited sessions
                </li>
                <li className="flex items-center gap-3 text-[var(--text-primary)]">
                  <CheckCircle size={20} className="text-indigo-400" /> 5 free workspace hours/mo
                </li>
                <li className="flex items-center gap-3 text-[var(--text-primary)]">
                  <CheckCircle size={20} className="text-indigo-400" /> Access to all VM templates
                </li>
              </ul>
              
              <Link to="/register" className="block w-full py-3 text-center bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] rounded-xl font-bold transition-colors">
                Get Started
              </Link>
            </div>
            
            {/* Pro Host */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-indigo-900/50 to-slate-900 border border-indigo-500/30 relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-indigo-500 to-cyan-500 text-[var(--text-primary)] text-xs font-bold rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Pro Host</h3>
              <p className="text-indigo-200/60 mb-6">For educators and teams.</p>
              <div className="text-4xl font-bold text-[var(--text-primary)] mb-8">$19 <span className="text-lg text-slate-500 font-normal">/mo</span></div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-[var(--text-primary)]">
                  <CheckCircle size={20} className="text-cyan-400" /> Host up to 50 participants
                </li>
                <li className="flex items-center gap-3 text-[var(--text-primary)]">
                  <CheckCircle size={20} className="text-cyan-400" /> 80 workspace hours/mo
                </li>
                <li className="flex items-center gap-3 text-[var(--text-primary)]">
                  <CheckCircle size={20} className="text-cyan-400" /> Exam Mode & Monitoring
                </li>
                <li className="flex items-center gap-3 text-[var(--text-primary)]">
                  <CheckCircle size={20} className="text-cyan-400" /> Analytics Dashboard
                </li>
              </ul>
              
              <Link to="/register" className="block w-full py-3 text-center bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-[var(--text-primary)] rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25">
                Upgrade to Host
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showJoinModal && (
        <JoinByCodeModal onClose={() => setShowJoinModal(false)} />
      )}
    </div>
  );
}
