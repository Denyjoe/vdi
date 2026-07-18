import { useState, useEffect, useRef } from 'react';
import { Search, Download, MoreVertical, X, Users } from 'lucide-react';
import api from '../../services/api';
import useBreakpoint from '../../hooks/useBreakpoint';
import { toast } from 'react-hot-toast';

function UserActionsMenu({ user, onSuspend, onReactivate, onViewDetail, onResetPassword }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  const menuItemStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: '12px',
    color: 'var(--text-primary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          padding: '6px',
          borderRadius: '8px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}>
        <MoreVertical size={16} />
      </button>
      
      {open && (
        <div style={{
          position: 'absolute',
          right: 0, top: '100%',
          marginTop: '4px',
          width: '180px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          zIndex: 20,
        }}>
          <button onClick={(e) => { e.stopPropagation(); onViewDetail(); setOpen(false); }}
            style={{ ...menuItemStyle, borderBottom: '1px solid var(--border-color)' }}>
            View Details
          </button>
          {user.role !== 'admin' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onResetPassword(); setOpen(false); }}
                style={menuItemStyle}>
                Trigger Password Reset
              </button>
              {user.is_suspended ? (
                <button onClick={(e) => { e.stopPropagation(); onReactivate(); setOpen(false); }}
                  style={{
                    ...menuItemStyle,
                    color: 'var(--status-online)'
                  }}>
                  Reactivate User
                </button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); onSuspend(); setOpen(false); }}
                  style={{
                    ...menuItemStyle,
                    color: 'var(--status-error)'
                  }}>
                  Suspend User
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function UserDetailDrawer({ userId, onClose, onSuspend, onReactivate }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.get(`/users/admin/${userId}/detail/`)
      .then(res => setDetail(res.data))
      .catch(e => {
        console.error(e);
        toast.error("Failed to load user details");
      })
      .finally(() => setLoading(false));
  }, [userId]);
  
  return (
    <>
      <div style={{
        position: 'fixed', inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.5)',
      }} onClick={onClose} />
      
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        zIndex: 61,
        width: '420px',
        maxWidth: '100%',
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border-color)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        overflowY: 'auto',
        animation: 'slideInRight 0.25s ease-out',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading details...
          </div>
        ) : detail && (
          <>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              position: 'sticky',
              top: 0,
              background: 'var(--bg-card)',
              zIndex: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {detail.avatar ? (
                  <img src={detail.avatar}
                    style={{
                      width: '48px', height: '48px',
                      borderRadius: '50%', objectFit: 'cover',
                    }} alt="" />
                ) : (
                  <div style={{
                    width: '48px', height: '48px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: 700,
                    color: 'var(--accent-primary)',
                  }}>
                    {detail.first_name?.[0]}{detail.last_name?.[0]}
                  </div>
                )}
                <div>
                  <h3 style={{
                    color: 'var(--text-primary)',
                    fontSize: '15px', fontWeight: 700, margin: 0
                  }}>
                    {detail.first_name} {detail.last_name}
                  </h3>
                  <p style={{
                    color: 'var(--text-muted)',
                    fontSize: '12px', margin: '4px 0 0 0'
                  }}>
                    {detail.email}
                  </p>
                </div>
              </div>
              <button onClick={onClose}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  padding: '6px',
                  display: 'flex',
                }}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '11px', fontWeight: 600,
                  background: 'var(--accent-primary-soft)',
                  color: 'var(--accent-primary)',
                }}>
                  {detail.role === 'admin' ? 'Admin' : detail.is_host ? 'Host' : 'Free User'}
                </span>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '11px', fontWeight: 600,
                  background: detail.is_suspended ? 'var(--status-error-bg)' : 'var(--status-online-bg)',
                  color: detail.is_suspended ? 'var(--status-error)' : 'var(--status-online)',
                }}>
                  {detail.is_suspended ? 'Suspended' : 'Active'}
                </span>
              </div>
              
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '12px', marginBottom: '24px',
              }}>
                {[
                  { label: 'Hours Used', value: `${detail.usage.hours_used}h` },
                  { label: 'Total Spent', value: `TZS ${detail.usage.total_spent.toLocaleString()}` },
                  { label: 'Workspaces', value: detail.usage.workspace_count },
                  { label: 'Sessions Hosted', value: detail.usage.sessions_hosted },
                ].map(stat => (
                  <div key={stat.label}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                    }}>
                    <p style={{
                      fontSize: '10px', textTransform: 'uppercase',
                      color: 'var(--text-muted)', marginBottom: '4px', margin: 0
                    }}>
                      {stat.label}
                    </p>
                    <p style={{
                      fontSize: '18px', fontWeight: 700,
                      color: 'var(--text-primary)', margin: 0
                    }}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
              
              <h4 style={{
                fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px',
                color: 'var(--text-muted)', fontWeight: 600, marginBottom: '10px', margin: '0 0 10px 0'
              }}>
                Recent Workspaces
              </h4>
              {detail.workspaces && detail.workspaces.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  {detail.workspaces.map(ws => (
                    <div key={ws.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--border-color)',
                        fontSize: '12px',
                      }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {ws.name}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {ws.template}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{
                  fontSize: '12px', color: 'var(--text-faint)', marginBottom: '24px',
                }}>
                  No workspaces created
                </p>
              )}
              
              {detail.role !== 'admin' && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                  {detail.is_suspended ? (
                    <button onClick={() => { onReactivate(detail.id); onClose(); }}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px',
                        background: 'var(--status-online-bg)',
                        color: 'var(--status-online)',
                        border: '1px solid var(--status-online)',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      }}>
                      Reactivate User
                    </button>
                  ) : (
                    <button onClick={() => { onSuspend(detail.id); onClose(); }}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px',
                        background: 'var(--status-error-bg)',
                        color: 'var(--status-error)',
                        border: '1px solid var(--status-error)',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      }}>
                      Suspend User
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function AdminUsersPage() {
  const { isMobile } = useBreakpoint();
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ all: 0, free: 0, hosts: 0, admins: 0, active: 0, suspended: 0 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('-date_joined');
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  
  const fetchUsers = () => {
    const params = new URLSearchParams({ search, role: roleFilter, status: statusFilter, sort });
    api.get(`/users/admin/?${params.toString()}`)
      .then(res => {
        setUsers(res.data.users || []);
        if (res.data.counts) setCounts(res.data.counts);
        setSelectedIds([]);
      })
      .catch(e => console.error(e));
  };
  
  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, statusFilter, sort]);
  
  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('dit_access_token');
      const baseUrl = api.defaults.baseURL || 'http://localhost:8000/api';
      const response = await fetch(`${baseUrl}/users/admin/export/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clouddesk_users_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch(e) {
      console.error('Export failed:', e);
      toast.error('Failed to export users: ' + e.message);
    }
  };
  
  const handleBulkAction = async (action) => {
    if (!window.confirm(`Are you sure you want to ${action} ${selectedIds.length} user(s)?`)) return;
    try {
      const res = await api.post('/users/admin/bulk/', { user_ids: selectedIds, action });
      toast.success(res.data.message || 'Action applied');
      fetchUsers();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    }
  };
  
  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(users.map(u => u.id));
    else setSelectedIds([]);
  };
  
  const toggleSelectUser = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  const handleSuspend = (userId) => {
    const reason = prompt('Reason for suspension (optional):');
    if (reason === null) return;
    api.post(`/users/admin/${userId}/suspend/`, { reason: reason || '' })
      .then(res => {
        toast.success(res.data.message);
        fetchUsers();
        if (selectedUserDetail === userId) setSelectedUserDetail(null);
      })
      .catch(e => toast.error('Failed: ' + (e.response?.data?.message || e.message)));
  };
  
  const handleReactivate = (userId) => {
    if (!window.confirm('Reactivate this user?')) return;
    api.post(`/users/admin/${userId}/reactivate/`)
      .then(res => {
        toast.success(res.data.message);
        fetchUsers();
      })
      .catch(e => toast.error('Failed: ' + (e.response?.data?.message || e.message)));
  };
  
  const handleTriggerReset = (userId) => {
    if (!window.confirm('Trigger a password reset for this user?')) return;
    api.post(`/users/admin/${userId}/trigger-reset/`)
      .then(res => {
        toast.success(res.data.message);
      })
      .catch(e => toast.error('Failed: ' + (e.response?.data?.message || e.message)));
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  return (
    <div style={{ padding: '24px' }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '20px',
      }}>
        <div>
          <h1 style={{
            color: 'var(--text-primary)',
            fontSize: '24px',
            fontWeight: 700,
            margin: 0
          }}>User Management</h1>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '13px',
            marginTop: '4px',
          }}>
            Manage platform users and subscriptions
          </p>
        </div>
        <button onClick={handleExportCSV}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '10px',
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer'
          }}>
          <Download size={14} /> Export CSV
        </button>
      </div>
      
      {/* Search + Sort row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{
            position: 'absolute', left: '14px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-faint)',
          }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            style={{
              width: '100%', padding: '10px 14px 10px 38px', borderRadius: '10px',
              border: '1px solid var(--border-color)', background: 'var(--bg-input)',
              color: 'var(--text-primary)', fontSize: '13px',
            }}
          />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)',
            background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px',
            cursor: 'pointer'
          }}>
          <option value="-date_joined">Newest First</option>
          <option value="date_joined">Oldest First</option>
          <option value="first_name">Name (A-Z)</option>
        </select>
      </div>
      
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'free', label: 'Free Users', count: counts.free },
          { key: 'host', label: 'Hosts', count: counts.hosts },
          { key: 'admin', label: 'Admins', count: counts.admins },
        ].map(f => (
          <button key={f.key} onClick={() => setRoleFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
              border: roleFilter === f.key ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: roleFilter === f.key ? 'var(--accent-primary-soft)' : 'var(--bg-card)',
              color: roleFilter === f.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}>
            {f.label} <span style={{ opacity: 0.6, marginLeft: '4px' }}>{f.count}</span>
          </button>
        ))}
        
        <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 4px' }} />
        
        {[
          { key: 'all', label: 'Any Status' },
          { key: 'active', label: 'Active' },
          { key: 'suspended', label: 'Suspended' },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
              border: statusFilter === f.key ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: statusFilter === f.key ? 'var(--accent-primary-soft)' : 'var(--bg-card)',
              color: statusFilter === f.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}>
            {f.label}
          </button>
        ))}
      </div>
      
      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 20px', borderRadius: '12px',
          background: 'var(--accent-primary-soft)', border: '1px solid var(--accent-primary)',
          marginBottom: '16px',
        }}>
          <span style={{ color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 600 }}>
            {selectedIds.length} selected
          </span>
          <button onClick={() => handleBulkAction('suspend')}
            style={{
              padding: '6px 14px', borderRadius: '8px', background: 'var(--status-error-bg)',
              color: 'var(--status-error)', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}>
            Suspend Selected
          </button>
          <button onClick={() => handleBulkAction('reactivate')}
            style={{
              padding: '6px 14px', borderRadius: '8px', background: 'var(--status-online-bg)',
              color: 'var(--status-online)', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}>
            Reactivate Selected
          </button>
          <button onClick={() => handleBulkAction('make_host')}
            style={{
              padding: '6px 14px', borderRadius: '8px', background: 'var(--bg-card)',
              color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}>
            Make Host
          </button>
          <button onClick={() => setSelectedIds([])}
            style={{
              marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '12px',
              background: 'none', border: 'none', cursor: 'pointer'
            }}>
            Clear
          </button>
        </div>
      )}
      
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: isMobile ? 'none' : '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {users.length > 0 ? users.map(u => (
              <div key={u.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'var(--bg-card)' }}
                onClick={(e) => {
                  if (e.target.type !== 'checkbox' && !e.target.closest('button'))
                    setSelectedUserDetail(u.id);
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleSelectUser(u.id)} />
                    {u.avatar ? (
                      <img src={u.avatar} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {u.first_name?.[0]}{u.last_name?.[0]}
                      </div>
                    )}
                    <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>{u.first_name} {u.last_name}</span>
                    {u.role === 'admin' && <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--status-info-bg)', color: 'var(--status-info)' }}>ADMIN</span>}
                    {u.is_host && u.role !== 'admin' && <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)' }}>HOST</span>}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: u.is_suspended ? 'var(--status-error-bg)' : 'var(--status-online-bg)', color: u.is_suspended ? 'var(--status-error)' : 'var(--status-online)' }}>
                    {u.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>Email:</span> {u.email}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>Plan:</span> {u.subscription?.plan_name ? u.subscription.plan_name.replace('_', ' ') : 'Free'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 600 }}>Joined:</span> {formatDate(u.date_joined)}
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-card)' }}>
                <Users size={32} style={{ color: 'var(--text-faint)', margin: '0 auto 12px auto' }} />
                <h3 style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 600 }}>No users found</h3>
              </div>
            )}
          </div>
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                <th style={{ width: '40px', padding: '12px 16px' }}>
                  <input type="checkbox"
                    checked={selectedIds.length === users.length && users.length > 0}
                    onChange={toggleSelectAll} 
                    style={{ cursor: 'pointer' }}/>
                </th>
                {['Name', 'Email', 'Plan', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{
                    textAlign: h === 'Actions' ? 'right' : 'left',
                    padding: '12px 16px', fontSize: '10px', textTransform: 'uppercase',
                    letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? users.map(u => (
                <tr key={u.id} style={{
                  borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={(e) => {
                  if (e.target.type !== 'checkbox' && !e.target.closest('button'))
                    setSelectedUserDetail(u.id);
                }}>
                  <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox"
                      checked={selectedIds.includes(u.id)}
                      onChange={() => toggleSelectUser(u.id)} 
                      style={{ cursor: 'pointer' }}/>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {u.avatar ? (
                        <img src={u.avatar} 
                          style={{
                            width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover',
                          }} alt=""
                          onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'var(--accent-primary-soft)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)',
                        }}>
                          {u.first_name?.[0]}{u.last_name?.[0]}
                        </div>
                      )}
                      <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>
                        {u.first_name} {u.last_name}
                      </span>
                      {u.role === 'admin' && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '2px 6px',
                          borderRadius: '4px', background: 'var(--status-info-bg)', color: 'var(--status-info)',
                        }}>
                          ADMIN
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {u.email}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {u.plan || 'Free'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700,
                      textTransform: 'uppercase',
                      background: u.is_suspended ? 'var(--status-error-bg)' : 'var(--status-online-bg)',
                      color: u.is_suspended ? 'var(--status-error)' : 'var(--status-online)',
                    }}>
                      {u.is_suspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatDate(u.date_joined)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <UserActionsMenu user={u} 
                      onSuspend={() => handleSuspend(u.id)}
                      onReactivate={() => handleReactivate(u.id)}
                      onViewDetail={() => setSelectedUserDetail(u.id)}
                      onResetPassword={() => handleTriggerReset(u.id)}
                    />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-faint)' }}>
                    <Users size={32} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                    No users found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
      
      {selectedUserDetail && (
        <UserDetailDrawer 
          userId={selectedUserDetail}
          onClose={() => setSelectedUserDetail(null)}
          onSuspend={handleSuspend}
          onReactivate={handleReactivate}
        />
      )}
    </div>
  );
}
