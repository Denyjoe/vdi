import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useBreakpoint from '../../hooks/useBreakpoint';
import {
  ChevronDown, ChevronUp, Edit2, Eye, EyeOff, Trash2,
  X, Check, Save, Loader2, RefreshCw, Monitor, Server, AlertTriangle, CheckCircle,
  Code, Zap, AppWindow, HardDrive, Database, Shield, Globe, Terminal, Film,
  Smartphone, Cpu, Palette, Network
} from 'lucide-react';
import api from '../../services/api';
import Toast from '../../components/shared/Toast';
import ConfirmModal from '../../components/shared/ConfirmModal';
import TemplateLinkModal from '../../components/admin/TemplateLinkModal';
import { getOsIcon } from '../../utils/osIcons';

const ICON_MAP = {
  Monitor, Code, Zap, AppWindow,
  Server, HardDrive, Database,
  Shield, Globe, Terminal, Film,
  Smartphone, Cpu, Palette, Network,
};

// Real OS icon (react-icons/Simple Icons) when the template has a known
// os_family; otherwise the manually-picked lucide icon (only ever
// relevant for the rare non-OS-identified row).
function TemplateIcon({ name, size = 16, color, osFamily }) {
  if (osFamily) {
    const IconComponent = getOsIcon(osFamily);
    return <span style={{ display: 'inline-flex' }}><IconComponent size={size} color={color} /></span>;
  }
  const IconComponent = ICON_MAP[name] || Monitor;
  return <IconComponent size={size} style={{ color }} />;
}

// Edit-only form: a real, wizard-built template's OS/specs are
// permanently baked into the actual Proxmox VM behind it, so only
// display/pricing fields are ever safe to change after the fact.
const EMPTY_EDIT_FORM = {
  name: '',
  price_per_hour: 0,
  price_per_month: 0,
  monthly_cap: 0,
  icon: 'Monitor',
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
  const [form, setForm] = useState(EMPTY_EDIT_FORM);
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
    setForm(EMPTY_EDIT_FORM);
    setFormErrors({});
    setEditingId(null);
  };

  const openEditForm = (template) => {
    setEditingId(template.id);
    setForm({
      name: template.name || '',
      price_per_hour: parseFloat(template.price_per_hour) || 0,
      price_per_month: parseFloat(template.price_per_month) || 0,
      monthly_cap: parseFloat(template.monthly_cap) || 0,
      icon: template.icon || 'Monitor',
    });
    setFormOpen(true);
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
      const res = await api.delete(`/vms/admin/templates/${template.id}/`);
      if (res.data.success) {
        showToast('Template deleted');
        setDeleteTarget(null);
        fetchTemplates();
      }
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to delete template', 'error');
    }
  };

  // Edit-only: this form only ever touches display/pricing fields on an
  // ALREADY-real, wizard-built template — there is no create path here
  // anymore. The backend also enforces this (AdminTemplateDetailView
  // rejects spec/OS changes on is_real templates), so this is real
  // defense in depth, not just a frontend convention.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    if (!form.name) return setFormErrors({ name: 'Name is required' });

    setSaving(true);
    try {
      await api.put(`/vms/admin/templates/${editingId}/`, {
        name: form.name,
        price_per_hour: form.price_per_hour,
        price_per_month: form.price_per_month,
        monthly_cap: form.monthly_cap,
        icon: form.icon,
      });
      showToast('Template updated successfully');
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
            // The only way to create a template: the real wizard, which
            // requires an actual, verified Proxmox VM behind every
            // template it produces. There is no manual/fake-entry path
            // anymore — a template row with no real VM behind it was a
            // genuine risk (members could see and try to launch it).
            <button onClick={() => navigate('/admin/templates/new')} className="flex items-center gap-2 bg-[var(--accent-primary)] hover:opacity-90 text-white px-4 py-2 rounded-xl transition-opacity font-medium shadow-lg shadow-[var(--accent-primary)]/20" title="Build a genuinely new OS template from scratch — real VM, real install, real config">
              <Server size={16} />
              New OS Template
            </button>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Edit Template</h2>
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
                <label style={labelStyle}>Icon (fallback — real templates show their real OS icon automatically)</label>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px', gridColumn: '1 / -1' }}>
                <div>
                  <label style={labelStyle}>Price per Hour (TZS)</label>
                  <input type="number" min={0} step="0.01" value={form.price_per_hour} onChange={e => setForm(f => ({ ...f, price_per_hour: parseFloat(e.target.value) || 0 }))} placeholder="0" style={inputStyle} />
                  <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px' }}>Charged when a user buys hours</p>
                </div>
                <div>
                  <label style={labelStyle}>Price per Month (TZS)</label>
                  <input type="number" min={0} step="0.01" value={form.price_per_month} onChange={e => setForm(f => ({ ...f, price_per_month: parseFloat(e.target.value) || 0 }))} placeholder="0" style={inputStyle} />
                  <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px' }}>Flat monthly subscription for unlimited access</p>
                </div>
                <div>
                  <label style={labelStyle}>Monthly Cap (TZS)</label>
                  <input type="number" min={0} step="0.01" value={form.monthly_cap} onChange={e => setForm(f => ({ ...f, monthly_cap: parseFloat(e.target.value) || 0 }))} placeholder="0" style={inputStyle} />
                  <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px' }}>Maximum monthly charge</p>
                </div>
              </div>

            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => { setFormOpen(false); resetForm(); }} style={{ padding: '10px 20px', background: 'none', border: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '10px 24px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : 'Update Template'}
              </button>
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
                No templates found. Click "New OS Template" to build one via the real wizard.
              </div>
            )}
            {templates.map(t => (
              <div key={t.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', background: 'var(--bg-card)', opacity: t.is_available ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    <TemplateIcon name={t.icon} osFamily={t.os_family} size={18} color="var(--accent-primary)" />
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
              {!loading && templates.length === 0 && <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No templates found. Click "New OS Template" to build one via the real wizard.</td></tr>}
              {templates.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: t.is_available ? 1 : 0.6 }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                         <TemplateIcon name={t.icon} osFamily={t.os_family} size={18} color="var(--accent-primary)" />
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
