import React from 'react';
import { Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050B18] text-[var(--text-primary)]">
      <nav className="fixed top-0 w-full z-40 bg-[#050B18]/80 backdrop-blur-md border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Monitor className="w-8 h-8 text-indigo-500" />
            <span className="text-xl font-bold tracking-tight">CloudDesk</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium hover:text-indigo-400 transition-colors">Sign in</Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24 max-w-3xl mx-auto px-6">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <div className="prose prose-invert prose-indigo max-w-none space-y-6 text-[var(--text-secondary)]">
          <p>Last updated: October 1, 2026</p>
          
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-8">1. Information We Collect</h2>
          <p>We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This includes your name, email address, and billing information.</p>
          
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-8">2. Workspace Data</h2>
          <p>Files, code, and configurations created within your virtual workspaces are stored securely. We do not inspect your workspace content unless required for troubleshooting at your request, or if required by law.</p>
          
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-8">3. How We Use Information</h2>
          <p>We use the information we collect to provide, maintain, and improve our services, including to provision virtual machines, process transactions, send related information, and provide customer support.</p>
          
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-8">4. Data Sharing</h2>
          <p>We do not share your personal information or workspace data with third parties except as necessary to provide our services (such as payment processing) or to comply with the law.</p>
          
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-8">5. Security</h2>
          <p>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction.</p>
        </div>
      </main>

      <footer className="py-12 bg-[#050B18] border-t border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Monitor className="w-6 h-6 text-indigo-500" />
            <span className="text-lg font-bold">CloudDesk</span>
          </div>
          <div className="flex gap-6">
            <Link to="/terms" className="text-sm text-[var(--text-secondary)] hover:text-indigo-400 transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="text-sm text-[var(--text-secondary)] hover:text-indigo-400 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
