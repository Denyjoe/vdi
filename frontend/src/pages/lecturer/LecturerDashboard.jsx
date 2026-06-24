import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function LecturerDashboard() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call for now since we have hardcoded data
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white font-inter">Welcome, {user?.first_name}</h2>
        <p className="text-slate-400 mt-1">Manage your classes and monitor student sessions</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-purple-500/20 p-4 rounded-lg text-2xl">👨‍🎓</div>
          <div>
            <p className="text-slate-400 text-sm font-medium">My Classes</p>
            <p className="text-2xl font-bold text-white">1</p>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-blue-500/20 p-4 rounded-lg text-2xl">👥</div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Active Students</p>
            <p className="text-2xl font-bold text-white">3</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-emerald-500/20 p-4 rounded-lg text-2xl">📝</div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Pending Submissions</p>
            <p className="text-2xl font-bold text-white">0</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to="/lecturer/classes" 
            className="flex items-center justify-center py-3 px-4 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-colors"
          >
            View My Classes
          </Link>
          <Link 
            to="/lecturer/monitor" 
            className="flex items-center justify-center py-3 px-4 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"
          >
            Monitor Sessions
          </Link>
          <Link 
            to="/lecturer/assignments" 
            className="flex items-center justify-center py-3 px-4 border border-emerald-500 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors"
          >
            Create Assignment
          </Link>
        </div>
      </div>
    </div>
  );
}
