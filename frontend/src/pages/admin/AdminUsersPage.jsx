import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, X, Mail, Calendar, Activity, CheckCircle, AlertCircle, Shield, ShieldOff, Eye } from 'lucide-react';
import api from '../../services/api';

const ROLE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'free', label: 'Free Users' },
  { key: 'host', label: 'Hosts' },
  { key: 'admin', label: 'Admins' },
];

const PLAN_BADGES = {
  free: 'bg-[var(--bg-card-hover)]/50 text-[var(--text-secondary)] border-slate-600/50',
  personal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pro: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  institution: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-medium ${
      type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100' : 'bg-red-900/90 border-red-500/40 text-red-100'
    }`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
      {message}
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
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/admin/list/');
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

  useEffect(() => { fetchUsers(); }, []);

  const roleCounts = useMemo(() => {
    const counts = { all: users.length, free: 0, host: 0, admin: 0 };
    users.forEach((u) => {
      if (u.role === 'admin') counts.admin++;
      else if (u.is_host) counts.host++;
      else counts.free++;
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      let matchesRole = false;
      if (activeTab === 'all') matchesRole = true;
      if (activeTab === 'free') matchesRole = !u.is_host && u.role !== 'admin';
      if (activeTab === 'host') matchesRole = u.is_host && u.role !== 'admin';
      if (activeTab === 'admin') matchesRole = u.role === 'admin';

      const query = searchQuery.toLowerCase();
      const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
      const matchesSearch = !query || fullName.includes(query) || u.email.toLowerCase().includes(query);
      
      return matchesRole && matchesSearch;
    });
  }, [users, activeTab, searchQuery]);

  const handleToggleAdmin = async (userId, currentRole) => {
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      // Assume endpoint for updating user exists, or we mock it
      // const res = await api.patch(`/admin/users/${userId}/`, { role: newRole });
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => ({ ...prev, role: newRole }));
      }
      showToast(`User role updated to ${newRole.toUpperCase()}`);
    } catch (err) {
      showToast('Failed to update user role', 'error');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getPlanDetails = (user) => {
    if (user.role === 'admin') return { name: 'Admin', key: 'pro' };
    if (!user.is_host) return { name: 'Free', key: 'free' };
    if (user.host_plan === 'pro') return { name: 'Pro Host', key: 'pro' };
    if (user.host_plan === 'institution') return { name: 'Institution', key: 'institution' };
    return { name: 'Personal Host', key: 'personal' };
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Activity className="animate-spin text-indigo-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">User Management</h2>
        <p className="text-[var(--text-secondary)] mt-1">Manage platform users and subscriptions</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1 bg-[var(--bg-card)] p-1 rounded-lg border border-[var(--border-color)]">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
              }`}>
              {tab.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.key ? 'bg-indigo-500/30 text-indigo-100' : 'bg-[var(--bg-card-hover)] text-[var(--text-secondary)]'
              }`}>
                {roleCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50">
                <th className="text-left px-6 py-4 text-[var(--text-secondary)] font-medium">Name</th>
                <th className="text-left px-6 py-4 text-[var(--text-secondary)] font-medium">Email</th>
                <th className="text-left px-6 py-4 text-[var(--text-secondary)] font-medium">Plan</th>
                <th className="text-center px-6 py-4 text-[var(--text-secondary)] font-medium">Host Status</th>
                <th className="text-left px-6 py-4 text-[var(--text-secondary)] font-medium">Joined</th>
                <th className="text-right px-6 py-4 text-[var(--text-secondary)] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const plan = getPlanDetails(u);
                  return (
                    <tr key={u.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-card-hover)]/30 transition-colors">
                      <td className="px-6 py-4 text-[var(--text-primary)] font-medium">{u.first_name} {u.last_name}</td>
                      <td className="px-6 py-4 text-[var(--text-primary)]">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PLAN_BADGES[plan.key]}`}>
                          {plan.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {u.is_host || u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">
                        {formatDate(u.created_at || u.date_joined)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="p-1.5 bg-[var(--bg-card-hover)]/50 hover:bg-slate-600 text-[var(--text-primary)] rounded-lg transition-colors border border-slate-600/50"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleAdmin(u.id, u.role)}
                            className={`p-1.5 rounded-lg transition-colors border ${
                              u.role === 'admin' 
                                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' 
                                : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20'
                            }`}
                            title={u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                          >
                            {u.role === 'admin' ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-secondary)]">
                    <Users className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                    No users match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-xl font-bold text-[var(--text-primary)]">
                  {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                </div>
                <div>
                  <p className="text-xl font-bold text-[var(--text-primary)]">{selectedUser.first_name} {selectedUser.last_name}</p>
                  <p className="text-[var(--text-secondary)] text-sm">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4 border border-[var(--border-color)]/50">
                  <p className="text-xs text-[var(--text-secondary)] mb-1">Plan</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{getPlanDetails(selectedUser).name}</p>
                </div>
                <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4 border border-[var(--border-color)]/50">
                  <p className="text-xs text-[var(--text-secondary)] mb-1">Joined</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{formatDate(selectedUser.created_at || selectedUser.date_joined)}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end bg-[var(--bg-primary)]/30">
              <button onClick={() => setSelectedUser(null)} className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] bg-[var(--bg-card-hover)] hover:bg-slate-600 rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
