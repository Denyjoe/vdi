import { useState, useEffect } from 'react';
import { 
  Plus, ChevronDown, ChevronUp, Edit2, Eye, EyeOff, Trash2, 
  X, Check, Save, Loader2, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import Toast from '../../components/shared/Toast';
import ConfirmModal from '../../components/shared/ConfirmModal';

/** OS options for the dropdown. */
const OS_OPTIONS = [
  'Windows 10 Pro',
  'Windows 11 Pro',
  'Ubuntu 22.04 LTS',
  'Ubuntu 20.04 LTS',
  'Kali Linux 2024',
  'CentOS 8',
  'Custom',
];

/** Icon name options relevant to computing. */
const ICON_OPTIONS = [
  'Monitor', 'Cpu', 'Code2', 'Database', 'Globe', 'Network',
  'Server', 'Shield', 'Smartphone', 'Film', 'Palette',
  'BrainCircuit', 'Compass', 'BarChart2', 'Building2',
  'Wifi', 'HardDrive', 'Terminal', 'Layout', 'Cloud',
];

/** Empty form state. */
const EMPTY_FORM = {
  name: '',
  os: 'Ubuntu 22.04 LTS',
  cpu_cores: 2,
  ram_gb: 4,
  storage_gb: 40,
  software_list: [],
  icon: 'Monitor',
  description: '',
  is_available: true,
};

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [softwareInput, setSoftwareInput] = useState('');
  const [customOs, setCustomOs] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // ── Data Fetching ────────────────────────────────────────────────────

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/vms/templates/');
      setTemplates(res.data.data);
    } catch {
      showToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  // ── Helpers ──────────────────────────────────────────────────────────

  /** @param {string} msg @param {'success'|'error'} type */
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

  /** Pre-fill form with an existing template for editing. */
  const openEditForm = (template) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      os: OS_OPTIONS.includes(template.os) ? template.os : 'Custom',
      cpu_cores: template.cpu_cores,
      ram_gb: template.ram_gb,
      storage_gb: template.storage_gb,
      software_list: template.software_list || [],
      icon: template.icon || 'Monitor',
      description: template.description || '',
      is_available: template.is_available,
    });
    if (!OS_OPTIONS.includes(template.os)) setCustomOs(template.os);
    setFormErrors({});
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Software Tags ────────────────────────────────────────────────────

  /** Add a software tag when Enter is pressed. */
  const handleSoftwareKeyDown = (e) => {
    if (e.key === 'Enter' && softwareInput.trim()) {
      e.preventDefault();
      if (!form.software_list.includes(softwareInput.trim())) {
        setForm(prev => ({ ...prev, software_list: [...prev.software_list, softwareInput.trim()] }));
      }
      setSoftwareInput('');
    }
  };

  const removeSoftwareTag = (tag) => {
    setForm(prev => ({ ...prev, software_list: prev.software_list.filter(s => s !== tag) }));
  };

  // ── Form Submission ──────────────────────────────────────────────────

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Template name is required.';
    if (form.os === 'Custom' && !customOs.trim()) errors.os = 'Enter a custom OS name.';
    if (form.cpu_cores < 1 || form.cpu_cores > 32) errors.cpu_cores = '1–32 cores.';
    if (form.ram_gb < 2 || form.ram_gb > 128) errors.ram_gb = '2–128 GB.';
    if (form.storage_gb < 20 || form.storage_gb > 2000) errors.storage_gb = '20–2000 GB.';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }

    const payload = {
      ...form,
      os: form.os === 'Custom' ? customOs.trim() : form.os,
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/admin/vms/templates/${editingId}/`, payload);
        showToast('Template updated successfully');
      } else {
        await api.post('/admin/vms/templates/', payload);
        showToast('Template created successfully');
      }
      resetForm();
      setFormOpen(false);
      fetchTemplates();
    } catch (err) {
      const msg = err.response?.data?.error
        ? JSON.stringify(err.response.data.error)
        : 'Failed to save template';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle Availability ──────────────────────────────────────────────

  const toggleAvailability = async (template) => {
    try {
      await api.patch(`/admin/vms/templates/${template.id}/`, {
        is_available: !template.is_available,
      });
      showToast(
        template.is_available ? `"${template.name}" hidden from catalog` : `"${template.name}" made available`
      );
      fetchTemplates();
    } catch {
      showToast('Failed to update availability', 'error');
    }
  };

  // ── Soft Delete ──────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/vms/templates/${deleteTarget.id}/`);
      showToast(`"${deleteTarget.name}" deactivated`);
      setDeleteTarget(null);
      fetchTemplates();
    } catch {
      showToast('Failed to deactivate template', 'error');
      setDeleteTarget(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: '' })}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Deactivate Template"
          message={`Are you sure you want to deactivate "${deleteTarget.name}"? It will be hidden from the user catalog. Existing VMs using this template are unaffected.`}
          confirmLabel="Deactivate"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] font-inter">VM Template Management</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">{templates.length} templates total</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchTemplates}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={formOpen ? () => { setFormOpen(false); resetForm(); } : openCreateForm}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {formOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {formOpen ? 'Cancel' : 'Add Template'}
          </button>
        </div>
      </div>

      {/* ── Collapsible Form ─────────────────────────────────────────── */}
      {formOpen && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-indigo-500/30 shadow-lg">
          <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {editingId ? 'Edit Template' : 'New Template'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Template Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Template Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Machine Learning Lab"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
            </div>

            {/* Operating System */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Operating System *</label>
              <select
                value={form.os}
                onChange={e => setForm(p => ({ ...p, os: e.target.value }))}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
              >
                {OS_OPTIONS.map(os => <option key={os} value={os}>{os}</option>)}
              </select>
              {form.os === 'Custom' && (
                <input
                  type="text"
                  value={customOs}
                  onChange={e => setCustomOs(e.target.value)}
                  placeholder="Enter custom OS name"
                  className="w-full mt-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                />
              )}
              {formErrors.os && <p className="text-red-400 text-xs mt-1">{formErrors.os}</p>}
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Icon</label>
              <select
                value={form.icon}
                onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
              >
                {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>

            {/* CPU, RAM, Storage */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">CPU Cores * (1–32)</label>
              <input
                type="number" min="1" max="32"
                value={form.cpu_cores}
                onChange={e => setForm(p => ({ ...p, cpu_cores: parseInt(e.target.value) || 1 }))}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
              />
              {formErrors.cpu_cores && <p className="text-red-400 text-xs mt-1">{formErrors.cpu_cores}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">RAM GB * (2–128)</label>
              <input
                type="number" min="2" max="128"
                value={form.ram_gb}
                onChange={e => setForm(p => ({ ...p, ram_gb: parseInt(e.target.value) || 2 }))}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
              />
              {formErrors.ram_gb && <p className="text-red-400 text-xs mt-1">{formErrors.ram_gb}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Storage GB * (20–2000)</label>
              <input
                type="number" min="20" max="2000"
                value={form.storage_gb}
                onChange={e => setForm(p => ({ ...p, storage_gb: parseInt(e.target.value) || 20 }))}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
              />
              {formErrors.storage_gb && <p className="text-red-400 text-xs mt-1">{formErrors.storage_gb}</p>}
            </div>

            {/* Available Toggle */}
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, is_available: !p.is_available }))}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none ${form.is_available ? 'bg-indigo-600' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform duration-200 ${form.is_available ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-[var(--text-primary)]">
                {form.is_available ? 'Available in catalog' : 'Hidden from catalog'}
              </span>
            </div>

            {/* Software List */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Software List</label>
              <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-3 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.software_list.map(sw => (
                    <span key={sw} className="flex items-center gap-1.5 bg-indigo-600/20 text-indigo-300 px-3 py-1 rounded-full text-sm border border-indigo-500/30">
                      {sw}
                      <button type="button" onClick={() => removeSoftwareTag(sw)} className="hover:text-[var(--text-primary)] transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={softwareInput}
                  onChange={e => setSoftwareInput(e.target.value)}
                  onKeyDown={handleSoftwareKeyDown}
                  placeholder='Type software name and press Enter...'
                  className="w-full bg-transparent text-[var(--text-primary)] text-sm focus:outline-none placeholder-slate-500"
                />
              </div>
              <p className="text-slate-500 text-xs mt-1">Press Enter to add each software item.</p>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Brief description of what this template is used for..."
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Form Actions */}
            <div className="md:col-span-2 flex justify-end gap-3 pt-2 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => { setFormOpen(false); resetForm(); }}
                className="px-4 py-2 text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : editingId ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Templates Table ─────────────────────────────────────────── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--text-primary)]">
            <thead className="text-xs text-[var(--text-secondary)] uppercase bg-[var(--bg-primary)]/50 border-b border-[var(--border-color)]">
              <tr>
                <th className="px-6 py-4 font-medium">Icon</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">OS</th>
                <th className="px-6 py-4 font-medium text-center">CPU</th>
                <th className="px-6 py-4 font-medium text-center">RAM</th>
                <th className="px-6 py-4 font-medium text-center">Storage</th>
                <th className="px-6 py-4 font-medium text-center">Software</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading && (
                <tr>
                  <td colSpan="9" className="px-6 py-10 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" />
                  </td>
                </tr>
              )}
              {!loading && templates.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-10 text-center text-[var(--text-secondary)]">
                    No templates found. Click "Add Template" to create one.
                  </td>
                </tr>
              )}
              {templates.map(template => (
                <tr key={template.id} className={`hover:bg-[var(--bg-card-hover)]/20 transition-colors ${!template.is_available ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4 text-lg font-mono text-[var(--text-secondary)]">{template.icon || 'Monitor'}</td>
                  <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{template.name}</td>
                  <td className="px-6 py-4 text-[var(--text-secondary)] text-xs">{template.os}</td>
                  <td className="px-6 py-4 text-center">{template.cpu_cores} cores</td>
                  <td className="px-6 py-4 text-center">{template.ram_gb} GB</td>
                  <td className="px-6 py-4 text-center">{template.storage_gb} GB</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-[var(--bg-card-hover)] px-2 py-0.5 rounded text-xs">
                      {template.software_list?.length || 0} apps
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {template.is_available ? (
                      <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs font-medium border border-emerald-400/20">Available</span>
                    ) : (
                      <span className="text-[var(--text-secondary)] bg-[var(--bg-card-hover)] px-2 py-1 rounded text-xs font-medium border border-slate-600">Hidden</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditForm(template)}
                        title="Edit"
                        className="p-1.5 text-[var(--text-secondary)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleAvailability(template)}
                        title={template.is_available ? 'Hide from catalog' : 'Show in catalog'}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                      >
                        {template.is_available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(template)}
                        title="Deactivate"
                        className="p-1.5 text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
