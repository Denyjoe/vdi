import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, Terminal, Server, Monitor, ArrowRight, X, Power, PowerOff, RotateCw, GraduationCap, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import GuacamoleEmbed from '../../components/shared/GuacamoleEmbed';
import useTunnelHealth from '../../hooks/useTunnelHealth';
import ConfirmModal from '../../components/shared/ConfirmModal';

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
// Real, deliberate separate list for the server (CLI-only) path — the
// desktop list above is entirely GUI apps, meaningless on a headless
// template. Genuinely common real-world server tooling instead.
const COMMON_SERVER_PACKAGES = ['git', 'htop', 'curl', 'wget', 'build-essential', 'python3-pip', 'docker.io', 'nginx', 'postgresql', 'nodejs'];

// Matches the backend's AdminTemplateJobPowerView.BUSY_STATUSES exactly —
// real, backend-automated work (SSH/apt commands) runs during these,
// so destructive power actions are blocked server-side too, not just
// hidden here.
const BUSY_JOB_STATUSES = ['configuring', 'installing_apps', 'finalizing'];

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
  // Phase 2 (Product Depth Layer) — reached via a University Admin's
  // "Approve & Build" action (TemplateRequestQueuePanel), reusing this
  // EXACT wizard rather than a parallel build flow. Pre-fills the form
  // and tags the real create-job call with template_request_id so the
  // backend can quota-check it and, on promote, link it back to the
  // course automatically.
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const templateRequestId = searchParams.get('template_request_id');
  const [templateRequest] = useState(location.state?.templateRequest || null);
  const [requestQuotaCheck] = useState(location.state?.quotaCheck || null);

  const [isos, setIsos] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [job, setJob] = useState(null); // null = not started yet
  const [loading, setLoading] = useState(false);
  const [vmIp, setVmIp] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalUrl, setTerminalUrl] = useState(null);
  // Real, live-polled tunnel-health signals — never a hardcoded
  // `true` — matching the exact proven pattern already used for the
  // member-facing desktop view and the Take Control modal, so
  // Guacamole's own raw connecting/disconnected text can never leak
  // through the cover.
  const [terminalConnectionId, setTerminalConnectionId] = useState(null);
  const terminalTunnelActive = useTunnelHealth(terminalConnectionId);
  const [consoleConnectionId, setConsoleConnectionId] = useState(null);
  const consoleTunnelActive = useTunnelHealth(consoleConnectionId);
  // Real, embedded install console (VNC via a local Proxmox-websocket
  // bridge) — replaces "open Proxmox in another tab" for Step 2.
  const [consoleTab, setConsoleTab] = useState('console'); // 'console' | 'terminal'
  const [consoleUrl2, setConsoleUrl2] = useState(null);
  const [consoleLoading, setConsoleLoading] = useState(false);
  // Real, confirmed bug this fixes: the console could sit on
  // "Connecting to the real install console..." forever with zero
  // further feedback when the VNC bridge/Guacamole tunnel never came
  // up in the FIRST place (as opposed to coming up then dropping,
  // which the reconnect logic below already handled) — reproduced
  // live: connection-status genuinely reported active:false
  // indefinitely, with nothing in the UI ever telling the admin.
  const [consoleFailed, setConsoleFailed] = useState(false);
  const consoleAttemptsRef = useRef(0);
  // Real, confirmed gap `consoleTunnelActive` alone doesn't cover: it's
  // a transport-level signal (guacd accepted a client) that can read
  // positive indefinitely while Guacamole's own client never actually
  // reaches CONNECTED — reproduced live against job #39's real, already
  // stale VNC ticket: connection-status genuinely reported active:true
  // on repeat, yet the console stayed on "Connecting..." forever. Fed
  // by GuacamoleEmbed's onReadyChange (the same `ready` gate it uses to
  // lift its own loading cover), so "actually usable" and "known stuck"
  // are driven by one real signal, not two that can disagree.
  const [consoleReady, setConsoleReady] = useState(false);
  // Real, polled VM power state — before this, a stopped/hung VM and a
  // genuine display bug looked identical: a permanently blank console
  // with no way to tell which one it was, let alone fix it, from
  // inside the wizard.
  const [powerStatus, setPowerStatus] = useState(null); // null = not known yet
  const [powerBusy, setPowerBusy] = useState(false);
  const powerPollRef = useRef(null);
  const pollRef = useRef(null);

  const [form, setForm] = useState({
    name: templateRequest ? `${templateRequest.course_code}: ${templateRequest.software_needed}`.slice(0, 100) : '',
    cpu_cores: templateRequest?.estimated_vcpu || 2,
    ram_gb: templateRequest?.estimated_ram_gb || 4,
    disk_gb: templateRequest?.estimated_storage_gb || 20,
    iso_volid: '', desktop_environment_id: '',
    // Real, deliberate default: 'desktop' matches every existing
    // template ever built through this wizard — a brand new admin
    // landing on this page for the first time gets the exact old
    // flow unless they actively pick "Server (CLI only)" below.
    template_type: 'desktop',
  });
  // ISO acquisition — real upload straight to Proxmox, or a real
  // server-side download Proxmox itself performs from a URL. Neither
  // ever requires touching Proxmox's own UI.
  const [isoMode, setIsoMode] = useState('existing'); // 'existing' | 'upload' | 'url'
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isoUrl, setIsoUrl] = useState('');
  const [isoUrlFilename, setIsoUrlFilename] = useState('');
  const [downloading, setDownloading] = useState(false);
  // Real percent/speed/eta/bytes parsed server-side from Proxmox's
  // own wget-style download-task log — not a vague "in progress"
  // message. null fields just mean Proxmox hasn't logged a progress
  // line yet (e.g. still resolving DNS).
  const [downloadProgress, setDownloadProgress] = useState(null);
  const downloadPollRef = useRef(null);
  // Real in-progress jobs found on mount, so the admin can choose to
  // resume one instead of the wizard silently starting fresh — same
  // real job data (status/log/etc.) the rest of this page already
  // knows how to render at any step.
  const [activeJobs, setActiveJobs] = useState([]);
  const [resumeChoiceMade, setResumeChoiceMade] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState(null);
  const [deleteJobTarget, setDeleteJobTarget] = useState(null);

  // Real deletion — also removes the real Proxmox VM the job created
  // (unless it's already been promoted into a live template, whose
  // lifecycle the Templates page owns instead). Confirmed real bug
  // this fixes: there was previously no way to delete a wizard job at
  // all, so abandoned test VMs stayed alive in Proxmox forever.
  const handleDeleteJob = async (jobToDelete) => {
    setDeletingJobId(jobToDelete.id);
    try {
      await api.delete(`/admin/templates/jobs/${jobToDelete.id}/`);
      setActiveJobs(prev => prev.filter(j => j.id !== jobToDelete.id));
      toast.success(`"${jobToDelete.name}" and its real VM were deleted.`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not delete this job.');
    } finally {
      setDeletingJobId(null);
      setDeleteJobTarget(null);
    }
  };
  const [sshCreds, setSshCreds] = useState({ ssh_username: 'ospace', ssh_password: '' });
  // Guest-agent isn't installed on a freshly, manually-installed VM
  // until finalize() installs it — so IP auto-discovery genuinely
  // can't work until then. Let the admin supply the real IP directly
  // (visible on the installer's summary screen or via `ip a`).
  const [manualIp, setManualIp] = useState('');
  const [selectedApps, setSelectedApps] = useState([]);
  const [customApp, setCustomApp] = useState('');
  const [promoteForm, setPromoteForm] = useState({ name: '', description: '', price_per_hour: 0, price_per_month: 0, icon: '🖥️', os_family: '', os: '' });

  const loadIsos = () => api.get('/admin/templates/available-isos/').then(r => setIsos(r.data.data || [])).catch(() => toast.error('Could not load real ISOs from Proxmox.'));

  useEffect(() => {
    loadIsos();
    api.get('/admin/templates/desktop-environments/').then(r => setProfiles(r.data.data || [])).catch(() => toast.error('Could not load desktop environment profiles.'));

    // Real "do I have an in-progress job" check — never silently
    // force resume OR silently force a fresh start; let the admin
    // choose via the banner below.
    api.get('/admin/templates/jobs/active/').then(r => setActiveJobs(r.data.data || [])).catch(() => {});

    // Real "do I have an ISO download still in flight" check,
    // independent of any job (a download commonly starts before one
    // exists) — genuinely resume showing its current progress rather
    // than starting the admin's awareness over from zero.
    api.get('/admin/templates/isos/active-download/').then(r => {
      const active = r.data?.data;
      if (!active || active.finished) return;
      setIsoMode('url');
      setIsoUrlFilename(active.filename);
      setDownloading(true);
      setDownloadProgress(active);
      resumeIsoDownloadPolling(active.upid, active.filename);
    }).catch(() => {});

    return () => clearInterval(downloadPollRef.current);
  }, []);

  // Real upload — genuine progress from axios' onUploadProgress, not
  // a fake animation. Streams straight to Proxmox server-side; this
  // request body IS the real bytes going over the wire.
  //
  // Real, confirmed fix, in two real, separate parts:
  //   1. Routed to a dedicated plain-WSGI listener (started alongside
  //      the main Daphne/ASGI server — see backend's apps/vms/apps.py)
  //      instead of the normal API. A real large (Windows-ISO-sized,
  //      4-6GB+) file made the main Daphne/ASGI server's memory
  //      balloon past 56GB and silently drop the connection before
  //      ever reaching this app's own view code — a confirmed
  //      Daphne/Twisted limitation for large request bodies, not a
  //      disk-space/size-limit/timeout issue.
  //   2. Hits that listener via a direct, absolute URL — NOT through
  //      Vite's own dev-server proxy. Confirmed live: proxying the
  //      exact same real large upload through Vite's proxy (Node's
  //      http-proxy) still failed with a genuine "socket hang up"
  //      even after raising its own timeout options — a separate,
  //      real Node/http-proxy-layer limitation for very large,
  //      long-running proxied request bodies. Going direct sidesteps
  //      it entirely and matches how a real deployment would point
  //      this at wherever the upload listener actually lives, rather
  //      than relying on dev-only proxy rewriting.
  // Same `api` instance, so its request interceptor still attaches
  // the real Bearer token automatically — an absolute `url` only
  // overrides the instance's baseURL, nothing else about it.
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.iso')) {
      toast.error('File must be a .iso');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    const body = new FormData();
    body.append('iso', file);
    const uploadPort = import.meta.env.VITE_LARGE_UPLOAD_PORT || '8010';
    const uploadUrl = `${window.location.protocol}//${window.location.hostname}:${uploadPort}/api/admin/templates/isos/upload/`;
    try {
      const r = await api.post(uploadUrl, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      toast.success(`"${file.name}" uploaded. Proxmox is finalizing it...`);
      await pollUntilFinished(r.data.data.upid, file.name);
      await loadIsos();
      setForm(f => ({ ...f, iso_volid: `local:iso/${file.name}` }));
      setIsoMode('existing');
      toast.success(`"${file.name}" is now genuinely available in Proxmox storage.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Real server-side download — Proxmox itself fetches the URL; we
  // only trigger it and poll its real, genuine task status/progress.
  const handleUrlDownload = async () => {
    if (!isoUrl.trim() || !isoUrlFilename.trim()) {
      toast.error('Enter both a URL and a filename ending in .iso');
      return;
    }
    setDownloading(true);
    setDownloadProgress(null);
    try {
      const r = await api.post('/admin/templates/isos/download-url/', { url: isoUrl.trim(), filename: isoUrlFilename.trim() });
      toast.success('Proxmox started downloading the ISO on the server.');
      await pollUntilFinished(r.data.data.upid, isoUrlFilename.trim());
      await loadIsos();
      setForm(f => ({ ...f, iso_volid: `local:iso/${isoUrlFilename.trim()}` }));
      setIsoMode('existing');
      toast.success(`"${isoUrlFilename.trim()}" is now genuinely available in Proxmox storage.`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Could not start the download.');
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  // Real polling of Proxmox's own task status/progress API — used by
  // both the upload and the download-url path, since both return the
  // same kind of real, pollable UPID. Reports live percent/speed/eta
  // into downloadProgress on every tick, not just a fire-and-forget
  // wait — this is also what resumeIsoDownloadPolling below reuses to
  // pick a download back up after a navigation away and back.
  const pollUntilFinished = (upid, filename) => new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const r = await api.get('/admin/templates/isos/download-status/', { params: { upid } });
        const data = r.data.data;
        setDownloadProgress({ ...data, upid, filename });
        if (data.finished) {
          clearInterval(downloadPollRef.current);
          if (data.success) resolve(data);
          else reject(new Error(`Proxmox task failed (exit status: ${data.exit_status}).`));
        }
      } catch (e) { /* transient poll failure, will retry */ }
    };
    poll();
    downloadPollRef.current = setInterval(poll, 3000);
  });

  // On mount, if a real ISO download is still genuinely running
  // (found via /isos/active-download/), pick its progress display back
  // up and run the exact same completion handling handleUrlDownload
  // would — same real success/failure path, just entered from a
  // resume instead of a fresh click.
  const resumeIsoDownloadPolling = async (upid, filename) => {
    try {
      await pollUntilFinished(upid, filename);
      await loadIsos();
      setForm(f => ({ ...f, iso_volid: `local:iso/${filename}` }));
      setIsoMode('existing');
      toast.success(`"${filename}" is now genuinely available in Proxmox storage.`);
    } catch (err) {
      toast.error(err.message || 'The resumed download failed.');
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

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

  const isServerType = form.template_type === 'server';

  const handleCreateVm = async () => {
    if (!form.name || !form.iso_volid || (!isServerType && !form.desktop_environment_id)) {
      toast.error(isServerType ? 'Name and ISO are required.' : 'Name, ISO, and desktop environment are all required.');
      return;
    }
    setLoading(true);
    try {
      const payload = templateRequestId ? { ...form, template_request_id: templateRequestId } : form;
      const r = await api.post('/admin/templates/create-job/', payload);
      setJob(r.data.data);
      setPromoteForm(p => ({ ...p, name: form.name }));
      toast.success('Real VM created. Booting from the selected ISO.');
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
      toast.success('Configuration applied. Real commands ran successfully.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Configuration failed. See the log below.');
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
      else toast.error('Some packages failed. See the log below.');
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
      toast.success('Template finalized. Starting verification.');
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

  const openConsole = async (isManualRetry = false) => {
    if (!job?.id) return;
    if (isManualRetry) {
      consoleAttemptsRef.current = 0;
      setConsoleFailed(false);
    }
    setConsoleLoading(true);
    setConsoleUrl2(null);
    setConsoleConnectionId(null);
    setConsoleReady(false);
    try {
      const r = await api.post(`/admin/templates/jobs/${job.id}/open-console/`);
      setConsoleUrl2(r.data.data.guacamole_url);
      setConsoleConnectionId(r.data.data.connection_id);
    } catch (e) {
      // A real, immediate failure to even mint a connection (bridge/
      // Guacamole error) — surface it honestly right away rather than
      // leaving "Connecting..." on screen with nothing behind it.
      toast.error(e.response?.data?.message || 'Could not open the real install console.');
      setConsoleFailed(true);
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

  // Real, confirmed root cause (found investigating today's recurring
  // black-screen reports): vnc_bridge.py's bridge is genuinely
  // single-shot — it mints one Proxmox VNC ticket, relays exactly one
  // TCP connection, and has zero automatic-reconnect logic. Any
  // transient drop (a network blip between this backend and Proxmox,
  // guacd hiccuping, the underlying VNC session ending) kills the
  // console permanently until an admin notices the black screen and
  // manually clicks "Refresh Console". True mid-session reconnection
  // isn't feasible without RFB protocol awareness the bridge
  // deliberately doesn't have (a fresh Proxmox ticket starts a brand
  // new RFB handshake, which would corrupt guacd's already-established
  // session if spliced in transparently) — so the real, honest fix is
  // at the connection-establishment layer: reuse the exact same
  // tunnel-health signal already proven elsewhere today, and the
  // moment a previously-healthy console tunnel is confirmed dead,
  // automatically mint a whole fresh ticket/bridge/Guacamole connection
  // (exactly what "Refresh Console" already does) — self-healing
  // without ever waiting on the admin to notice.
  // Real, confirmed fix: this used to key off `consoleTunnelActive`
  // (transport-level only) — reproduced live that a stale/consumed VNC
  // ticket can hold `consoleTunnelActive` positive indefinitely while
  // Guacamole's own client never actually reaches CONNECTED, which
  // both latched `hadConsoleTunnelRef` on a connection that was never
  // really usable AND meant this effect's own "confirmed dead" check
  // could never fire (the transport signal never actually went
  // negative). Now keyed off `consoleReady` — the real, both-layers
  // signal from GuacamoleEmbed's own onReadyChange.
  const hadConsoleTunnelRef = useRef(false);
  const consoleReconnectTimerRef = useRef(null);
  useEffect(() => {
    if (consoleReady) {
      hadConsoleTunnelRef.current = true;
      if (consoleReconnectTimerRef.current) {
        clearTimeout(consoleReconnectTimerRef.current);
        consoleReconnectTimerRef.current = null;
      }
      return;
    }
    // Only auto-heal a tunnel that was genuinely up before — never
    // fires while the very first connection is still establishing.
    if (!hadConsoleTunnelRef.current) return;
    if (job?.status !== 'awaiting_os_install') return;
    if (consoleLoading) return;
    // A short debounce (matching useTunnelHealth's own 2s poll) avoids
    // reconnect-storming on a single transient blip that resolves on
    // its own within a couple of polls.
    consoleReconnectTimerRef.current = setTimeout(() => {
      if (!consoleReady && job?.status === 'awaiting_os_install') {
        hadConsoleTunnelRef.current = false;
        toast('Console connection dropped. Reconnecting automatically...', { icon: '🔄' });
        openConsole();
      }
    }, 6000);
    return () => {
      if (consoleReconnectTimerRef.current) clearTimeout(consoleReconnectTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleReady, job?.status]);

  // Complementary fix for the SECOND real bug found live in Phase 1:
  // the reconnect effect above only ever fires for a tunnel that was
  // PREVIOUSLY confirmed healthy (hadConsoleTunnelRef.current). Live
  // repro on a freshly-created job with zero prior successful
  // connection: the panel sat on "Connecting to the real install
  // console..." forever when the very FIRST attempt never came up —
  // useTunnelHealth's confirm-strikes poll never went positive, and
  // this whole failure class was invisible to the admin, with no
  // retry and no error. Fixed with a capped watchdog dedicated to the
  // first attempt: give useTunnelHealth's own poll (2 x 2s
  // confirm-strikes) real margin to confirm health, auto-retry a
  // bounded number of times if it doesn't, and only once that budget
  // is exhausted, stop and surface an honest "couldn't connect" state
  // with a manual Retry button — never leave it spinning forever.
  const firstAttemptTimerRef = useRef(null);
  useEffect(() => {
    if (consoleReady) {
      if (firstAttemptTimerRef.current) {
        clearTimeout(firstAttemptTimerRef.current);
        firstAttemptTimerRef.current = null;
      }
      return;
    }
    // This watchdog only covers what the reconnect effect above
    // explicitly excludes: a tunnel that has never yet been confirmed
    // healthy for this console session.
    if (hadConsoleTunnelRef.current) return;
    if (!consoleConnectionId) return;
    if (job?.status !== 'awaiting_os_install') return;
    if (consoleFailed) return;

    const FIRST_ATTEMPT_TIMEOUT_MS = 14000;
    const MAX_AUTO_ATTEMPTS = 3;

    firstAttemptTimerRef.current = setTimeout(() => {
      if (consoleReady || hadConsoleTunnelRef.current) return;
      if (consoleAttemptsRef.current < MAX_AUTO_ATTEMPTS) {
        consoleAttemptsRef.current += 1;
        toast(`Console still not connecting. Retrying (attempt ${consoleAttemptsRef.current}/${MAX_AUTO_ATTEMPTS})...`, { icon: '🔄' });
        openConsole();
      } else {
        setConsoleFailed(true);
      }
    }, FIRST_ATTEMPT_TIMEOUT_MS);

    return () => {
      if (firstAttemptTimerRef.current) clearTimeout(firstAttemptTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleReady, consoleConnectionId, job?.status, consoleFailed]);

  // Real, live power-state polling — the console/terminal tab has no
  // other way to tell a genuinely stopped/hung VM apart from a display
  // bug, so this has to reflect Proxmox's actual current state, not a
  // cached/assumed one. Polls only while the console step is visible.
  useEffect(() => {
    const relevant = job?.status === 'awaiting_os_install' || BUSY_JOB_STATUSES.includes(job?.status);
    if (!job?.proxmox_vmid || !relevant) {
      setPowerStatus(null);
      return;
    }
    const poll = async () => {
      try {
        const r = await api.get(`/admin/templates/jobs/${job.id}/power-status/`);
        setPowerStatus(r.data.data.power_status);
      } catch (e) { /* transient poll failure, will retry */ }
    };
    poll();
    powerPollRef.current = setInterval(poll, 5000);
    return () => clearInterval(powerPollRef.current);
  }, [job?.id, job?.proxmox_vmid, job?.status]);

  const handlePower = async (action) => {
    if (!job?.id) return;
    setPowerBusy(true);
    try {
      const r = await api.post(`/admin/templates/jobs/${job.id}/power/`, { action });
      setPowerStatus(r.data.data.power_status);
      toast.success(`Power action "${action}" sent.`);
    } catch (e) {
      toast.error(e.response?.data?.message || `Power action "${action}" failed.`);
    } finally {
      setPowerBusy(false);
    }
  };

  const openTerminal = async () => {
    if (!sshCreds.ssh_password) {
      toast.error('Enter SSH credentials first.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post(`/admin/templates/jobs/${job.id}/open-terminal/`, { ...sshCreds, vm_ip: manualIp || undefined });
      setTerminalUrl(r.data.data.guacamole_url);
      setTerminalConnectionId(r.data.data.connection_id);
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
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: templateRequest ? '16px' : '24px' }}>
        Build a new Linux VM template entirely from here — real Proxmox VM, real config, real apps, real verification.
      </p>

      {templateRequest && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '12px 16px', borderRadius: '12px', marginBottom: '24px',
          background: 'var(--accent-primary-soft)', border: '1px solid var(--accent-primary)',
        }}>
          <GraduationCap size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
              <strong>Building for {templateRequest.course_code}</strong>. Requested by {templateRequest.requested_by_name}.
              Pre-filled from their estimated specs; on Promote this will auto-assign to the course and notify them.
            </p>
            {requestQuotaCheck && !requestQuotaCheck.fits_quota && (
              <p style={{ fontSize: '12px', color: '#F59E0B', marginTop: '6px' }}>
                ⚠️ {requestQuotaCheck.message} The build itself will be blocked if it genuinely exceeds quota at that moment.
              </p>
            )}
          </div>
        </div>
      )}

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

      {/* Resume banner — real, still-in-progress jobs exist; let the
          admin choose to resume or delete each one rather than
          silently forcing any path. Deleting genuinely removes the
          real Proxmox VM too (see handleDeleteJob). */}
      {!job && !resumeChoiceMade && activeJobs.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '16px', border: '1px solid var(--accent-primary)' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px' }}>
            You have {activeJobs.length === 1 ? 'an in-progress template' : `${activeJobs.length} in-progress templates`}:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {activeJobs.map(j => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'var(--bg-input)', borderRadius: '10px', padding: '10px 12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{j.name}</strong>: {STEP_LABELS[j.status] || j.status}
                  {j.proxmox_vmid ? ` (VM ${j.proxmox_vmid})` : ''}
                </span>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button style={{ ...primaryBtn, padding: '6px 14px', fontSize: '12px' }} onClick={() => { setJob(j); setResumeChoiceMade(true); }}>
                    Resume
                  </button>
                  <button
                    style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--status-error, #EF4444)', border: '1px solid var(--status-error, #EF4444)', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setDeleteJobTarget(j)}
                    disabled={deletingJobId === j.id}
                  >
                    {deletingJobId === j.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            style={{ ...primaryBtn, background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            onClick={() => setResumeChoiceMade(true)}
          >
            Start New Instead
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteJobTarget}
        title="Delete Template Job?"
        message={`This genuinely deletes "${deleteJobTarget?.name}" and its real Proxmox VM${deleteJobTarget?.proxmox_vmid ? ` (vmid ${deleteJobTarget.proxmox_vmid})` : ''} too, unless it's already been promoted into a live template. This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => handleDeleteJob(deleteJobTarget)}
        onCancel={() => setDeleteJobTarget(null)}
      />

      {/* STEP 1: form */}
      {!job && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Step 1: VM Specification</h2>

          {/* Real, deliberate first choice (Phase 3): this determines
              everything downstream — a 'server' pick means no desktop
              environment is ever configured, ongoing access is via
              Guacamole SSH only (never RDP/VNC), and the promote form
              won't ask for a desktop environment either. Locked to
              whatever it was at Create VM time — the backend job row
              itself is immutable on this field once created, so
              changing it after the VM already exists would just be
              lying to the UI. */}
          <label style={labelStyle}>Template Type</label>
          {/* Real, confirmed bug found via a real 375px screenshot: a
              fixed 2-column grid left the "Desktop" card's title text
              nearly touching the selected-state checkmark and squeezed
              the description down to one word per line — readable but
              genuinely cramped. A real CSS media query (not another
              inline-style width guess) stacks this to one column below
              480px, where two side-by-side cards can't carry this much
              copy comfortably. */}
          <style>{`
            @media (max-width: 480px) {
              .template-type-picker { grid-template-columns: 1fr !important; }
            }
          `}</style>
          <div className="template-type-picker" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px', marginBottom: '18px' }}>
            {[
              { value: 'desktop', title: 'Desktop Environment', desc: 'A full graphical desktop, streamed via RDP.', icon: <Monitor size={18} /> },
              { value: 'server', title: 'Server (CLI only)', desc: 'Headless. No desktop at all. Ongoing access via SSH only.', icon: <Terminal size={18} /> },
            ].map(opt => {
              const selected = form.template_type === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setForm({ ...form, template_type: opt.value })}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                  style={{
                    position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '10px', textAlign: 'left',
                    width: '100%', minWidth: 0, boxSizing: 'border-box',
                    padding: '14px', borderRadius: '12px', cursor: 'pointer', transition: 'border-color 150ms ease, background 150ms ease',
                    border: `1.5px solid ${selected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    background: selected ? 'var(--accent-primary-bg, rgba(99,102,241,0.08))' : 'var(--bg-input)',
                  }}
                >
                  {selected && (
                    <CheckCircle2 size={16} style={{ position: 'absolute', top: '10px', right: '10px', color: 'var(--accent-primary)' }} />
                  )}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    width: '30px', height: '30px', borderRadius: '9px',
                    background: selected ? 'var(--accent-primary)' : 'var(--bg-canvas, rgba(255,255,255,0.05))',
                    color: selected ? '#fff' : 'var(--text-secondary)',
                  }}>
                    {opt.icon}
                  </div>
                  <div style={{ minWidth: 0, paddingRight: '22px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{opt.title}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Template Name</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Debian Dev Workstation" />
            </div>
            {!isServerType && (
              <div>
                <label style={labelStyle}>Desktop Environment</label>
                <select style={inputStyle} value={form.desktop_environment_id} onChange={e => setForm({ ...form, desktop_environment_id: e.target.value })}>
                  <option value="">Select...</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                </select>
              </div>
            )}
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
          </div>

          {/* ISO acquisition — pick an already-uploaded ISO, upload a
              real file directly, or have Proxmox download one
              server-side from a URL. Never touches Proxmox's own UI. */}
          <label style={labelStyle}>ISO Image</label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {[['existing', 'Use Existing'], ['upload', 'Upload File'], ['url', 'Download from URL']].map(([mode, label]) => (
              <button key={mode} onClick={() => setIsoMode(mode)} style={{
                padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: isoMode === mode ? 'var(--accent-primary)' : 'var(--bg-input)',
                color: isoMode === mode ? '#fff' : 'var(--text-secondary)',
              }}>{label}</button>
            ))}
          </div>

          {isoMode === 'existing' && (
            <select style={{ ...inputStyle, marginBottom: '16px' }} value={form.iso_volid} onChange={e => setForm({ ...form, iso_volid: e.target.value })}>
              <option value="">Select...</option>
              {isos.map(i => <option key={i.volid} value={i.volid}>{i.filename} ({(i.size_bytes / 1e9).toFixed(2)} GB)</option>)}
            </select>
          )}

          {isoMode === 'upload' && (
            <div style={{ marginBottom: '16px' }}>
              <input type="file" accept=".iso" onChange={handleFileSelect} disabled={uploading}
                style={{ fontSize: '12px', color: 'var(--text-secondary)' }} />
              {uploading && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-input)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--accent-primary)', transition: 'width 0.2s' }} />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Finalizing on the server...'}
                  </p>
                </div>
              )}
              {form.iso_volid && !uploading && isoMode === 'upload' && (
                <p style={{ fontSize: '12px', color: 'var(--status-success, #10B981)', marginTop: '8px' }}>
                  Selected: {form.iso_volid.split('/').pop()}
                </p>
              )}
            </div>
          )}

          {isoMode === 'url' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <input style={inputStyle} value={isoUrl} onChange={e => setIsoUrl(e.target.value)}
                  placeholder="https://releases.ubuntu.com/.../ubuntu-22.04.5-desktop-amd64.iso" disabled={downloading} />
                <input style={inputStyle} value={isoUrlFilename} onChange={e => setIsoUrlFilename(e.target.value)}
                  placeholder="save-as-name.iso" disabled={downloading} />
              </div>
              <button style={primaryBtn} onClick={handleUrlDownload} disabled={downloading}>
                {downloading ? <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} /> : null}
                Start Download
              </button>
              {downloading && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-input)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${downloadProgress?.percent ?? 3}%`,
                      background: 'var(--accent-primary)',
                      transition: 'width 0.4s',
                    }} />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {downloadProgress?.percent != null
                      ? `Downloading on the server... ${downloadProgress.percent}%`
                        + (downloadProgress.speed ? ` · ${downloadProgress.speed}B/s` : '')
                        + (downloadProgress.eta ? ` · ETA ${downloadProgress.eta}` : '')
                      : 'Starting server-side download...'}
                  </p>
                  {downloadProgress?.bytes_downloaded != null && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {(downloadProgress.bytes_downloaded / 1e9).toFixed(2)} GB downloaded so far
                    </p>
                  )}
                </div>
              )}
              {form.iso_volid && !downloading && isoMode === 'url' && (
                <p style={{ fontSize: '12px', color: 'var(--status-success, #10B981)', marginTop: '8px' }}>
                  Selected: {form.iso_volid.split('/').pop()}
                </p>
              )}
            </div>
          )}

          <button style={primaryBtn} onClick={handleCreateVm} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} /> : null}
            Create VM
          </button>
        </div>
      )}

      {/* STEP 2: awaiting OS install — real console + terminal, embedded, never leaving the app */}
      {job && job.status === 'awaiting_os_install' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Step 2: Install the OS</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '10px' }}>
            The VM is running and booted from the ISO. Complete the real OS installer directly below —
            language, keyboard, disk, user account — then enable SSH (or install openssh-server) and click Continue.
          </p>
          <div style={{
            background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px',
            padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)',
          }}>
            <b style={{ color: 'var(--text-primary)' }}>Before clicking Continue:</b>{' '}
            {job.template_type === 'server' ? (
              <>most server installers (Ubuntu Server included) offer to install OpenSSH Server directly in
              the setup screens. Check that box if you see it. If it wasn't offered or wasn't checked, open a
              terminal in the console above (or the Terminal tab once SSH is up) and run:</>
            ) : (
              <>most desktop Linux distros (Parrot included) don't ship an SSH server by default. Open a
              terminal in the console above (or the Terminal tab once SSH is up) and run:</>
            )}
            <div style={{
              marginTop: '6px', fontFamily: 'monospace', fontSize: '12px', background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px',
              color: 'var(--text-primary)', userSelect: 'all',
            }}>
              sudo apt update &amp;&amp; sudo apt install openssh-server -y
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>VM: <b>{job.proxmox_vmid}</b></span>
            {vmIp && <span style={{ fontSize: '12px', color: 'var(--status-success, #10B981)' }}>Real IP detected: <b>{vmIp}</b> (SSH reachable)</span>}
          </div>

          {/* Real power state + controls — a stopped or hung VM used to look
              identical to a genuine display/VNC bug: a permanently blank
              console with no way to tell which one it was, or fix it. */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '10px 14px',
            background: 'var(--bg-input)',
            borderRadius: '10px',
            marginBottom: '10px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <div style={{
                width: '8px', height: '8px',
                borderRadius: '50%',
                background: powerStatus === 'running'
                  ? 'var(--status-online, #10B981)'
                  : powerStatus === null
                    ? 'var(--text-muted)'
                    : 'var(--status-offline, #EF4444)',
              }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {powerStatus === null ? 'Checking…' : powerStatus === 'running' ? 'Running' : 'Stopped'}
              </span>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {powerStatus !== 'running' && (
                <button onClick={() => handlePower('start')} disabled={powerBusy || powerStatus === null} style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)', color: 'var(--text-primary)',
                }}>
                  <Power size={14} /> Power On
                </button>
              )}
              {powerStatus === 'running' && (
                <>
                  <button onClick={() => handlePower('restart')} disabled={powerBusy} style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                  }}>
                    <RotateCw size={14} /> Restart
                  </button>
                  <button onClick={() => handlePower('shutdown')} disabled={powerBusy} style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                  }}>
                    <PowerOff size={14} /> Shutdown
                  </button>
                  <button onClick={() => { if (window.confirm('Force-stop the VM? This is a hard power-cut, not a graceful shutdown. Use it when the guest is hung and Shutdown/Restart time out without doing anything.')) handlePower('stop'); }} disabled={powerBusy} style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--status-offline, #EF4444)',
                    background: 'transparent', color: 'var(--status-offline, #EF4444)',
                  }}>
                    <PowerOff size={14} /> Force Stop
                  </button>
                </>
              )}
            </div>
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
            {consoleTab === 'console' && consoleFailed && (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '10px', color: '#f87171', fontSize: '13px', textAlign: 'center', padding: '0 24px',
              }}>
                <AlertTriangle size={22} />
                <div>
                  Couldn't establish the real install console after several attempts.
                  <br />
                  The VM itself is fine — this is a connection issue with the console bridge.
                </div>
                <button onClick={() => openConsole(true)} disabled={consoleLoading} style={{
                  fontSize: '12px', padding: '6px 16px', borderRadius: '6px', border: '1px solid #f87171',
                  background: 'transparent', color: '#f87171', cursor: 'pointer', fontWeight: 600,
                }}>
                  {consoleLoading ? 'Retrying…' : 'Retry Connection'}
                </button>
              </div>
            )}
            {consoleTab === 'console' && !consoleFailed && consoleUrl2 && (
              <GuacamoleEmbed url={consoleUrl2} title="Install Console" loadingText="Connecting to the real install console..." tunnelActive={consoleTunnelActive} onReadyChange={setConsoleReady} />
            )}
            {consoleTab === 'console' && !consoleFailed && !consoleUrl2 && (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                {consoleLoading ? 'Connecting to the real console…' : 'Console not connected yet.'}
              </div>
            )}
            {consoleTab === 'terminal' && terminalUrl && (
              <GuacamoleEmbed url={terminalUrl} title="Terminal" loadingText="Connecting to terminal..." tunnelActive={terminalTunnelActive} />
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
              <label style={labelStyle}>VM IP (only if not auto-detected above. Guest-agent isn't installed yet at this stage, so check the console or run `ip a`)</label>
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
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Step 3/4: Configuration &amp; Apps</h2>

          {/* Real, confirmed fix: a power action sent while this step is
              genuinely running is what left dpkg interrupted before
              (job 18's actual log). The backend rejects it outright
              (409) — this banner + disabled buttons make that visible
              up front instead of the admin discovering it via an error
              toast, and the live log right below proves real,
              ongoing progress instead of a static, ambiguous screen. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            padding: '10px 14px', background: 'var(--status-warning-bg)',
            border: '1px solid var(--status-warning)', borderRadius: '10px', marginBottom: '14px',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, minWidth: '240px' }}>
              ⏳ <b>Configuration in progress</b>. This can take several minutes (full-upgrade alone
              typically takes ~13 minutes). Power controls are disabled to protect the installation —
              watch the live log below for real, ongoing progress.
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: powerStatus === 'running' ? 'var(--status-online, #10B981)' : 'var(--text-muted)',
              }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {powerStatus === null ? 'Checking…' : powerStatus === 'running' ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {['Restart', 'Shutdown', 'Force Stop'].map(label => (
                <button key={label} disabled title="Blocked while configuration is actively running" style={{
                  padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                  color: 'var(--text-muted)', cursor: 'not-allowed', opacity: 0.6,
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <JobLog job={job} />
          <div style={{ marginTop: '20px' }}>
            <label style={labelStyle}>
              {job.template_type === 'server' ? 'Common CLI Tools (optional. A server template needs none of these.)' : 'Common Apps'}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {(job.template_type === 'server' ? COMMON_SERVER_PACKAGES : COMMON_APPS).map(app => (
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
            <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button style={primaryBtn} onClick={handleInstallApps} disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} /> : null}
                Install Selected
              </button>
              <button style={{ ...primaryBtn, background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }} onClick={openTerminal} disabled={loading}>
                <Terminal size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Open Terminal
              </button>
              {job.template_type === 'server' && (
                <button
                  style={{ ...primaryBtn, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                  onClick={handleFinalize}
                  disabled={loading}
                  title="This server template needs no CLI tools beyond the base OS. Go straight to finalizing."
                >
                  Skip — Finalize with Base OS Only
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: finalize. For a desktop job, shown once at least one
          app install attempt happened (existing behavior, unchanged).
          For a server job, CLI tools are genuinely optional (see the
          Skip button above) — always available the moment the job
          reaches installing_apps, never gated behind having installed
          something first. */}
      {job && job.status === 'installing_apps' && (job.template_type === 'server' || job.log?.some(l => l.message.includes('exit'))) && (
        <div style={{ ...cardStyle, marginTop: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Step 5: Finalize Template</h2>
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
              <label style={labelStyle}>Icon (emoji fallback. Only used if no OS family below.)</label>
              <input style={inputStyle} value={promoteForm.icon} onChange={e => setPromoteForm({ ...promoteForm, icon: e.target.value })} />
            </div>
            {job.template_type === 'server' && (
              <div>
                <label style={labelStyle}>OS Display Name (this template has no desktop environment to derive one from)</label>
                <input
                  style={inputStyle}
                  value={promoteForm.os}
                  onChange={e => setPromoteForm({ ...promoteForm, os: e.target.value })}
                  placeholder="e.g. Ubuntu 22.04 Server. Leave blank to guess from the ISO filename."
                />
              </div>
            )}
            <div>
              <label style={labelStyle}>OS family (picks the real, correctly-licensed OS icon shown everywhere)</label>
              <input
                style={inputStyle}
                list="os-family-options"
                value={promoteForm.os_family}
                onChange={e => setPromoteForm({ ...promoteForm, os_family: e.target.value })}
                placeholder="e.g. ubuntu, debian, parrot, zorin, windows"
              />
              <datalist id="os-family-options">
                <option value="ubuntu" /><option value="debian" /><option value="parrot" />
                <option value="zorin" /><option value="kali" /><option value="fedora" />
                <option value="arch" /><option value="centos" /><option value="mint" />
                <option value="windows" /><option value="macos" /><option value="linux" />
              </datalist>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={promoteForm.description} onChange={e => setPromoteForm({ ...promoteForm, description: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Price/hour (TZS)</label>
              <input type="number" step="0.01" min={0} style={inputStyle} value={promoteForm.price_per_hour} onChange={e => setPromoteForm({ ...promoteForm, price_per_hour: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Price/month (TZS)</label>
              <input type="number" step="0.01" min={0} style={inputStyle} value={promoteForm.price_per_month} onChange={e => setPromoteForm({ ...promoteForm, price_per_month: e.target.value })} />
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
            <GuacamoleEmbed url={terminalUrl} title="Wizard Terminal" loadingText="Connecting to terminal..." tunnelActive={terminalTunnelActive} />
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
