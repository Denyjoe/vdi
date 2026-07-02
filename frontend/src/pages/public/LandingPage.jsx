import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Monitor, Zap, Users, FolderOpen, Shield, CreditCard, UserPlus, Rocket } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';

export default function LandingPage() {
  const templates = [
    { name: 'AutoCAD Workstation', icon: '📐', os: 'Windows 10', cpu: 4, ram: 8 },
    { name: 'MATLAB Lab', icon: '📊', os: 'Windows 10', cpu: 4, ram: 16 },
    { name: 'Programming Environment', icon: '💻', os: 'Ubuntu 22.04', cpu: 2, ram: 4 },
    { name: 'Graphic Design Studio', icon: '🎨', os: 'Windows 10', cpu: 4, ram: 8 },
    { name: 'Network Lab', icon: '🌐', os: 'Ubuntu 22.04', cpu: 2, ram: 4 },
    { name: 'Cybersecurity Lab', icon: '🛡️', os: 'Kali Linux', cpu: 4, ram: 8 },
  ];

  const features = [
    {
      icon: <Zap className="w-6 h-6 text-indigo-400" />,
      title: "Launch in Seconds",
      text: "Click a template, wait 8 seconds, start working. No downloads, no configuration, no waiting."
    },
    {
      icon: <Monitor className="w-6 h-6 text-cyan-400" />,
      title: "Works on Any Device",
      text: "Your MacBook, Windows laptop, Chromebook, even a tablet. If it has a browser, it works."
    },
    {
      icon: <Users className="w-6 h-6 text-indigo-400" />,
      title: "Collaborate Live",
      text: "Create a session, share a code, teach or learn together. Everyone gets their own VM instance."
    },
    {
      icon: <FolderOpen className="w-6 h-6 text-cyan-400" />,
      title: "Groups & Materials",
      text: "Create groups, share notes, post assignments, collect submissions. Everything in one place."
    },
    {
      icon: <Shield className="w-6 h-6 text-indigo-400" />,
      title: "Isolated & Secure",
      text: "Every VM is completely isolated. Your work is private. Sessions are encrypted end-to-end."
    },
    {
      icon: <CreditCard className="w-6 h-6 text-cyan-400" />,
      title: "Pay As You Grow",
      text: "Start free. Upgrade when you need more. No long-term contracts. Cancel anytime."
    }
  ];

  return (
    <div className="min-h-screen bg-[#050B18]">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden min-h-screen flex flex-col justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#050B18] to-[#050B18]"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm mb-8">
            ✨ Now with 12+ VM Templates
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="text-gradient block mb-2">Your Powerful Workspace,</span>
            <span className="text-gradient-indigo">Anywhere in the World</span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mt-6 leading-relaxed mb-10">
            Access AutoCAD, MATLAB, VS Code, Photoshop and 50+ professional tools from any browser. No installation. No expensive hardware. Just open and start working.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-base font-semibold transition-all duration-300 glow-primary hover:shadow-[0_0_40px_rgba(99,102,241,0.6)]">
              Start for Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/templates" className="px-8 py-4 border border-white/20 hover:border-white/40 text-white rounded-full text-base font-semibold transition-all duration-300">
              See Templates →
            </Link>
          </div>
          
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-slate-500">
            <div className="flex items-center gap-1"><span className="text-indigo-500">✓</span> No credit card required</div>
            <div className="flex items-center gap-1"><span className="text-indigo-500">✓</span> 5 hours free every month</div>
            <div className="flex items-center gap-1"><span className="text-indigo-500">✓</span> Cancel anytime</div>
          </div>

          {/* Browser Mockup */}
          <div className="relative mt-16 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/50 max-w-5xl mx-auto">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <div className="ml-4 flex-1 bg-white/10 rounded-full h-6 px-3 flex items-center max-w-sm mx-auto">
                <span className="text-xs text-slate-400">app.clouddesk.io/dashboard</span>
              </div>
            </div>
            
            <div className="p-6 bg-[#0D1526] grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {templates.slice(0,3).map(t => (
                <div key={t.name} className="glass-card rounded-xl p-4">
                  <div className="text-3xl mb-3">{t.icon}</div>
                  <h3 className="font-semibold text-white mb-1">{t.name}</h3>
                  <p className="text-xs text-slate-400 mb-4">{t.cpu} Core CPU · {t.ram}GB RAM</p>
                  <button className="w-full py-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-600/30 transition-colors">
                    Launch
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/5 text-center">
            <div>
              <div className="text-4xl font-bold text-gradient-indigo mb-1">12+</div>
              <div className="text-sm text-slate-400">VM Templates</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gradient-indigo mb-1">50+</div>
              <div className="text-sm text-slate-400">Tools Available</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gradient-indigo mb-1">99.9%</div>
              <div className="text-sm text-slate-400">Uptime SLA</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gradient-indigo mb-1">Free</div>
              <div className="text-sm text-slate-400">To Get Started</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Everything you need, nothing you don't</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Built for professionals, students, and teams who need powerful tools without powerful hardware.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="glass-card rounded-2xl p-6 hover:bg-white/10 hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates Showcase */}
      <section className="py-24 overflow-hidden bg-gradient-to-b from-transparent to-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">50+ Professional Tools, Ready Instantly</h2>
        </div>
        
        <div className="relative w-full flex overflow-x-hidden">
          <div className="flex gap-4 animate-[scroll_30s_linear_infinite] whitespace-nowrap min-w-max px-4">
            {[...templates, ...templates].map((t, i) => (
              <div key={i} className="glass-card rounded-xl p-5 w-72 inline-block flex-shrink-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">{t.icon}</div>
                  <span className="text-xs px-2 py-1 bg-white/10 rounded-full text-slate-300">{t.os}</span>
                </div>
                <h3 className="font-semibold text-white mb-1 truncate">{t.name}</h3>
                <p className="text-xs text-slate-400 mb-4">{t.cpu} CPU · {t.ram}GB RAM</p>
                <div className="text-sm font-medium text-indigo-400">Launch →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Get started in 3 simple steps</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-indigo-500/0"></div>
            
            <div className="text-center relative z-10">
              <div className="w-24 h-24 mx-auto bg-[#0D1526] rounded-full border border-indigo-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <UserPlus className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">1. Create your account</h3>
              <p className="text-slate-400">Sign up free. No credit card needed. You get 5 hours/month to explore the platform.</p>
            </div>
            
            <div className="text-center relative z-10">
              <div className="w-24 h-24 mx-auto bg-[#0D1526] rounded-full border border-indigo-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <Monitor className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">2. Choose your workspace</h3>
              <p className="text-slate-400">Browse 12+ VM templates. Pick the tools you need. Your VM launches in seconds.</p>
            </div>
            
            <div className="text-center relative z-10">
              <div className="w-24 h-24 mx-auto bg-[#0D1526] rounded-full border border-indigo-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <Rocket className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">3. Start working</h3>
              <p className="text-slate-400">Connect to your virtual desktop from any browser. Your work is saved automatically.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-indigo-900/50 to-cyan-900/20 border-y border-indigo-500/20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to get started?</h2>
          <p className="text-xl text-indigo-200 mb-10">Join thousands of professionals accessing powerful tools from any browser.</p>
          <Link to="/register" className="inline-block px-10 py-4 bg-white text-indigo-900 rounded-full text-lg font-bold hover:bg-indigo-50 transition-colors shadow-xl">
            Start Free Today
          </Link>
          <div className="mt-6 text-sm text-indigo-300">
            No credit card required · 5 free hours every month · Cancel anytime
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#050B18] pt-16 pb-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-6 h-6 text-indigo-500" />
                <span className="text-xl font-bold text-white tracking-tight">CloudDesk</span>
              </div>
              <p className="text-slate-400 text-sm mb-6">Your workspace, anywhere.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-indigo-400">Features</a></li>
                <li><Link to="/templates" className="hover:text-indigo-400">Templates</Link></li>
                <li><Link to="/pricing" className="hover:text-indigo-400">Pricing</Link></li>
                <li><a href="#" className="hover:text-indigo-400">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-indigo-400">About</a></li>
                <li><a href="#" className="hover:text-indigo-400">Blog</a></li>
                <li><a href="#" className="hover:text-indigo-400">Careers</a></li>
                <li><a href="#" className="hover:text-indigo-400">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-indigo-400">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-indigo-400">Terms of Service</a></li>
                <li><a href="#" className="hover:text-indigo-400">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
            <p>© 2026 CloudDesk. Built with ❤️ in Tanzania</p>
            <p className="mt-2 md:mt-0">All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
