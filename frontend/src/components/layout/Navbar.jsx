import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../shared/NotificationBell';
import { Monitor, Menu, Sun, Moon } from 'lucide-react';
import useThemeStore from '../../store/themeStore';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const getInitials = () => {
    return `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  };
  
  const avatarUrl = user?.avatar_url || user?.avatar;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-card)]"
          aria-label="Toggle sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="md:hidden flex items-center gap-2">
            <Monitor className="w-6 h-6 text-indigo-500" />
            <h1 className="text-[var(--text-primary)] font-bold text-lg leading-tight">CloudDesk</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />

        <button 
          onClick={toggleTheme}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
          }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="hidden sm:flex flex-col items-end">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
            {user?.role === 'admin' ? (
                <span className="text-purple-400 font-bold tracking-wide uppercase">Admin</span>
            ) : user?.is_host ? (
                <span className="text-blue-400 font-bold tracking-wide uppercase">Host</span>
            ) : (
                <span className="text-slate-500 uppercase tracking-wide font-medium">Free</span>
            )}
          </p>
        </div>

        <div className="relative">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-[var(--bg-card)] flex items-center justify-center border border-[var(--border-color)] shadow-sm cursor-pointer hover:border-slate-600 transition-colors" onClick={() => navigate('/profile')}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[var(--text-primary)] font-bold text-sm tracking-wider">
                {getInitials()}
              </span>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
