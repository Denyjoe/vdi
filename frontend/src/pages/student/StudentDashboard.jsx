import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { Monitor, Link2, ClipboardList, Info } from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import { vmService } from '../../services/vmService';
import ExamBanner from '../../components/student/ExamBanner';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [vmCount, setVmCount] = useState(0);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [sessionRes, vmsRes] = await Promise.all([
          sessionService.getActiveSession(),
          vmService.getMyVMs()
        ]);
        
        if (sessionRes.data.success && sessionRes.data.data) {
          setActiveSession(sessionRes.data.data);
        }
        if (vmsRes.data.success) {
          setVmCount(vmsRes.data.data.length);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white font-inter">Welcome, {user?.first_name}</h2>
        <p className="text-slate-400 mt-1">Access your virtual desktop and class resources</p>
      </div>

      {/* Exam Banner — only visible when a lecturer has started an exam */}
      <ExamBanner />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-blue-500/20 p-4 rounded-lg">
            <Monitor className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">My VMs</p>
            <p className="text-2xl font-bold text-white">{vmCount}</p>
          </div>
        </div>
        
        {activeSession ? (
          <Link to={`/session/${activeSession.id}`} className="bg-slate-800 rounded-xl p-6 shadow-md border border-emerald-500/50 flex items-center gap-4 transition-transform hover:scale-105 group cursor-pointer">
            <div className="bg-emerald-500 p-4 rounded-lg group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <Link2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-emerald-400 text-sm font-medium">Active Session</p>
              <p className="text-2xl font-bold text-white">1 Active</p>
            </div>
          </Link>
        ) : (
          <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <Link2 className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm font-medium">Active Session</p>
              <p className="text-2xl font-bold text-slate-500">None</p>
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-purple-500/20 p-4 rounded-lg">
            <ClipboardList className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Pending Assignments</p>
            <p className="text-2xl font-bold text-white">0</p>
          </div>
        </div>
      </div>

      {/* Announcement Card */}
      <div className="bg-blue-900/40 border border-blue-500/30 rounded-xl p-6 shadow-sm">
        <div className="flex gap-4">
          <div className="mt-1">
            <Info className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-blue-100 leading-relaxed">
              New to DIT VDI? Start by requesting a Virtual Machine from the VM catalog. 
              Choose a template that matches your coursework needs.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link 
            to="/student/vms" 
            className="flex items-center justify-center py-3 px-4 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"
          >
            Request a VM
          </Link>
          <Link 
            to="/student/assignments" 
            className="flex items-center justify-center py-3 px-4 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-colors"
          >
            View Assignments
          </Link>
        </div>
      </div>
    </div>
  );
}
