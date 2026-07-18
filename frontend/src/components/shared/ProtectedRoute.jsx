import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, user, logout } = useAuthStore();
  const [maintenanceCheckLoading, setMaintenanceCheckLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || isLoading) {
      setMaintenanceCheckLoading(false);
      return;
    }

    const checkMaintenance = async () => {
      try {
        const res = await api.get('/settings/public/');
        if (res.data?.success && res.data.data?.maintenance_mode === 'true') {
          // If maintenance mode is ON and user is NOT admin
          if (user?.role !== 'admin') {
            logout();
            navigate('/signin');
          }
        }
      } catch (err) {
        console.error('Failed to check maintenance mode', err);
      } finally {
        setMaintenanceCheckLoading(false);
      }
    };

    checkMaintenance();
  }, [isAuthenticated, isLoading, user, logout, navigate]);

  if (isLoading || maintenanceCheckLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return children;
}
