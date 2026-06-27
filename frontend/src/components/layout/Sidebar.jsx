/**
 * Sidebar — vertical navigation for all dashboard pages.
 *
 * Renders role-specific navigation links based on the authenticated user's role.
 * Accepts an optional `onClose` callback used to dismiss the sidebar on mobile
 * after a link is clicked.
 *
 * @param {Object} props
 * @param {Function} [props.onClose] - Callback to close the mobile sidebar overlay.
 * @returns {JSX.Element} The sidebar navigation panel.
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Server, Users, ScrollText,
  GraduationCap, Eye, FolderOpen, ClipboardList, LayoutGrid, History, BarChart2, X, FlaskConical
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function Sidebar({ onClose }) {
  const { user } = useAuthStore();
  const role = user?.role || 'student';

  /** Admin navigation links */
  const adminLinks = [
    { name: 'Overview', path: '/admin/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Virtual Machines', path: '/admin/vms', icon: <Monitor className="w-5 h-5" /> },
    { name: 'VM Templates', path: '/admin/templates', icon: <LayoutGrid className="w-5 h-5" /> },
    { name: 'Hardware', path: '/admin/hardware', icon: <Server className="w-5 h-5" /> },
    { name: 'Users', path: '/admin/users', icon: <Users className="w-5 h-5" /> },
    { name: 'Analytics', path: '/admin/analytics', icon: <BarChart2 className="w-5 h-5" /> },
    { name: 'Logs', path: '/admin/logs', icon: <ScrollText className="w-5 h-5" /> },
  ];

  /** Lecturer navigation links */
  const lecturerLinks = [
    { name: 'Overview', path: '/lecturer/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'My Classes', path: '/lecturer/classes', icon: <GraduationCap className="w-5 h-5" /> },
    { name: 'Practicals', path: '/lecturer/practicals', icon: <FlaskConical className="w-5 h-5" /> },
    { name: 'Monitor Sessions', path: '/lecturer/monitor', icon: <Eye className="w-5 h-5" /> },
    { name: 'Materials', path: '/lecturer/materials', icon: <FolderOpen className="w-5 h-5" /> },
    { name: 'Assignments', path: '/lecturer/assignments', icon: <ClipboardList className="w-5 h-5" /> },
  ];

  /** Student navigation links */
  const studentLinks = [
    { name: 'Overview', path: '/student/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'My Classes', path: '/student/classes', icon: <GraduationCap className="w-5 h-5" /> },
    { name: 'Practicals', path: '/student/practicals', icon: <FlaskConical className="w-5 h-5" /> },
    { name: 'My VMs', path: '/student/vms', icon: <Monitor className="w-5 h-5" /> },
    { name: 'Session History', path: '/student/sessions', icon: <History className="w-5 h-5" /> },
    { name: 'Class Materials', path: '/student/materials', icon: <FolderOpen className="w-5 h-5" /> },
    { name: 'Assignments', path: '/student/assignments', icon: <ClipboardList className="w-5 h-5" /> },
  ];

  /**
   * Returns the appropriate link set for the current user role.
   * @returns {Array} Navigation links for the active role.
   */
  const getLinksForRole = () => {
    switch (role) {
      case 'admin': return adminLinks;
      case 'lecturer': return lecturerLinks;
      case 'student':
      default: return studentLinks;
    }
  };

  const links = getLinksForRole();

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 h-full flex flex-col">
      {/* Mobile close button */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <span className="text-white font-semibold text-sm">Navigation</span>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 py-6 overflow-y-auto">
        <nav className="space-y-1 px-3">
          {links.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              {link.icon}
              {link.name}
            </NavLink>
          ))}
        </nav>
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-slate-700 text-xs text-slate-500 text-center font-inter">
        &copy; {new Date().getFullYear()} DIT
      </div>
    </aside>
  );
}
