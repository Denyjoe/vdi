import { NavLink } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function Sidebar() {
  const { user } = useAuthStore();
  const role = user?.role || 'student';

  const adminLinks = [
    { name: 'Overview', path: '/admin/dashboard', icon: '🏠' },
    { name: 'Virtual Machines', path: '/admin/vms', icon: '🖥️' },
    { name: 'Hardware', path: '/admin/hardware', icon: '⚙️' },
    { name: 'Users', path: '/admin/users', icon: '👥' },
    { name: 'Logs', path: '/admin/logs', icon: '📋' },
  ];

  const lecturerLinks = [
    { name: 'Overview', path: '/lecturer/dashboard', icon: '🏠' },
    { name: 'My Classes', path: '/lecturer/classes', icon: '👨‍🎓' },
    { name: 'Monitor Sessions', path: '/lecturer/monitor', icon: '👁️' },
    { name: 'Materials', path: '/lecturer/materials', icon: '📁' },
    { name: 'Assignments', path: '/lecturer/assignments', icon: '📝' },
  ];

  const studentLinks = [
    { name: 'Overview', path: '/student/dashboard', icon: '🏠' },
    { name: 'My VMs', path: '/student/vms', icon: '🖥️' },
    { name: 'Class Materials', path: '/student/materials', icon: '📁' },
    { name: 'Assignments', path: '/student/assignments', icon: '📝' },
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
              <span className="text-lg">{link.icon}</span>
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
