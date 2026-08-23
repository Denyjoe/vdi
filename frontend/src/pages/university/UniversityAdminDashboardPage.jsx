import { useState, useEffect, useCallback } from 'react';
import {
  Landmark, Plus, X, Upload, Link2, Copy, UserPlus, UserMinus,
  BarChart3, BookOpen, Users, RefreshCw, Server, GraduationCap,
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import UniversityHardwarePanel from '../../components/university/UniversityHardwarePanel';
import TemplateRequestQueuePanel from '../../components/university/TemplateRequestQueuePanel';

export default function UniversityAdminDashboardPage() {
  const [universities, setUniversities] = useState(null); // null = loading
  const [university, setUniversity] = useState(null);
  const [tab, setTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [courses, setCourses] = useState([]);
  const [invites, setInvites] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: '', code: '' });

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState('student');

  const [lecturerEmail, setLecturerEmail] = useState('');
  const [lecturerCourseId, setLecturerCourseId] = useState('');
  const [lecturers, setLecturers] = useState(null);

  const [csvResults, setCsvResults] = useState(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  const fetchDepartments = useCallback(async (uniId) => {
    const res = await api.get(`/university-admin/universities/${uniId}/departments/`);
    setDepartments(res.data?.data || []);
  }, []);

  const fetchAnalytics = useCallback(async (uniId) => {
    const res = await api.get(`/university-admin/universities/${uniId}/analytics/`);
    setAnalytics(res.data?.data || null);
  }, []);

  const fetchLecturers = useCallback(async (uniId) => {
    try {
      const res = await api.get(`/university-admin/universities/${uniId}/lecturers/`);
      setLecturers(res.data?.data || []);
    } catch (err) {
      setLecturers([]);
    }
  }, []);

  useEffect(() => {
    api.get('/university-admin/universities/mine/').then(res => {
      const list = res.data?.data || [];
      setUniversities(list);
      if (list.length > 0) {
        setUniversity(list[0]);
      }
    }).catch(() => setUniversities([]));
  }, []);

  useEffect(() => {
    if (!university) return;
    fetchDepartments(university.id);
    fetchAnalytics(university.id);
    fetchLecturers(university.id);
  }, [university, fetchDepartments, fetchAnalytics, fetchLecturers]);

  const fetchCourses = useCallback(async (deptId) => {
    const res = await api.get(`/university-admin/departments/${deptId}/courses/`);
    setCourses(res.data?.data || []);
  }, []);

  const fetchInvites = useCallback(async (deptId) => {
    const res = await api.get(`/university-admin/departments/${deptId}/invites/`);
    setInvites(res.data?.data || []);
  }, []);

  const selectDept = (dept) => {
    setSelectedDept(dept);
    fetchCourses(dept.id);
    fetchInvites(dept.id);
    setCsvResults(null);
  };

  const handleRefresh = async () => {
    if (!university) return;
    setRefreshing(true);
    await fetchDepartments(university.id);
    await fetchAnalytics(university.id);
    if (selectedDept) {
      await fetchCourses(selectedDept.id);
      await fetchInvites(selectedDept.id);
    }
    setRefreshing(false);
  };

  const createDepartment = async () => {
    if (!deptForm.name.trim() || !deptForm.code.trim()) {
      toast.error('Name and code are required.');
      return;
    }
    try {
      await api.post(`/university-admin/universities/${university.id}/departments/`, deptForm);
      toast.success('Department created.');
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '' });
      fetchDepartments(university.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create department');
    }
  };

  const createCourse = async () => {
    if (!courseForm.name.trim() || !courseForm.code.trim()) {
      toast.error('Name and code are required.');
      return;
    }
    try {
      await api.post(`/university-admin/departments/${selectedDept.id}/courses/`, courseForm);
      toast.success('Course created.');
      setShowCourseModal(false);
      setCourseForm({ name: '', code: '' });
      fetchCourses(selectedDept.id);
      fetchDepartments(university.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create course');
    }
  };

  const createInvite = async () => {
    try {
      await api.post(`/university-admin/departments/${selectedDept.id}/invites/`, { role: inviteRole });
      toast.success('Invite link created.');
      setShowInviteModal(false);
      fetchInvites(selectedDept.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create invite');
    }
  };

  const copyInviteLink = (code) => {
    const url = `${window.location.origin}/join/university?code=${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied.');
  };

  const grantLecturer = async () => {
    if (!lecturerEmail.trim()) { toast.error('Email is required.'); return; }
    try {
      const res = await api.post(`/university-admin/departments/${selectedDept.id}/lecturers/grant/`, {
        email: lecturerEmail, course_id: lecturerCourseId || undefined,
      });
      toast.success(res.data?.message || 'Lecturer granted.');
      setLecturerEmail('');
      setLecturerCourseId('');
      // Real fix for Issue 3 — the grant used to be a fire-and-forget
      // toast with nothing showing the result afterward. Now the course
      // list (lecturer names) and the real Lecturers list both refresh
      // immediately so the admin sees the same real row they just created.
      fetchCourses(selectedDept.id);
      fetchLecturers(university.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not grant lecturer role');
    }
  };

  const revokeLecturer = async () => {
    if (!lecturerEmail.trim()) { toast.error('Email is required.'); return; }
    try {
      const res = await api.post(`/university-admin/departments/${selectedDept.id}/lecturers/revoke/`, {
        email: lecturerEmail, course_id: lecturerCourseId || undefined,
      });
      toast.success(res.data?.message || 'Lecturer revoked.');
      setLecturerEmail('');
      setLecturerCourseId('');
      fetchCourses(selectedDept.id);
      fetchLecturers(university.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not revoke lecturer role');
    }
  };

  const revokeLecturerRow = async (row) => {
    try {
      await api.post(`/university-admin/departments/${row.department_id}/lecturers/revoke/`, {
        email: row.email, course_id: row.course_id || undefined,
      });
      toast.success(`${row.name} removed.`);
      fetchLecturers(university.id);
      if (selectedDept && selectedDept.id === row.department_id) fetchCourses(selectedDept.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not revoke');
    }
  };

  const uploadCsv = async (file) => {
    if (!file) return;
    setUploadingCsv(true);
    setCsvResults(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(
        `/university-admin/universities/${university.id}/enroll/bulk-csv/`,
        formData, { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setCsvResults(res.data?.data || null);
      toast.success(`Processed ${res.data.data.total_rows} row(s) — ${res.data.data.ok} enrolled.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'CSV upload failed');
    } finally {
      setUploadingCsv(false);
    }
  };

  if (universities === null) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (universities.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-24">
        <Landmark className="mx-auto mb-4 text-[var(--text-faint)]" size={40} />
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No university to manage</h1>
        <p className="text-[var(--text-secondary)]">This account isn't a designated university admin for any institution.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Landmark className="w-6 h-6 text-indigo-400" /> {university.name}
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">University admin dashboard — departments, courses, and enrollment.</p>
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

      <div className="flex gap-2 border-b border-[var(--border-color)] overflow-x-auto">
        {[['departments', 'Departments'], ['lecturers', 'Lecturers'], ['requests', 'Template Requests'], ['hardware', 'Hardware & Performance'], ['analytics', 'Analytics']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              tab === key
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'departments' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Department list */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-[var(--text-primary)]">Departments</h3>
              <button onClick={() => setShowDeptModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold hover:opacity-90">
                <Plus size={14} /> New
              </button>
            </div>
            {departments.length === 0 && (
              <div className="glass-card rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                No departments yet.
              </div>
            )}
            {departments.map(d => (
              <button key={d.id} onClick={() => selectDept(d)}
                className={`w-full text-left glass-card rounded-xl p-4 transition-colors ${selectedDept?.id === d.id ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}>
                <p className="font-medium text-[var(--text-primary)]">{d.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">{d.code} · {d.course_count} course(s)</p>
              </button>
            ))}
          </div>

          {/* Department detail */}
          <div className="lg:col-span-3 space-y-6">
            {!selectedDept ? (
              <div className="glass-card rounded-2xl p-10 text-center text-[var(--text-secondary)]">
                Select a department to manage its courses, invites, and enrollment.
              </div>
            ) : (
              <>
                <div className="glass-card rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2"><BookOpen size={16} /> Courses in {selectedDept.name}</h3>
                    <button onClick={() => setShowCourseModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold hover:opacity-90">
                      <Plus size={14} /> New Course
                    </button>
                  </div>
                  {courses.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">No courses yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {courses.map(c => (
                        <div key={c.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 text-sm py-2 border-b border-[var(--border-color)] last:border-0">
                          <span className="text-[var(--text-primary)]">{c.code} — {c.name}</span>
                          <span className="text-[var(--text-secondary)] text-xs">
                            {c.student_count} student(s) ·{' '}
                            {c.lecturers.length > 0
                              ? `Lecturer: ${c.lecturers.map(l => l.name).join(', ')}`
                              : 'No lecturer assigned'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="glass-card rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2"><Link2 size={16} /> Self-Enroll Invite Links</h3>
                    <button onClick={() => setShowInviteModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold hover:opacity-90">
                      <Plus size={14} /> New Invite
                    </button>
                  </div>
                  {invites.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">No active invite links yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {invites.map(inv => (
                        <div key={inv.id} className="flex justify-between items-center text-sm py-2 border-b border-[var(--border-color)] last:border-0">
                          <span className="text-[var(--text-primary)] capitalize">{inv.role} invite {inv.course_code ? `(${inv.course_code})` : ''}</span>
                          <button onClick={() => copyInviteLink(inv.code)}
                            className="flex items-center gap-1 text-[var(--accent-primary)] font-medium">
                            <Copy size={12} /> Copy link
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="glass-card rounded-2xl p-5">
                  <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"><Users size={16} /> Grant / Revoke Lecturer</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="email" value={lecturerEmail} onChange={e => setLecturerEmail(e.target.value)}
                      placeholder="lecturer@university.ac.tz"
                      className="flex-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                    <select value={lecturerCourseId} onChange={e => setLecturerCourseId(e.target.value)}
                      className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]">
                      <option value="">Whole department</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={grantLecturer}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25">
                        <UserPlus size={14} /> Grant
                      </button>
                      <button onClick={revokeLecturer}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25">
                        <UserMinus size={14} /> Revoke
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-faint)] mt-2">
                    Pick a course to assign that course specifically, or leave "Whole department" for a department-wide grant.
                  </p>
                </div>
              </>
            )}

            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"><Upload size={16} /> Bulk Enroll (CSV)</h3>
              <p className="text-xs text-[var(--text-faint)] mb-3">
                Columns: <code>email, department_code, role, course_code</code> (role and course_code optional).
                Everyone must already have an Ospace account.
              </p>
              <input type="file" accept=".csv" disabled={uploadingCsv}
                onChange={e => uploadCsv(e.target.files?.[0])}
                className="text-sm text-[var(--text-secondary)]" />
              {csvResults && (
                <div className="mt-4 text-sm">
                  <p className="text-[var(--text-primary)] font-medium mb-2">
                    {csvResults.ok} enrolled · {csvResults.partial} partial · {csvResults.errors} errors
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {csvResults.results.map((r, i) => (
                      <p key={i} className={`text-xs ${r.status === 'ok' ? 'text-emerald-400' : r.status === 'partial' ? 'text-amber-400' : 'text-red-400'}`}>
                        Row {r.row} ({r.email}): {r.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Lecturers — Issue 3 fix: a real, persistent answer to "who
           is assigned as lecturer to what", across BOTH real grant
           paths (department-wide and course-scoped). ─────────────── */}
      {tab === 'lecturers' && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <GraduationCap size={16} /> Lecturer Assignments
            </h3>
            <span className="text-xs text-[var(--text-secondary)]">{lecturers?.length || 0} real assignment(s)</span>
          </div>
          {lecturers === null ? (
            <div className="p-10 text-center text-[var(--text-secondary)] text-sm">Loading...</div>
          ) : lecturers.length === 0 ? (
            <div className="p-10 text-center text-[var(--text-secondary)] text-sm">
              No lecturer has been assigned yet. Use "Grant / Revoke Lecturer" under Departments.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-color)]">
              {lecturers.map(row => (
                <div key={row.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{row.name} <span className="text-[var(--text-faint)] font-normal">({row.email})</span></p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {row.kind === 'course'
                        ? <>Course: <span className="text-[var(--accent-primary)] font-medium">{row.course_code}</span> · {row.department_name}</>
                        : <>Department-wide · {row.department_name}</>}
                      {' · '}{new Date(row.assigned_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => revokeLecturerRow(row)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 self-start sm:self-auto">
                    <UserMinus size={13} /> Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'requests' && university && (
        <TemplateRequestQueuePanel universityId={university.id} />
      )}

      {tab === 'hardware' && university && (
        <UniversityHardwarePanel universityId={university.id} />
      )}

      {tab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">Departments</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{analytics.department_count}</p>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">Courses</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{analytics.course_count}</p>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">Students</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{analytics.student_count}</p>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">Lecturers</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{analytics.lecturer_count}</p>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"><BarChart3 size={16} /> By Course</h3>
            {analytics.by_course.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No courses yet.</p>
            ) : (
              <div className="space-y-2">
                {analytics.by_course.map(c => (
                  <div key={c.course_id} className="flex justify-between text-sm py-2 border-b border-[var(--border-color)] last:border-0">
                    <span className="text-[var(--text-primary)]">{c.course_code} — {c.course_name}</span>
                    <span className="text-[var(--text-secondary)]">{c.enrolled_count} enrolled · {c.session_count} class session(s)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── New Department Modal ─────────────────────────────────── */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">New Department</h3>
              <button onClick={() => setShowDeptModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="Department name (e.g. Computer Science)"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
              <input type="text" value={deptForm.code} onChange={e => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                placeholder="Code (e.g. CS)"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
              <button onClick={createDepartment}
                className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-semibold">
                Create Department
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Course Modal ─────────────────────────────────────── */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">New Course in {selectedDept?.name}</h3>
              <button onClick={() => setShowCourseModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={courseForm.name} onChange={e => setCourseForm({ ...courseForm, name: e.target.value })}
                placeholder="Course name (e.g. Intro to Programming)"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
              <input type="text" value={courseForm.code} onChange={e => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })}
                placeholder="Code (e.g. CS101)"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
              <button onClick={createCourse}
                className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-semibold">
                Create Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Invite Modal ─────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">New Invite Link</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]">
                <option value="student">Student</option>
                <option value="lecturer">Lecturer</option>
              </select>
              <button onClick={createInvite}
                className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-semibold">
                Create Invite Link
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
