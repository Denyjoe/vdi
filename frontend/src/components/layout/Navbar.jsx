/**
 * Navbar — top navigation bar for all dashboard pages.
 *
 * Displays CloudDesk branding on the left, user info + role badge + logout on the right.
 * On mobile (<768px), shows a hamburger menu button to toggle the sidebar.
 *
 * @param {Object} props
 * @param {Function} props.onMenuClick - Callback to toggle mobile sidebar open/closed.
 * @returns {JSX.Element} The top navigation bar.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../shared/NotificationBell';
import { Monitor, Menu } from 'lucide-react';

/** Color mappings for role badges */
const ROLE_BADGE_STYLES = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  lecturer: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  student: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

/** Label mappings for role badges */
const ROLE_LABELS = {
  admin: 'Admin',
  lecturer: 'Lecturer',
  student: 'Student',
};

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Avatar fallback gradient
  const getGradient = () => {
    if (user?.role === 'admin') return 'from-red-600 to-red-800';
    if (user?.role === 'lecturer') return 'from-purple-600 to-purple-800';
    return 'from-blue-600 to-blue-800';
  };
  
  const getInitials = () => {
    return `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  };
  
  const avatarUrl = user?.avatar_url || user?.avatar;

  /**
   * Handles user logout by clearing auth state and redirecting to login.
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /**
   * Returns a styled role badge element for the given role.
   * @param {string} role - The user's role (admin, lecturer, student).
   * @returns {JSX.Element} A colored badge pill.
   */
  const getRoleBadge = (role) => {
    const style = ROLE_BADGE_STYLES[role] || ROLE_BADGE_STYLES.student;
    const label = ROLE_LABELS[role] || 'Student';
    return (
      <span className={`${style} text-xs font-medium px-2.5 py-1 rounded-full border`}>
        {label}
      </span>
    );
  };

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
      {/* Left — hamburger (mobile) + system branding */}
      <div className="flex items-center gap-3">
        {/* Hamburger menu — visible only on mobile */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700"
          aria-label="Toggle sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* CloudDesk branding */}
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-sm">
          <Monitor className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-white font-bold text-lg leading-tight">CloudDesk</h1>
          <span className="text-slate-400 text-xs leading-tight hidden sm:block">
            Virtual Desktop Infrastructure
          </span>
        </div>
      </div>

      {/* Right — user info */}
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <NotificationBell />
            {/* User Profile display */}
            <div className="hidden md:flex items-center gap-3 bg-slate-800/50 py-1.5 px-3 rounded-full border border-slate-700">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-600" />
              ) : (
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getGradient()} flex items-center justify-center border border-slate-600`}>
                  <span className="text-xs font-bold text-white">{getInitials()}</span>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white leading-tight">
                  {user?.first_name} {user?.last_name}
                </span>
                <span className={`text-[10px] font-medium uppercase tracking-wider
                  ${user?.role === 'admin' ? 'text-red-400' : 
                    user?.role === 'lecturer' ? 'text-purple-400' : 'text-indigo-400'}`}
                >
                  {user?.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors ml-2 sm:ml-4 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-md"
            >
              Logout
            </button>
          </>
        ) : (
          <span className="text-slate-300 text-sm">Not logged in</span>
        )}
      </div>
    </nav>
  );
}
