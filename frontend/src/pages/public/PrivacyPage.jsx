import React from 'react';
import { Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-bold mb-8 text-[#0F172A] dark:text-white">Privacy Policy</h1>
        <div className="prose max-w-none space-y-6 text-[#334155] dark:text-slate-200">
          <p className="text-[#64748B] dark:text-slate-400">Last updated: October 1, 2026</p>
          
          <h2 className="text-2xl font-semibold text-[#1E293B] dark:text-slate-100 mt-8">1. Information We Collect</h2>
          <p>We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This includes your name, email address, and billing information.</p>
          
          <h2 className="text-2xl font-semibold text-[#1E293B] dark:text-slate-100 mt-8">2. Workspace Data</h2>
          <p>Files, code, and configurations created within your virtual workspaces are stored securely. We do not inspect your workspace content unless required for troubleshooting at your request, or if required by law.</p>
          
          <h2 className="text-2xl font-semibold text-[#1E293B] dark:text-slate-100 mt-8">3. How We Use Information</h2>
          <p>We use the information we collect to provide, maintain, and improve our services, including to provision virtual machines, process transactions, send related information, and provide customer support.</p>
          
          <h2 className="text-2xl font-semibold text-[#1E293B] dark:text-slate-100 mt-8">4. Data Sharing</h2>
          <p>We do not share your personal information or workspace data with third parties except as necessary to provide our services (such as payment processing) or to comply with the law.</p>
          
          <h2 className="text-2xl font-semibold text-[#1E293B] dark:text-slate-100 mt-8">5. Security</h2>
          <p>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction.</p>
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
