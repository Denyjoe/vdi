import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useBreakpoint from '../../hooks/useBreakpoint';
import { 
  Plus, ChevronDown, ChevronUp, Edit2, Eye, EyeOff, Trash2, 
  X, Check, Save, Loader2, RefreshCw, Monitor, Server, AlertTriangle, CheckCircle,
  Code, Zap, AppWindow, HardDrive, Database, Shield, Globe, Terminal, Film,
  Smartphone, Cpu, Palette, Network
} from 'lucide-react';
import api from '../../services/api';
import Toast from '../../components/shared/Toast';
import ConfirmModal from '../../components/shared/ConfirmModal';
import TemplateLinkModal from '../../components/admin/TemplateLinkModal';

const OS_OPTIONS = [
  'Windows 10 Pro',
  'Windows 11 Pro',
  'Ubuntu 22.04 LTS',
  'Ubuntu 20.04 LTS',
  'Kali Linux 2024',
  'CentOS 8',
  'Custom',
];

import OsIcon, { OS_ICONS } from '../../components/shared/OsIcon';

const ICON_MAP = {
  Monitor, Code, Zap, AppWindow,
  Server, HardDrive, Database,
  Shield, Globe, Terminal, Film,
  Smartphone, Cpu, Palette, Network,
};

function TemplateIcon({ name, size = 16, color, templateName }) {
  if (templateName && OS_ICONS[templateName]) {
    return <span style={{ display: 'inline-flex' }}><OsIcon templateName={templateName} size={size} color={color} /></span>;
  }
  const IconComponent = ICON_MAP[name] || Monitor;
  return <IconComponent size={size} style={{ color }} />;
}

const EMPTY_FORM = {
  name: '',
  template_type: 'desktop',
  os: 'Ubuntu 22.04 LTS',
  cpu_cores: 2,
  ram_gb: 4,
  storage_gb: 40,
  price_per_hour: 0,
  price_per_month: 0,
  monthly_cap: 0,
  software_list: [],
  icon: 'Monitor',
  description: '',
  is_available: true,
};

