import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, Terminal, Server, Monitor, ArrowRight, X } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import GuacamoleEmbed from '../../components/shared/GuacamoleEmbed';

const STEP_LABELS = {
  vm_creating: 'Creating VM',
  awaiting_os_install: 'Awaiting OS Install',
  configuring: 'Applying Configuration',
  installing_apps: 'Installing Applications',
  finalizing: 'Finalizing Template',
  verifying: 'Verifying Template',
  completed: 'Completed',
  failed: 'Failed',
};

const COMMON_APPS = ['firefox', 'libreoffice', 'gimp', 'code', 'vlc', 'thunderbird', 'blender', 'audacity'];

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  padding: '24px',
};
const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  fontSize: '13px',
  boxSizing: 'border-box',
};
const labelStyle = { fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' };
const primaryBtn = {
  padding: '10px 20px',
  borderRadius: '10px',
  background: 'var(--accent-primary)',
  color: '#fff',
  border: 'none',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

export default function AdminTemplateWizardPage() {
  const [isos, setIsos] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [job, setJob] = useState(null); // null = not started yet
  const [loading, setLoading] = useState(false);
  const [vmIp, setVmIp] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalUrl, setTerminalUrl] = useState(null);
  // Real, embedded install console (VNC via a local Proxmox-websocket
  // bridge) — replaces "open Proxmox in another tab" for Step 2.
  const [consoleTab, setConsoleTab] = useState('console'); // 'console' | 'terminal'
  const [consoleUrl2, setConsoleUrl2] = useState(null);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const pollRef = useRef(null);

  const [form, setForm] = useState({
    name: '', cpu_cores: 2, ram_gb: 4, disk_gb: 20, iso_volid: '', desktop_environment_id: '',
  });
  const [sshCreds, setSshCreds] = useState({ ssh_username: 'ospace', ssh_password: '' });
  // Guest-agent isn't installed on a freshly, manually-installed VM
  // until finalize() installs it — so IP auto-discovery genuinely
  // can't work until then. Let the admin supply the real IP directly
  // (visible on the installer's summary screen or via `ip a`).
  const [manualIp, setManualIp] = useState('');
  const [selectedApps, setSelectedApps] = useState([]);
  const [customApp, setCustomApp] = useState('');
  const [promoteForm, setPromoteForm] = useState({ name: '', description: '', price_per_hour: 0, price_per_month: 0, icon: '🖥️' });

  useEffect(() => {
    api.get('/admin/templates/available-isos/').then(r => setIsos(r.data.data || [])).catch(() => toast.error('Could not load real ISOs from Proxmox.'));
    api.get('/admin/templates/desktop-environments/').then(r => setProfiles(r.data.data || [])).catch(() => toast.error('Could not load desktop environment profiles.'));
  }, []);

  // Real-time job polling — genuine progress, not fake
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;
    const poll = async () => {
      try {
        const r = await api.get(`/admin/templates/jobs/${job.id}/`);
        setJob(r.data.data);
        if (r.data.data.vm_ip) setVmIp(r.data.data.vm_ip);
      } catch (e) { /* transient poll failure, will retry */ }
    };
    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => clearInterval(pollRef.current);
  }, [job?.id, job?.status]);

  const handleCreateVm = async () => {
    if (!form.name || !form.iso_volid || !form.desktop_environment_id) {
      toast.error('Name, ISO, and desktop environment are all required.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post('/admin/templates/create-job/', form);
      setJob(r.data.data);
      setPromoteForm(p => ({ ...p, name: form.name }));
      toast.success('Real VM created — booting from the selected ISO.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create VM.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyConfiguration = async () => {
    if (!sshCreds.ssh_password) {
      toast.error('Enter the SSH password you set during the OS install.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post(`/admin/templates/jobs/${job.id}/apply-configuration/`, { ...sshCreds, vm_ip: manualIp || undefined });
      setJob(r.data.data);
      toast.success('Configuration applied — real commands ran successfully.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Configuration failed — see the log below.');
      // Real error - re-fetch job so the honest failure/log shows up
      const r = await api.get(`/admin/templates/jobs/${job.id}/`);
      setJob(r.data.data);
    } finally {
      setLoading(false);
    }
  };

  const toggleApp = (app) => {
    setSelectedApps(prev => prev.includes(app) ? prev.filter(a => a !== app) : [...prev, app]);
  };

  const handleInstallApps = async () => {
    const packages = [...selectedApps];
    if (customApp.trim()) packages.push(...customApp.split(',').map(s => s.trim()).filter(Boolean));
    if (packages.length === 0) {
      toast.error('Select or type at least one package.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post(`/admin/templates/jobs/${job.id}/install-apps/`, { packages, ...sshCreds, vm_ip: manualIp || undefined });
      setJob(r.data.data.job);
      if (r.data.success) toast.success('All packages installed.');
      else toast.error('Some packages failed — see the log below.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Install failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/admin/templates/jobs/${job.id}/finalize/`, { ...sshCreds, vm_ip: manualIp || undefined });
      setJob(r.data.data);
      toast.success('Template finalized — starting verification.');
      const v = await api.post(`/admin/templates/jobs/${job.id}/verify/`);
      setJob(v.data.data);
      if (v.data.success) toast.success('Template genuinely verified and ready.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Finalize/verify failed.');
      const r = await api.get(`/admin/templates/jobs/${job.id}/`);
      setJob(r.data.data);
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/admin/templates/jobs/${job.id}/promote/`, promoteForm);
      toast.success(`"${promoteForm.name}" is now genuinely live for real users.`);
      setJob(prev => ({ ...prev, _promotedTemplateId: r.data.data.template_id }));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Promote failed.');
    } finally {
      setLoading(false);
    }
  };

  const openConsole = async () => {
    if (!job?.id) return;
    setConsoleLoading(true);
    setConsoleUrl2(null);
    try {
      const r = await api.post(`/admin/templates/jobs/${job.id}/open-console/`);
      setConsoleUrl2(r.data.data.guacamole_url);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not open the real install console.');
    } finally {
      setConsoleLoading(false);
    }
  };

  // Auto-open the real console the moment there's a VM to point it at,
  // so the admin sees the actual install screen without an extra click.
  useEffect(() => {
    if (job?.proxmox_vmid && job.status === 'awaiting_os_install' && !consoleUrl2 && !consoleLoading) {
      openConsole();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.proxmox_vmid, job?.status]);

  const openTerminal = async () => {
    if (!sshCreds.ssh_password) {
      toast.error('Enter SSH credentials first.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post(`/admin/templates/jobs/${job.id}/open-terminal/`, { ...sshCreds, vm_ip: manualIp || undefined });
      setTerminalUrl(r.data.data.guacamole_url);
      setShowTerminal(true);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not open terminal.');
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = () => {
    if (!job) return 0;
    const order = ['vm_creating', 'awaiting_os_install', 'configuring', 'installing_apps', 'finalizing', 'verifying', 'completed'];
    const idx = order.indexOf(job.status === 'failed' ? (job.log?.length ? 'awaiting_os_install' : 'vm_creating') : job.status);
    return idx === -1 ? 0 : idx;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
        New OS Template
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
        Build a new Linux VM template entirely from here — real Proxmox VM, real config, real apps, real verification.
      </p>

      {/* Progress rail */}
      {job && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
          {['vm_creating', 'awaiting_os_install', 'configuring', 'installing_apps', 'finalizing', 'verifying', 'completed'].map((s, i) => (
            <div key={s} style={{
              flex: 1, height: '6px', borderRadius: '3px',
              background: job.status === 'failed' && i >= currentStepIndex()
                ? 'var(--status-error)'
                : i <= currentStepIndex() ? 'var(--accent-primary)' : 'var(--bg-input)',
            }} title={STEP_LABELS[s]} />
          ))}
        </div>
      )}

      {/* STEP 1: form */}
      {!job && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Step 1 — VM Specification</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Template Name</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Debian Dev Workstation" />
            </div>
            <div>
              <label style={labelStyle}>Desktop Environment</label>
              <select style={inputStyle} value={form.desktop_environment_id} onChange={e => setForm({ ...form, desktop_environment_id: e.target.value })}>
                <option value="">Select...</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>vCPU Cores</label>
              <input type="number" style={inputStyle} value={form.cpu_cores} onChange={e => setForm({ ...form, cpu_cores: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>RAM (GB)</label>
              <input type="number" style={inputStyle} value={form.ram_gb} onChange={e => setForm({ ...form, ram_gb: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Disk (GB)</label>
              <input type="number" style={inputStyle} value={form.disk_gb} onChange={e => setForm({ ...form, disk_gb: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>ISO Image (real, already-uploaded)</label>
              <select style={inputStyle} value={form.iso_volid} onChange={e => setForm({ ...form, iso_volid: e.target.value })}>
                <option value="">Select...</option>
                {isos.map(i => <option key={i.volid} value={i.volid}>{i.filename} ({(i.size_bytes / 1e9).toFixed(1)} GB)</option>)}
              </select>
            </div>
          </div>
          <button style={primaryBtn} onClick={handleCreateVm} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} /> : null}
            Create VM
          </button>
        </div>
      )}

      {/* STEP 2: awaiting OS install — real console + terminal, embedded, never leaving the app */}
      {job && job.status === 'awaiting_os_install' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Step 2 — Install the OS</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
            The VM is running and booted from the ISO. Complete the real OS installer directly below —
            language, keyboard, disk, user account — then enable SSH (or install openssh-server) and click Continue.
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>VM: <b>{job.proxmox_vmid}</b></span>
            {vmIp && <span style={{ fontSize: '12px', color: 'var(--status-success, #10B981)' }}>Real IP detected: <b>{vmIp}</b> (SSH reachable)</span>}
          </div>

          {/* Console / Terminal tabs — same VM, both real, both embedded via the same proven GuacamoleEmbed */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <button onClick={() => setConsoleTab('console')} style={{
              padding: '6px 14px', borderRadius: '8px 8px 0 0', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border-color)', borderBottom: 'none',
              background: consoleTab === 'console' ? 'var(--bg-input)' : 'transparent',
              color: consoleTab === 'console' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
              <Monitor size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} /> Install Console
            </button>
            <button onClick={() => { setConsoleTab('terminal'); if (!terminalUrl && sshCreds.ssh_password) openTerminal(); }} style={{
              padding: '6px 14px', borderRadius: '8px 8px 0 0', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border-color)', borderBottom: 'none',
              background: consoleTab === 'terminal' ? 'var(--bg-input)' : 'transparent',
              color: consoleTab === 'terminal' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
              <Terminal size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} /> Terminal
            </button>
            <div style={{ flex: 1 }} />
            {consoleTab === 'console' && (
              <button onClick={openConsole} disabled={consoleLoading} style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', alignSelf: 'center',
              }}>
                {consoleLoading ? 'Reconnecting…' : 'Refresh Console'}
              </button>
            )}
          </div>
          <div style={{ height: '440px', background: '#000', borderRadius: '0 10px 10px 10px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            {consoleTab === 'console' && consoleUrl2 && (
              <GuacamoleEmbed url={consoleUrl2} title="Install Console" loadingText="Connecting to the real install console..." tunnelActive={true} />
            )}
            {consoleTab === 'console' && !consoleUrl2 && (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                {consoleLoading ? 'Connecting to the real console…' : 'Console not connected yet.'}
              </div>
            )}
            {consoleTab === 'terminal' && terminalUrl && (
              <GuacamoleEmbed url={terminalUrl} title="Terminal" loadingText="Connecting to terminal..." tunnelActive={true} />
            )}
            {consoleTab === 'terminal' && !terminalUrl && (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '0 20px' }}>
                Enter SSH credentials below, then reopen this tab — SSH must be installed and enabled inside the VM first.
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>SSH Username (the account you created)</label>
              <input style={inputStyle} value={sshCreds.ssh_username} onChange={e => setSshCreds({ ...sshCreds, ssh_username: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>SSH Password</label>
              <input type="password" style={inputStyle} value={sshCreds.ssh_password} onChange={e => setSshCreds({ ...sshCreds, ssh_password: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>VM IP (only if not auto-detected above — guest-agent isn't installed yet at this stage, so check the console or run `ip a`)</label>
              <input style={inputStyle} value={manualIp} onChange={e => setManualIp(e.target.value)} placeholder="e.g. 192.168.1.17" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={primaryBtn} onClick={handleApplyConfiguration} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} /> : null}
              Continue — Apply Configuration
            </button>
          </div>
        </div>
      )}

      {/* STEP 3+4: configuring/installing_apps — log + app picker */}
      {job && (job.status === 'installing_apps' || job.status === 'configuring') && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Step 3/4 — Configuration &amp; Apps</h2>
          <JobLog job={job} />
          <div style={{ marginTop: '20px' }}>
            <label style={labelStyle}>Common Apps</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {COMMON_APPS.map(app => (
                <button key={app} onClick={() => toggleApp(app)} style={{
                  padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  background: selectedApps.includes(app) ? 'var(--accent-primary)' : 'var(--bg-input)',
                  color: selectedApps.includes(app) ? '#fff' : 'var(--text-secondary)',
                }}>{app}</button>
              ))}
            </div>
            <label style={labelStyle}>Other packages (comma-separated apt package names)</label>
            <input style={inputStyle} value={customApp} onChange={e => setCustomApp(e.target.value)} placeholder="e.g. htop, git, curl" />
            <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
              <button style={primaryBtn} onClick={handleInstallApps} disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} /> : null}
                Install Selected
              </button>
              <button style={{ ...primaryBtn, background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }} onClick={openTerminal} disabled={loading}>
                <Terminal size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Open Terminal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: finalize (shown once at least one app install attempt happened, or admin wants to skip apps) */}
      {job && job.status === 'installing_apps' && job.log?.some(l => l.message.includes('exit')) && (
        <div style={{ ...cardStyle, marginTop: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Step 5 — Finalize Template</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
            Real finalization: machine-id truncate + verify, SSH host key removal, guest agent install, shutdown, convert to template — then an isolated verification clone.
          </p>
          <button style={primaryBtn} onClick={handleFinalize} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} /> : null}
            Finalize Template
          </button>
        </div>
      )}

      {(job?.status === 'finalizing' || job?.status === 'verifying') && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {job.status === 'finalizing' ? 'Finalizing…' : 'Verifying…'}
          </h2>
          <JobLog job={job} />
        </div>
      )}

      {job?.status === 'failed' && (
        <div style={{ ...cardStyle, border: '1px solid var(--status-error)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <XCircle size={20} style={{ color: 'var(--status-error)' }} />
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--status-error)' }}>Job Failed</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>{job.error_message}</p>
          <JobLog job={job} />
        </div>
      )}

      {/* STEP 6: success + promote */}
      {job?.status === 'completed' && !job._promotedTemplateId && (
        <div style={{ ...cardStyle, border: '1px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <CheckCircle2 size={20} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Template Verified and Ready</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input style={inputStyle} value={promoteForm.name} onChange={e => setPromoteForm({ ...promoteForm, name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Icon (emoji)</label>
              <input style={inputStyle} value={promoteForm.icon} onChange={e => setPromoteForm({ ...promoteForm, icon: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={promoteForm.description} onChange={e => setPromoteForm({ ...promoteForm, description: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Price/hour (TZS)</label>
              <input type="number" style={inputStyle} value={promoteForm.price_per_hour} onChange={e => setPromoteForm({ ...promoteForm, price_per_hour: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Price/month (TZS)</label>
              <input type="number" style={inputStyle} value={promoteForm.price_per_month} onChange={e => setPromoteForm({ ...promoteForm, price_per_month: e.target.value })} />
            </div>
          </div>
          <button style={primaryBtn} onClick={handlePromote} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} /> : null}
            Add to Platform
          </button>
        </div>
      )}

      {job?._promotedTemplateId && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <CheckCircle2 size={40} style={{ color: 'var(--accent-primary)', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Live on the platform</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
            VMTemplate #{job._promotedTemplateId} is now genuinely available to real users.
          </p>
        </div>
      )}

      {/* In-app terminal modal — reuses the proven GuacamoleEmbed */}
      {showTerminal && terminalUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '90vw', height: '80vh', background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '1px solid var(--border-color)' }}>
            <button onClick={() => setShowTerminal(false)} style={{
              position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: '8px', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <X size={16} style={{ color: 'var(--text-primary)' }} />
            </button>
            <GuacamoleEmbed url={terminalUrl} title="Wizard Terminal" loadingText="Connecting to terminal..." tunnelActive={true} />
          </div>
        </div>
      )}
    </div>
  );
}

function JobLog({ job }) {
  return (
    <div style={{
      background: 'var(--bg-input)', borderRadius: '10px', padding: '12px', maxHeight: '260px', overflowY: 'auto',
      fontFamily: 'monospace', fontSize: '12px',
    }}>
      {(job.log || []).map((entry, i) => (
        <div key={i} style={{ color: entry.level === 'error' ? 'var(--status-error)' : 'var(--text-secondary)', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-muted)' }}>[{new Date(entry.ts).toLocaleTimeString()}]</span> {entry.message}
        </div>
      ))}
    </div>
  );
}
