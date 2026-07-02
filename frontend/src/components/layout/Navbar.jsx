import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../shared/NotificationBell';
import { Monitor, Menu } from 'lucide-react';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
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
    <nav className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
          aria-label="Toggle sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="md:hidden flex items-center gap-2">
            <Monitor className="w-6 h-6 text-indigo-500" />
            <h1 className="text-white font-bold text-lg leading-tight">CloudDesk</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />

        <div className="hidden sm:flex flex-col items-end">
          <p className="text-sm font-semibold text-white">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="text-xs text-slate-400 flex items-center gap-2">
            {user?.is_host ? (
                <span className="text-indigo-400 font-bold tracking-wide uppercase">Host</span>
            ) : (
                <span className="text-slate-500 uppercase tracking-wide font-medium">User</span>
            )}
          </p>
        </div>

        <div className="relative">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center border border-slate-700 shadow-sm cursor-pointer hover:border-slate-600 transition-colors" onClick={() => navigate('/profile')}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-slate-300 font-bold text-sm tracking-wider">
                {getInitials()}
              </span>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
