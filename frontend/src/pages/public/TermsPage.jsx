import React from 'react';
import { Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#050B18] text-[#1E293B] dark:text-slate-100">
      <nav className="fixed top-0 w-full z-40 bg-[#F8FAFC]/80 dark:bg-[#050B18]/80 backdrop-blur-md border-b border-[#E2E8F0] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Monitor className="w-8 h-8 text-indigo-500" />
            <span className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-white">CloudDesk</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/signin" className="text-sm font-medium text-[#475569] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white dark:text-white transition-colors">Sign in</Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24 max-w-3xl mx-auto px-6">
        <h1 className="text-4xl font-bold mb-8 text-[#0F172A] dark:text-white">Terms of Service</h1>
        <div className="prose max-w-none space-y-6 text-[#334155] dark:text-slate-200">
          <p className="text-[#64748B] dark:text-slate-400">Last updated: October 1, 2026</p>
          
          <h2 className="text-2xl font-semibold text-[#1E293B] dark:text-slate-100 mt-8">1. Acceptance of Terms</h2>
          <p>By accessing and using CloudDesk, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
          
          <h2 className="text-2xl font-semibold text-[#1E293B] dark:text-slate-100 mt-8">2. Virtual Workspaces and Usage</h2>
          <p>CloudDesk provides virtual desktop infrastructure for educational and professional use. Users are prohibited from using the provided virtual machines for cryptocurrency mining, illegal file sharing, or any activities that violate applicable laws or consume excessive network resources beyond their allocated quotas.</p>
          
          <h2 className="text-2xl font-semibold text-[#1E293B] dark:text-slate-100 mt-8">3. Accounts and Subscriptions</h2>
          <p>You are responsible for maintaining the security of your account and password. Subscription fees are billed in advance on a monthly basis and are non-refundable. Host plans include specific usage limits which must not be circumvented.</p>
          
          <h2 className="text-2xl font-semibold text-[#1E293B] dark:text-slate-100 mt-8">4. Data and Privacy</h2>
          <p>We respect your privacy. Virtual machines are ephemeral by default, but user data saved within designated persistent storage volumes is retained. Please review our Privacy Policy to understand how we collect and use your information.</p>
          
          <h2 className="text-2xl font-semibold text-[#1E293B] dark:text-slate-100 mt-8">5. Termination</h2>
          <p>We reserve the right to terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
        </div>
      </main>

      <footer className="py-12 bg-[#F8FAFC] dark:bg-[#050B18] border-t border-[#E2E8F0] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Monitor className="w-6 h-6 text-indigo-500" />
            <span className="text-lg font-bold text-[#0F172A] dark:text-white">CloudDesk</span>
          </div>
          <div className="flex gap-6">
            <Link to="/terms" className="text-sm text-[#475569] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white dark:text-white transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="text-sm text-[#475569] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white dark:text-white transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
