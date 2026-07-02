/**
 * LecturerClassesPage — full class management for lecturers.
 *
 * Features:
 *   - Grid of class cards with enrolled count + pending request badge
 *   - Create new class via modal
 *   - Manage class via modal with Students tab + Enrollment Requests tab
 *   - Approve / Reject requests inline
 *   - Remove students from class
 */

import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, Plus, Users, ClipboardList, CheckCircle, XCircle,
  UserMinus, X, ChevronDown, ChevronUp, Search, BookOpen, Loader2,
  Clock, AlertCircle
} from 'lucide-react';
import { classService } from '../../services/classService';

/** Toast notification component */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-medium animate-fade-in ${
      type === 'success'
        ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100'
        : 'bg-red-900/90 border-red-500/40 text-red-100'
    }`}>
      {type === 'success'
        ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
        : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
      {message}
    </div>
  );
}

/** CreateClassModal — form to create a new working group */
function CreateClassModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    department: '',
    max_students: 60,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Group name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await classService.createClass(form);
      if (res.data.success) {
        onCreated(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-slate-400 mb-1.5';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/20 p-2 rounded-lg">
              <Plus className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Create Working Group</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClass}>Group Name *</label>
            <input name="name" value={form.name} onChange={handleChange}
              placeholder="e.g. Wednesday Afternoon Lab Group" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea name="description" value={form.description} onChange={handleChange}
              placeholder="Optional description..." rows={3}
              className={inputClass + ' resize-none'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Department (Optional)</label>
              <input name="department" value={form.department} onChange={handleChange}
                placeholder="e.g. Computer Engineering" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Max Students</label>
              <input type="number" name="max_students" value={form.max_students} onChange={handleChange}
                min={1} max={500} className={inputClass} />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 px-4 text-sm font-medium border border-slate-600 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 px-4 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** ClassDetailModal — manage enrolled students + enrollment requests */
function ClassDetailModal({ classRoom, onClose, onUpdate, showToast }) {
  const [activeTab, setActiveTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actionId, setActionId] = useState(null);

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const res = await classService.getClassStudents(classRoom.id);
      if (res.data.success) setStudents(res.data.data);
    } catch { /* silent */ }
    finally { setLoadingStudents(false); }
  }, [classRoom.id]);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await classService.getEnrollmentRequests(classRoom.id);
      if (res.data.success) setRequests(res.data.data);
    } catch { /* silent */ }
    finally { setLoadingRequests(false); }
  }, [classRoom.id]);

  useEffect(() => {
    loadStudents();
    loadRequests();
  }, [loadStudents, loadRequests]);

  const handleRemoveStudent = async (studentId) => {
    if (!confirm('Remove this student from the class?')) return;
    setActionId(studentId);
    try {
      await classService.removeStudent(classRoom.id, studentId);
      setStudents(prev => prev.filter(s => s.student?.id !== studentId));
      showToast('Student removed from class.', 'success');
      onUpdate({ enrolled_count: (classRoom.enrolled_count || 0) - 1 });
    } catch {
      showToast('Failed to remove student.', 'error');
    } finally { setActionId(null); }
  };

  const handleApprove = async (requestId) => {
    setActionId(requestId);
    try {
      await classService.approveRequest(requestId);
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'approved' } : r));
      await loadStudents();
      showToast('Student approved and enrolled.', 'success');
      onUpdate({ pending_requests_count: Math.max(0, (classRoom.pending_requests_count || 0) - 1), enrolled_count: (classRoom.enrolled_count || 0) + 1 });
    } catch {
      showToast('Failed to approve request.', 'error');
    } finally { setActionId(null); }
  };

  const handleReject = async (requestId) => {
    const reason = prompt('Rejection reason (optional):') ?? '';
    setActionId(requestId);
    try {
      await classService.rejectRequest(requestId, reason);
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'rejected', rejection_reason: reason } : r));
      showToast('Request rejected.', 'success');
      onUpdate({ pending_requests_count: Math.max(0, (classRoom.pending_requests_count || 0) - 1) });
    } catch {
      showToast('Failed to reject request.', 'error');
    } finally { setActionId(null); }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-700 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">{classRoom.name}</h3>
            <p className="text-slate-400 text-sm mt-0.5">
              {classRoom.department && `${classRoom.department} · `}
              {classRoom.enrolled_count ?? 0} enrolled · {classRoom.max_students ?? 60} max
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 px-6 shrink-0">
          <button onClick={() => setActiveTab('students')}
            className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'students' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Enrolled Students
              <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">{students.length}</span>
            </span>
          </button>
          <button onClick={() => setActiveTab('requests')}
            className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'requests' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            <span className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Enrollment Requests
              {pendingCount > 0 && (
                <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">{pendingCount}</span>
              )}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'students' && (
            <div>
              {loadingStudents ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p className="font-medium">No students enrolled yet</p>
                  <p className="text-sm mt-1">Students need to request enrollment and be approved.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {students.map((enrollment) => {
                    const s = enrollment.student;
                    return (
                      <div key={enrollment.id}
                        className="flex items-center justify-between bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0">
                            {s?.name?.[0] || '?'}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{s?.name || 'Unknown'}</p>
                            <p className="text-slate-400 text-xs">{s?.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveStudent(s?.id)}
                          disabled={actionId === s?.id}
                          title="Remove from class"
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40">
                          {actionId === s?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div>
              {loadingRequests ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p className="font-medium">No enrollment requests</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => {
                    const s = req.student;
                    return (
                      <div key={req.id}
                        className="bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-300 font-bold text-sm shrink-0">
                              {s?.name?.[0] || '?'}
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">{s?.name || 'Unknown'}</p>
                              <p className="text-slate-400 text-xs">{s?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {req.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => handleApprove(req.id)}
                                  disabled={actionId === req.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50">
                                  {actionId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(req.id)}
                                  disabled={actionId === req.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50">
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              </>
                            ) : (
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {req.status}
                              </span>
                            )}
                          </div>
                        </div>
                        {req.message && (
                          <p className="text-slate-400 text-xs mt-2 ml-12 italic">"{req.message}"</p>
                        )}
                        {req.status === 'rejected' && req.rejection_reason && (
                          <p className="text-red-400 text-xs mt-1 ml-12">Reason: {req.rejection_reason}</p>
                        )}
                        <p className="text-slate-500 text-xs mt-1 ml-12 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(req.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Main LecturerClassesPage */
export default function LecturerClassesPage() {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [managingClass, setManagingClass] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const showToast = (message, type = 'success') => setToast({ message, type });

  const fetchClasses = useCallback(async () => {
    try {
      const res = await classService.getMyClasses();
      if (res.data.success) setClasses(res.data.data);
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const handleClassCreated = (newClass) => {
    setClasses(prev => [newClass, ...prev]);
    setShowCreateModal(false);
    showToast(`Class "${newClass.name}" created successfully.`);
  };

  const handleClassUpdate = (updatedFields) => {
    if (managingClass) {
      const updated = { ...managingClass, ...updatedFields };
      setManagingClass(updated);
      setClasses(prev => prev.map(c => c.id === managingClass.id ? updated : c));
    }
  };

  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.department || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">My Classes</h2>
          <p className="text-slate-400 mt-1">{classes.length} class{classes.length !== 1 ? 'es' : ''} managed</p>
        </div>
        <button
          id="create-class-btn"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-purple-500/20">
          <Plus className="w-4 h-4" /> Create Working Group
        </button>
      </div>

      {/* Search */}
      {classes.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search classes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/50 border border-slate-700 rounded-2xl">
          <GraduationCap className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <p className="text-white font-semibold text-lg">
            {classes.length === 0 ? 'No classes yet' : 'No classes match your search'}
          </p>
          <p className="text-slate-400 mt-2 mb-6">
            {classes.length === 0 ? 'Create your first class to get started.' : 'Try a different search term.'}
          </p>
          {classes.length === 0 && (
            <button onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors">
              Create Class
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              onManage={() => setManagingClass(cls)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateClassModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleClassCreated}
        />
      )}
      {managingClass && (
        <ClassDetailModal
          classRoom={managingClass}
          onClose={() => setManagingClass(null)}
          onUpdate={handleClassUpdate}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/** ClassCard — individual class card in the grid */
function ClassCard({ cls, onManage }) {
  const enrolled = cls.enrolled_count ?? 0;
  const maxStudents = cls.max_students ?? 60;
  const pending = cls.pending_requests_count ?? 0;
  const fillPct = Math.min(100, Math.round((enrolled / maxStudents) * 100));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-md hover:border-indigo-500/50 transition-all flex flex-col">
      {/* Top Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-base leading-tight truncate">{cls.name}</h3>
          {cls.department && (
            <p className="text-slate-400 text-xs mt-0.5">{cls.department}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            cls.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/50 text-slate-400'
          }`}>
            {cls.is_active ? 'Active' : 'Inactive'}
          </span>
          {pending > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
              {pending} pending
            </span>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mb-4">
        {cls.academic_year && <span>📅 {cls.academic_year}</span>}
        {cls.stream && <span>🏫 {cls.stream}</span>}
        {cls.semester && <span>Sem {cls.semester}</span>}
      </div>

      {/* Enrollment progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-400">{enrolled} / {maxStudents} students</span>
          <span className="text-slate-500">{fillPct}% full</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              fillPct > 90 ? 'bg-red-500' : fillPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {/* Action */}
      <button
        id={`manage-class-${cls.id}`}
        onClick={onManage}
        className="mt-auto w-full py-2.5 bg-slate-700 hover:bg-indigo-600 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
        <Users className="w-4 h-4" /> Manage
      </button>
    </div>
  );
}
