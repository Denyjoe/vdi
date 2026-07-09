import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import useSettingsStore from '../../store/settingsStore';
import useThemeStore from '../../store/themeStore';
import useLiveSession from '../../hooks/useLiveSession';
import { toast } from 'react-hot-toast';
import { 
  LayoutDashboard, Monitor, Video, Plus, BarChart3, ChevronLeft, 
  ChevronRight, Radio, ChevronUp, LogOut, Settings, Receipt,
  Server, Users, LayoutTemplate, HardDrive
} from 'lucide-react';

function NavItem({ icon: Icon, label, path, onClick, collapsed, active, accent, theme, badge }) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (onClick) onClick();
    else if (path) navigate(path);
  };
  
  return (
    <button onClick={handleClick}
      className={`w-full flex items-center rounded-xl transition-all duration-200 active:scale-[0.97] group relative ${collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5'} ${active ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-nav-hover)] hover:text-[var(--text-primary)] font-medium'}`}
      title={collapsed ? label : ''}>
      
      <div style={{
        background: active 
          ? (theme === 'light' ? '#DBEAFE' : 'rgba(0, 102, 255, 0.15)') 
          : 'transparent',
        boxShadow: active && theme === 'light' ? '0 1px 2px rgba(37, 99, 235, 0.1)' : 'none',
      }}
      className={`flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg transition-all duration-200 group-hover:bg-[var(--bg-nav-hover)]`}>
        <Icon size={17} style={{ color: active ? 'var(--accent-primary)' : 'inherit' }} />
      </div>
      
      {!collapsed && (
        <span className={`text-[13px] truncate ${active ? 'font-semibold' : ''}`}>
          {label}
        </span>
      )}
      
      {active && (
        <div style={{
          background: 'var(--accent-primary)',
          boxShadow: theme === 'light' ? '0 0 8px rgba(37, 99, 235, 0.2)' : '0 0 12px rgba(0, 102, 255, 0.3)'
        }} className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full`} />
      )}
      
      {collapsed && (
        <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-card text-[11px] font-medium text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-xl shadow-black/30 border border-border-subtle z-50">
          {label}
        </div>
      )}
    

      {!collapsed && badge && (
        <span style={{
          marginLeft: 'auto',
          padding: '2px 7px',
          borderRadius: '9999px',
          fontSize: '10px',
          fontWeight: 700,
          background: 'var(--status-online-bg)',
          color: 'var(--status-online)',
        }}>
          {badge}
        </span>
      )}
      {collapsed && badge && (
        <span style={{
          position: 'absolute',
          top: '2px', right: '2px',
          width: '8px', height: '8px',
          borderRadius: '50%',
          background: 'var(--status-online)',
        }} />
      )}
</button>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, openBilling } = useUIStore();
  const theme = useThemeStore(s => s.theme);
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

  const [liveSessionCount, setLiveSessionCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    
    const fetchLiveCount = async () => {
      try {
        const res = await api.get('/admin/sessions/live/');
        setLiveSessionCount(res.data.total_active || 0);
      } catch(e) {
        // Silent fail — badge just won't show
      }
    };
    
    fetchLiveCount();
    const interval = setInterval(fetchLiveCount, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  return (
    <aside className={`h-screen flex flex-col border-r transition-all duration-300 ease-out ${collapsed ? 'w-[68px]' : 'w-[240px]'} flex-shrink-0 relative`} style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}>
      
      {/* ═══ LOGO AREA ═══ */}
      <div className={`h-14 flex items-center border-b flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5'}`} style={{ borderColor: 'var(--border-subtle)' }}>
        
        {collapsed ? (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#0066FF] flex items-center justify-center">
            <span className="text-primary text-xs font-extrabold">C</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#0066FF] flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-xs font-extrabold">C</span>
            </div>
            <span className="text-[15px] font-extrabold text-primary tracking-tight">
              CloudDesk
            </span>
          </div>
        )}
      </div>
      
      {/* ═══ COLLAPSE TOGGLE ═══ */}
      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-nav-hover)] hover:border-[var(--border-strong)] active:scale-90 transition-all duration-200 z-10 shadow-md"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      
</button>
      
      {/* ═══ NAVIGATION ═══ */}
      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        
        {/* MAIN section */}
        {user?.role !== 'admin' && (
          <>
            {!collapsed && (
              <p className="px-5 mb-2 text-[9px] uppercase tracking-[3px] text-faint font-semibold">
                Main
              </p>
            )}
            
            <div className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
              <NavItem icon={LayoutDashboard} label="Overview" path="/dashboard" collapsed={collapsed} active={location.pathname === '/dashboard'} theme={theme} />
              <NavItem icon={Monitor} label="My Workspaces" path="/workspaces" collapsed={collapsed} active={location.pathname === '/workspaces'} theme={theme} />
              <NavItem icon={Video} label="My Sessions" path="/sessions/my" collapsed={collapsed} active={location.pathname === '/sessions/my'} theme={theme} />
            </div>
          </>
        )}

        {/* HOST section */}
        {user?.is_host && user?.role !== 'admin' && (
          <>
            {!collapsed && (
              <p className="px-5 mt-6 mb-2 text-[9px] uppercase tracking-[3px] text-faint font-semibold">
                Host
              </p>
            )}
            
            {collapsed && (
              <div className="mx-2 my-4 border-t border-border-subtle" />
            )}
            
            <div className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
              <NavItem icon={Plus} label="Create Session" path="/create-session" collapsed={collapsed} active={location.pathname === '/create-session'} />
              
              {/* Live session indicator */}
              {liveSession && (
                <button onClick={() => navigate(`/host/session/${liveSession.id}`)}
                  className={`w-full flex items-center gap-2.5 rounded-xl transition-all duration-200 active:scale-[0.97] bg-[#DCFCE7] border border-[#BBF7D0] hover:bg-[#bbf7d0] dark:bg-[#00FF87]/5 dark:border-[#00FF87]/15 dark:hover:bg-[#00FF87]/10 ${collapsed ? 'justify-center p-2.5 mt-1' : 'px-3 py-2.5 mt-1'}`}>
                  <div className="relative flex-shrink-0">
                    <Radio size={16} strokeWidth={2} className="text-[#15803D] dark:text-[#00FF87]" />
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#166534] dark:bg-[#00FF87] animate-pulse" />
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[11px] font-semibold text-[#15803D] dark:text-[#00FF87] truncate">
                        {liveSession.name}
                      </p>
                      <p className="text-[9px] font-medium text-[#166534] dark:text-muted">
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
              <p className="px-5 mt-6 mb-2 text-[9px] uppercase tracking-[3px] text-faint font-semibold">
                Admin
              </p>
            )}
            {collapsed && (
              <div className="mx-2 my-4 border-t border-border-subtle" />
            )}
            
            <div className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
              <NavItem icon={LayoutDashboard} label="Dashboard" path="/admin/dashboard" collapsed={collapsed} active={location.pathname === '/admin/dashboard'} theme={theme} />
              
              <div className="mx-2 my-4 border-t border-border-subtle" />
              
              <p className={`text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-2 px-3 ${collapsed ? 'hidden' : 'block'}`}>
                Administration
              </p>
              
              <NavItem icon={Radio} label="Live Sessions" path="/admin/sessions" collapsed={collapsed} active={location.pathname === '/admin/sessions'} badge={liveSessionCount > 0 ? liveSessionCount : null} theme={theme} />
              <NavItem icon={HardDrive} label="Workspaces" path="/admin/workspaces" collapsed={collapsed} active={location.pathname === '/admin/workspaces'} theme={theme} />
              <NavItem icon={Server} label="VM Pool" path="/admin/vm-pool" collapsed={collapsed} active={location.pathname === '/admin/vm-pool'} theme={theme} />
              <NavItem icon={Users} label="Users" path="/admin/users" collapsed={collapsed} active={location.pathname === '/admin/users'} theme={theme} />
              <NavItem icon={LayoutTemplate} label="Templates" path="/admin/templates" collapsed={collapsed} active={location.pathname === '/admin/templates'} theme={theme} />
              <NavItem icon={BarChart3} label="Analytics" path="/admin/analytics" collapsed={collapsed} active={location.pathname === '/admin/analytics'} theme={theme} />
              <NavItem icon={Settings} label="Settings" path="/admin/settings" collapsed={collapsed} active={location.pathname === '/admin/settings'} theme={theme} />
            </div>
          </>
        )}
      </nav>
      
      {/* ═══ AVATAR / USER AREA ═══ */}
      <div className="border-t border-border-subtle relative" ref={menuRef}>
        
        {/* Avatar popup menu */}
        {showUserMenu && (
          <div className="absolute bottom-full left-2 right-2 mb-2 bg-card border border-border rounded-2xl overflow-hidden shadow-2xl shadow-black/50 z-50"
            style={{ animation: 'slideUp 0.2s ease-out', minWidth: collapsed ? '220px' : 'auto', left: collapsed ? '4px' : '8px' }}>
            
            {/* User info */}
            <div className="px-4 py-3.5 border-b border-border-subtle">
              <p className="text-sm font-semibold text-primary truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[11px] text-muted truncate">
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
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
                <Settings size={14} className="text-muted" />
                Account Settings
              
</button>
              <button onClick={() => { openBilling(); setShowUserMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
                <Receipt size={14} className="text-muted" />
                Billing & Usage
              
</button>
            </div>
            
            {/* Sign out */}
            <div className="border-t border-border-subtle py-1">
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
                <p className="text-xs font-semibold text-primary truncate">
                  {user?.first_name} {user?.last_name}
                </p>
              </div>
              <ChevronUp size={14} className={`text-faint transition-transform duration-200 ${showUserMenu ? '' : 'rotate-180'}`} />
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
