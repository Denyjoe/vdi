import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { GraduationCap, Users, ClipboardList, ShieldAlert } from 'lucide-react';
import { classService } from '../../services/classService';
import { sessionService } from '../../services/sessionService';
import { assignmentService } from '../../services/assignmentService';

/**
 * LecturerDashboard — overview page for lecturers.
 *
 * Pulls real data from:
 *   - GET /api/classes/my-classes/    → class count
 *   - GET /api/sessions/lecturer/monitor/ → active students + active exams
 *
 * @returns {JSX.Element}
 */
export default function LecturerDashboard() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    classCount: 0,
    activeStudents: 0,
    activeExams: 0,
    pendingSubmissions: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesRes, monitorRes, assignmentsRes] = await Promise.all([
          classService.getMyClasses(),
          sessionService.getMonitorData(),
          assignmentService.getLecturerAssignments().catch(() => null)
        ]);

        const classCount = classesRes.data?.data?.length ?? 0;
        const monitorData = monitorRes.data?.data ?? {};
        const activeStudents = monitorData.summary?.total_active ?? 0;
        const activeExams = monitorData.exam_sessions?.length ?? 0;

        // Compute pending: for each assignment, (enrolled_count - submission_count)
        let pendingSubmissions = 0;
        if (assignmentsRes?.data?.success) {
          const assignmentList = assignmentsRes.data.data || [];
          // Fetch enrolled counts per class in parallel
          const classIds = [...new Set(assignmentList.map(a => a.class_room?.id).filter(Boolean))];
          const classDetails = await Promise.all(
            classIds.map(id => classService.getClassDetails(id).catch(() => null))
          );
          const enrolledByClass = {};
          classDetails.forEach(res => {
            if (res?.data?.success) {
              const cls = res.data.data;
              enrolledByClass[cls.id] = cls.enrolled_count ?? 0;
            }
          });
          pendingSubmissions = assignmentList.reduce((sum, a) => {
            const enrolled = enrolledByClass[a.class_room?.id] ?? 0;
            const submitted = a.submission_count ?? 0;
            return sum + Math.max(0, enrolled - submitted);
          }, 0);
        }

        setStats({ classCount, activeStudents, activeExams, pendingSubmissions });
      } catch (error) {
        console.error('Failed to load lecturer dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'My Classes',
      value: stats.classCount,
      icon: <GraduationCap className="w-6 h-6 text-purple-400" />,
      bg: 'bg-purple-500/20',
    },
    {
      label: 'Active Students',
      value: stats.activeStudents,
      icon: <Users className="w-6 h-6 text-blue-400" />,
      bg: stats.activeStudents > 0 ? 'bg-blue-500/20' : 'bg-slate-700/50',
      valueColor: stats.activeStudents > 0 ? 'text-blue-400' : 'text-slate-400',
    },
    {
      label: 'Pending Submissions',
      value: stats.pendingSubmissions > 0 ? stats.pendingSubmissions : 'All done!',
      icon: <ClipboardList className={`w-6 h-6 ${stats.pendingSubmissions > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />,
      bg: stats.pendingSubmissions > 0 ? 'bg-amber-500/20' : 'bg-emerald-500/20',
      valueColor: stats.pendingSubmissions > 0 ? 'text-amber-400' : 'text-emerald-400',
    },
    {
      label: 'Active Exams',
      value: stats.activeExams,
      icon: <ShieldAlert className="w-6 h-6 text-yellow-400" />,
      bg: stats.activeExams > 0 ? 'bg-yellow-500/20' : 'bg-slate-700/50',
      valueColor: stats.activeExams > 0 ? 'text-yellow-400' : 'text-slate-400',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white font-inter">
          Welcome, {user?.first_name}
        </h2>
        <p className="text-slate-400 mt-1">Manage your classes and monitor student sessions</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 flex items-center gap-4 transition-transform hover:scale-105"
          >
            <div className={`${card.bg} p-4 rounded-lg`}>{card.icon}</div>
            <div>
              <p className="text-slate-400 text-sm font-medium">{card.label}</p>
              <p className={`text-2xl font-bold ${card.valueColor ?? 'text-white'}`}>
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 rounded-xl shadow-md border border-slate-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/lecturer/monitor"
            className="flex items-center justify-center py-3 px-4 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"
          >
            Monitor Sessions
          </Link>
          <Link
            to="/lecturer/classes"
            className="flex items-center justify-center py-3 px-4 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-colors"
          >
            View My Classes
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
