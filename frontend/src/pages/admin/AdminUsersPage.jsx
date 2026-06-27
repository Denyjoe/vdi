/**
 * AdminUsersPage — comprehensive user management + class management for admins.
 *
 * Features:
 *   - Two top-level tabs: "Users" and "Classes"
 *   - Users tab: search/filter, role tabs, user detail modal, activate/deactivate
 *   - Classes tab: list all classes, expandable rows with enrolled students,
 *     create new class (for any lecturer), enroll student directly
 *
 * Data sources:
 *   - GET /api/admin/users/                    → user list
 *   - POST /api/admin/users/:id/activate/      → activate user
 *   - POST /api/admin/users/:id/deactivate/    → deactivate user
 *   - GET /api/admin/classes/                  → all classes
 *   - POST /api/admin/classes/create/          → create class
 *   - POST /api/admin/classes/:id/enroll/      → enroll student
 *
 * @returns {JSX.Element}
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Search, X, Shield, GraduationCap, BookOpen,
  Calendar, Mail, Hash, Building, Activity, Plus,
  ChevronDown, ChevronUp, CheckCircle, Loader2, AlertCircle, UserPlus, FileText, Check, Settings
} from 'lucide-react';
import api from '../../services/api';
import { classService } from '../../services/classService';
import CreateOfficialClassModal from '../../components/admin/CreateOfficialClassModal';
import AssignLecturerModal from '../../components/admin/AssignLecturerModal';

/** Role filter tabs definition */
const ROLE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'student', label: 'Students' },
  { key: 'lecturer', label: 'Lecturers' },
  { key: 'admin', label: 'Admins' },
];

/** Badge color mapping for user roles */
const ROLE_BADGE_CLASSES = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  lecturer: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  student: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

