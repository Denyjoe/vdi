import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Monitor, 
  Video, 
  Plus,
  BarChart2,
  UserCircle,
  Settings,
  LogOut
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import { toast } from 'react-hot-toast';

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

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
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed top-0 left-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          CloudDesk
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 no-scrollbar">
        
        {/* MAIN SECTION */}
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

        {/* HOST SECTION */}
        {user?.is_host && (
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
                  color: '#64748b',
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
              <NavItem to="/host/analytics" icon={BarChart2}>Analytics</NavItem>
            </div>
          </div>
        )}

        {/* ACCOUNT SECTION */}
        <div>
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Account
          </p>
          <div className="space-y-1">
            <NavItem to="/profile" icon={UserCircle}>My Profile</NavItem>
            <NavItem to="/settings" icon={Settings}>Settings</NavItem>
          </div>
        </div>
      </div>

      {/* UPGRADE BANNER */}
      {!user?.is_host && (
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
          <p style={{color: '#64748b', fontSize: '12px', marginBottom: '12px'}}>
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

      {/* USER PROFILE CARD */}
      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
          {user?.avatar ? (
            <img 
              src={user.avatar} 
              alt="Profile" 
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg">
              {user?.first_name?.charAt(0) || user?.email?.charAt(0) || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {user?.is_host ? 'Host' : 'User'}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
