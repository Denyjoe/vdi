import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { Monitor, Link2, ClipboardList, Info, GraduationCap, Megaphone } from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import { vmService } from '../../services/vmService';
import { assignmentService } from '../../services/assignmentService';
import { classService } from '../../services/classService';
import ExamBanner from '../../components/student/ExamBanner';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [vmCount, setVmCount] = useState(0);
  const [pendingAssignments, setPendingAssignments] = useState(0);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const fetchPublicSettings = async () => {
      try {
        const res = await api.get('/settings/public/');
        const ann = res.data?.data?.system_announcement || '';
        setAnnouncement(ann);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };
    fetchPublicSettings();
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [sessionRes, vmsRes, assignmentsRes, classesRes] = await Promise.all([
          sessionService.getActiveSession(),
          vmService.getMyVMs(),
          assignmentService.getStudentAssignments().catch(() => null),
          classService.getEnrolledClasses().catch(() => null)
        ]);
        if (classesRes?.data?.success) {
          setEnrolledCount(classesRes.data.data?.length ?? 0);
        }
        
        if (sessionRes.data.success && sessionRes.data.data) {
          setActiveSession(sessionRes.data.data);
        }
        if (vmsRes.data.success) {
          setVmCount(vmsRes.data.data?.length ?? 0);
        }
        if (assignmentsRes?.data?.success) {
          const pending = (assignmentsRes.data.data || []).filter(
            a => !a.has_submitted && !a.is_overdue
          ).length;
          setPendingAssignments(pending);
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {announcement && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor">
            <path strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625 -1.234 9.168-3v14c-1.543-1.766 -5.067-3-9.168-3H7a3.988 3.988 0 01-2.564-.917z" />
          </svg>
          <p className="text-amber-200 text-sm leading-relaxed">
            {announcement}
          </p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white font-inter">Welcome, {user?.first_name}</h2>
        <p className="text-slate-400 mt-1">Access your virtual desktop and class resources</p>
      </div>

      {/* Exam Banner — only visible when a lecturer has started an exam */}
      <ExamBanner />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105">
          <div className="bg-indigo-500/20 p-4 rounded-lg">
            <Monitor className="w-6 h-6 text-indigo-400" />
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

        <Link
          to="/student/materials"
          className={`rounded-xl p-6 shadow-md border flex items-center gap-4 transition-transform hover:scale-105 ${
            pendingAssignments > 0
              ? 'bg-amber-900/30 border-amber-500/40 hover:border-amber-400/60'
              : 'bg-slate-800 border-slate-700'
          }`}
        >
          <div className={`p-4 rounded-lg ${
            pendingAssignments > 0 ? 'bg-amber-500/20' : 'bg-green-500/20'
          }`}>
            <ClipboardList className={`w-6 h-6 ${
              pendingAssignments > 0 ? 'text-amber-400' : 'text-green-400'
            }`} />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Pending Assignments</p>
            <p className={`text-2xl font-bold ${
              pendingAssignments > 0 ? 'text-amber-400' : 'text-green-400'
            }`}>
              {pendingAssignments > 0 ? pendingAssignments : 'All done!'}
            </p>
          </div>
        </Link>
      </div>

      {/* Announcement Card */}
      <div className="bg-indigo-900/40 border border-indigo-500/30 rounded-xl p-6 shadow-sm">
        <div className="flex gap-4">
          <div className="mt-1">
            <Info className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <p className="text-indigo-100 leading-relaxed">
              New to CloudDesk? Start by requesting a Virtual Machine from the VM catalog. 
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
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to="/student/classes" 
            className="flex items-center justify-center py-3 px-4 border border-emerald-500 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors"
          >
            My Classes ({enrolledCount})
          </Link>
          <Link 
            to="/student/vms" 
            className="flex items-center justify-center py-3 px-4 border border-indigo-500 text-indigo-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-colors"
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
