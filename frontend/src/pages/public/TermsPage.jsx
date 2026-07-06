import React from 'react';
import { Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <div className="prose prose-invert prose-indigo max-w-none space-y-6 text-[var(--text-secondary)]">
          <p>Last updated: October 1, 2026</p>
          
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-8">1. Acceptance of Terms</h2>
          <p>By accessing and using CloudDesk, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
          
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-8">2. Virtual Workspaces and Usage</h2>
          <p>CloudDesk provides virtual desktop infrastructure for educational and professional use. Users are prohibited from using the provided virtual machines for cryptocurrency mining, illegal file sharing, or any activities that violate applicable laws or consume excessive network resources beyond their allocated quotas.</p>
          
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-8">3. Accounts and Subscriptions</h2>
          <p>You are responsible for maintaining the security of your account and password. Subscription fees are billed in advance on a monthly basis and are non-refundable. Host plans include specific usage limits which must not be circumvented.</p>
          
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-8">4. Data and Privacy</h2>
          <p>We respect your privacy. Virtual machines are ephemeral by default, but user data saved within designated persistent storage volumes is retained. Please review our Privacy Policy to understand how we collect and use your information.</p>
          
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-8">5. Termination</h2>
          <p>We reserve the right to terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
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
