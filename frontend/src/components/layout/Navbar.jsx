import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="bg-red-500/20 text-red-400 text-xs font-medium px-2.5 py-1 rounded-full border border-red-500/30">Admin</span>;
      case 'lecturer':
        return <span className="bg-purple-500/20 text-purple-400 text-xs font-medium px-2.5 py-1 rounded-full border border-purple-500/30">Lecturer</span>;
      case 'student':
      default:
        return <span className="bg-blue-500/20 text-blue-400 text-xs font-medium px-2.5 py-1 rounded-full border border-blue-500/30">Student</span>;
    }
  };

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
      {/* Left — system branding */}
      <div className="flex items-center gap-3">
        <span className="text-blue-500 text-xl font-bold">🖥️</span>
        <h1 className="text-white font-semibold text-lg font-inter">DIT VDI System</h1>
      </div>

      {/* Right — user info */}
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-slate-300 text-sm font-medium">
              {user.first_name} {user.last_name}
            </span>
            {getRoleBadge(user.role)}
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors ml-4 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-md"
            >
              Logout
            </button>
          </>
        ) : (
          <span className="text-slate-300 text-sm">Not logged in</span>
        )}
      </div>
    </nav>
  );
}
