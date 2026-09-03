import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Radio, Users, RefreshCw, X, PackagePlus, Clock, CheckCircle2, XCircle, Hammer, CalendarDays, MessageSquare, Send, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import ActiveSessionPanel from '../../components/university/ActiveSessionPanel';

const REQUEST_STATUS_META = {
  pending: { label: 'Pending Review', color: '#F59E0B', icon: Clock },
  approved: { label: 'Approved: Building', color: '#3B82F6', icon: Hammer },
  completed: { label: 'Completed', color: '#10B981', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#EF4444', icon: XCircle },
};

const DAY_OPTIONS = [
  { value: '', label: 'No recurring day' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];
const DAY_LABELS = Object.fromEntries(DAY_OPTIONS.filter(d => d.value).map(d => [d.value, d.label]));

export default function LecturerDashboardPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState(null); // null = loading
  const [refreshing, setRefreshing] = useState(false);
  const [rosterCourse, setRosterCourse] = useState(null);
  const [roster, setRoster] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const [myRequests, setMyRequests] = useState([]);
  const [requestCourse, setRequestCourse] = useState(null);
  const [requestForm, setRequestForm] = useState({
    software_needed: '', purpose: '', estimated_vcpu: 2, estimated_ram_gb: 4, estimated_storage_gb: 20,
  });
  const [quotaPreview, setQuotaPreview] = useState(null);
  const [checkingQuota, setCheckingQuota] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const quotaDebounceRef = useRef(null);

  const [scheduleCourse, setScheduleCourse] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ schedule_day: '', schedule_time: '' });
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [broadcastCourse, setBroadcastCourse] = useState(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.get('/university-admin/lecturer/my-courses/');
      setCourses(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load your courses');
      setCourses([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const fetchMyRequests = useCallback(async () => {
    try {
      const res = await api.get('/university-admin/lecturer/template-requests/');
      setMyRequests(res.data?.data || []);
    } catch (err) {
      // Non-critical — the page still works without this list.
    }
  }, []);

  useEffect(() => { fetchCourses(); fetchMyRequests(); }, [fetchCourses, fetchMyRequests]);

  const handleRefresh = () => { setRefreshing(true); fetchCourses(); fetchMyRequests(); };

  const openRequestModal = (course) => {
    setRequestCourse(course);
    setRequestForm({ software_needed: '', purpose: '', estimated_vcpu: 2, estimated_ram_gb: 4, estimated_storage_gb: 20 });
    setQuotaPreview(null);
  };

  // Real, honest, debounced quota pre-check — warns, never blocks.
  useEffect(() => {
    if (!requestCourse) return;
    if (quotaDebounceRef.current) clearTimeout(quotaDebounceRef.current);
    quotaDebounceRef.current = setTimeout(async () => {
      setCheckingQuota(true);
      try {
        const res = await api.get('/university-admin/lecturer/template-requests/quota-preview/', {
          params: {
            course_id: requestCourse.id,
            estimated_vcpu: requestForm.estimated_vcpu,
            estimated_ram_gb: requestForm.estimated_ram_gb,
            estimated_storage_gb: requestForm.estimated_storage_gb,
          },
        });
        setQuotaPreview(res.data?.data || null);
      } catch (err) {
        setQuotaPreview(null);
      } finally {
        setCheckingQuota(false);
      }
    }, 400);
    return () => clearTimeout(quotaDebounceRef.current);
  }, [requestCourse, requestForm.estimated_vcpu, requestForm.estimated_ram_gb, requestForm.estimated_storage_gb]);

  const submitRequest = async () => {
    if (!requestForm.software_needed.trim() || !requestForm.purpose.trim()) {
      toast.error('Software needed and purpose are both required.');
      return;
    }
    setSubmittingRequest(true);
    try {
      await api.post('/university-admin/lecturer/template-requests/', {
        course_id: requestCourse.id, ...requestForm,
      });
      toast.success('Request submitted to your university admin.');
      setRequestCourse(null);
      fetchMyRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const startClassSession = (course) => {
    // Reuses the EXISTING CreateSessionPage/PayAndStartSessionView flow —
    // just pre-filled with this course's default template/restrictions
    // and tagged with course= on the resulting LiveSession.
    navigate(`/create-session?course_id=${course.id}`, { state: { course } });
  };

  const openRoster = async (course) => {
    setRosterCourse(course);
    setLoadingRoster(true);
    try {
      const res = await api.get(`/university-admin/lecturer/courses/${course.id}/roster/`);
      setRoster(res.data?.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load roster');
      setRosterCourse(null);
    } finally {
      setLoadingRoster(false);
    }
  };

  const openScheduleModal = (course) => {
    setScheduleCourse(course);
    setScheduleForm({ schedule_day: course.schedule_day || '', schedule_time: course.schedule_time || '' });
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await api.patch(`/university-admin/courses/${scheduleCourse.id}/`, {
        schedule_day: scheduleForm.schedule_day,
        schedule_time: scheduleForm.schedule_time,
      });
      if (res.data?.success === false) {
        toast.error(res.data.message || 'Could not save schedule');
        return;
      }
      toast.success('Recurring schedule saved.');
      setScheduleCourse(null);
      fetchCourses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const openBroadcastModal = (course) => {
    setBroadcastCourse(course);
    setBroadcastMessage('');
  };

  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      toast.error('Message cannot be empty.');
      return;
    }
    setSendingBroadcast(true);
    try {
      const res = await api.post(`/university-admin/lecturer/courses/${broadcastCourse.id}/broadcast/`, {
        message: broadcastMessage.trim(),
      });
      toast.success(res.data?.message || 'Sent.');
      setBroadcastCourse(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send message');
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (courses === null) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Phase 4 (Premium Rebuild) — real visual hierarchy: what genuinely
  // needs the lecturer's attention right now (a live session, a real
  // class scheduled for today, a real rejected request they haven't
  // seen) versus routine, browse-at-leisure course information below.
  const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const liveCourses = courses.filter(c => c.active_session);
  const todayCourses = courses.filter(c => !c.active_session && c.schedule_day === todayKey);
  const rejectedRequests = myRequests.filter(r => r.status === 'rejected' && r.admin_notes);
  const hasAttentionItems = liveCourses.length > 0 || todayCourses.length > 0 || rejectedRequests.length > 0;

  const scrollToCourse = (courseId) => {
    document.getElementById(`course-${courseId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-400" /> My Courses
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">Courses you teach. Start a class session or view your roster.</p>
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

      {/* ── Needs Your Attention — Phase 4 (Premium Rebuild) ────────
           Real, urgent-first hierarchy: live sessions, today's real
           scheduled classes, real rejected requests with feedback —
           never a fabricated "all clear", but a genuine one when
           there's truly nothing pending. */}
      {courses.length > 0 && (
        <div className={`glass-card rounded-2xl p-5 ${hasAttentionItems ? 'border-2 border-amber-500/25' : ''}`}>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Sparkles size={16} className={hasAttentionItems ? 'text-amber-400' : 'text-emerald-400'} /> Needs Your Attention
          </h3>
          {hasAttentionItems ? (
            <div className="space-y-1.5">
              {liveCourses.map(c => (
                <button key={`live-${c.id}`} onClick={() => scrollToCourse(c.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-left hover:bg-emerald-500/15 transition-colors">
                  <span className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    {c.code} is live right now
                  </span>
                  <ChevronRight size={14} className="text-emerald-400 flex-shrink-0" />
                </button>
              ))}
              {todayCourses.map(c => (
                <button key={`today-${c.id}`} onClick={() => scrollToCourse(c.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-left hover:bg-blue-500/15 transition-colors">
                  <span className="flex items-center gap-2 text-sm text-blue-400 font-medium">
                    <CalendarDays size={14} className="flex-shrink-0" />
                    {c.code}: class today{c.schedule_time ? ` at ${c.schedule_time}` : ''}
                  </span>
                  <ChevronRight size={14} className="text-blue-400 flex-shrink-0" />
                </button>
              ))}
              {rejectedRequests.map(r => (
                <div key={`rej-${r.id}`} className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-red-400">
                    <span className="font-medium">{r.course_code} template request rejected</span>. {r.admin_notes}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400" />
              You're all caught up. No live sessions, no classes scheduled today, nothing awaiting your response.
            </p>
          )}
        </div>
      )}

      {courses.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-[var(--text-secondary)]">
          You aren't listed as the lecturer for any course yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(c => (
            <div key={c.id} id={`course-${c.id}`} className="glass-card rounded-2xl p-5">
              <p className="text-xs text-[var(--text-faint)] uppercase tracking-wider mb-1">{c.university_name} · {c.department_name}</p>
              <h3 className="font-semibold text-[var(--text-primary)] mb-1">{c.code}: {c.name}</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-1">{c.student_count} student(s) enrolled</p>
              <button onClick={() => openScheduleModal(c)}
                className="flex items-center gap-1.5 text-xs mb-4 hover:underline"
                style={{ color: c.schedule_day ? 'var(--accent-primary)' : 'var(--text-faint)' }}>
                <CalendarDays size={13} />
                {c.schedule_day
                  ? `${DAY_LABELS[c.schedule_day] || c.schedule_day}${c.schedule_time ? ` · ${c.schedule_time}` : ''}`
                  : 'Set recurring schedule'}
              </button>
              {/* Phase 2 (Premium Rebuild) — the real, existing
                  session-hosting toolkit, surfaced right here the
                  moment a real class session is active — not something
                  the lecturer has to remember exists elsewhere. */}
              {c.active_session ? (
                <div className="mb-2">
                  <ActiveSessionPanel session={c.active_session} courseCode={c.code} onEnded={fetchCourses} />
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => startClassSession(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-semibold hover:opacity-90">
                    <Radio size={14} /> Start Class Session
                  </button>
                  <button onClick={() => openRoster(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold hover:bg-[var(--bg-nav-hover)]">
                    <Users size={14} /> Roster
                  </button>
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <button onClick={() => openBroadcastModal(c)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-transparent border border-dashed border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--bg-nav-hover)] hover:text-[var(--text-primary)]">
                  <MessageSquare size={14} /> Message Class
                </button>
                <button onClick={() => openRequestModal(c)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-transparent border border-dashed border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--bg-nav-hover)] hover:text-[var(--text-primary)]">
                  <PackagePlus size={14} /> Request Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {myRequests.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <PackagePlus size={16} /> My Template Requests
          </h3>
          <div className="space-y-2">
            {myRequests.map(r => {
              const meta = REQUEST_STATUS_META[r.status];
              const Icon = meta.icon;
              return (
                <div key={r.id} className="flex justify-between items-center text-sm py-2 border-b border-[var(--border-color)] last:border-0">
                  <div>
                    <span className="text-[var(--text-primary)] font-medium">{r.course_code}</span>{' '}
                    <span className="text-[var(--text-secondary)]">({r.software_needed})</span>
                    {r.status === 'rejected' && r.admin_notes && (
                      <p className="text-xs text-red-400 mt-0.5">{r.admin_notes}</p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                    style={{ background: `${meta.color}1a`, color: meta.color }}>
                    <Icon size={12} /> {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Roster Modal ─────────────────────────────────────────── */}
      {rosterCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Roster: {rosterCourse.code}</h3>
              <button onClick={() => { setRosterCourse(null); setRoster(null); }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>
            {loadingRoster ? (
              <div className="py-10 text-center text-[var(--text-secondary)]">Loading...</div>
            ) : roster ? (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Enrolled ({roster.roster.length})</h4>
                  <div className="space-y-1">
                    {roster.roster.map(r => (
                      <div key={r.user_id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm py-1.5 border-b border-[var(--border-color)] last:border-0 gap-0.5">
                        <span className="text-[var(--text-primary)]">{r.name} <span className="text-[var(--text-faint)]">({r.email})</span></span>
                        <span className="text-[var(--text-secondary)] text-xs flex items-center gap-1">
                          <span className="capitalize">{r.role}</span>
                          <span>· {r.sessions_attended} session(s)</span>
                          {r.sessions_attended > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-400">
                              <TrendingUp size={11} /> avg {r.average_duration_minutes}min · {r.total_minutes}min total
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    {roster.roster.length === 0 && <p className="text-sm text-[var(--text-secondary)]">No one enrolled yet.</p>}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Class Sessions ({roster.total_sessions})</h4>
                  <div className="space-y-1">
                    {roster.sessions.map(s => (
                      <div key={s.id} className="flex justify-between text-sm py-1.5 border-b border-[var(--border-color)] last:border-0">
                        <span className="text-[var(--text-primary)]">{s.name}</span>
                        <span className="text-[var(--text-secondary)] capitalize">{s.status} · {s.participant_count} joined</span>
                      </div>
                    ))}
                    {roster.sessions.length === 0 && <p className="text-sm text-[var(--text-secondary)]">No class sessions started yet.</p>}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Request Template Modal ───────────────────────────────── */}
      {requestCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Request Template: {requestCourse.code}</h3>
              <button onClick={() => setRequestCourse(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Software needed</label>
                <textarea rows={2} value={requestForm.software_needed}
                  onChange={e => setRequestForm({ ...requestForm, software_needed: e.target.value })}
                  placeholder="e.g. MATLAB, Simulink, Control System Toolbox"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Purpose</label>
                <textarea rows={2} value={requestForm.purpose}
                  onChange={e => setRequestForm({ ...requestForm, purpose: e.target.value })}
                  placeholder="e.g. Weekly control systems lab, 40 students"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Estimated specs</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">vCPU Cores</label>
                    <input type="number" min="1" value={requestForm.estimated_vcpu}
                      onChange={e => setRequestForm({ ...requestForm, estimated_vcpu: parseInt(e.target.value) || 1 })}
                      placeholder="vCPU"
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">RAM (GB)</label>
                    <input type="number" min="1" value={requestForm.estimated_ram_gb}
                      onChange={e => setRequestForm({ ...requestForm, estimated_ram_gb: parseInt(e.target.value) || 1 })}
                      placeholder="RAM GB"
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Storage (GB)</label>
                    <input type="number" min="1" value={requestForm.estimated_storage_gb}
                      onChange={e => setRequestForm({ ...requestForm, estimated_storage_gb: parseInt(e.target.value) || 1 })}
                      placeholder="Storage GB"
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  </div>
                </div>
              </div>

              {checkingQuota && (
                <p className="text-xs text-[var(--text-faint)]">Checking real quota headroom...</p>
              )}
              {!checkingQuota && quotaPreview && !quotaPreview.fits_quota && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  Heads up. As of right now, this likely exceeds your university's remaining capacity:{' '}
                  {quotaPreview.message} You can still submit; your admin will see the same real check when reviewing.
                </p>
              )}
              {!checkingQuota && quotaPreview && quotaPreview.fits_quota && (
                <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  Fits within your university's current remaining capacity.
                </p>
              )}

              <button onClick={submitRequest} disabled={submittingRequest}
                className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-50 mt-2">
                {submittingRequest ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recurring Schedule Modal ─────────────────────────────── */}
      {scheduleCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <CalendarDays size={20} /> Schedule: {scheduleCourse.code}
              </h3>
              <button onClick={() => setScheduleCourse(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Day of week</label>
                <select value={scheduleForm.schedule_day}
                  onChange={e => setScheduleForm({ ...scheduleForm, schedule_day: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]">
                  {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Class time</label>
                <input type="time" value={scheduleForm.schedule_time}
                  disabled={!scheduleForm.schedule_day}
                  onChange={e => setScheduleForm({ ...scheduleForm, schedule_time: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-50" />
              </div>
              <p className="text-xs text-[var(--text-faint)]">Students enrolled in this course see this recurring time on their own schedule page, regardless of how they were enrolled.</p>
              <button onClick={saveSchedule} disabled={savingSchedule}
                className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-50 mt-2">
                {savingSchedule ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Message Class (Broadcast) Modal ──────────────────────── */}
      {broadcastCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <MessageSquare size={20} /> Message Class: {broadcastCourse.code}
              </h3>
              <button onClick={() => setBroadcastCourse(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Message</label>
                <textarea rows={4} value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  placeholder="e.g. Class moved to Room 204 this week. Same time."
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none" />
              </div>
              <p className="text-xs text-[var(--text-faint)]">Sent as a real notification to every student enrolled in {broadcastCourse.code}. No active class session required.</p>
              <button onClick={sendBroadcast} disabled={sendingBroadcast}
                className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-50 mt-2 flex items-center justify-center gap-2">
                <Send size={16} /> {sendingBroadcast ? 'Sending...' : 'Send to Class'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
