import React, { useState, useEffect } from 'react';
import { HardDrive, Search, RefreshCw } from 'lucide-react';
import api from '../../services/api';

function formatTimeAgo(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState([]);
  const [counts, setCounts] = useState({
    all: 0, running: 0, stopped: 0, error: 0, provisioning: 0
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkspaces = async () => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      
      const res = await api.get(`/admin/workspaces/?${params.toString()}`);
      setWorkspaces(res.data.workspaces || []);
      setCounts(res.data.counts || counts);
    } catch(e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [search, statusFilter]);

  const handleForceStop = async (id) => {
    if (!window.confirm('Stop this workspace? The user will be disconnected.')) return;
    try {
      await api.post(`/admin/workspaces/${id}/force-stop/`);
      fetchWorkspaces();
    } catch(e) {
      alert('Failed: ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this workspace? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/workspaces/${id}/`);
      fetchWorkspaces();
    } catch(e) {
      alert('Failed: ' + e.message);
    }
  };

  const handleBulkAction = async (action) => {
    const label = action === 'stop' ? 'stop' : 'permanently delete';
    if (!window.confirm(`Are you sure you want to ${label} ${selectedIds.length} workspace(s)?`)) return;
    try {
      await api.post('/admin/workspaces/bulk/', {
        workspace_ids: selectedIds,
        action,
      });
      setSelectedIds([]);
      fetchWorkspaces();
    } catch(e) {
      alert('Failed: ' + e.message);
    }
  };

  const toggleSelectWs = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.length === workspaces.length && workspaces.length > 0
        ? []
        : workspaces.map(w => w.id)
    );
  };

  return (
    <div style={{ padding: '24px' }}>
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
          }}>Workspaces & VMs</h1>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '13px',
            marginTop: '4px',
          }}>
            Global view of all workspaces across the platform
          </p>
        </div>
        <button onClick={fetchWorkspaces}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
          }}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>
      
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <Search size={14} style={{
          position: 'absolute',
          left: '14px', top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-faint)',
        }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by workspace name, owner name, or email..."
          style={{
            width: '100%',
            padding: '10px 14px 10px 38px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: '13px',
          }}
        />
      </div>
      
      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'active', label: 'Running', count: counts.running },
          { key: 'stopped', label: 'Stopped', count: counts.stopped },
          { key: 'provisioning', label: 'Provisioning', count: counts.provisioning },
          { key: 'error', label: 'Error', count: counts.error },
        ].map(f => (
          <button key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              border: statusFilter === f.key ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: statusFilter === f.key ? 'var(--accent-primary-soft)' : 'var(--bg-card)',
              color: statusFilter === f.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}>
            {f.label} 
            <span style={{ opacity: 0.6, marginLeft: '4px' }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px',
          borderRadius: '12px', background: 'var(--accent-primary-soft)',
          border: '1px solid var(--accent-primary)', marginBottom: '16px',
        }}>
          <span style={{ color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 600 }}>
            {selectedIds.length} selected
          </span>
          <button onClick={() => handleBulkAction('stop')}
            style={{
              padding: '6px 14px', borderRadius: '8px', background: 'var(--status-warning-bg)',
              color: 'var(--status-warning)', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}>
            Stop Selected
          </button>
          <button onClick={() => handleBulkAction('delete')}
            style={{
              padding: '6px 14px', borderRadius: '8px', background: 'var(--status-error-bg)',
              color: 'var(--status-error)', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}>
            Delete Selected
          </button>
          <button onClick={() => setSelectedIds([])}
            style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
            Clear
          </button>
        </div>
      )}

      {/* Workspaces Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            <th style={{ width: '40px', padding: '10px 16px', textAlign: 'left' }}>
              <input type="checkbox"
                checked={selectedIds.length === workspaces.length && workspaces.length > 0}
                onChange={toggleSelectAll} />
            </th>
            {['Workspace', 'Owner', 'Template', 'IP Address', 'Status', 'Created', 'Actions'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '10px 16px', fontSize: '10px', textTransform: 'uppercase',
                letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workspaces.map(ws => (
            <tr key={ws.id} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
              onClick={(e) => {
                if (e.target.type !== 'checkbox' && !e.target.closest('button'))
                  setSelectedDetail(ws.id);
              }}>
              <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selectedIds.includes(ws.id)} onChange={() => toggleSelectWs(ws.id)} />
              </td>
              <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                {ws.name}
              </td>
              <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <div>
                  <p>{ws.owner_name}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-faint)' }}>{ws.owner_email}</p>
                </div>
              </td>
              <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <div>
                  <p>{ws.template_name}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-faint)' }}>{ws.template_specs}</p>
                </div>
              </td>
              <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                {ws.ip_address || '—'}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                  background: ws.status === 'active' || ws.status === 'running' ? 'var(--status-online-bg)' :
                              ws.status === 'error' ? 'var(--status-error-bg)' :
                              ws.status === 'provisioning' ? 'var(--status-info-bg)' : 'var(--status-warning-bg)',
                  color: ws.status === 'active' || ws.status === 'running' ? 'var(--status-online)' :
                         ws.status === 'error' ? 'var(--status-error)' :
                         ws.status === 'provisioning' ? 'var(--status-info)' : 'var(--status-warning)',
                }}>
                  {ws.status}
                </span>
              </td>
              <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {formatTimeAgo(ws.created_at)}
              </td>
              <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(ws.status === 'active' || ws.status === 'running') && (
                    <button onClick={() => handleForceStop(ws.id)}
                      style={{ padding: '5px 10px', borderRadius: '6px', background: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
                      Stop
                    </button>
                  )}
                  <button onClick={() => handleDelete(ws.id)}
                    style={{ padding: '5px 10px', borderRadius: '6px', background: 'var(--status-error-bg)', color: 'var(--status-error)', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {workspaces.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <HardDrive size={28} style={{ color: 'var(--text-faint)', marginBottom: '10px', margin: '0 auto' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No workspaces found</p>
        </div>
      )}
    </div>
  );
}
