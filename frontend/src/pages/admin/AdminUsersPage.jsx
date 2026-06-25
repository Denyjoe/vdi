/**
 * AdminUsersPage — comprehensive user management page for admins.
 *
 * Features:
 *   - Search bar to filter users by name or email (client-side)
 *   - Role filter tabs: All | Students | Lecturers | Admins (with counts)
 *   - Sortable, responsive user table
 *   - Click-to-open user detail modal with full profile, stats, and
 *     activate/deactivate toggle
 *
 * Data sources:
 *   - GET /api/admin/users/                    → user list
 *   - POST /api/admin/users/:id/activate/      → activate user
 *   - POST /api/admin/users/:id/deactivate/    → deactivate user
 *
 * @returns {JSX.Element}
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Users, Search, X, Shield, GraduationCap, BookOpen,
  Calendar, Mail, Hash, Building, Activity
} from 'lucide-react';
import api from '../../services/api';

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [togglingUser, setTogglingUser] = useState(null);

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
   * @returns {Object} Counts keyed by role + 'all'.
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
   * @returns {Array} Filtered user list.
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
   * @param {number} userId - The user to toggle.
   * @param {boolean} currentlyActive - Whether the user is currently active.
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
   * @param {string} dateString - ISO date string.
   * @returns {string} Formatted date.
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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
        <h2 className="text-2xl sm:text-3xl font-bold text-white">User Management</h2>
        <p className="text-slate-400 mt-1">
          {users.length} registered users across the platform
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Role Tabs */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key
                    ? 'bg-blue-500/30 text-blue-100'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
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
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-white font-medium">
                      {u.first_name} {u.last_name}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{u.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                          ROLE_BADGE_CLASSES[u.role] || ROLE_BADGE_CLASSES.student
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 hidden sm:table-cell">
                      {formatDate(u.created_at || u.date_joined)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          u.is_active !== false ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
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

      {/* ── User Detail Modal ─────────────────────────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">User Details</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-white transition-colors p-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-6">
              {/* Name + Role */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-700 rounded-full flex items-center justify-center text-xl font-bold text-white">
                  {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                </div>
                <div>
                  <p className="text-xl font-bold text-white">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </p>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                      ROLE_BADGE_CLASSES[selectedUser.role] || ROLE_BADGE_CLASSES.student
                    }`}
                  >
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              {/* Info rows */}
              <div className="space-y-3">
                <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={selectedUser.email} />
                {selectedUser.department && (
                  <InfoRow icon={<Building className="w-4 h-4" />} label="Department" value={selectedUser.department} />
                )}
                {selectedUser.student_id && (
                  <InfoRow icon={<Hash className="w-4 h-4" />} label="Student ID" value={selectedUser.student_id} />
                )}
                {selectedUser.year && (
                  <InfoRow icon={<GraduationCap className="w-4 h-4" />} label="Year / Stream" value={`${selectedUser.year} ${selectedUser.stream || ''}`} />
                )}
                <InfoRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Account Created"
                  value={formatDate(selectedUser.created_at || selectedUser.date_joined)}
                />
              </div>

              {/* Stats */}
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

              {/* Active toggle */}
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
                  onClick={() =>
                    handleToggleActive(selectedUser.id, selectedUser.is_active !== false)
                  }
                  disabled={togglingUser === selectedUser.id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    selectedUser.is_active !== false ? 'bg-emerald-500' : 'bg-slate-600'
                  } ${togglingUser === selectedUser.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-label="Toggle user active status"
                >
                  <span
                    className={`inline-block w-4 h-4 transform rounded-full bg-white transition-transform ${
                      selectedUser.is_active !== false ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * InfoRow — renders a single label/value pair with an icon.
 *
 * @param {Object} props
 * @param {JSX.Element} props.icon - Lucide icon element.
 * @param {string} props.label - Field label.
 * @param {string} props.value - Field value.
 * @returns {JSX.Element}
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
