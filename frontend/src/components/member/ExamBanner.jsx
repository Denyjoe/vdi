import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Clock, AlertTriangle } from 'lucide-react';
import { sessionService } from '../../services/sessionService';

/**
 * ExamBanner — shown on student pages when an active exam session exists.
 *
 * Polls GET /api/sessions/exam-sessions/active/ and displays a full-width
 * amber banner with a live countdown. Returns null when no active exam.
 *
 * @returns {JSX.Element|null}
 */
export default function ExamBanner() {
  const [activeExam, setActiveExam] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const navigate = useNavigate();

  // Poll for active exam on mount and every 30 seconds
  useEffect(() => {
    let cancelled = false;

    const fetchExam = async () => {
      try {
        const res = await sessionService.getStudentActiveExam();
        if (!cancelled) {
          const exam = res.data?.data || null;
          setActiveExam(exam);
          if (exam) {
            const endsAt = new Date(exam.ends_at).getTime();
            const now = Date.now();
            setTimeRemaining(Math.max(0, Math.floor((endsAt - now) / 1000)));
          }
        }
      } catch {
        // Silently ignore errors — banner is non-critical
      }
    };

    fetchExam();
    const pollInterval = setInterval(fetchExam, 30_000);
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, []);

  // Client-side countdown — ticks every second without re-fetching
  useEffect(() => {
    if (!activeExam) return;
    const tick = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [activeExam]);

  if (!activeExam) return null;

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const isUrgent = timeRemaining < 600; // under 10 minutes

  return (
    <div className={`w-full rounded-xl border px-6 py-4 flex items-center justify-between gap-4
      ${isUrgent
        ? 'bg-red-900/50 border-red-500/40'
        : 'bg-amber-900/40 border-amber-500/30'
      }`}>

      <div className="flex items-start gap-4">
        <div className={`mt-0.5 shrink-0 p-2.5 rounded-lg ${isUrgent ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
          <Shield className={`w-5 h-5 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            {isUrgent && <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />}
            <p className={`text-xs font-bold uppercase tracking-widest ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
              📋 Exam In Progress
            </p>
          </div>
          <p className="text-white font-bold text-base">{activeExam.name}</p>
          <p className="text-amber-200/70 text-sm">
            {activeExam.allowed_vm_template
              ? `Allowed VM: ${activeExam.allowed_vm_template.name}`
              : 'Any VM allowed'}
          </p>
          {(activeExam.restrict_internet || activeExam.restrict_copy_paste) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {activeExam.restrict_internet && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-300 bg-amber-900/60 border border-amber-700/50 rounded-full px-2.5 py-0.5">
                  🚫 No Internet
                </span>
              )}
              {activeExam.restrict_copy_paste && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-300 bg-amber-900/60 border border-amber-700/50 rounded-full px-2.5 py-0.5">
                  🚫 No Copy-Paste
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-amber-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Time Remaining</span>
          </div>
          <div className={`text-2xl font-bold font-mono tabular-nums ${isUrgent ? 'text-red-400' : 'text-amber-300'}`}>
            {formatTime(timeRemaining)}
          </div>
        </div>

        <button
          onClick={() => navigate('/student/vms')}
          className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all
            ${isUrgent
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-amber-500 hover:bg-amber-400 text-amber-900'
            }`}
        >
          Join Exam →
        </button>
      </div>
    </div>
  );
}
