import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Clock, TrendingUp, RefreshCw, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const DAY_LABELS = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

function CourseCard({ c, highlight = false }) {
  return (
    <div className={highlight
      ? 'rounded-2xl border-2 border-blue-500/25 bg-blue-500/[0.04] p-5'
      : 'glass-card rounded-2xl p-5'}>
      <p className="text-xs text-[var(--text-faint)] uppercase tracking-wider mb-1">{c.university_name} · {c.department_name}</p>
      <h3 className="font-semibold text-[var(--text-primary)] mb-3">{c.code}: {c.name}</h3>

      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-4">
        <Clock size={14} className={highlight ? 'text-blue-400' : 'text-[var(--accent-primary)]'} />
        {c.schedule_day ? (
          <span className={highlight ? 'text-blue-300 font-medium' : ''}>
            {DAY_LABELS[c.schedule_day] || c.schedule_day}{c.schedule_time ? ` · ${c.schedule_time}` : ''}
          </span>
        ) : (
          <span className="text-[var(--text-faint)]">No recurring schedule set yet</span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-3">
        <TrendingUp size={14} className="text-emerald-400" />
        <span>
          {c.sessions_attended} session{c.sessions_attended === 1 ? '' : 's'} attended
          {c.sessions_attended > 0 && ` · avg ${c.average_duration_minutes} min`}
        </span>
      </div>
    </div>
  );
}

/**
 * MySchedulePage — Phase 4 (Product Depth Layer), student-facing.
 * Real enrolled courses (however the CourseEnrollment row was created —
 * bulk CSV, self-enroll invite link, or a direct grant, all converge on
 * the same real data here), their recurring schedule, and the
 * student's own real attendance record for each — reusing the exact
 * same _real_attendance_stats the lecturer's roster is built from.
 *
 * Phase 4 (Premium Rebuild) — real visual hierarchy: today's real
 * scheduled classes surface first and distinctly, routine course
 * browsing sits below, not mixed together in one flat grid.
 */
export default function MySchedulePage() {
  const [courses, setCourses] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCoursework = useCallback(async () => {
    try {
      const res = await api.get('/university-admin/student/my-coursework/');
      setCourses(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load your schedule');
      setCourses([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCoursework(); }, [fetchCoursework]);

  const handleRefresh = () => { setRefreshing(true); fetchCoursework(); };

  if (courses === null) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todayCourses = courses.filter(c => c.schedule_day === todayKey);
  const otherCourses = courses.filter(c => c.schedule_day !== todayKey);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-400" /> My Schedule
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">Your real, enrolled courses, recurring class times, and attendance.</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10,
            background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-[var(--text-secondary)]">
          You aren't enrolled as a student in any course yet.
        </div>
      ) : (
        <>
          {/* Today's Classes — the real, urgent-first section. Only
              rendered when there's genuinely a real class today; no
              fabricated "nothing today" banner cluttering the page on
              every other day of the week. */}
          {todayCourses.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock size={14} className="text-blue-400" /> Today's Classes
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {todayCourses.map(c => <CourseCard key={c.course_id} c={c} highlight />)}
              </div>
            </div>
          )}

          <div>
            {todayCourses.length > 0 && (
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                All My Courses
              </h2>
            )}
            {otherCourses.length === 0 && todayCourses.length === courses.length ? (
              <p className="text-sm text-[var(--text-faint)] flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" /> That's everything. All your courses have class today.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(todayCourses.length > 0 ? otherCourses : courses).map(c => (
                  <CourseCard key={c.course_id} c={c} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
