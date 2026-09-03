import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import useThemeStore from '../../store/themeStore';
import { LayoutDashboard, Monitor, Video, Menu, Radio, Users } from 'lucide-react';

export default function BottomDock() {
  const { user } = useAuthStore();
  const theme = useThemeStore(s => s.theme);
  const { toggleMobileMenu, mobileMenuOpen } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === 'admin';

  // Base links for member
  const memberLinks = [
    { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
    { icon: Monitor, label: 'Workspaces', path: '/workspaces' },
    { icon: Video, label: 'Sessions', path: '/sessions/my' },
  ];

  // Base links for admin
  const adminLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Radio, label: 'Sessions', path: '/admin/sessions' },
    { icon: Users, label: 'Users', path: '/admin/users' },
  ];

  const links = isAdmin ? adminLinks : memberLinks;

  const NavItem = ({ icon: Icon, label, path, onClick, isActive }) => {
    return (
      <button 
        onClick={() => {
          if (onClick) onClick();
          else if (path) navigate(path);
        }}
        className="flex flex-col items-center justify-center flex-1 h-full gap-1 active:scale-95 transition-transform"
      >
        <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isActive ? 'bg-[var(--accent-primary-soft)]' : 'bg-transparent'}`}>
            <Icon 
            size={18} 
            className={isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'} 
            strokeWidth={isActive ? 2.5 : 2}
            />
        </div>
        <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-muted)]'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div 
      className="md:hidden fixed bottom-0 left-0 right-0 z-[60] border-t border-[var(--border-subtle)] flex items-center justify-around px-2"
      style={{ 
        height: 'calc(64px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: theme === 'light'
          ? 'rgba(248, 250, 252, 0.85)'
          : 'rgba(8, 11, 16, 0.85)',
        backdropFilter: 'blur(12px)'
      }}
    >
      {links.map(link => (
        <NavItem 
          key={link.path} 
          icon={link.icon} 
          label={link.label} 
          path={link.path} 
          isActive={location.pathname === link.path} 
        />
      ))}
      <NavItem 
        icon={Menu} 
        label="Menu" 
        onClick={toggleMobileMenu} 
        isActive={mobileMenuOpen} 
      />
    </div>
  );
}
