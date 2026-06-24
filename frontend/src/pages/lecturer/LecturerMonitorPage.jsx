import { useState, useEffect } from 'react';
import { 
  Activity, ShieldAlert, Monitor, Eye, X, 
  Play, Edit, Trash2, StopCircle, BarChart, 
  Clock 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { sessionService } from '../../services/sessionService';
import ConfirmModal from '../../components/shared/ConfirmModal';
import CreateExamModal from '../../components/lecturer/CreateExamModal';
import EmptyState from '../../components/shared/EmptyState';

export default function LecturerMonitorPage() {
  const [monitorData, setMonitorData] = useState({
    active_sessions: [],
    exam_sessions: [],
    summary: { total_active: 0, in_exam: 0, free_sessions: 0 }
  });
  
  // We need to fetch all exams (scheduled, active, ended) for the right column,
  // but monitorData returns only active_exams! Wait, I should fetch all exams.
  const [allExams, setAllExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTerminateSession, setShowTerminateSession] = useState(null);
  const [showEndExam, setShowEndExam] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [monitorRes, examsRes] = await Promise.all([
        sessionService.getMonitorData(),
        sessionService.getExamSessions()
      ]);
      setMonitorData(monitorRes.data.data);
      setAllExams(examsRes.data.data);
    } catch (error) {
      console.error("Failed to fetch monitor data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateSession = async () => {
    if (!showTerminateSession) return;
    try {
      await sessionService.lecturerTerminate(showTerminateSession.id);
      toast.success("Session terminated successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to terminate session");
    } finally {
      setShowTerminateSession(null);
    }
  };

  const handleStartExam = async (examId) => {
    try {
      await sessionService.startExamSession(examId);
      toast.success("Exam started successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to start exam");
    }
  };

  const handleEndExam = async () => {
    if (!showEndExam) return;
    try {
      const res = await sessionService.endExamSession(showEndExam.id);
      toast.success(`Exam ended. Terminated ${res.data.data.terminated_sessions} sessions.`);
      fetchData();
    } catch (error) {
      toast.error("Failed to end exam");
    } finally {
      setShowEndExam(null);
    }
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const StatCard = ({ title, count, icon: Icon, colorClass }) => (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{count}</div>
        <div className="text-sm font-medium text-slate-400">{title}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Active" 
          count={monitorData.summary.total_active} 
          icon={Activity} 
          colorClass="text-green-500 bg-green-500" 
        />
        <StatCard 
          title="In Exam" 
          count={monitorData.summary.in_exam} 
          icon={ShieldAlert} 
          colorClass="text-yellow-500 bg-yellow-500" 
        />
        <StatCard 
          title="Free Sessions" 
          count={monitorData.summary.free_sessions} 
          icon={Monitor} 
          colorClass="text-blue-500 bg-blue-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - 65% */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-400" />
                Live Student Sessions
              </h2>
              <div className="flex items-center gap-2 text-sm font-medium text-green-400">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Live
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900/50 text-slate-400 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-medium">Student</th>
                    <th className="px-6 py-4 font-medium">VM</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Duration</th>
                    <th className="px-6 py-4 font-medium">Exam Mode</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {monitorData.active_sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12">
                        <EmptyState 
                          icon={Eye} 
                          title="No Active Sessions" 
                          description="Students will appear here when they connect to their VMs" 
                        />
                      </td>
                    </tr>
                  ) : (
                    monitorData.active_sessions.map(session => (
                      <tr key={session.id} className="hover:bg-slate-750 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-white">{session.user.full_name}</div>
                          <div className="text-xs text-slate-400">{session.user.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-200">{session.vm.name}</div>
                          <div className="text-xs text-slate-400">{session.vm.template_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-mono text-slate-300">
                            {formatDuration(session.duration_seconds)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {session.is_in_exam ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                              <ShieldAlert className="w-3 h-3" />
                              Exam
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600">
                              Free
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="View Session">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setShowTerminateSession(session)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" 
                            title="Terminate Session"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - 35% */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col h-full">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-yellow-400" />
                Exam Sessions
              </h2>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + New Exam
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto max-h-[800px]">
              {allExams.length === 0 ? (
                <EmptyState icon={ShieldAlert} title="No Exam Sessions" description="Create an exam session to start monitoring" />
              ) : (
                allExams.map(exam => (
                  <div key={exam.id} className="bg-slate-900/50 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-colors space-y-4">
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-white">{exam.name}</h3>
                        <p className="text-sm text-slate-400">{exam.class_room.name}</p>
                      </div>
                      
                      {exam.status === 'scheduled' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                          Scheduled
                        </span>
                      )}
                      {exam.status === 'active' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          Active
                        </span>
                      )}
                      {exam.status === 'ended' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-500 border border-slate-700">
                          Ended
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Clock className="w-4 h-4 text-slate-500" />
                      {exam.status === 'scheduled' && <span>Starts: {format(new Date(exam.starts_at), 'MMM d, h:mm a')}</span>}
                      {exam.status === 'ended' && <span>Ended on {format(new Date(exam.ends_at), 'MMM d, h:mm a')}</span>}
                      {exam.status === 'active' && (
                        <span className={exam.time_remaining_seconds < 600 ? "text-red-400 font-medium" : "text-yellow-400"}>
                          ⏱ {formatDuration(exam.time_remaining_seconds)} remaining
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-slate-400 flex items-center justify-between">
                      <span>{exam.enrolled_student_count} students enrolled</span>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                      {exam.status === 'scheduled' && (
                        <>
                          <button onClick={() => handleStartExam(exam.id)} className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2 bg-green-600/10 text-green-500 hover:bg-green-600/20 hover:text-green-400 text-sm font-medium rounded-lg transition-colors border border-green-600/20">
                            <Play className="w-4 h-4" /> Start Exam
                          </button>
                          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors border border-slate-700" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors border border-slate-700 hover:border-red-900/50" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {exam.status === 'active' && (
                        <button onClick={() => setShowEndExam(exam)} className="w-full flex justify-center items-center gap-1.5 px-3 py-2 bg-red-600/10 text-red-500 hover:bg-red-600/20 hover:text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-600/20">
                          <StopCircle className="w-4 h-4" /> End Exam
                        </button>
                      )}
                      {exam.status === 'ended' && (
                        <button className="w-full flex justify-center items-center gap-1.5 px-3 py-2 bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 hover:text-blue-400 text-sm font-medium rounded-lg transition-colors border border-blue-600/20">
                          <BarChart className="w-4 h-4" /> View Report
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateExamModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchData}
      />
      
      {showTerminateSession && (
        <ConfirmModal
          isOpen={true}
          onCancel={() => setShowTerminateSession(null)}
          onConfirm={handleTerminateSession}
          title="Terminate Session"
          message={`Are you sure you want to terminate ${showTerminateSession.user.full_name}'s session? All unsaved data may be lost.`}
          confirmText="Terminate Session"
          variant="danger"
        />
      )}
      
      {showEndExam && (
        <ConfirmModal
          isOpen={true}
          onCancel={() => setShowEndExam(null)}
          onConfirm={handleEndExam}
          title="End Exam Session"
          message={`This will terminate all active student sessions for ${showEndExam.name}. Are you sure you want to end the exam?`}
          confirmText="End Exam"
          variant="danger"
        />
      )}
    </div>
  );
}
