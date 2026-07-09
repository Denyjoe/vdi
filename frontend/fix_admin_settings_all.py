import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add states
states_block = '''  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [savingSection, setSavingSection] = useState(null);'''
  
new_states = '''  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [savingSection, setSavingSection] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backingUp, setBackingUp] = useState(false);
  const [securityLogs, setSecurityLogs] = useState({ attempts: [], failed_last_24h: 0 });
  const [auditLogs, setAuditLogs] = useState({ logs: [], total: 0, page: 1, total_pages: 1 });
  const [auditSearch, setAuditSearch] = useState('');
  const [apiTokens, setApiTokens] = useState([]);'''

content = content.replace(states_block, new_states)

# Add fetches to useEffect
fetch_block = '''  useEffect(() => {
    fetchConfig();
    testConnections();
    fetchPlans();
  }, []);'''
  
new_fetch_block = '''  useEffect(() => {
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
      const res = await api.get(/admin/audit-log/?page=&search=);
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
    setBackingUp(true);
    try {
      const res = await api.post('/admin/backup/trigger/');
      if (res.data.success) {
        toast.success('Backup created successfully');
        fetchBackups();
      } else {
        toast.error('Failed to create backup');
      }
    } catch (e) {
      toast.error('Failed to create backup');
    } finally {
      setBackingUp(false);
    }
  };

  const handleDownloadBackup = async (filename) => {
    const token = localStorage.getItem('dit_access_token');
    const response = await fetch(/api/admin/backup/download//, {
      headers: { 'Authorization': Bearer  }
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
      const res = await api.post(/admin/api-tokens//revoke/);
      if (res.data.success) {
        toast.success('Token revoked');
        fetchApiTokens();
      }
    } catch (e) {
      toast.error('Failed to revoke token');
    }
  };'''

content = content.replace(fetch_block, new_fetch_block)

# Add Lucide Icons
import_block = "import { Settings as SettingsIcon, Server, Shield, CreditCard, Save, Activity, RefreshCw, X, Lock } from 'lucide-react';"
new_import_block = "import { Settings as SettingsIcon, Server, Shield, CreditCard, Save, Activity, RefreshCw, X, Lock, Database, Search, Key, AlertTriangle } from 'lucide-react';"
content = content.replace(import_block, new_import_block)

# Replace AzamPay environment
payment_block = '''          <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Payment Configuration</h2>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex-1">
                <p className="text-sm text-[var(--text-primary)] font-medium mb-4">Supported Methods</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-[var(--bg-card-hover)] text-[var(--text-primary)] px-2 py-1 rounded">☑ Airtel Money</span>
                  <span className="text-xs bg-[var(--bg-card-hover)] text-[var(--text-primary)] px-2 py-1 rounded">☑ Tigo Pesa</span>
                  <span className="text-xs bg-[var(--bg-card-hover)] text-[var(--text-primary)] px-2 py-1 rounded">☑ Halopesa</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-[var(--text-secondary)]">Status</span>
                <span className="text-sm flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Connected
                </span>
              </div>
            </div>
          </section>'''

new_payment_block = '''          <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Payment Configuration</h2>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              
              <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg mb-4">
                <AlertTriangle size={14} className="text-orange-400 mt-0.5 shrink-0" />
                <span className="text-xs text-orange-400/90 leading-relaxed">
                  Currently running in SANDBOX mode. No real payments are processed. Switching to production requires approved AzamPay merchant credentials.
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-[10px] uppercase text-[var(--text-secondary)] mb-1">Provider</p>
                  <p className="text-sm text-[var(--text-primary)] font-semibold">AzamPay</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--text-secondary)] mb-1">Environment</p>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400">
                    SANDBOX
                  </span>
                </div>
              </div>
              
              <div className="flex-1 border-t border-[var(--border-color)] pt-4">
                <p className="text-sm text-[var(--text-primary)] font-medium mb-3">Supported Methods</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-[var(--bg-card-hover)] text-[var(--text-primary)] px-2 py-1 rounded">☑ Airtel Money</span>
                  <span className="text-xs bg-[var(--bg-card-hover)] text-[var(--text-primary)] px-2 py-1 rounded">☑ Tigo Pesa</span>
                  <span className="text-xs bg-[var(--bg-card-hover)] text-[var(--text-primary)] px-2 py-1 rounded">☑ Halopesa</span>
                </div>
              </div>
            </div>
          </section>'''

content = content.replace(payment_block, new_payment_block)

# Add new sections below Admin Password
new_sections = '''
        {/* SECTION 7: Backup Management */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex justify-between items-center">
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
                    <tr key={b.filename} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-primary)]/30">
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
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Security Log (Logins)</h2>
            </div>
            {securityLogs.failed_last_24h > 0 && (
              <span className={	ext-xs font-bold px-2.5 py-1 rounded-full }>
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
                    <tr key={i} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-primary)]/30">
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
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
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
                  className="pl-9 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
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
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/30">
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Admin</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Action</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Description</th>
                    <th className="py-3 px-6 text-xs font-semibold text-[var(--text-secondary)] uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.logs.map(l => (
                    <tr key={l.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-primary)]/30">
                      <td className="py-3 px-6 text-sm text-[var(--text-primary)] font-medium">{l.admin_name}</td>
                      <td className="py-3 px-6 text-xs">
                        <span className="bg-[var(--bg-card-hover)] px-2 py-1 rounded text-[var(--text-primary)]">{l.action_type}</span>
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
            <div className="px-6 py-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/30 flex justify-between items-center">
              <span className="text-xs text-[var(--text-secondary)]">Page {auditLogs.page} of {auditLogs.total_pages}</span>
              <div className="flex gap-2">
                <button 
                  disabled={auditLogs.page <= 1} 
                  onClick={() => fetchAuditLogs(auditLogs.page - 1)}
                  className="px-3 py-1 text-xs bg-[var(--bg-card)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-card-hover)] disabled:opacity-50 text-[var(--text-primary)]"
                >
                  Previous
                </button>
                <button 
                  disabled={auditLogs.page >= auditLogs.total_pages} 
                  onClick={() => fetchAuditLogs(auditLogs.page + 1)}
                  className="px-3 py-1 text-xs bg-[var(--bg-card)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-card-hover)] disabled:opacity-50 text-[var(--text-primary)]"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 10: API Tokens */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">API Token Oversight</h2>
          </div>
          <div className="p-0 overflow-x-auto">
            {apiTokens.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/30">
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
                    <tr key={t.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-primary)]/30">
                      <td className="py-3 px-6">
                        <p className="text-sm text-[var(--text-primary)] font-medium">{t.user_name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{t.user_email}</p>
                      </td>
                      <td className="py-3 px-6 text-sm text-[var(--text-primary)] font-mono bg-[var(--bg-primary)]/50 rounded my-2 inline-block ml-6">{t.prefix}...</td>
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
'''

content = content.replace("      </div>\n\n      {/* Edit Plan Modal */}", new_sections + "\n      </div>\n\n      {/* Edit Plan Modal */}")

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
