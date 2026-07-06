import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../shared/NotificationBell';
import { Monitor, Menu, Sun, Moon, Bell, Clock, Wifi, HelpCircle } from 'lucide-react';
import useThemeStore from '../../store/themeStore';
import useLiveSession from '../../hooks/useLiveSession';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const liveSession = useLiveSession(user);

  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hours}:${minutes}:${seconds}`);
    };
    
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const getPageLabel = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'COMMAND CENTER';
    if (path === '/workspaces') return 'ACTIVE TERMINAL STREAMS';
    if (path.startsWith('/workspace/')) return 'LIVE DESKTOP SESSION';
    if (path === '/sessions/my') return 'SESSION LOGS';
    if (path === '/account' || path === '/settings') return 'ACCOUNT TERMINAL';
    if (path.startsWith('/admin/dashboard')) return 'ADMIN CONSOLE';
    if (path.startsWith('/admin/vm-pool')) return 'NODE POOL MANAGER';
    if (path.startsWith('/admin/users')) return 'USER REGISTRY';
    if (path.startsWith('/admin/templates')) return 'TEMPLATE ENGINE';
    if (path.startsWith('/admin/analytics')) return 'ANALYTICS MATRIX';
    if (path.startsWith('/admin/settings')) return 'SYSTEM CONFIG';
    if (path.startsWith('/host/session')) return 'SESSION MONITOR';
    return 'DASHBOARD';
  };

  const getInitials = () => {
    return `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  };
  
  const avatarUrl = user?.avatar_url || user?.avatar;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="h-14 px-4 sm:px-6 flex items-center justify-between bg-[#080B10]/80 backdrop-blur-md border-b border-slate-800/30 sticky top-0 z-50">
      <style>{`
        @keyframes wifiBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .wifi-blink {
          animation: wifiBlink 1.5s ease-in-out infinite;
          display: flex;
          align-items: center;
        }
        @keyframes bellWiggle {
          0%, 85%, 100% { transform: rotate(0); }
          88% { transform: rotate(-10deg); }
          91% { transform: rotate(10deg); }
          94% { transform: rotate(-8deg); }
          97% { transform: rotate(8deg); }
        }
        .bell-wiggle {
          animation: bellWiggle 3s ease-in-out infinite;
          transform-origin: top center;
        }
      `}</style>
      
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800/50"
          aria-label="Toggle sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="md:hidden flex items-center gap-2">
            <Monitor className="w-6 h-6 text-[#0066FF]" />
            <h1 className="text-slate-200 font-bold text-lg leading-tight">CloudDesk</h1>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <span className="text-[11px] text-slate-600 font-medium tracking-wider uppercase">
            Console
          </span>
          <span className="text-slate-700">›</span>
          <span className="px-3 py-1 rounded-full bg-[#0066FF]/10 border border-[#0066FF]/20 text-[10px] font-bold text-[#00A3FF] uppercase tracking-widest">
            {getPageLabel()}
          </span>
          
          {liveSession && (
            <button
              onClick={() => navigate(`/host/session/${liveSession.id}`)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00FF87]/5 border border-[#00FF87]/15 hover:bg-[#00FF87]/10 active:scale-95 transition-all ml-3">
              <div className="w-2 h-2 rounded-full bg-[#00FF87] animate-pulse shadow-lg shadow-green-500/50" />
              <span className="text-[10px] font-semibold text-[#00FF87] uppercase tracking-wider">
                Live Session
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        
        <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/30">
          <div className="wifi-blink">
            <Wifi size={13} className="text-[#00A3FF]" />
          </div>
          <span className="text-[10px] font-semibold tracking-wider uppercase">
            <span className="text-white">GW-SSL:</span>{' '}
            <span className="text-[#00FF87]">Secured</span>
          </span>
          <div className="w-2 h-2 rounded-full bg-[#00FF87]" style={{ boxShadow: '0 0 6px rgba(0,255,135,0.4)' }} />
        </div>
        
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/50">
          <Clock size={12} className="text-slate-500" />
          <span className="text-[11px] font-mono font-medium text-slate-400 tabular-nums tracking-wider">
            {utcTime}
          </span>
          <span className="text-[8px] text-slate-600 font-semibold uppercase ml-0.5">
            UTC
          </span>
        </div>
        
        <button className="hidden sm:block relative group p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors active:scale-95">
          <HelpCircle size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
          <div className="absolute top-full right-0 mt-2 px-3 py-1.5 rounded-lg bg-slate-800 text-[10px] text-slate-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
            Help & Documentation
          </div>
        </button>

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