/** Page-level toast notification */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-medium ${
      type === 'success'
        ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100'
        : 'bg-red-900/90 border-red-500/40 text-red-100'
    }`}>
      {type === 'success'
        ? <CheckCircle className="w-4 h-4 text-emerald-400" />
        : <AlertCircle className="w-4 h-4 text-red-400" />}
      {message}
    </div>
  );
}

/** ClassesTab — admin view of all classes */
function ClassesTab({ allUsers, showToast }) {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assigningClass, setAssigningClass] = useState(null);
  
  const [enrollingClass, setEnrollingClass] = useState(null);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [autoEnrolling, setAutoEnrolling] = useState(false);
  const [classTab, setClassTab] = useState('official');

  const lecturers = useMemo(() => allUsers.filter(u => u.role === 'lecturer'), [allUsers]);
  const students = useMemo(() => allUsers.filter(u => u.role === 'student'), [allUsers]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await classService.getAllClasses();
      if (res.data.success) setClasses(res.data.data);
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const handleClassCreated = (newClass) => {
    setClasses(prev => [newClass, ...prev]);
    setShowCreateModal(false);
    showToast(`Class "${newClass.name}" created.`);
  };

  const handleLecturerAssigned = (updatedClass) => {
    setClasses(prev => prev.map(c => c.id === updatedClass.id ? updatedClass : c));
    setAssigningClass(null);
    showToast(`Lecturer assigned to "${updatedClass.name}".`);
  };

  const handleEnroll = async (classId) => {
    if (!enrollStudentId) { showToast('Select a student first.', 'error'); return; }
    setEnrolling(true);
    try {
      const res = await classService.adminEnrollStudent(classId, parseInt(enrollStudentId, 10));
      if (res.data.success) {
        showToast('Student enrolled successfully.');
        setEnrollingClass(null);
        setEnrollStudentId('');
        fetchClasses();
      } else {
        showToast(res.data.message || 'Failed to enroll student.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to enroll student.', 'error');
    } finally { setEnrolling(false); }
  };

  const handleAutoEnroll = async (cls) => {
    setAutoEnrolling(true);
    try {
      const res = await api.post(`/admin/classes/${cls.id}/auto-enroll/`);
      if (res.data.success) {
        showToast(res.data.message);
        fetchClasses();
      } else {
        showToast(res.data.message || 'Auto-enroll failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Auto-enroll failed.', 'error');
    } finally {
      setAutoEnrolling(false);
    }
  };
  
  const handleToggleActive = async (cls) => {
    try {
      const res = await api.patch(`/admin/classes/${cls.id}/`, { is_active: !cls.is_active });
      if (res.data.success) {
        setClasses(prev => prev.map(c => c.id === cls.id ? res.data.data : c));
        showToast(`Class marked as ${!cls.is_active ? 'Active' : 'Inactive'}`);
      }
    } catch (err) {
      showToast('Failed to toggle class status', 'error');
    }
  };

  const filteredClasses = classes.filter(c => c.class_type === classTab || (!c.class_type && classTab === 'working_group')); // Fallback for old ones

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2 bg-slate-900/50 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setClassTab('official')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              classTab === 'official' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}>
            Official Classes
          </button>
          <button
            onClick={() => setClassTab('working_group')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              classTab === 'working_group' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}>
            Working Groups
          </button>
        </div>
        
        {classTab === 'official' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Create Official Class
          </button>
        )}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        {filteredClasses.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="font-medium">No {classTab === 'official' ? 'official classes' : 'working groups'} found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4">Class Name</th>
                  {classTab === 'official' && <th className="px-6 py-4">Programme & Year</th>}
                  {classTab === 'working_group' && <th className="px-6 py-4">Created By</th>}
                  <th className="px-6 py-4">Students</th>
                  <th className="px-6 py-4">Lecturer</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((cls) => (
                  <React.Fragment key={cls.id}>
                    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{cls.name}</td>
                      
                      {classTab === 'official' && (
                        <td className="px-6 py-4">
                          <span className="text-slate-400">{cls.department || 'N/A'}</span>
                          <div className="text-xs text-slate-500 mt-1">Yr {cls.year_of_study || '-'} | Sem {cls.semester || '-'}</div>
                        </td>
                      )}
                      
                      {classTab === 'working_group' && (
                        <td className="px-6 py-4 text-slate-400">{cls.created_by_name || 'N/A'}</td>
                      )}
                      
                      <td className="px-6 py-4">
                        <span className="font-medium text-blue-400">{cls.enrolled_count ?? 0}</span>
                        <span className="text-slate-500"> / {cls.max_students ?? 60}</span>
                      </td>
                      
                      <td className="px-6 py-4">
                        {cls.lecturer ? (
                           <span className="text-slate-300">{cls.lecturer.name || cls.lecturer.email}</span>
                        ) : (
                           <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => handleToggleActive(cls)} title="Toggle Active">
                           <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                        </button>
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setExpanded(expanded === cls.id ? null : cls.id)}
                            className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-colors border border-blue-500/20"
                          >
                            View Students
                          </button>
                          
                          {classTab === 'official' && (
                            <button
                              onClick={() => setAssigningClass(cls)}
                              className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium transition-colors border border-purple-500/20"
                            >
                              Assign Lecturer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Students Row */}
                    {expanded === cls.id && (
                      <tr>
                        <td colSpan={7} className="px-6 py-5 bg-slate-900/30 border-b border-slate-700/50">
                          <div className="flex items-end justify-between mb-4">
                             <div>
                                <h4 className="text-sm font-medium text-white mb-1">Manage Enrollments</h4>
                                <p className="text-xs text-slate-400">Enroll students manually {classTab === 'official' && 'or auto-enroll matching students.'}</p>
                             </div>
                             
                             {classTab === 'official' && (
                                <button 
                                  onClick={() => handleAutoEnroll(cls)}
                                  disabled={autoEnrolling}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                  {autoEnrolling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />}
                                  Auto-enroll matching students
                                </button>
                             )}
                          </div>
                          
                          <div className="flex gap-3 items-end p-4 bg-slate-800 rounded-xl border border-slate-700">
                            <div className="flex-1">
                              <label className="block text-xs text-slate-400 mb-1.5">Select Student to Enroll</label>
                              <select
                                value={enrollStudentId}
                                onChange={(e) => setEnrollStudentId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">— Choose student —</option>
                                {students.map(s => (
                                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.email})</option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => handleEnroll(cls.id)}
                              disabled={enrolling || !enrollStudentId}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 h-[38px]">
                              {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                              Manual Enroll
                            </button>
                            <button onClick={() => setExpanded(null)} className="px-3 py-2 text-slate-400 hover:text-white text-sm rounded-lg transition-colors bg-slate-700 h-[38px]">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateOfficialClassModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleClassCreated}
        />
      )}
      
      {assigningClass && (
        <AssignLecturerModal
          classItem={assigningClass}
          lecturers={lecturers}
          onClose={() => setAssigningClass(null)}
          onAssigned={handleLecturerAssigned}
        />
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [togglingUser, setTogglingUser] = useState(null);
  const [pageTab, setPageTab] = useState('users'); // 'users' | 'classes'
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  /**
   * Fetches the full user list from the backend.
   */
  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users/');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (err) {
      setError('Failed to load users. Please try again.');
      console.error('AdminUsersPage fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  /**
   * Counts users per role for the tab badges.
   */
  const roleCounts = useMemo(() => {
    const counts = { all: users.length, student: 0, lecturer: 0, admin: 0 };
    users.forEach((u) => {
      if (counts[u.role] !== undefined) counts[u.role]++;
    });
    return counts;
  }, [users]);

  /**
   * Filters users by the active role tab and search query.
   */
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = activeTab === 'all' || u.role === activeTab;
      const query = searchQuery.toLowerCase();
      const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        u.email.toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [users, activeTab, searchQuery]);

  /**
   * Toggles a user's active status via the backend API.
   */
  const handleToggleActive = async (userId, currentlyActive) => {
    setTogglingUser(userId);
    try {
      const endpoint = currentlyActive
        ? `/admin/users/${userId}/deactivate/`
        : `/admin/users/${userId}/activate/`;
      const response = await api.post(endpoint);
      if (response.data.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, is_active: !currentlyActive } : u
          )
        );
        if (selectedUser?.id === userId) {
          setSelectedUser((prev) => ({ ...prev, is_active: !currentlyActive }));
        }
      }
    } catch (err) {
      console.error('Failed to toggle user status:', err);
    } finally {
      setTogglingUser(null);
    }
  };

  /**
   * Formats an ISO date string to a readable format.
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Activity className="animate-spin text-blue-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">System Management</h2>
        <p className="text-slate-400 mt-1">Manage users, classes, and enrollments</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Page-level tabs: Users | Classes */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setPageTab('users')}
          className={`flex items-center gap-2 py-3 px-4 mr-2 text-sm font-medium border-b-2 transition-colors ${
            pageTab === 'users' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}>
          <Users className="w-4 h-4" /> Users
          <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">{users.length}</span>
        </button>
        <button
          onClick={() => setPageTab('classes')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            pageTab === 'classes' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}>
          <GraduationCap className="w-4 h-4" /> Classes
        </button>
      </div>

      {pageTab === 'users' && (
        <>
          {/* Search + Role Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
              {ROLE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}>
                  {tab.label}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-blue-500/30 text-blue-100' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {roleCounts[tab.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Name</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Email</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Role</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium hidden sm:table-cell">Joined</th>
                    <th className="text-center px-6 py-4 text-slate-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors">
                        <td className="px-6 py-4 text-white font-medium">{u.first_name} {u.last_name}</td>
                        <td className="px-6 py-4 text-slate-300">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_BADGE_CLASSES[u.role] || ROLE_BADGE_CLASSES.student}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 hidden sm:table-cell">
                          {formatDate(u.created_at || u.date_joined)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-full ${u.is_active !== false ? 'bg-emerald-500' : 'bg-red-500'}`}
                            title={u.is_active !== false ? 'Active' : 'Inactive'}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        <Users className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                        No users match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {pageTab === 'classes' && (
        <ClassesTab allUsers={users} showToast={showToast} />
      )}

      {/* ── User Detail Modal ─────────────────────────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white transition-colors p-1" aria-label="Close modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-700 rounded-full flex items-center justify-center text-xl font-bold text-white">
                  {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{selectedUser.first_name} {selectedUser.last_name}</p>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_BADGE_CLASSES[selectedUser.role] || ROLE_BADGE_CLASSES.student}`}>
                    {selectedUser.role}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={selectedUser.email} />
                {selectedUser.department && <InfoRow icon={<Building className="w-4 h-4" />} label="Department" value={selectedUser.department} />}
                {selectedUser.student_id && <InfoRow icon={<Hash className="w-4 h-4" />} label="Student ID" value={selectedUser.student_id} />}
                {selectedUser.year && <InfoRow icon={<GraduationCap className="w-4 h-4" />} label="Year / Stream" value={`${selectedUser.year} ${selectedUser.stream || ''}`} />}
                <InfoRow icon={<Calendar className="w-4 h-4" />} label="Account Created" value={formatDate(selectedUser.created_at || selectedUser.date_joined)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 text-center">
                  <p className="text-2xl font-bold text-blue-400">{selectedUser.vm_count ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Total VMs Created</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 text-center">
                  <p className="text-2xl font-bold text-purple-400">{selectedUser.session_count ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Total Sessions</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                <div>
                  <p className="text-white font-medium text-sm">Account Active</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {selectedUser.is_active !== false
                      ? 'This user can log in and use the system.'
                      : 'This user is blocked from accessing the system.'}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleActive(selectedUser.id, selectedUser.is_active !== false)}
                  disabled={togglingUser === selectedUser.id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    selectedUser.is_active !== false ? 'bg-emerald-500' : 'bg-slate-600'
                  } ${togglingUser === selectedUser.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-label="Toggle user active status">
                  <span className={`inline-block w-4 h-4 transform rounded-full bg-white transition-transform ${selectedUser.is_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
              <button onClick={() => setSelectedUser(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/**
 * InfoRow — renders a single label/value pair with an icon.
 */
function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-slate-400">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-white">{value}</p>
      </div>
    </div>
  );
}
