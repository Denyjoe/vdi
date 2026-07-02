/**
 * StudentClassesPage — class browser and enrollment management for students.
 *
 * Features:
 *   - "My Enrolled Classes" section with enrolled class cards
 *   - "Available Classes" section with search filter
 *   - Request to join with optional message
 *   - Cancel pending requests
 *   - Status badges for pending/rejected requests
 */

import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, Search, BookOpen, Users, CheckCircle, XCircle,
  Clock, Send, X, Loader2, AlertCircle, ChevronDown, Plus
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

/** RequestModal — optional message when requesting to join */
function RequestModal({ cls, onClose, onRequested }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await classService.requestEnrollment(cls.id, message);
      if (res.data.success) {
        onRequested(cls.id, res.data.data);
      } else {
        setError(res.data.message || 'Failed to send request.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
          <div>
            <h3 className="text-base font-bold text-white">Request to Join</h3>
            <p className="text-slate-400 text-sm mt-0.5">{cls.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Message to Lecturer <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. I am in COE-2 stream and would like to join this class..."
              rows={4}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 px-4 text-sm font-medium border border-slate-600 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 px-4 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <Send className="w-4 h-4" />
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Main StudentClassesPage */
export default function StudentClassesPage() {
  const [enrolledClasses, setEnrolledClasses] = useState([]);
  const [recommendedClasses, setRecommendedClasses] = useState([]);
  const [openGroups, setOpenGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [requestingClass, setRequestingClass] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [enrolledRes, availableRes] = await Promise.all([
        classService.getEnrolledClasses(),
        classService.getAvailableClasses(),
      ]);
      if (enrolledRes.data.success) setEnrolledClasses(enrolledRes.data.data);
      if (availableRes.data.success) {
        setRecommendedClasses(availableRes.data.data.recommended || []);
        setOpenGroups(availableRes.data.data.open_groups || []);
      }
    } catch (err) {
      console.error('Failed to load classes:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRequested = (classId, requestData) => {
    const updateFn = prev => prev.map(c =>
      c.id === classId
        ? { ...c, is_requested: true, request_status: 'pending', request_id: requestData.id }
        : c
    );
    setRecommendedClasses(updateFn);
    setOpenGroups(updateFn);
    setRequestingClass(null);
    showToast('Enrollment request sent! Waiting for lecturer approval.');
  };

  const handleCancelRequest = async (cls) => {
    if (!cls.request_id || !confirm('Cancel your enrollment request for this class?')) return;
    setCancellingId(cls.id);
    try {
      await classService.cancelRequest(cls.request_id);
      const updateFn = prev => prev.map(c =>
        c.id === cls.id
          ? { ...c, is_requested: false, request_status: null, request_id: null }
          : c
      );
      setRecommendedClasses(updateFn);
      setOpenGroups(updateFn);
      showToast('Request cancelled.');
    } catch {
      showToast('Failed to cancel request.', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  const searchLower = search.toLowerCase();
  const filterFn = c =>
    c.name.toLowerCase().includes(searchLower) ||
    (c.department || '').toLowerCase().includes(searchLower) ||
    (c.lecturer?.name || '').toLowerCase().includes(searchLower);

  const filteredRecommended = recommendedClasses.filter(filterFn);
  const filteredOpenGroups = openGroups.filter(filterFn);

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">My Classes</h2>
        <p className="text-slate-400 mt-1">Manage your enrollments and browse available classes</p>
      </div>

      {/* Enrolled Classes */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-400" />
          Enrolled Classes
          <span className="text-sm font-normal text-slate-400 ml-1">({enrolledClasses.length})</span>
        </h3>

        {enrolledClasses.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl px-6 py-10 text-center text-slate-400">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="font-medium">Not enrolled in any classes yet</p>
            <p className="text-sm mt-1">Browse available classes below and request to join.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {enrolledClasses.map((cls) => (
              <div key={cls.id}
                className="bg-slate-800 border border-emerald-500/30 rounded-2xl p-5 shadow-md hover:border-emerald-400/50 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold text-sm leading-tight truncate">{cls.name}</h4>
                    <p className="text-slate-400 text-xs mt-0.5">{cls.department}</p>
                  </div>
                  <span className="ml-2 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Enrolled
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>{cls.lecturer?.name}</span>
                  </div>
                  {cls.academic_year && <p>📅 {cls.academic_year} · Sem {cls.semester}</p>}
                  {cls.stream && <p>🏫 {cls.stream}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Available Classes Search */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            Class Discovery
          </h3>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, dept, lecturer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Recommended Classes */}
        <div className="mb-8">
          <h4 className="text-md font-medium text-slate-300 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            Recommended Official Classes
            <span className="text-xs font-normal text-slate-500 ml-1">({filteredRecommended.length})</span>
          </h4>

          {filteredRecommended.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl px-6 py-8 text-center text-slate-400">
              <p className="font-medium text-sm">{search ? 'No recommended classes match your search' : 'No recommended classes found for your profile'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRecommended.map((cls) => (
                <AvailableClassCard
                  key={cls.id}
                  cls={cls}
                  cancelling={cancellingId === cls.id}
                  onRequest={() => setRequestingClass(cls)}
                  onCancel={() => handleCancelRequest(cls)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Open Working Groups */}
        <div>
          <h4 className="text-md font-medium text-slate-300 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Open Working Groups
            <span className="text-xs font-normal text-slate-500 ml-1">({filteredOpenGroups.length})</span>
          </h4>

          {filteredOpenGroups.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl px-6 py-8 text-center text-slate-400">
              <p className="font-medium text-sm">{search ? 'No open groups match your search' : 'No open working groups available'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOpenGroups.map((cls) => (
                <AvailableClassCard
                  key={cls.id}
                  cls={cls}
                  cancelling={cancellingId === cls.id}
                  onRequest={() => setRequestingClass(cls)}
                  onCancel={() => handleCancelRequest(cls)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Request Modal */}
      {requestingClass && (
        <RequestModal
          cls={requestingClass}
          onClose={() => setRequestingClass(null)}
          onRequested={handleRequested}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/** AvailableClassCard */
function AvailableClassCard({ cls, onRequest, onCancel, cancelling }) {
  const isPending = cls.request_status === 'pending';
  const isRejected = cls.request_status === 'rejected';
  const enrolled = cls.enrolled_count ?? 0;
  const maxStudents = cls.max_students ?? 60;

  return (
    <div className={`bg-slate-800 border rounded-2xl p-5 shadow-md transition-all ${
      isPending ? 'border-amber-500/40' : isRejected ? 'border-red-500/30' : 'border-slate-700 hover:border-indigo-500/40'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-bold text-sm leading-tight truncate">{cls.name}</h4>
          <p className="text-slate-400 text-xs mt-0.5">{cls.department}</p>
        </div>
        {isPending && (
          <span className="ml-2 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
            Pending
          </span>
        )}
        {isRejected && (
          <span className="ml-2 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            Rejected
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-xs text-slate-400 mb-4">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>{cls.lecturer?.name || 'Unknown Lecturer'}</span>
        </div>
        {cls.academic_year && <p>📅 {cls.academic_year} · Sem {cls.semester}</p>}
        {cls.stream && <p>🏫 {cls.stream}</p>}
        <p className="text-slate-500">{enrolled}/{maxStudents} enrolled</p>
      </div>

      {isRejected && cls.rejection_reason && (
        <p className="text-red-400/80 text-xs mb-3 italic">Reason: {cls.rejection_reason}</p>
      )}

      {isPending ? (
        <button
          id={`cancel-request-${cls.id}`}
          onClick={onCancel}
          disabled={cancelling}
          className="w-full py-2 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          Cancel Request
        </button>
      ) : (
        <button
          id={`request-join-${cls.id}`}
          onClick={onRequest}
          className="w-full py-2 text-xs font-medium bg-indigo-500/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-transparent rounded-xl transition-colors flex items-center justify-center gap-2">
          <Plus className="w-3.5 h-3.5" />
          {isRejected ? 'Request Again' : 'Request to Join'}
        </button>
      )}
    </div>
  );
}