export default function AdminTemplatesPage() {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [softwareInput, setSoftwareInput] = useState('');
  const [customOs, setCustomOs] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [linkModalTemplate, setLinkModalTemplate] = useState(null);

  const fetchTemplates = async (isManual = false) => {
    if (!isManual) setLoading(true);
    try {
      const res = await api.get('/vms/admin/templates/', { params: { t: Date.now() } }); // Prevent caching
      setTemplates(res.data.data);
      if (isManual) showToast('Templates refreshed', 'success');
    } catch {
      if (!isManual) showToast('Failed to load templates', 'error');
      else showToast('Failed to refresh templates', 'error');
    } finally {
      if (!isManual) setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTemplates(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 500); // 500ms min delay so spinner animation is visible
  };

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, message: msg, type });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSoftwareInput('');
    setCustomOs('');
    setFormErrors({});
    setEditingId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (template) => {
    setEditingId(template.id);
    setForm({
      name: template.name || '',
      template_type: template.template_type || 'desktop',
      os: OS_OPTIONS.includes(template.os) ? template.os : 'Custom',
      cpu_cores: template.cpu_cores || 2,
      ram_gb: template.ram_gb || 4,
      storage_gb: template.storage_gb || 40,
      price_per_hour: parseFloat(template.price_per_hour) || 0,
      price_per_month: parseFloat(template.price_per_month) || 0,
      monthly_cap: parseFloat(template.monthly_cap) || 0,
      software_list: template.software_list || [],
      icon: template.icon || 'Monitor',
      description: template.description || '',
      is_available: template.is_available,
    });
    if (!OS_OPTIONS.includes(template.os)) {
      setCustomOs(template.os);
    }
    setFormOpen(true);
  };

  const handleSoftwareKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = softwareInput.trim();
      if (val && !form.software_list.includes(val)) {
        setForm(p => ({ ...p, software_list: [...p.software_list, val] }));
      }
      setSoftwareInput('');
    }
  };

  const removeSoftwareTag = (sw) => {
    setForm(p => ({ ...p, software_list: p.software_list.filter(item => item !== sw) }));
  };

  const toggleAvailability = async (template) => {
    try {
      await api.put(`/vms/admin/templates/${template.id}/`, {
        is_available: !template.is_available
      });
      fetchTemplates();
      showToast('Template updated');
    } catch {
      showToast('Failed to update template', 'error');
    }
  };

  const handleDelete = async (template) => {
    try {
      const res = await api.delete(`/vms/admin/templates/${template.id}/delete/`);
      if (res.data.success) {
        showToast('Template deleted');
        setDeleteTarget(null);
        fetchTemplates();
      }
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to delete template', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return setFormErrors({ name: 'Name is required' });

    setSaving(true);
    try {
      const payload = {
        ...form,
        os: form.os === 'Custom' ? customOs : form.os,
      };
      
      if (editingId) {
        await api.put(`/vms/admin/templates/${editingId}/`, payload);
        showToast('Template updated successfully');
      } else {
        await api.post('/vms/admin/templates/create/', payload);
        showToast('Template created successfully');
      }
      setFormOpen(false);
      resetForm();
      fetchTemplates();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' };
  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' };
  const iconButtonStyle = { padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
      <ConfirmModal isOpen={!!deleteTarget} title="Delete Template" message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`} confirmText="Delete" cancelText="Cancel" onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} isDanger={true} />
      
      <TemplateLinkModal template={linkModalTemplate} isOpen={!!linkModalTemplate} onClose={() => setLinkModalTemplate(null)} onLinked={() => { setLinkModalTemplate(null); fetchTemplates(); }} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">VM Templates</h1>
          <p className="text-[var(--text-secondary)] mt-1">Manage the catalogue of available virtual machines.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleRefresh} disabled={refreshing} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--text-primary)',
            border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
          }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          {!formOpen && (
            <>
              <button onClick={() => navigate('/admin/templates/new')} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }} title="Build a genuinely new OS template from scratch — real VM, real install, real config">
                <Server size={14} />
                New OS Template
              </button>
              <button onClick={openCreateForm} className="flex items-center gap-2 bg-[var(--accent-primary)] hover:opacity-90 text-white px-4 py-2 rounded-xl transition-opacity font-medium shadow-lg shadow-[var(--accent-primary)]/20">
                <Plus size={18} />
                Add Template
              </button>
            </>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{editingId ? 'Edit Template' : 'Create New Template'}</h2>
            <button onClick={() => { setFormOpen(false); resetForm(); }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 transition-colors">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label style={labelStyle}>Template Name *</label>
                <input style={inputStyle} type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. AutoCAD Workstation" required />
                {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label style={labelStyle}>Icon</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {Object.entries(ICON_MAP).map(([name, Icon]) => (
                    <button key={name} type="button" onClick={() => setForm(f => ({ ...f, icon: name }))} style={{
                      padding: '10px', borderRadius: '10px',
                      border: form.icon === name ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: form.icon === name ? 'var(--accent-primary-soft)' : 'var(--bg-input)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}>
                      <Icon size={18} style={{ color: form.icon === name ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px', gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Template Type *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, template_type: 'desktop' }))} style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: form.template_type === 'desktop' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: form.template_type === 'desktop' ? 'var(--accent-primary-soft)' : 'var(--bg-input)',
                    color: form.template_type === 'desktop' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 600,
                  }}>
                    <Monitor size={16} /> Desktop
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, template_type: 'server' }))} style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: form.template_type === 'server' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: form.template_type === 'server' ? 'var(--accent-primary-soft)' : 'var(--bg-input)',
                    color: form.template_type === 'server' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 600,
                  }}>
                    <Server size={16} /> Server
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Operating System *</label>
                <select style={inputStyle} value={form.os} onChange={e => setForm(f => ({ ...f, os: e.target.value }))}>
                  {OS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {form.os === 'Custom' && (
                  <input style={{...inputStyle, marginTop: '8px'}} type="text" value={customOs} onChange={e => setCustomOs(e.target.value)} placeholder="e.g. Debian 12" required />
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div><label style={labelStyle}>vCPU Cores</label><input style={inputStyle} type="number" min="1" max="64" value={form.cpu_cores} onChange={e => setForm(f => ({ ...f, cpu_cores: parseInt(e.target.value)||1 }))} /></div>
                <div><label style={labelStyle}>RAM (GB)</label><input style={inputStyle} type="number" min="1" max="256" value={form.ram_gb} onChange={e => setForm(f => ({ ...f, ram_gb: parseInt(e.target.value)||1 }))} /></div>
                <div><label style={labelStyle}>Storage (GB)</label><input style={inputStyle} type="number" min="10" max="2000" value={form.storage_gb} onChange={e => setForm(f => ({ ...f, storage_gb: parseInt(e.target.value)||10 }))} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px', gridColumn: '1 / -1' }}>
                <div>
                  <label style={labelStyle}>Price per Hour (TZS)</label>
                  <input type="number" min={0} value={form.price_per_hour} onChange={e => setForm(f => ({ ...f, price_per_hour: parseFloat(e.target.value) || 0 }))} placeholder="0" style={inputStyle} />
                  <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px' }}>Charged when a user buys hours</p>
                </div>
                <div>
                  <label style={labelStyle}>Price per Month (TZS)</label>
                  <input type="number" min={0} value={form.price_per_month} onChange={e => setForm(f => ({ ...f, price_per_month: parseFloat(e.target.value) || 0 }))} placeholder="0" style={inputStyle} />
                  <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px' }}>Flat monthly subscription for unlimited access</p>
                </div>
                <div>
                  <label style={labelStyle}>Monthly Cap (TZS)</label>
                  <input type="number" min={0} value={form.monthly_cap} onChange={e => setForm(f => ({ ...f, monthly_cap: parseFloat(e.target.value) || 0 }))} placeholder="0" style={inputStyle} />
                  <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px' }}>Maximum monthly charge</p>
                </div>
              </div>

              <div className="md:col-span-2">
                <label style={labelStyle}>Included Software</label>
                <div style={{...inputStyle, padding: '8px', minHeight: '80px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                    {form.software_list.map(sw => (
                      <span key={sw} style={{display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600}}>
                        {sw}
                        <button type="button" onClick={() => removeSoftwareTag(sw)} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0}}><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                  <input type="text" value={softwareInput} onChange={e => setSoftwareInput(e.target.value)} onKeyDown={handleSoftwareKeyDown} placeholder="Type software name and press Enter..." style={{background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '13px', width: '100%'}} />
                </div>
              </div>

              <div className="md:col-span-2">
                <label style={labelStyle}>Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Brief description of what this template is used for..." style={{...inputStyle, resize: 'vertical'}} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => { setFormOpen(false); resetForm(); }} style={{ padding: '10px 20px', background: 'none', border: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <button type="submit" disabled={saving} style={{ padding: '10px 24px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving...' : (editingId ? 'Update Template' : 'Create Template')}
                </button>
                {!editingId && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center' }}>After creating, link this template to a Proxmox VM from the templates table to make it available for users to launch.</p>}
              </div>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
        {isMobile ? (
          // Real, measured mobile bug (Ospace responsive audit): this
          // 8-column table's overflow-x wrapper scrolled internally
          // (scrollWidth 796px vs clientWidth 342px at 375px) with no
          // visible affordance. Stacked cards instead, same established
          // pattern as AdminUsersPage/MemberSessionsPage.
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
            {loading && (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <Loader2 size={24} style={{ color: 'var(--accent-primary)', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
              </div>
            )}
            {!loading && templates.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                No templates found. Tap "Add Template" to create one.
              </div>
            )}
            {templates.map(t => (
              <div key={t.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', background: 'var(--bg-card)', opacity: t.is_available ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    <TemplateIcon name={t.icon} templateName={t.name} size={18} color="var(--accent-primary)" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', wordBreak: 'break-word' }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.software_list?.length || 0} apps</div>
                  </div>
                  {t.is_available ? (
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, background: 'var(--status-online-bg)', color: 'var(--status-online)', flexShrink: 0 }}>Available</span>
                  ) : (
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, background: 'var(--bg-input)', color: 'var(--text-secondary)', flexShrink: 0 }}>Hidden</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: t.template_type === 'server' ? 'var(--status-warning-bg)' : 'var(--status-info-bg)', color: t.template_type === 'server' ? 'var(--status-warning)' : 'var(--status-info)' }}>
                    {t.template_type}
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '10px', background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{t.os}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  {t.cpu_cores} vCPU · {t.ram_gb}GB RAM · {t.storage_gb}GB SSD
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '10px' }}>
                  {t.price_per_hour > 0 ? `TZS ${t.price_per_hour.toLocaleString()}/hr` : 'TZS 0/hr'}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
                    {t.price_per_month > 0 ? `TZS ${t.price_per_month.toLocaleString()}/mo` : 'no subscription'}
                  </span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  {t.proxmox_template_id ? (
                    t.has_duplicate_link ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} style={{ color: 'var(--status-warning)' }} />
                        <span style={{ fontSize: '11px', color: 'var(--status-warning)' }}>Duplicate (ID: {t.proxmox_template_id})</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} style={{ color: 'var(--status-online)' }} />
                        <span style={{ fontSize: '11px', color: 'var(--status-online)' }}>Linked (ID: {t.proxmox_template_id})</span>
                      </div>
                    )
                  ) : (
                    <button onClick={() => setLinkModalTemplate(t)} style={{ fontSize: '12px', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      + Link to Proxmox
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => openEditForm(t)} style={{ ...iconButtonStyle, flex: 1, width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit2 size={16} /></button>
                  <button onClick={() => toggleAvailability(t)} style={{ ...iconButtonStyle, flex: 1, width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t.is_available ? 'Hide from catalog' : 'Show in catalog'}>
                    {t.is_available ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button onClick={() => setDeleteTarget(t)} style={{ ...iconButtonStyle, flex: 1, width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-error)' }}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Icon / Name</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Type</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>OS</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Specs</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Price/hr</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Proxmox Link</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center' }}><Loader2 size={24} style={{ color: 'var(--accent-primary)', margin: '0 auto', animation: 'spin 1s linear infinite' }} /></td></tr>}
              {!loading && templates.length === 0 && <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No templates found. Click "Add Template" to create one.</td></tr>}
              {templates.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: t.is_available ? 1 : 0.6 }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                         <TemplateIcon name={t.icon} templateName={t.name} size={18} color="var(--accent-primary)" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{t.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.software_list?.length || 0} apps</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: t.template_type === 'server' ? 'var(--status-warning-bg)' : 'var(--status-info-bg)', color: t.template_type === 'server' ? 'var(--status-warning)' : 'var(--status-info)' }}>
                      {t.template_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{t.os}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {t.cpu_cores} vCPU · {t.ram_gb}GB · {t.storage_gb}GB
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    <div>{t.price_per_hour > 0 ? `TZS ${t.price_per_hour.toLocaleString()}/hr` : 'TZS 0/hr'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                      {t.price_per_month > 0 ? `TZS ${t.price_per_month.toLocaleString()}/mo` : 'no subscription'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.proxmox_template_id ? (
                      t.has_duplicate_link ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} style={{ color: 'var(--status-warning)' }} />
                          <span style={{ fontSize: '11px', color: 'var(--status-warning)' }}>Duplicate (ID: {t.proxmox_template_id})</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} style={{ color: 'var(--status-online)' }} />
                          <span style={{ fontSize: '11px', color: 'var(--status-online)' }}>Linked (ID: {t.proxmox_template_id})</span>
                        </div>
                      )
                    ) : (
                      <button onClick={() => setLinkModalTemplate(t)} style={{ fontSize: '11px', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        + Link to Proxmox
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.is_available ? (
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: 'var(--status-online-bg)', color: 'var(--status-online)' }}>Available</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Hidden</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button onClick={() => openEditForm(t)} style={iconButtonStyle}><Edit2 size={14} /></button>
                      <button onClick={() => toggleAvailability(t)} style={iconButtonStyle} title={t.is_available ? 'Hide from catalog' : 'Show in catalog'}>
                        {t.is_available ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button onClick={() => setDeleteTarget(t)} style={{ ...iconButtonStyle, color: 'var(--status-error)' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
