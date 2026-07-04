/**
 * NotFoundPage — displayed when the user navigates to an unknown route.
 *
 * Shows a 404 message with a button to return to the appropriate dashboard
 * based on the user's role (admin, lecturer, or student). If not authenticated,
 * the button navigates to the login page.
 *
 * @returns {JSX.Element} A centered 404 error page.
 */

import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import useAuthStore from '../../store/authStore';

/** Maps user roles to their respective dashboard paths */
const DASHBOARD_PATHS = {
  admin: '/admin/dashboard',
  user: '/dashboard',
  host: '/dashboard'
};

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  /**
   * Determines the correct "go back" path based on auth state and role.
   * @returns {string} The path to navigate to.
   */
  const getBackPath = () => {
    if (!isAuthenticated || !user) return '/login';
    return DASHBOARD_PATHS[user.role] || '/dashboard';
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-center px-4">
      <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6">
        <AlertTriangle className="w-10 h-10 text-red-400" />
      </div>

      <h1 className="text-5xl font-bold text-[var(--text-primary)] mb-2">404</h1>
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Page Not Found</h2>
      <p className="text-[var(--text-secondary)] max-w-md mb-8">
        The page you're looking for doesn't exist or has been moved.
        Let's get you back to safety.
      </p>

      <button
        onClick={() => navigate(getBackPath())}
        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-[var(--text-primary)] rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-lg shadow-blue-900/50"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>
    </div>
  );
}
