import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import useSettingsStore from '../../store/settingsStore';
import useLiveSession from '../../hooks/useLiveSession';
import { toast } from 'react-hot-toast';
import { 
  LayoutDashboard, Monitor, Video, Plus, BarChart3, ChevronLeft, 
  ChevronRight, Radio, ChevronUp, LogOut, Settings, Receipt,
  Server, Users, LayoutTemplate
} from 'lucide-react';

function NavItem({ icon: Icon, label, path, onClick, collapsed, active, accent }) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (onClick) onClick();
    else if (path) navigate(path);
  };
  
  return (
    <button onClick={handleClick}
      className={`w-full flex items-center rounded-xl transition-all duration-200 active:scale-[0.97] group relative
        ${collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5'}
        ${active
          ? 'bg-[#0066FF]/10 text-[#0066FF]'
          : accent
            ? 'text-[#00FF87] hover:bg-[#00FF87]/5'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
        }`}
      title={collapsed ? label : ''}>
      
      {/* Icon with glow on active */}
      <div className={`flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg transition-all duration-200
        ${active
          ? 'bg-[#0066FF]/15 shadow-sm shadow-blue-500/10'
          : accent
            ? 'bg-[#00FF87]/10'
            : 'bg-transparent group-hover:bg-slate-800/50'
        }`}>
        <Icon size={17} className={active ? 'text-[#0066FF]' : accent ? 'text-[#00FF87]' : ''} />
      </div>
      
      {/* Label — hidden when collapsed */}
      {!collapsed && (
        <span className={`text-[13px] font-medium truncate ${active ? 'text-[#0066FF] font-semibold' : ''}`}>
          {label}
        </span>
      )}
      
      {/* Active indicator bar */}
      {active && (
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#0066FF] shadow-lg shadow-blue-500/30`} />
      )}
      
      {/* Tooltip on collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-[#1E293B] text-[11px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-xl shadow-black/30 border border-slate-700/30 z-50">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#1E293B]" />
        </div>
      )}
    </button>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, openBilling } = useUIStore();
  const collapsed = sidebarCollapsed;
  const navigate = useNavigate();
  const location = useLocation();
  const liveSession = useLiveSession(user);
  const { openSettings } = useSettingsStore();

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

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  return (
    <aside className={`h-screen flex flex-col bg-[#080B10] border-r border-slate-800/30 transition-all duration-300 ease-out ${collapsed ? 'w-[68px]' : 'w-[240px]'} flex-shrink-0 relative`}>
      
      {/* ═══ LOGO AREA ═══ */}
      <div className={`h-14 flex items-center border-b border-slate-800/30 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
        
        {collapsed ? (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#0066FF] flex items-center justify-center">
            <span className="text-white text-xs font-extrabold">C</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#0066FF] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-extrabold">C</span>
            </div>
            <span className="text-[15px] font-extrabold text-white tracking-tight">
              CloudDesk
            </span>
          </div>
        )}
      </div>
      
      {/* ═══ COLLAPSE TOGGLE ═══ */}
      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-[#1E293B] border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#0066FF] hover:border-[#0066FF] active:scale-90 transition-all duration-200 z-10 shadow-lg shadow-black/30"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
      
      {/* ═══ NAVIGATION ═══ */}
      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        
        {/* MAIN section */}
        {user?.role !== 'admin' && (
          <>
            {!collapsed && (
              <p className="px-5 mb-2 text-[9px] uppercase tracking-[3px] text-slate-600 font-semibold">
                Main
              </p>
            )}
            
            <div className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
              <NavItem icon={LayoutDashboard} label="Overview" path="/dashboard" collapsed={collapsed} active={location.pathname === '/dashboard'} />
              <NavItem icon={Monitor} label="My Workspaces" path="/workspaces" collapsed={collapsed} active={location.pathname === '/workspaces'} />
              <NavItem icon={Video} label="My Sessions" path="/sessions/my" collapsed={collapsed} active={location.pathname === '/sessions/my'} />
            </div>
          </>
        )}

        {/* HOST section */}
        {user?.is_host && user?.role !== 'admin' && (
          <>
            {!collapsed && (
              <p className="px-5 mt-6 mb-2 text-[9px] uppercase tracking-[3px] text-slate-600 font-semibold">
                Host
              </p>
            )}
            
            {collapsed && (
              <div className="mx-2 my-4 border-t border-slate-800/30" />
            )}
            
            <div className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
              <NavItem icon={Plus} label="Create Session" path="/create-session" collapsed={collapsed} active={location.pathname === '/create-session'} />
              
              {/* Live session indicator */}
              {liveSession && (
                <button onClick={() => navigate(`/host/session/${liveSession.id}`)}
                  className={`w-full flex items-center gap-2.5 rounded-xl transition-all duration-200 active:scale-[0.97] bg-[#00FF87]/5 border border-[#00FF87]/15 hover:bg-[#00FF87]/10 ${collapsed ? 'justify-center p-2.5 mt-1' : 'px-3 py-2.5 mt-1'}`}>
                  <div className="relative flex-shrink-0">
                    <Radio size={16} className="text-[#00FF87]" />
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00FF87] animate-pulse" />
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[11px] font-semibold text-[#00FF87] truncate">
                        {liveSession.name}
                      </p>
                      <p className="text-[9px] text-slate-500">
                        Live
                      </p>
                    </div>
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {/* ADMIN section */}
        {user?.role === 'admin' && (
          <>
            {!collapsed && (
              <p className="px-5 mt-6 mb-2 text-[9px] uppercase tracking-[3px] text-slate-600 font-semibold">
                Admin
              </p>
            )}
            
            {collapsed && (
              <div className="mx-2 my-4 border-t border-slate-800/30" />
            )}
            
            <div className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
              <NavItem icon={LayoutDashboard} label="Dashboard" path="/admin/dashboard" collapsed={collapsed} active={location.pathname === '/admin/dashboard'} />
              <NavItem icon={Server} label="VM Pool" path="/admin/vm-pool" collapsed={collapsed} active={location.pathname === '/admin/vm-pool'} />
              <NavItem icon={Users} label="Users" path="/admin/users" collapsed={collapsed} active={location.pathname === '/admin/users'} />
              <NavItem icon={LayoutTemplate} label="Templates" path="/admin/templates" collapsed={collapsed} active={location.pathname === '/admin/templates'} />
              <NavItem icon={BarChart3} label="Analytics" path="/admin/analytics" collapsed={collapsed} active={location.pathname === '/admin/analytics'} />
              <NavItem icon={Settings} label="Settings" path="/admin/settings" collapsed={collapsed} active={location.pathname === '/admin/settings'} />
            </div>
          </>
        )}
      </nav>
      
      {/* ═══ AVATAR / USER AREA ═══ */}
      <div className="border-t border-slate-800/30 relative" ref={menuRef}>
        
        {/* Avatar popup menu */}
        {showUserMenu && (
          <div className="absolute bottom-full left-2 right-2 mb-2 bg-[#0F131A] border border-slate-800/50 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 z-50"
            style={{ animation: 'slideUp 0.2s ease-out', minWidth: collapsed ? '220px' : 'auto', left: collapsed ? '4px' : '8px' }}>
            
            {/* User info */}
            <div className="px-4 py-3.5 border-b border-slate-800/30">
              <p className="text-sm font-semibold text-white truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {user?.email}
              </p>
              {user?.is_host && (
                <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-full bg-[#6C63FF]/10 text-[9px] font-bold text-[#6C63FF] uppercase tracking-wider">
                  HOST
                </span>
              )}
            </div>
            
            {/* Menu items */}
            <div className="py-1">
              <button onClick={() => { openSettings('profile'); setShowUserMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800/40 transition-colors">
                <Settings size={14} className="text-slate-500" />
                Account Settings
              </button>
              <button onClick={() => { openBilling(); setShowUserMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800/40 transition-colors">
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
        
        {/* Avatar button */}
        <button onClick={() => setShowUserMenu(!showUserMenu)}
          className={`w-full flex items-center transition-all duration-200 hover:bg-slate-800/30 active:scale-[0.98] group ${collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-3'}`}>
          
          {/* Avatar circle */}
          {user?.avatar ? (
            <img src={user.avatar} className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-700/50 group-hover:ring-slate-600 transition-all flex-shrink-0" alt="" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6C63FF]/30 to-[#0066FF]/30 flex items-center justify-center text-xs font-bold text-[#6C63FF] ring-2 ring-slate-700/50 group-hover:ring-slate-600 transition-all flex-shrink-0">
              {user?.first_name?.[0]}
              {user?.last_name?.[0]}
            </div>
          )}
          
          {/* Name + chevron */}
          {!collapsed && (
            <>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
              </div>
              <ChevronUp size={14} className={`text-slate-600 transition-transform duration-200 ${showUserMenu ? '' : 'rotate-180'}`} />
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
      `}</style>
    </aside>
  );
}
