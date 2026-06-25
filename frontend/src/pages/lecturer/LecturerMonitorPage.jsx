import { useState, useEffect } from 'react';
import {
  Activity, ShieldAlert, Monitor, Eye, X,
  Play, Edit, Trash2, StopCircle, BarChart2, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { sessionService } from '../../services/sessionService';
import ConfirmModal from '../../components/shared/ConfirmModal';
import CreateExamModal from '../../components/lecturer/CreateExamModal';

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Format seconds into "Xh Xm Xs" display string.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/**
 * Safely format a date string. Returns fallback if value is missing/invalid.
 * @param {string|null} dateStr
 * @param {string} fallback
 * @returns {string}
 */
function safeDate(dateStr, fallback = 'Not set') {
  if (!dateStr) return fallback;
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return fallback;
  }
}

// ─── sub-components ─────────────────────────────────────────────────────────

/** Pulsing "Live" indicator badge */
function LiveBadge() {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-green-400">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
      </span>
      Live
    </div>
  );
}

/** Summary stat card at the top of the monitor page */
function StatCard({ title, count, Icon, colorText, colorBg }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colorBg}`}>
        <Icon className={`w-6 h-6 ${colorText}`} />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{count ?? 0}</div>
        <div className="text-sm font-medium text-slate-400">{title}</div>
      </div>
    </div>
  );
}

/** Status pill for sessions */
function StatusPill({ isInExam }) {
  if (isInExam) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        <ShieldAlert className="w-3 h-3" /> Exam
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600">
      Free
    </span>
  );
}

/** Status badge for exam cards */
function ExamStatusBadge({ status }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Active
      </span>
    );
  }
  if (status === 'ended') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-500 border border-slate-700">
        Ended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
      Scheduled
    </span>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

/**
 * LecturerMonitorPage — live command-centre for session supervision.
 *
 * Left column:  live student sessions table (auto-refreshes every 5 s).
 * Right column: exam session cards with create / start / end controls.
 *
 * @returns {JSX.Element}
 */
export default function LecturerMonitorPage() {
  const [monitorData, setMonitorData] = useState({
    active_sessions: [],
    exam_sessions: [],
    summary: { total_active: 0, in_exam: 0, free_sessions: 0 },
  });
  const [allExams, setAllExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTerminateSession, setShowTerminateSession] = useState(null);
  const [showEndExam, setShowEndExam] = useState(null);

  // ── data fetching ────────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      const [monitorRes, examsRes] = await Promise.all([
        sessionService.getMonitorData(),
        sessionService.getExamSessions(),
      ]);
      const mData = monitorRes.data?.data;
      if (mData) setMonitorData(mData);
      setAllExams(examsRes.data?.data || []);
    } catch (err) {
      console.error('Monitor fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── actions ──────────────────────────────────────────────────────────────

  const handleTerminateSession = async () => {
    if (!showTerminateSession) return;
    try {
      await sessionService.lecturerTerminate(showTerminateSession.id);
      toast.success('Session terminated');
      fetchData();
    } catch {
      toast.error('Failed to terminate session');
    } finally {
      setShowTerminateSession(null);
    }
  };

  const handleStartExam = async (examId) => {
    try {
      await sessionService.startExamSession(examId);
      toast.success('Exam started');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start exam');
    }
  };

  const handleEndExam = async () => {
    if (!showEndExam) return;
    try {
      const res = await sessionService.endExamSession(showEndExam.id);
      const count = res.data?.data?.terminated_sessions ?? 0;
      toast.success(`Exam ended. ${count} session(s) terminated.`);
      fetchData();
    } catch {
      toast.error('Failed to end exam');
    } finally {
      setShowEndExam(null);
    }
  };

  // ── derived state ────────────────────────────────────────────────────────
  const activeSessions = monitorData.active_sessions || [];
  const summary        = monitorData.summary || { total_active: 0, in_exam: 0, free_sessions: 0 };

  // ── render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Page heading */}
      <div>
        <h1 className="text-3xl font-bold text-white">Session Monitor</h1>
        <p className="text-slate-400 mt-1">Live supervision dashboard — refreshes every 5 seconds</p>
      </div>

      {/* ── Top summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Active"  count={summary.total_active}  Icon={Activity}    colorText="text-green-400"  colorBg="bg-green-500/10" />
        <StatCard title="In Exam"       count={summary.in_exam}       Icon={ShieldAlert} colorText="text-yellow-400" colorBg="bg-yellow-500/10" />
        <StatCard title="Free Sessions" count={summary.free_sessions} Icon={Monitor}     colorText="text-blue-400"   colorBg="bg-blue-500/10" />
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left column — Live sessions table */}
        <div className="lg:col-span-8">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">

            {/* Table header */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-400" />
                Live Student Sessions
              </h2>
              <LiveBadge />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-medium">Student</th>
                    <th className="px-6 py-3 font-medium">VM</th>
                    <th className="px-6 py-3 font-medium">Duration</th>
                    <th className="px-6 py-3 font-medium">Exam Mode</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {activeSessions.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                          <Eye className="w-10 h-10 mb-3 opacity-40" />
                          <p className="text-sm font-medium">No Active Sessions</p>
                          <p className="text-xs mt-1">Students appear here when they connect to their VMs</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activeSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{session.user?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-slate-400">{session.user?.email || ''}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-200">{session.vm?.name || 'Unknown VM'}</div>
                          <div className="text-xs text-slate-400">{session.vm?.template_name || ''}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-slate-300">
                            {formatDuration(session.duration_seconds)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusPill isInExam={session.is_in_exam} />
                        </td>
                        <td className="px-6 py-4 text-right space-x-1">
                          <button
                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                            title="View Session"
                          >
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

        {/* Right column — Exam sessions */}
        <div className="lg:col-span-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col">

            {/* Panel header */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
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

            {/* Exam cards list */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[720px]">
              {allExams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <ShieldAlert className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm font-medium">No Exam Sessions</p>
                  <p className="text-xs mt-1 text-center">Create an exam to start monitoring</p>
                </div>
              ) : (
                allExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="bg-slate-900/60 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors space-y-3"
                  >
                    {/* Exam title & status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm truncate">{exam.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{exam.class_room?.name || '—'}</p>
                      </div>
                      <ExamStatusBadge status={exam.status} />
                    </div>

                    {/* Time info */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {exam.status === 'scheduled' && (
                        <span>Starts: {safeDate(exam.starts_at)}</span>
                      )}
                      {exam.status === 'ended' && (
                        <span>Ended: {safeDate(exam.ends_at)}</span>
                      )}
                      {exam.status === 'active' && (
                        <span className={exam.time_remaining_seconds < 600 ? 'text-red-400 font-medium' : 'text-yellow-400'}>
                          ⏱ {formatDuration(exam.time_remaining_seconds)} remaining
                        </span>
                      )}
                    </div>

                    {/* Student count */}
                    <p className="text-xs text-slate-400">
                      {exam.enrolled_student_count ?? 0} students enrolled
                    </p>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1 border-t border-slate-700/60">
                      {exam.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => handleStartExam(exam.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600/10 text-green-400 hover:bg-green-600/20 text-xs font-medium rounded-lg transition-colors border border-green-600/20"
                          >
                            <Play className="w-3.5 h-3.5" /> Start Exam
                          </button>
                          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors border border-slate-700" title="Edit">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors border border-slate-700" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {exam.status === 'active' && (
                        <button
                          onClick={() => setShowEndExam(exam)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/10 text-red-400 hover:bg-red-600/20 text-xs font-medium rounded-lg transition-colors border border-red-600/20"
                        >
                          <StopCircle className="w-3.5 h-3.5" /> End Exam
                        </button>
                      )}
                      {exam.status === 'ended' && (
                        <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 text-xs font-medium rounded-lg transition-colors border border-blue-600/20">
                          <BarChart2 className="w-3.5 h-3.5" /> View Report
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

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <CreateExamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchData}
      />

      <ConfirmModal
        isOpen={!!showTerminateSession}
        title="Terminate Session"
        message={`Terminate ${showTerminateSession?.user?.full_name ?? 'this student'}'s session? All unsaved work will be lost.`}
        confirmText="Terminate"
        variant="danger"
        onConfirm={handleTerminateSession}
        onCancel={() => setShowTerminateSession(null)}
      />

      <ConfirmModal
        isOpen={!!showEndExam}
        title="End Exam Session"
        message={`End "${showEndExam?.name ?? 'this exam'}"? All active student sessions for this exam will be terminated immediately.`}
        confirmText="End Exam"
        variant="danger"
        onConfirm={handleEndExam}
        onCancel={() => setShowEndExam(null)}
      />
    </div>
  );
}
