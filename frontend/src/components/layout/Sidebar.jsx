import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Monitor, Server, Users, ScrollText, 
  GraduationCap, Eye, FolderOpen, ClipboardList, LayoutGrid
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function Sidebar() {
  const { user } = useAuthStore();
  const role = user?.role || 'student';

  const adminLinks = [
    { name: 'Overview', path: '/admin/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Virtual Machines', path: '/admin/vms', icon: <Monitor className="w-5 h-5" /> },
    { name: 'VM Templates', path: '/admin/templates', icon: <LayoutGrid className="w-5 h-5" /> },
    { name: 'Hardware', path: '/admin/hardware', icon: <Server className="w-5 h-5" /> },
    { name: 'Users', path: '/admin/users', icon: <Users className="w-5 h-5" /> },
    { name: 'Logs', path: '/admin/logs', icon: <ScrollText className="w-5 h-5" /> },
  ];

  const lecturerLinks = [
    { name: 'Overview', path: '/lecturer/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'My Classes', path: '/lecturer/classes', icon: <GraduationCap className="w-5 h-5" /> },
    { name: 'Monitor Sessions', path: '/lecturer/monitor', icon: <Eye className="w-5 h-5" /> },
    { name: 'Materials', path: '/lecturer/materials', icon: <FolderOpen className="w-5 h-5" /> },
    { name: 'Assignments', path: '/lecturer/assignments', icon: <ClipboardList className="w-5 h-5" /> },
  ];

  const studentLinks = [
    { name: 'Overview', path: '/student/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'My VMs', path: '/student/vms', icon: <Monitor className="w-5 h-5" /> },
    { name: 'Class Materials', path: '/student/materials', icon: <FolderOpen className="w-5 h-5" /> },
    { name: 'Assignments', path: '/student/assignments', icon: <ClipboardList className="w-5 h-5" /> },
  ];

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
    <aside className="w-64 bg-slate-800 border-r border-slate-700 min-h-screen flex flex-col">
      <div className="flex-1 py-6">
        <nav className="space-y-1 px-3">
          {links.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
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
      
      {/* Footer area inside sidebar if needed */}
      <div className="p-4 border-t border-slate-700 text-xs text-slate-500 text-center font-inter">
        &copy; {new Date().getFullYear()} DIT
      </div>
    </aside>
  );
}
