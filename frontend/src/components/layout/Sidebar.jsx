import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Server, Users, ScrollText,
  LayoutGrid, History, BarChart2, X, UserCircle, Settings,
  Globe, Video, FolderOpen, ClipboardList
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function Sidebar({ onClose }) {
  const { user } = useAuthStore();
  const role = user?.role || 'member';

  const adminLinks = [
    { name: 'Overview', path: '/admin/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Virtual Machines', path: '/admin/vms', icon: <Monitor className="w-5 h-5" /> },
    { name: 'VM Templates', path: '/admin/templates', icon: <LayoutGrid className="w-5 h-5" /> },
    { name: 'Hardware', path: '/admin/hardware', icon: <Server className="w-5 h-5" /> },
    { name: 'Users', path: '/admin/users', icon: <Users className="w-5 h-5" /> },
    { name: 'Analytics', path: '/admin/analytics', icon: <BarChart2 className="w-5 h-5" /> },
    { name: 'Settings', path: '/admin/settings', icon: <Settings className="w-5 h-5" /> },
    { name: 'Logs', path: '/admin/logs', icon: <ScrollText className="w-5 h-5" /> },
    { name: 'My Profile', path: '/profile', icon: <UserCircle className="w-5 h-5" /> },
  ];

  const instructorNav = [
    {
      section: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Overview', path: '/instructor/dashboard' },
        { icon: Video, label: 'My Sessions', path: '/instructor/sessions' },
        { icon: Users, label: 'My Groups', path: '/instructor/groups' },
      ]
    },
    {
      section: 'CONTENT',
      items: [
        // Content moved to Groups
      ]
    },
    {
      section: 'INSIGHTS',
      items: [
        { icon: BarChart2, label: 'Analytics', path: '/instructor/analytics' },
      ]
    },
    {
      section: 'ACCOUNT',
      items: [
        { icon: UserCircle, label: 'My Profile', path: '/profile' },
      ]
    }
  ];

  const memberNav = [
    { 
      section: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Overview', path: '/member/dashboard' },
        { icon: Monitor, label: 'My Workspaces', path: '/member/workspaces' },
        { icon: Globe, label: 'Discover', path: '/sessions' },
      ]
    },
    {
      section: 'COLLABORATE',
      items: [
        { icon: Users, label: 'My Groups', path: '/member/groups' },
        { icon: Video, label: 'Live Sessions', path: '/member/sessions' },
        { icon: History, label: 'Session History', path: '/member/sessions-history' },
      ]
    },
    {
      section: 'ACCOUNT',
      items: [
        { icon: UserCircle, label: 'My Profile', path: '/profile' },
      ]
    }
  ];

  const renderFlatLinks = (links) => (
    <nav className="space-y-1 px-3">
      {links.map((link) => (
        <NavLink
          key={link.name}
          to={link.path}
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          {link.icon}
          {link.name}
        </NavLink>
      ))}
    </nav>
  );

  const renderSectionedLinks = (sections) => (
    <nav className="space-y-6 px-3">
      {sections.map((sectionGroup, idx) => (
        <div key={idx}>
          <h4 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {sectionGroup.section}
          </h4>
          <div className="space-y-1">
            {sectionGroup.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <aside className="w-64 bg-[#0B1120] border-r border-white/5 h-full flex flex-col">
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-white font-semibold text-sm">Navigation</span>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 py-6 overflow-y-auto">
        {role === 'admin' ? renderFlatLinks(adminLinks) :
         role === 'instructor' ? renderSectionedLinks(instructorNav) :
         renderSectionedLinks(memberNav)}
      </div>
    </aside>
  );
}
