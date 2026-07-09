import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Server, Shield, CreditCard, Save, Activity, RefreshCw, X, Lock, Database, Search, Key, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [savingSection, setSavingSection] = useState(null);
  
  // Platform Config
  const [platformConfig, setPlatformConfig] = useState({
    platform_name: 'CloudDesk',
    support_email: 'admin@clouddesk.io',
    allow_registration: true,
    maintenance_mode: false,
    system_announcement: ''
  });

  // Resource Limits
  const [resourceLimits, setResourceLimits] = useState({
    max_vms_per_user: 1,
    max_concurrent_vms: 3,
    vm_provisioning_timeout: 300,
    auto_shutdown_idle: true,
    idle_timeout_mins: 30
  });

  // Infrastructure Status
  const [infraStats, setInfraStats] = useState(null);
  const [testingInfra, setTestingInfra] = useState(false);

  // Plans
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    price_usd: 0,
    price_tzs: 0,
    max_hours: 0,
    max_participants: 0,
    can_host: false
  });

  // Change Password
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: ''
  });

  const [backups, setBackups] = useState([]);
  const [backingUp, setBackingUp] = useState(false);
  const [securityLogs, setSecurityLogs] = useState({ attempts: [], failed_last_24h: 0 });
  const [auditLogs, setAuditLogs] = useState({ logs: [], total: 0, page: 1, total_pages: 1 });
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [apiTokens, setApiTokens] = useState([]);

  useEffect(() => {
    fetchConfig();
    testConnections();
    fetchPlans();
    fetchBackups();
    fetchSecurityLogs();
    fetchAuditLogs(1);
    fetchApiTokens();
  }, []);

  const fetchBackups = async () => {
    try {
      const res = await api.get('/admin/backup/list/');
      if (res.data.backups) setBackups(res.data.backups);
    } catch (e) {}
  };
  
  const fetchSecurityLogs = async () => {
    try {
      const res = await api.get('/admin/security-log/');
      if (res.data.attempts) setSecurityLogs(res.data);
    } catch (e) {}
  };

  const fetchAuditLogs = async (page = 1) => {
    try {
      const res = await api.get(`/admin/audit-log/?page=${page}&search=${auditSearch}`);
      if (res.data.logs) setAuditLogs(res.data);
    } catch (e) {}
  };

  const fetchApiTokens = async () => {
    try {
      const res = await api.get('/admin/api-tokens/');
      if (res.data.tokens) setApiTokens(res.data.tokens);
    } catch (e) {}
  };

  const handleTriggerBackup = async () => {
    try {
      setBackingUp(true);
      const res = await api.post('/admin/backup/trigger/');
      if (res.data.success) {
        alert(`Backup created: ${res.data.filename} (${res.data.size_mb} MB)`);
        fetchBackups();
      } else {
        alert('Backup failed: ' + res.data.error);
      }
    } catch(e) {
      alert('Backup failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setBackingUp(false);
    }
  };

  const handleDownloadBackup = async (filename) => {
    const token = localStorage.getItem('dit_access_token');
    const response = await fetch(`/api/admin/backup/download/${filename}/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } else {
        toast.error('Failed to download backup');
    }
  };

  const handleRevokeToken = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this API token?')) return;
    try {
      const res = await api.post(`/admin/api-tokens/${id}/revoke/`);
      if (res.data.success) {
        toast.success('Token revoked');
        fetchApiTokens();
      }
    } catch (e) {
      toast.error('Failed to revoke token');
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await api.get('/admin/config/');
      if (res.data.success && res.data.data) {
        setPlatformConfig(prev => ({ ...prev, ...res.data.data }));
      }
    } catch (err) {
      console.error('Failed to fetch platform config');
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get('/subscriptions/plans/');
      if (res.data.success && res.data.data) {
        setPlans(res.data.data);
      } else if (Array.isArray(res.data)) {
        setPlans(res.data);
      }
    } catch (err) {
      toast.error('Failed to fetch subscription plans');
    }
  };

  const handlePlatformChange = (k, v) => setPlatformConfig(p => ({ ...p, [k]: v }));
  const handleLimitChange = (k, v) => setResourceLimits(p => ({ ...p, [k]: v }));

  const savePlatformConfig = async () => {
    setSavingSection('platform');
    try {
      await api.put('/admin/config/', platformConfig);
      toast.success('Platform configuration saved');
    } catch (err) {
      toast.error('Failed to save platform configuration');
    } finally {
      setSavingSection(null);
    }
  };

  const saveResourceLimits = async () => {
    setSavingSection('limits');
    await new Promise(r => setTimeout(r, 600));
    localStorage.setItem('clouddesk_resource_limits', JSON.stringify(resourceLimits));
    toast.success('Resource limits saved');
    setSavingSection(null);
  };

  const testConnections = async () => {
    setTestingInfra(true);
    try {
      const res = await api.get('/vms/admin/system-stats/');
      if (res.data.success) {
        setInfraStats(res.data);
      }
    } catch (err) {
      toast.error('Failed to contact infrastructure');
    } finally {
      setTestingInfra(false);
    }
  };

  const openPlanEdit = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name || plan.display_name,
      price_usd: plan.price_usd || plan.price || 0,
      price_tzs: plan.price_tzs || 0,
      max_hours: plan.max_hours || plan.compute_hours_per_month || 0,
      max_participants: plan.max_participants || plan.max_session_participants || 0,
      can_host: plan.can_host || plan.can_host_sessions || false
    });
  };

  const savePlan = async () => {
    if (!editingPlan) return;
    try {
      await api.put(`/subscriptions/plans/${editingPlan.id}/`, planForm);
      toast.success(`Plan "${planForm.name}" updated successfully`);
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      toast.error('Failed to update plan');
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setSavingSection('password');
    try {
      await api.post('/auth/password/change/', {
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      toast.error('Failed to change password');
    } finally {
      setSavingSection(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-fade-in p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-500" />
          System Settings
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">Configure platform behaviour, limits, and infrastructure</p>
      </div>

      <div className="space-y-8">
        {/* SECTION 1: Platform Config */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Platform Configuration</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Platform Name</label>
                <input type="text" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                  value={platformConfig.platform_name} onChange={e => handlePlatformChange('platform_name', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Support Email</label>
                <input type="email" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                  value={platformConfig.support_email} onChange={e => handlePlatformChange('support_email', e.target.value)} />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-[var(--bg-nav-hover)] rounded-lg border border-[var(--border-color)]/50">
              <div>
                <p className="text-[var(--text-primary)] font-medium text-sm">Allow Registration</p>
                <p className="text-[var(--text-muted)] text-xs">Allow users to sign up for free</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={platformConfig.allow_registration} onChange={e => handlePlatformChange('allow_registration', e.target.checked)} />
                <div className="w-11 h-6 bg-[var(--bg-nav-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-[var(--bg-nav-hover)] rounded-lg border border-[var(--border-color)]/50">
              <div>
                <p className="text-[var(--text-primary)] font-medium text-sm">Maintenance Mode</p>
                <p className="text-[var(--text-muted)] text-xs">Block non-admin access</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={platformConfig.maintenance_mode} onChange={e => handlePlatformChange('maintenance_mode', e.target.checked)} />
                <div className="w-11 h-6 bg-[var(--bg-nav-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">System Announcement</label>
              <textarea className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] h-20 resize-none"
                placeholder="Message shown to all users..."
                value={platformConfig.system_announcement} onChange={e => handlePlatformChange('system_announcement', e.target.value)} />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex justify-end">
            <button onClick={savePlatformConfig} disabled={savingSection === 'platform'} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Save size={16} />
              {savingSection === 'platform' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>

        {/* SECTION 2: Subscription Plans */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Subscription Plans</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.length === 0 ? (
                <div className="col-span-full text-center text-[var(--text-secondary)] p-4">No plans found. Loading...</div>
              ) : plans.map(p => (
                <div key={p.id} className="bg-[var(--bg-nav-hover)] border border-[var(--border-color)] rounded-lg p-5 flex flex-col text-center hover:border-indigo-500/50 transition-colors group">
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{p.display_name || p.name}</h3>
                  <p className="text-2xl font-bold text-indigo-400 mb-4">TZS {(p.price_tzs || p.price || 0).toLocaleString()}/mo</p>
                  <div className="space-y-2 mb-6 flex-1">
                    <p className="text-sm text-[var(--text-primary)]">
                      {(p.max_hours || p.compute_hours_per_month) === -1 ? 'Unlimited hrs' : `${p.max_hours || p.compute_hours_per_month} hrs/mo`}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {p.can_host_sessions || p.can_host ? `${p.max_participants || p.max_session_participants || 0} participants` : 'No hosting'}
                    </p>
                  </div>
                  <button onClick={() => openPlanEdit(p)} className="w-full py-2 bg-[var(--bg-card)] group-hover:bg-indigo-600 text-[var(--text-primary)] group-hover:text-white rounded-md text-sm font-medium transition-colors border border-[var(--border-color)] group-hover:border-indigo-500">
                    Edit Plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: VM & Resource Limits */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">VM & Resource Limits</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Max VMs per User</label>
                <input type="number" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                  value={resourceLimits.max_vms_per_user} onChange={e => handleLimitChange('max_vms_per_user', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Max Concurrent VMs</label>
                <input type="number" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                  value={resourceLimits.max_concurrent_vms} onChange={e => handleLimitChange('max_concurrent_vms', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">VM Provisioning Timeout (s)</label>
                <input type="number" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                  value={resourceLimits.vm_provisioning_timeout} onChange={e => handleLimitChange('vm_provisioning_timeout', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Idle Timeout (minutes)</label>
                <input type="number" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                  value={resourceLimits.idle_timeout_mins} onChange={e => handleLimitChange('idle_timeout_mins', e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-[var(--bg-nav-hover)] rounded-lg border border-[var(--border-color)]/50 mt-4">
              <div>
                <p className="text-[var(--text-primary)] font-medium text-sm">Auto-shutdown Idle VMs</p>
                <p className="text-[var(--text-muted)] text-xs">Stop VMs automatically after idle timeout</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={resourceLimits.auto_shutdown_idle} onChange={e => handleLimitChange('auto_shutdown_idle', e.target.checked)} />
                <div className="w-11 h-6 bg-[var(--bg-nav-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex justify-end">
            <button onClick={saveResourceLimits} disabled={savingSection === 'limits'} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Save size={16} />
              {savingSection === 'limits' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>

        {/* SECTION 4 & 5 Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Infrastructure */}
          <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Infrastructure</h2>
            </div>
            <div className="p-6 flex-1 space-y-4">
              <div className="bg-[var(--bg-nav-hover)] border border-[var(--border-color)]/50 rounded-lg p-4">
                <p className="text-xs text-[var(--text-muted)] mb-1">Proxmox Host</p>
                <p className="text-sm text-[var(--text-primary)] font-mono">192.168.1.13 (pve)</p>
                <p className="text-sm mt-2 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${infraStats?.proxmox?.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  <span className={infraStats?.proxmox?.status === 'online' ? 'text-emerald-400' : 'text-red-400'}>
                    {infraStats?.proxmox?.status === 'online' ? 'Connected' : 'Offline'}
                  </span>
                </p>
              </div>
              <div className="bg-[var(--bg-nav-hover)] border border-[var(--border-color)]/50 rounded-lg p-4">
                <p className="text-xs text-[var(--text-muted)] mb-1">Guacamole URL</p>
                <p className="text-sm text-[var(--text-primary)] font-mono">localhost:8080</p>
                <p className="text-sm mt-2 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${infraStats?.guacamole?.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  <span className={infraStats?.guacamole?.status === 'online' ? 'text-emerald-400' : 'text-red-400'}>
                    {infraStats?.guacamole?.status === 'online' ? 'Connected' : 'Offline'}
                  </span>
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-nav-hover)]">
              <button onClick={testConnections} disabled={testingInfra} className="w-full flex justify-center items-center gap-2 bg-[var(--bg-nav-hover)] hover:bg-slate-600 text-[var(--text-primary)] px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <RefreshCw size={16} className={testingInfra ? "animate-spin" : ""} />
                Test Connections
              </button>
            </div>
          </section>

          {/* Payment Configuration */}
          <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Payment Configuration</h2>
            </div>
            <div className="p-6 flex-1 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]/50">
                <span className="text-sm text-[var(--text-secondary)]">Payment Provider</span>
                <span className="text-sm text-[var(--text-primary)] font-medium">AzamPay</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]/50">
                <span className="text-sm text-[var(--text-secondary)]">Environment</span>
                <span className="text-sm px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">Sandbox</span>
              </div>
              <div className="py-2 border-b border-[var(--border-color)]/50">
                <span className="text-sm text-[var(--text-secondary)] block mb-2">Supported Methods</span>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-[var(--bg-nav-hover)] text-[var(--text-primary)] px-2 py-1 rounded">☑ M-Pesa</span>
                  <span className="text-xs bg-[var(--bg-nav-hover)] text-[var(--text-primary)] px-2 py-1 rounded">☑ Airtel Money</span>
                  <span className="text-xs bg-[var(--bg-nav-hover)] text-[var(--text-primary)] px-2 py-1 rounded">☑ Tigo Pesa</span>
                  <span className="text-xs bg-[var(--bg-nav-hover)] text-[var(--text-primary)] px-2 py-1 rounded">☑ Halopesa</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-[var(--text-secondary)]">Status</span>
                <span className="text-sm flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Connected
                </span>
              </div>
            </div>
          </section>
        </div>
        
        {/* SECTION 6: Admin Password */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Change Admin Password</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-4 max-w-sm">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Current Password</label>
                <input 
                  type="password" 
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">New Password</label>
                <input 
                  type="password" 
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button 
                type="submit"
                disabled={savingSection === 'password' || !passwordForm.currentPassword || !passwordForm.newPassword}
                className="mt-2 flex items-center justify-center gap-2 bg-[var(--bg-nav-hover)] hover:bg-slate-600 disabled:opacity-50 text-[var(--text-primary)] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {savingSection === 'password' ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </section>

        {/* SECTION 7: Backup Management */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Backup Management</h2>
            </div>
            <button onClick={handleTriggerBackup} disabled={backingUp} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {backingUp ? 'Creating...' : 'Create Backup Now'}
            </button>
          </div>
          <div className="p-6 overflow-x-auto">
            {backups.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="py-3 px-4 text-xs font-semibold text-[var(--text-secondary)] uppercase">Filename</th>
                    <th className="py-3 px-4 text-xs font-semibold text-[var(--text-secondary)] uppercase">Size</th>
                    <th className="py-3 px-4 text-xs font-semibold text-[var(--text-secondary)] uppercase">Created</th>
                    <th className="py-3 px-4 text-xs font-semibold text-[var(--text-secondary)] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map(b => (
                    <tr key={b.filename} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-nav-hover)]">
                      <td className="py-3 px-4 text-sm text-[var(--text-primary)] font-mono">{b.filename}</td>
                      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{b.size_mb} MB</td>
                      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{new Date(b.created_at * 1000).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-right">
                        <button onClick={() => handleDownloadBackup(b.filename)} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3" />
                <p className="text-[var(--text-secondary)]">No backups yet</p>
                <p className="text-sm text-[var(--text-faint)] mt-1">Create your first backup to protect your data</p>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 8: Security Log */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Security Log (Logins)</h2>
            </div>
            {securityLogs.failed_last_24h > 0 && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${securityLogs.failed_last_24h > 5 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                {securityLogs.failed_last_24h} failed in 24h
              </span>
            )}
          </div>
          <div className="p-0 overflow-x-auto max-h-[400px] overflow-y-auto">
            {securityLogs.attempts.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[var(--bg-card)] z-10 shadow-sm border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Status</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Email</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">IP Address</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {securityLogs.attempts.map((a, i) => (
                    <tr key={i} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-nav-hover)]">
                      <td className="py-3 px-6">
                        {a.success ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">SUCCESS</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">FAILED</span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-sm text-[var(--text-primary)]">{a.email}</td>
                      <td className="py-3 px-6 text-sm text-[var(--text-secondary)] font-mono">{a.ip_address}</td>
                      <td className="py-3 px-6 text-sm text-[var(--text-secondary)]">{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <p className="text-[var(--text-secondary)]">No login attempts recorded yet</p>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 9: Audit Log */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Admin Audit Log</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
                  className="pl-9 pr-4 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchAuditLogs(1)}
                />
              </div>
            </div>
          </div>
          <div className="p-0 overflow-x-auto">
            {auditLogs.logs.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)]">
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Admin</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Action</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Description</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.logs.map(l => (
                    <tr key={l.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-nav-hover)]">
                      <td className="py-3 px-6 text-sm text-[var(--text-primary)] font-medium">{l.admin_name}</td>
                      <td className="py-3 px-6 text-xs">
                        <span className="bg-[var(--bg-nav-hover)] px-2 py-1 rounded text-[var(--text-primary)]">{l.action_type}</span>
                      </td>
                      <td className="py-3 px-6 text-sm text-[var(--text-secondary)] max-w-xs truncate" title={l.description}>{l.description}</td>
                      <td className="py-3 px-6 text-sm text-[var(--text-secondary)]">{new Date(l.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-[var(--text-secondary)]">No audit logs found</div>
            )}
          </div>
          {auditLogs.total_pages > 1 && (
            <div className="px-6 py-3 border-t border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex justify-between items-center">
              <span className="text-xs text-[var(--text-secondary)]">Page {auditLogs.page} of {auditLogs.total_pages}</span>
              <div className="flex gap-2">
                <button 
                  disabled={auditLogs.page <= 1} 
                  onClick={() => fetchAuditLogs(auditLogs.page - 1)}
                  className="px-3 py-1 text-xs bg-[var(--bg-card)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-nav-hover)] disabled:opacity-50 text-[var(--text-primary)]"
                >
                  Previous
                </button>
                <button 
                  disabled={auditLogs.page >= auditLogs.total_pages} 
                  onClick={() => fetchAuditLogs(auditLogs.page + 1)}
                  className="px-3 py-1 text-xs bg-[var(--bg-card)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-nav-hover)] disabled:opacity-50 text-[var(--text-primary)]"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 10: API Tokens */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">API Token Oversight</h2>
          </div>
          <div className="p-0 overflow-x-auto">
            {apiTokens.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)]">
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">User</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Prefix</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Created</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Last Used</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Calls Today</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {apiTokens.map(t => (
                    <tr key={t.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-nav-hover)]">
                      <td className="py-3 px-6">
                        <p className="text-sm text-[var(--text-primary)] font-medium">{t.user_name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{t.user_email}</p>
                      </td>
                      <td className="py-3 px-6 text-sm text-[var(--text-primary)] font-mono bg-[var(--bg-nav-hover)] rounded my-2 inline-block ml-6">{t.prefix}...</td>
                      <td className="py-3 px-6 text-sm text-[var(--text-secondary)]">{new Date(t.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-6 text-sm text-[var(--text-secondary)]">{t.last_used_at ? new Date(t.last_used_at).toLocaleDateString() : 'Never'}</td>
                      <td className="py-3 px-6 text-sm text-[var(--text-secondary)]">{t.calls_today}</td>
                      <td className="py-3 px-6 text-right">
                        <button onClick={() => handleRevokeToken(t.id)} className="text-red-400 hover:text-red-300 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded transition-colors">
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-[var(--text-secondary)]">No active API tokens</div>
            )}
          </div>
        </section>

      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl max-w-md w-full shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-nav-hover)]">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Edit Plan: "{editingPlan.display_name || editingPlan.name}"</h3>
              <button onClick={() => setEditingPlan(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Plan Name</label>
                <input type="text" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                  value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Price (USD)</label>
                  <input type="number" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                    value={planForm.price_usd} onChange={e => setPlanForm({...planForm, price_usd: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Price (TZS)</label>
                  <input type="number" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                    value={planForm.price_tzs} onChange={e => setPlanForm({...planForm, price_tzs: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Max Hours/Month (-1=unl)</label>
                  <input type="number" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                    value={planForm.max_hours} onChange={e => setPlanForm({...planForm, max_hours: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Max Participants</label>
                  <input type="number" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                    value={planForm.max_participants} onChange={e => setPlanForm({...planForm, max_participants: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-[var(--bg-nav-hover)] rounded-lg border border-[var(--border-color)]/50">
                <span className="text-sm text-[var(--text-primary)] font-medium">Can Host Sessions</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={planForm.can_host} onChange={e => setPlanForm({...planForm, can_host: e.target.checked})} />
                  <div className="w-11 h-6 bg-[var(--bg-nav-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-nav-hover)] flex justify-end gap-3">
              <button onClick={() => setEditingPlan(null)} className="px-4 py-2 text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium">
                Cancel
              </button>
              <button onClick={savePlan} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
