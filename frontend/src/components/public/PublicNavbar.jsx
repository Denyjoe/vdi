import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Monitor, Menu, X } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function PublicNavbar() {
  const { user } = useAuthStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'Templates', href: '/templates' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'About', href: '/#about' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/30 backdrop-blur-md border-b border-[var(--border-color)] transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Monitor className="w-8 h-8 text-indigo-500" />
            <span className="text-xl font-bold text-[var(--text-primary)] tracking-tight">CloudDesk</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a 
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <Link 
                to="/dashboard"
                className="text-sm font-medium text-[var(--text-primary)] bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-full transition-all duration-300 glow-primary"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link 
                  to="/login"
                  className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors px-4 py-2"
                >
                  Sign In
                </Link>
                <Link 
                  to="/register"
                  className="text-sm font-medium text-[var(--text-primary)] bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-full transition-all duration-300 glow-primary"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-[var(--text-primary)] hover:text-[var(--text-primary)] focus:outline-none p-2"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0D1526] border-b border-[var(--border-color)] absolute w-full left-0 top-16 shadow-2xl">
          <div className="px-4 pt-2 pb-6 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block px-3 py-3 text-base font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-md"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-6 pt-6 border-t border-[var(--border-color)] flex flex-col gap-3">
              {user ? (
                <Link 
                  to="/dashboard"
                  className="block text-center w-full text-base font-medium text-[var(--text-primary)] bg-indigo-600 hover:bg-indigo-500 px-5 py-3 rounded-xl transition-all duration-300"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link 
                    to="/login"
                    className="block text-center w-full text-base font-medium text-[var(--text-primary)] border border-white/20 hover:bg-white/5 px-5 py-3 rounded-xl transition-all duration-300"
                  >
                    Sign In
                  </Link>
                  <Link 
                    to="/register"
                    className="block text-center w-full text-base font-medium text-[var(--text-primary)] bg-indigo-600 hover:bg-indigo-500 px-5 py-3 rounded-xl transition-all duration-300"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
