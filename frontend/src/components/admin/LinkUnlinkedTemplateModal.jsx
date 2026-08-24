import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const OS_FAMILY_OPTIONS = ['ubuntu', 'debian', 'parrot', 'zorin', 'kali', 'fedora', 'arch', 'centos', 'mint', 'windows', 'macos', 'linux'];

const labelStyle = { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' };

// Creates a real, new VMTemplate row pointing at an already-real,
// already-built Proxmox template that just isn't connected to the
// platform yet — the "Link to Platform" action from the Unlinked
// Proxmox Templates section.
export default function LinkUnlinkedTemplateModal({ unlinked, isOpen, onClose, onLinked }) {
  const [name, setName] = useState('');
  const [osFamily, setOsFamily] = useState('');
  const [pricePerHour, setPricePerHour] = useState(0);
  const [pricePerMonth, setPricePerMonth] = useState(0);
  // Real, deliberate (Phase 4): the backend link-unlinked-template
  // endpoint has accepted template_type since Phase 3, but this modal
  // never sent one — every template linked this way silently defaulted
  // to 'desktop', even a real, already-built headless server template
  // an admin created outside the wizard. Defaulting the picker itself
  // to 'desktop' keeps every existing linking flow's behavior
  // unchanged unless the admin actively picks otherwise.
  const [templateType, setTemplateType] = useState('desktop');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (unlinked) {
      setName(unlinked.name || `Template ${unlinked.proxmox_vmid}`);
      setOsFamily('');
      setPricePerHour(0);
      setPricePerMonth(0);
      setTemplateType('desktop');
    }
  }, [unlinked]);

  if (!isOpen || !unlinked) return null;

  const handleLink = async () => {
    if (!name.trim()) {
      toast.error('Name is required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/vms/admin/templates/unlinked/link/', {
        proxmox_vmid: unlinked.proxmox_vmid,
        name: name.trim(),
        os_family: osFamily,
        price_per_hour: pricePerHour,
        price_per_month: pricePerMonth,
        template_type: templateType,
      });
      toast.success(`"${name}" is now a real, linked template.`);
      onLinked();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to link template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: '16px', width: '440px', maxWidth: '90vw',
        boxShadow: 'var(--shadow-xl)', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700 }}>
            Link Proxmox Template {unlinked.proxmox_vmid} to the Platform
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
            "{unlinked.name}" already exists in Proxmox — this creates a real VMTemplate record pointing at it. No new VM is created.
          </p>
        </div>

        <div style={{ padding: '24px' }}>
          <label style={labelStyle}>Template Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {[
              { value: 'desktop', label: 'Desktop' },
              { value: 'server', label: 'Server (CLI only)' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setTemplateType(opt.value)}
                style={{
                  padding: '9px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${templateType === opt.value ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  background: templateType === opt.value ? 'var(--accent-primary)' : 'var(--bg-input)',
                  color: templateType === opt.value ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label style={labelStyle}>Display Name *</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />

          <label style={labelStyle}>OS Family (real icon)</label>
          <input
            style={inputStyle}
            list="unlinked-os-family-options"
            value={osFamily}
            onChange={e => setOsFamily(e.target.value)}
            placeholder="e.g. ubuntu, debian, parrot"
          />
          <datalist id="unlinked-os-family-options">
            {OS_FAMILY_OPTIONS.map(o => <option key={o} value={o} />)}
          </datalist>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Price / Hour (TZS)</label>
              <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerHour} onChange={e => setPricePerHour(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={labelStyle}>Price / Month (TZS)</label>
              <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerMonth} onChange={e => setPricePerMonth(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleLink} disabled={saving} style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--accent-primary)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Linking...' : 'Link to Platform'}
          </button>
        </div>
      </div>
    </div>
  );
}
