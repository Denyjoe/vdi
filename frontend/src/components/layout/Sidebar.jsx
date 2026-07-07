import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Monitor, 
  Video, 
  Plus,
  BarChart2,
  BarChart3,
  UserCircle,
  Settings,
  LogOut,
  Server,
  Users,
  Database,
  Cpu,
  FileText,
  LayoutTemplate,
  Radio,
  Receipt,
  Moon,
  Sun,
  ChevronUp
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import useSettingsStore from '../../store/settingsStore';
import useLiveSession from '../../hooks/useLiveSession';
import { toast } from 'react-hot-toast';

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useUIStore();
  const navigate = useNavigate();
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  const liveSession = useLiveSession(user);
  const { openSettings } = useSettingsStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const { openUpgradeModal, openCreateSessionModal } = useUIStore();

  const NavItem = ({ to, icon: Icon, children }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-indigo-500/10 text-indigo-400 font-medium'
            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
        }`
      }
    >
      <Icon size={20} className="shrink-0" />
      <span>{children}</span>
    </NavLink>
  );

  return (
    <aside className="w-64 bg-[#080B10] border-r border-slate-800/30 flex flex-col h-screen fixed top-0 left-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-700/50 shrink-0">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          CloudDesk
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 no-scrollbar">
        
        {/* MAIN SECTION */}
        {user?.role !== 'admin' && (
          <div>
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Main
            </p>
            <div className="space-y-1">
              <NavItem to="/dashboard" icon={LayoutDashboard}>Overview</NavItem>
              <NavItem to="/workspaces" icon={Monitor}>My Workspaces</NavItem>
              <NavItem to="/sessions/my" icon={Video}>My Sessions</NavItem>
            </div>
          </div>
        )}

        {/* HOST SECTION */}
        {user?.is_host && user?.role !== 'admin' && (
          <div>
            <p className="px-4 text-xs font-semibold text-indigo-400/80 uppercase tracking-wider mb-4">
              Host
            </p>
            <div className="space-y-1">
              <button
                onClick={openCreateSessionModal}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  width: '100%',
                  borderRadius: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#e2e8f0'
                  e.currentTarget.style.background = 
                    'rgba(255,255,255,0.05)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#64748b'
                  e.currentTarget.style.background = 'none'
                }}>
                <Plus size={16} />
                Create Session
              </button>
              
              {liveSession && (
                <button
                  onClick={() => navigate(`/host/session/${liveSession.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#00FF87]/5 border border-[#00FF87]/15 hover:bg-[#00FF87]/10 active:scale-[0.98] transition-all group mb-1"
                >
                  <div className="relative flex-shrink-0">
                    <Radio size={16} className="text-[#00FF87]" />
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00FF87] animate-pulse" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[11px] font-semibold text-[#00FF87] truncate">
                      {liveSession.name}
                    </p>
                    <p className="text-[9px] text-slate-500">
                      {liveSession.participant_count || 0} participants · Live
                    </p>
                  </div>
                </button>
              )}

            </div>
          </div>
        )}

        {/* ADMIN SECTION */}
        {user?.role === 'admin' && (
          <div>
            <p className="px-4 text-xs font-semibold text-rose-400/80 uppercase tracking-wider mb-4">
              Admin
            </p>
            <div className="space-y-1">
              <NavItem to="/admin/dashboard" icon={LayoutDashboard}>Dashboard</NavItem>
              <NavItem to="/admin/vm-pool" icon={Server}>VM Pool</NavItem>
              <NavItem to="/admin/users" icon={Users}>Users</NavItem>
              <NavItem to="/admin/templates" icon={LayoutTemplate}>Templates</NavItem>
              <NavItem to="/admin/analytics" icon={BarChart3}>Analytics</NavItem>
              <NavItem to="/admin/settings" icon={Settings}>Settings</NavItem>
            </div>
          </div>
        )}
      </div>

      {/* UPGRADE BANNER */}
      {!user?.is_host && user?.role !== 'admin' && (
        <div style={{
          margin: '12px',
          padding: '16px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.1))',
          border: '1px solid rgba(99,102,241,0.2)'
        }}>
          <p style={{color: '#a5b4fc', fontSize: '13px', fontWeight: 600, marginBottom: '4px'}}>
            ⚡ Host Sessions
          </p>
          <p style={{color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px'}}>
            Run live VM sessions for up to 200 participants
          </p>
          <button 
            onClick={openUpgradeModal}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}>
            Upgrade to Host →
          </button>
        </div>
      )}

      {/* USER PROFILE AVATAR POPUP */}
      <div className="relative mt-auto border-t border-slate-800/30 pt-3" ref={menuRef}>
        
        {/* Popup menu — appears above avatar */}
        {showUserMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 bg-[#0F131A] border border-slate-800/50 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 z-50"
            style={{
              animation: 'slideUp 0.2s ease-out',
            }}>
            
            {/* User info */}
            <div className="px-4 py-3.5 border-b border-slate-800/30">
              <div className="flex items-center gap-3">
                {user.avatar ? (
                  <img src={user.avatar} 
                    className="w-10 h-10 rounded-full object-cover" 
                    alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#6C63FF]/20 flex items-center justify-center text-sm font-bold text-[#6C63FF]">
                    {user.first_name?.[0]}
                    {user.last_name?.[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              {user.is_host && (
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6C63FF]/10 text-[9px] font-bold text-[#6C63FF] uppercase tracking-wider">
                  HOST
                </div>
              )}
            </div>
            
            {/* Theme toggle */}
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-800/30">
              <div className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <Moon size={14} className="text-slate-400" />
                ) : (
                  <Sun size={14} className="text-slate-400" />
                )}
                <span className="text-xs text-slate-400">
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </span>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative w-9 h-5 rounded-full transition-all duration-300 active:scale-95
                  ${theme === 'dark' ? 'bg-[#6C63FF]' : 'bg-slate-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300
                  ${theme === 'dark' ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
            
            {/* Menu items */}
            <div className="py-1">
              <button onClick={() => {
                openSettings('profile');
                setShowUserMenu(false);
              }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800/50 transition-colors">
                <Settings size={14} className="text-slate-500" />
                Account Settings
              </button>
              <button onClick={() => {
                navigate('/billing');
                setShowUserMenu(false);
              }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800/50 transition-colors">
                <Receipt size={14} className="text-slate-500" />
                Billing & Usage
              </button>
            </div>
            
            {/* Sign out */}
            <div className="border-t border-slate-800/30 py-1">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/5 transition-colors">
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        )}
        
        {/* Avatar button — always visible */}
        <button 
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/30 transition-all active:scale-[0.98] group">
          {user.avatar ? (
            <img src={user.avatar} 
              className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-700 group-hover:ring-slate-500 transition-all" alt="" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#6C63FF]/20 flex items-center justify-center text-xs font-bold text-[#6C63FF] ring-2 ring-slate-700 group-hover:ring-slate-500 transition-all">
              {user.first_name?.[0]}
              {user.last_name?.[0]}
            </div>
          )}
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {user.first_name} {user.last_name}
            </p>
          </div>
          <ChevronUp size={14} 
            className={`text-slate-600 transition-transform duration-200
            ${showUserMenu ? '' : 'rotate-180'}`} />
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </aside>
  );
}
