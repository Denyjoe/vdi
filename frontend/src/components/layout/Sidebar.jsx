import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import useSettingsStore from '../../store/settingsStore';
import useThemeStore from '../../store/themeStore';
import useLiveSession from '../../hooks/useLiveSession';
import { toast } from 'react-hot-toast';
import { signOutFirebase } from '../../config/firebase';
import useBreakpoint from '../../hooks/useBreakpoint';
import OspaceLogo from '../shared/OspaceLogo';
import useContextStore from '../../store/contextStore';
import {
  LayoutDashboard, Monitor, Video, Plus, BarChart3, ChevronLeft,
  X,
  ChevronRight, Radio, ChevronUp, LogOut, Settings, Receipt,
  Server, Users, LayoutTemplate, HardDrive, Cpu, Landmark, BookOpen, CalendarDays
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
  const { sidebarCollapsed, toggleSidebar, openBilling, mobileMenuOpen, closeMobileMenu } = useUIStore();
  const { isMobile } = useBreakpoint();
  const theme = useThemeStore(s => s.theme);
  const collapsed = isMobile ? false : sidebarCollapsed;
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
        const res = await api.get('/sessions/admin/live/');
        setLiveSessionCount(res.data.total_active || 0);
      } catch(e) {
        // Silent fail — badge just won't show
      }
    };
    
    fetchLiveCount();
    const interval = setInterval(fetchLiveCount, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Universities THIS real account administers — a normal user account
  // may also be a university admin (Phase 4), so this is checked
  // independently of the platform 'admin' role and shown to any user.
  const [myUniversities, setMyUniversities] = useState([]);
  useEffect(() => {
    if (!user) return;
    api.get('/university-admin/universities/mine/')
      .then(res => setMyUniversities(res.data?.data || []))
      .catch(() => {});
  }, [user]);

  // Courses THIS real account is the lecturer for (Phase 5) — independent
  // of university-admin status; a lecturer need not administer anything.
  const [myCourses, setMyCourses] = useState([]);
  useEffect(() => {
    if (!user) return;
    api.get('/university-admin/lecturer/my-courses/')
      .then(res => setMyCourses(res.data?.data || []))
      .catch(() => {});
  }, [user]);

  // Real courses THIS account is a STUDENT in (Phase 4) — independent of
  // lecturer/admin status; a student need not teach or administer
  // anything. Populated regardless of HOW the CourseEnrollment row was
  // created (bulk CSV, self-enroll invite, direct grant — all the same
  // real table).
  const [myStudentCourses, setMyStudentCourses] = useState([]);
  useEffect(() => {
    if (!user) return;
    api.get('/university-admin/student/my-coursework/')
      .then(res => setMyStudentCourses(res.data?.data || []))
      .catch(() => {});
  }, [user]);

  // Phase 3 — complete context isolation audit. myUniversities/myCourses/
  // myStudentCourses above answer "what CAN this account reach" (raw
  // capability data); this answers "what context is genuinely ACTIVE
  // right now" — the University/Teaching/Student nav sections below are
  // gated on BOTH, so switching to Personal genuinely removes them from
  // the rendered output (not just visually) rather than showing them
  // purely because the account happens to hold that role somewhere.
  const activeContext = useContextStore(s => s.current);
  const inUniversityContext = activeContext.type === 'university';
  const activeUniversityAdminEntry = inUniversityContext
    ? myUniversities.find(u => u.id === activeContext.universityId)
    : null;
  const hasActiveTeachingCourse = inUniversityContext
    && myCourses.some(c => c.university_id === activeContext.universityId);
  const hasActiveStudentCourse = inUniversityContext
    && myStudentCourses.some(c => c.university_id === activeContext.universityId);

  const handleLogout = async () => {
    try {
      await signOutFirebase();
    } catch(e) {
      console.error('Firebase signout error:', e);
    }
    logout();
    navigate('/signin');
    toast.success('Logged out successfully');
  };


  const sidebarContent = (
    <>
      
      {/* ═══ LOGO AREA ═══ */}
      <div className={`h-14 flex items-center border-b flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5'}`} style={{ borderColor: 'var(--border-subtle)' }}>
        
        {collapsed ? (
          <OspaceLogo size={28} />
        ) : (
          <div className="flex items-center gap-2.5">
            <OspaceLogo size={28} className="flex-shrink-0" />
            <span className="text-[15px] font-extrabold text-primary tracking-tight">
              Ospace
            </span>
          </div>
        )}
      </div>
      
      {/* ═══ COLLAPSE TOGGLE (desktop/tablet only — mobile has its own close button) ═══ */}
      {!isMobile && (
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-nav-hover)] hover:border-[var(--border-strong)] active:scale-90 transition-all duration-200 z-10 shadow-md"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}

</button>
      )}

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

        {/* HOST section — Phase 3: "Create Session" starts a real,
            personal (non-course) session, so it's a genuine "personal
            workspace/session creation NOT tied to a course" entry point
            — hidden while a university context is active, per the same
            isolation standard as the rest of this audit. Lecturers
            already have a real, course-tagged "Start Class Session"
            entry point on each course card instead. The whole section
            still renders if there's a real, already-live session to
            jump back into, regardless of context — that's real, active
            state, not a new-session creation shortcut. */}
        {user?.role !== 'admin' && (!inUniversityContext || liveSession) && (
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
              {!inUniversityContext && (
                <NavItem icon={Plus} label="Create Session" path="/create-session" collapsed={collapsed} active={location.pathname === '/create-session'} />
              )}

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

        {/* UNIVERSITY section — Phase 3: gated on the ACTIVE context, not
            just "does this account administer a university somewhere".
            Switching to Personal genuinely removes this from the
            rendered DOM; switching to a DIFFERENT university this
            account also administers keeps it hidden too (never leaks a
            university this isn't the currently-active context). */}
        {activeUniversityAdminEntry && (
          <>
            {!collapsed && (
              <p className="px-5 mt-6 mb-2 text-[9px] uppercase tracking-[3px] text-faint font-semibold">
                University
              </p>
            )}
            {collapsed && (
              <div className="mx-2 my-4 border-t border-border-subtle" />
            )}
            <div className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
              <NavItem icon={Landmark} label={activeUniversityAdminEntry.name} path="/university-admin" collapsed={collapsed} active={location.pathname === '/university-admin'} theme={theme} />
            </div>
          </>
        )}

        {/* LECTURER section — Phase 3: same real, active-context gate —
            only rendered while the currently-selected context is a
            university this account genuinely teaches a course in. */}
        {hasActiveTeachingCourse && (
          <>
            {!collapsed && (
              <p className="px-5 mt-6 mb-2 text-[9px] uppercase tracking-[3px] text-faint font-semibold">
                Teaching
              </p>
            )}
            {collapsed && (
              <div className="mx-2 my-4 border-t border-border-subtle" />
            )}
            <div className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
              <NavItem icon={BookOpen} label="My Courses" path="/my-courses" collapsed={collapsed} active={location.pathname === '/my-courses'} theme={theme} />
            </div>
          </>
        )}

        {/* STUDENT section (Phase 4) — same real, active-context gate —
            only rendered while the currently-selected context is a
            university this account is genuinely enrolled as a student
            in, regardless of which real path created that enrollment. */}
        {hasActiveStudentCourse && (
          <>
            {!collapsed && (
              <p className="px-5 mt-6 mb-2 text-[9px] uppercase tracking-[3px] text-faint font-semibold">
                Student
              </p>
            )}
            {collapsed && (
              <div className="mx-2 my-4 border-t border-border-subtle" />
            )}
            <div className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
              <NavItem icon={CalendarDays} label="My Schedule" path="/my-schedule" collapsed={collapsed} active={location.pathname === '/my-schedule'} theme={theme} />
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
              <NavItem icon={Cpu} label="Hardware" path="/admin/hardware" collapsed={collapsed} active={location.pathname === '/admin/hardware'} theme={theme} />
              <NavItem icon={Users} label="Users" path="/admin/users" collapsed={collapsed} active={location.pathname === '/admin/users'} theme={theme} />
              <NavItem icon={LayoutTemplate} label="Templates" path="/admin/templates" collapsed={collapsed} active={location.pathname === '/admin/templates'} theme={theme} />
              <NavItem icon={BarChart3} label="Analytics" path="/admin/analytics" collapsed={collapsed} active={location.pathname === '/admin/analytics'} theme={theme} />
              <NavItem icon={Settings} label="Settings" path="/admin/settings" collapsed={collapsed} active={location.pathname === '/admin/settings'} theme={theme} />

              {/* SuperAdmin-only — real platform owner (is_superuser),
                  distinct from regular platform admins (role='admin').
                  Not shown to any other admin account. */}
              {user?.is_superuser && (
                <>
                  <div className="mx-2 my-4 border-t border-border-subtle" />
                  <p className={`text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-2 px-3 ${collapsed ? 'hidden' : 'block'}`}>
                    SuperAdmin
                  </p>
                  <NavItem icon={Landmark} label="University Requests" path="/admin/university-requests" collapsed={collapsed} active={location.pathname === '/admin/university-requests'} theme={theme} />
                </>
              )}
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
            </div>
            
            {/* Menu items */}
            <div className="py-1">
              <button onClick={() => { openSettings('profile'); setShowUserMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
                <Settings size={14} className="text-muted" />
                Account Settings
              
</button>
              {/* Phase 3 — individual billing is always personal data
                  (Phase 6: never context-scoped), so the entry point
                  itself is hidden while a university context is active
                  rather than surfacing personal payment history under a
                  "University" mental context — a real institution pays
                  via its own invoice, not this. */}
              {!inUniversityContext && (
                <button onClick={() => { openBilling(); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
                  <Receipt size={14} className="text-muted" />
                  Billing & Usage

</button>
              )}
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
          className={`w-full flex items-center transition-all duration-200 hover:bg-[var(--bg-nav-hover)] active:scale-[0.98] group ${collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-3'}`}>
          
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
    
    </>
  );

  if (isMobile) {
    return (
      <>
        {mobileMenuOpen && (
          <div 
            onClick={closeMobileMenu}
            style={{
              position: 'fixed', 
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 90,
            }}
          />
        )}
        
        <aside style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width: '260px',
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          zIndex: 91,
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '16px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <button onClick={closeMobileMenu}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
              }}>
              <X size={20} />
            </button>
          </div>
          
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside className={`h-screen flex flex-col border-r transition-all duration-300 ease-out flex-shrink-0 relative z-20 ${collapsed ? 'w-[80px]' : 'w-[260px]'}`} style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}>
      {sidebarContent}
    </aside>
  );
}
