import { useState, useEffect, useCallback } from 'react';
import {
  Landmark, CheckCircle, XCircle, Clock, Ban, X, Receipt,
  DollarSign, RefreshCw, FileText, Pencil, Trash2, PlayCircle, AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import useConfirm from '../../hooks/useConfirm';

const STATUS_META = {
  pending: { label: 'Pending', color: '#f59e0b', icon: Clock },
  active: { label: 'Active', color: '#10b981', icon: CheckCircle },
  suspended: { label: 'Suspended', color: '#ef4444', icon: Ban },
  rejected: { label: 'Rejected', color: '#6b7280', icon: XCircle },
};

const INVOICE_STATUS_META = {
  pending: { label: 'Pending', color: '#f59e0b' },
  sent: { label: 'Sent', color: '#3b82f6' },
  paid: { label: 'Paid', color: '#10b981' },
  overdue: { label: 'Overdue', color: '#ef4444' },
};

function StatusPill({ meta }) {
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: `${meta.color}1a`, color: meta.color }}
    >
      {Icon && <Icon size={12} />}
      {meta.label}
    </span>
  );
}

export default function SuperAdminUniversityRequestsPage() {
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [tab, setTab] = useState('requests'); // requests | universities | invoices | revenue
  const [universities, setUniversities] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [approveTarget, setApproveTarget] = useState(null);
  const [approveForm, setApproveForm] = useState({
    admin_user_email: '', seats_allocated: '', price_per_seat_tzs: '', billing_cycle: 'semester',
    max_vcpu_cores: '', max_ram_gb: '', max_storage_gb: '',
  });
  const [approving, setApproving] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [suspending, setSuspending] = useState(null);
  const [reactivating, setReactivating] = useState(null);

  const [editTermsTarget, setEditTermsTarget] = useState(null);
  const [editTermsForm, setEditTermsForm] = useState({
    seats_allocated: '', price_per_seat_tzs: '', billing_cycle: 'semester',
    max_vcpu_cores: '', max_ram_gb: '', max_storage_gb: '',
  });
  const [savingTerms, setSavingTerms] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    university_id: '', amount_tzs: '', billing_period_start: '', billing_period_end: '', due_date: '',
  });
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [uniRes, invRes, revRes] = await Promise.all([
        api.get('/superadmin/university/universities/'),
        api.get('/superadmin/university/invoices/'),
        api.get('/superadmin/university/revenue/'),
      ]);
      setUniversities(uniRes.data?.data || []);
      setInvoices(invRes.data?.data || []);
      setRevenue(revRes.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load university data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRefresh = () => { setRefreshing(true); fetchAll(); };

  const pending = universities.filter(u => u.status === 'pending');
  const active = universities.filter(u => u.status === 'active' || u.status === 'suspended');
  const rejected = universities.filter(u => u.status === 'rejected');

  const openApprove = (uni) => {
    setApproveTarget(uni);
    setApproveForm({
      admin_user_email: uni.contact_email || '',
      seats_allocated: '', price_per_seat_tzs: '', billing_cycle: 'semester',
      max_vcpu_cores: uni.requested_vcpu_cores || '',
      max_ram_gb: uni.requested_ram_gb || '',
      max_storage_gb: uni.requested_storage_gb || '',
    });
  };

  const submitApprove = async () => {
    if (!approveForm.admin_user_email || !approveForm.seats_allocated || !approveForm.price_per_seat_tzs) {
      toast.error('Admin email, seats, and price per seat are all required.');
      return;
    }
    if (!approveForm.max_vcpu_cores || !approveForm.max_ram_gb || !approveForm.max_storage_gb) {
      toast.error('The real, approved vCPU/RAM/storage quota is required.');
      return;
    }
    setApproving(true);
    try {
      await api.post(`/superadmin/university/universities/${approveTarget.id}/approve/`, {
        admin_user_email: approveForm.admin_user_email,
        seats_allocated: parseInt(approveForm.seats_allocated, 10),
        price_per_seat_tzs: approveForm.price_per_seat_tzs,
        billing_cycle: approveForm.billing_cycle,
        max_vcpu_cores: parseInt(approveForm.max_vcpu_cores, 10),
        max_ram_gb: parseInt(approveForm.max_ram_gb, 10),
        max_storage_gb: parseInt(approveForm.max_storage_gb, 10),
      });
      toast.success(`${approveTarget.name} approved and activated.`);
      setApproveTarget(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('A real reason is required.');
      return;
    }
    setRejecting(true);
    try {
      await api.post(`/superadmin/university/universities/${rejectTarget.id}/reject/`, { reason: rejectReason });
      toast.success(`${rejectTarget.name} rejected.`);
      setRejectTarget(null);
      setRejectReason('');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  const suspendUniversity = async (uni) => {
    const ok = await confirm(
      'Suspend University',
      `Suspend ${uni.name}? Their real users will be immediately blocked from launching new workspaces or sessions. Existing running VMs are left alone.`,
      false,
    );
    if (!ok) return;
    setSuspending(uni.id);
    try {
      await api.post(`/superadmin/university/universities/${uni.id}/suspend/`, {});
      toast.success(`${uni.name} suspended.`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not suspend university');
    } finally {
      setSuspending(null);
    }
  };

  const reactivateUniversity = async (uni) => {
    setReactivating(uni.id);
    try {
      await api.post(`/superadmin/university/universities/${uni.id}/reactivate/`, {});
      toast.success(`${uni.name} reactivated.`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reactivate university');
    } finally {
      setReactivating(null);
    }
  };

  const openEditTerms = (uni) => {
    setEditTermsTarget(uni);
    setEditTermsForm({
      seats_allocated: uni.seats_allocated ?? '',
      price_per_seat_tzs: uni.price_per_seat_tzs ?? '',
      billing_cycle: uni.billing_cycle || 'semester',
      max_vcpu_cores: uni.max_vcpu_cores ?? '',
      max_ram_gb: uni.max_ram_gb ?? '',
      max_storage_gb: uni.max_storage_gb ?? '',
    });
  };

  const submitEditTerms = async () => {
    setSavingTerms(true);
    try {
      await api.post(`/superadmin/university/universities/${editTermsTarget.id}/edit-terms/`, {
        seats_allocated: parseInt(editTermsForm.seats_allocated, 10),
        price_per_seat_tzs: editTermsForm.price_per_seat_tzs,
        billing_cycle: editTermsForm.billing_cycle,
        max_vcpu_cores: parseInt(editTermsForm.max_vcpu_cores, 10),
        max_ram_gb: parseInt(editTermsForm.max_ram_gb, 10),
        max_storage_gb: parseInt(editTermsForm.max_storage_gb, 10),
      });
      toast.success(`Terms updated for ${editTermsTarget.name}.`);
      setEditTermsTarget(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update terms');
    } finally {
      setSavingTerms(false);
    }
  };

  const openDelete = (uni) => {
    setDeleteTarget(uni);
    setDeleteConfirmInput('');
    setDeleteError(null);
  };

  const submitDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.post(`/superadmin/university/universities/${deleteTarget.id}/delete/`, {
        confirm_name: deleteConfirmInput,
      });
      toast.success(`${deleteTarget.name} permanently deleted.`);
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Could not delete university');
    } finally {
      setDeleting(false);
    }
  };

  const submitInvoice = async () => {
    const { university_id, amount_tzs, billing_period_start, billing_period_end, due_date } = invoiceForm;
    if (!university_id || !amount_tzs || !billing_period_start || !billing_period_end || !due_date) {
      toast.error('All invoice fields are required.');
      return;
    }
    setCreatingInvoice(true);
    try {
      await api.post('/superadmin/university/invoices/', invoiceForm);
      toast.success('Invoice created.');
      setShowInvoiceModal(false);
      setInvoiceForm({ university_id: '', amount_tzs: '', billing_period_start: '', billing_period_end: '', due_date: '' });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create invoice');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const markInvoiceStatus = async (invoice, status) => {
    const ok = await confirm(
      status === 'paid' ? 'Mark Invoice Paid' : `Mark Invoice ${status}`,
      `Mark invoice #${invoice.id} for ${invoice.university_name} as "${status}"?`,
      false,
    );
    if (!ok) return;
    try {
      await api.post(`/superadmin/university/invoices/${invoice.id}/status/`, { status });
      toast.success(`Invoice #${invoice.id} marked ${status}.`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Landmark className="w-6 h-6 text-indigo-400" />
            University Requests
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">SuperAdmin only. Review, approve, and bill institutional customers.</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10,
            background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border-color)] overflow-x-auto">
        {[
          ['requests', `Pending (${pending.length})`],
          ['universities', `Universities (${active.length})`],
          ['invoices', `Invoices (${invoices.length})`],
          ['revenue', 'Revenue'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              tab === key
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Pending Requests ─────────────────────────────────────── */}
      {tab === 'requests' && (
        <div className="space-y-4">
          {pending.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-[var(--text-secondary)]">
              No pending requests right now.
            </div>
          )}
          {pending.map(u => (
            <div key={u.id} className="glass-card rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-[var(--text-primary)]">{u.name}</h3>
                  <StatusPill meta={STATUS_META[u.status]} />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{u.contact_name} · {u.contact_email}</p>
                {u.description && <p className="text-sm text-[var(--text-faint)] mt-1 max-w-xl">{u.description}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openApprove(u)}
                  className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/25 transition-colors">
                  Approve
                </button>
                <button onClick={() => setRejectTarget(u)}
                  className="px-4 py-2 rounded-xl bg-red-500/15 text-red-400 font-semibold text-sm hover:bg-red-500/25 transition-colors">
                  Reject
                </button>
              </div>
            </div>
          ))}

          {rejected.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wider text-[var(--text-faint)] mt-8 mb-2">Rejected</p>
              {rejected.map(u => (
                <div key={u.id} className="glass-card rounded-2xl p-5 flex items-center justify-between gap-4 opacity-70">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[var(--text-primary)]">{u.name}</h3>
                      <StatusPill meta={STATUS_META[u.status]} />
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{u.rejection_reason}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Active Universities ──────────────────────────────────── */}
      {tab === 'universities' && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-[var(--text-faint)] uppercase text-xs tracking-wider">
                  <th className="px-5 py-3">Institution</th>
                  <th className="px-5 py-3">Admin</th>
                  <th className="px-5 py-3">Seats</th>
                  <th className="px-5 py-3">Price/seat</th>
                  <th className="px-5 py-3">Billing</th>
                  <th className="px-5 py-3">Quota</th>
                  <th className="px-5 py-3">Departments</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {active.map(u => (
                  <tr key={u.id} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="px-5 py-3 text-[var(--text-primary)] font-medium">{u.name}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{u.admin_user_email || 'N/A'}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{u.seats_allocated}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{Number(u.price_per_seat_tzs || 0).toLocaleString()} TZS</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)] capitalize">{u.billing_cycle}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)] text-xs">{u.max_vcpu_cores} vCPU / {u.max_ram_gb}GB / {u.max_storage_gb}GB</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{u.department_count}</td>
                    <td className="px-5 py-3"><StatusPill meta={STATUS_META[u.status]} /></td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {u.status === 'active' ? (
                          <button onClick={() => suspendUniversity(u)} disabled={suspending === u.id}
                            title="Suspend"
                            className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 disabled:opacity-50">
                            <Ban size={14} />
                          </button>
                        ) : (
                          <button onClick={() => reactivateUniversity(u)} disabled={reactivating === u.id}
                            title="Reactivate"
                            className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50">
                            <PlayCircle size={14} />
                          </button>
                        )}
                        <button onClick={() => openEditTerms(u)} title="Edit Terms"
                          className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => openDelete(u)} title="Delete"
                          className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {active.length === 0 && (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-[var(--text-secondary)]">No active universities yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Invoices ─────────────────────────────────────────────── */}
      {tab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowInvoiceModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] text-white font-semibold text-sm hover:opacity-90 transition-opacity">
              <FileText size={16} /> New Invoice
            </button>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-left text-[var(--text-faint)] uppercase text-xs tracking-wider">
                    <th className="px-5 py-3">University</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Period</th>
                    <th className="px-5 py-3">Due</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-b border-[var(--border-color)] last:border-0">
                      <td className="px-5 py-3 text-[var(--text-primary)] font-medium">{inv.university_name}</td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">{Number(inv.amount_tzs).toLocaleString()} TZS</td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">{inv.billing_period_start} → {inv.billing_period_end}</td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">{inv.due_date}</td>
                      <td className="px-5 py-3"><StatusPill meta={INVOICE_STATUS_META[inv.status]} /></td>
                      <td className="px-5 py-3">
                        {inv.status !== 'paid' && (
                          <div className="flex gap-2">
                            {inv.status === 'pending' && (
                              <button onClick={() => markInvoiceStatus(inv, 'sent')}
                                className="px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-semibold hover:bg-blue-500/25">
                                Mark Sent
                              </button>
                            )}
                            <button onClick={() => markInvoiceStatus(inv, 'paid')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25">
                              Mark Paid
                            </button>
                            {inv.status !== 'overdue' && (
                              <button onClick={() => markInvoiceStatus(inv, 'overdue')}
                                className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25">
                                Mark Overdue
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-[var(--text-secondary)]">No invoices yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Revenue ──────────────────────────────────────────────── */}
      {tab === 'revenue' && revenue && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">Paid (University Contracts)</p>
              <p className="text-2xl font-bold text-emerald-400">{revenue.total_paid_tzs.toLocaleString()} TZS</p>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">Pending / Sent</p>
              <p className="text-2xl font-bold text-amber-400">{revenue.pending_tzs.toLocaleString()} TZS</p>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">Overdue</p>
              <p className="text-2xl font-bold text-red-400">{revenue.overdue_tzs.toLocaleString()} TZS</p>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"><DollarSign size={16} /> By University</h3>
            {revenue.by_university.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No paid invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {revenue.by_university.map(row => (
                  <div key={row.university_id} className="flex justify-between text-sm py-2 border-b border-[var(--border-color)] last:border-0">
                    <span className="text-[var(--text-primary)]">{row.university_name}</span>
                    <span className="text-[var(--text-secondary)] font-medium">{row.amount_tzs.toLocaleString()} TZS</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--text-faint)]">
            Kept separate from individual-user revenue (Analytics → Revenue Breakdown) — this reflects
            university-contract billing only, so the two are never silently combined.
          </p>
        </div>
      )}

      {/* ── Approve Modal ────────────────────────────────────────── */}
      {approveTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Approve {approveTarget.name}</h3>
              <button onClick={() => setApproveTarget(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  University admin — existing Ospace account email
                </label>
                <input type="email" value={approveForm.admin_user_email}
                  onChange={e => setApproveForm({ ...approveForm, admin_user_email: e.target.value })}
                  placeholder="admin@university.ac.tz"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                <p className="text-xs text-[var(--text-faint)] mt-1">Must already have signed up on Ospace (Google/GitHub).</p>
              </div>
              {(approveTarget.requested_vcpu_cores || approveTarget.requested_ram_gb || approveTarget.requested_storage_gb) && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  Requested on the form: {approveTarget.requested_vcpu_cores || 'N/A'} vCPU /{' '}
                  {approveTarget.requested_ram_gb || 'N/A'} GB RAM / {approveTarget.requested_storage_gb || 'N/A'} GB storage.
                  Real approved quota below is negotiated — it may differ.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Seats</label>
                  <input type="number" min="1" value={approveForm.seats_allocated}
                    onChange={e => setApproveForm({ ...approveForm, seats_allocated: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Price/seat (TZS)</label>
                  <input type="number" min="0" value={approveForm.price_per_seat_tzs}
                    onChange={e => setApproveForm({ ...approveForm, price_per_seat_tzs: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Billing cycle</label>
                <select value={approveForm.billing_cycle}
                  onChange={e => setApproveForm({ ...approveForm, billing_cycle: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]">
                  <option value="monthly">Monthly</option>
                  <option value="semester">Per Semester</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  Real, approved hardware quota
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" min="1" value={approveForm.max_vcpu_cores}
                    onChange={e => setApproveForm({ ...approveForm, max_vcpu_cores: e.target.value })}
                    placeholder="vCPU"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  <input type="number" min="1" value={approveForm.max_ram_gb}
                    onChange={e => setApproveForm({ ...approveForm, max_ram_gb: e.target.value })}
                    placeholder="RAM GB"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  <input type="number" min="1" value={approveForm.max_storage_gb}
                    onChange={e => setApproveForm({ ...approveForm, max_storage_gb: e.target.value })}
                    placeholder="Storage GB"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
              </div>
              <button onClick={submitApprove} disabled={approving}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-50 mt-2">
                {approving ? 'Approving...' : 'Approve & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ─────────────────────────────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Reject {rejectTarget.name}</h3>
              <button onClick={() => setRejectTarget(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Reason (recorded, shown internally)</label>
            <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none mb-4" />
            <button onClick={submitReject} disabled={rejecting}
              className="w-full py-3 rounded-xl bg-red-500 hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-50">
              {rejecting ? 'Rejecting...' : 'Reject Request'}
            </button>
          </div>
        </div>
      )}

      {/* ── Edit Terms Modal ─────────────────────────────────────── */}
      {editTermsTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Pencil size={18} /> Edit Terms: {editTermsTarget.name}
              </h3>
              <button onClick={() => setEditTermsTarget(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-faint)]">Real contract renegotiation. Changes take effect immediately.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Seats</label>
                  <input type="number" min="1" value={editTermsForm.seats_allocated}
                    onChange={e => setEditTermsForm({ ...editTermsForm, seats_allocated: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Price/seat (TZS)</label>
                  <input type="number" min="0" value={editTermsForm.price_per_seat_tzs}
                    onChange={e => setEditTermsForm({ ...editTermsForm, price_per_seat_tzs: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Billing cycle</label>
                <select value={editTermsForm.billing_cycle}
                  onChange={e => setEditTermsForm({ ...editTermsForm, billing_cycle: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]">
                  <option value="monthly">Monthly</option>
                  <option value="semester">Per Semester</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Real, approved hardware quota</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" min="1" value={editTermsForm.max_vcpu_cores}
                    onChange={e => setEditTermsForm({ ...editTermsForm, max_vcpu_cores: e.target.value })}
                    placeholder="vCPU"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  <input type="number" min="1" value={editTermsForm.max_ram_gb}
                    onChange={e => setEditTermsForm({ ...editTermsForm, max_ram_gb: e.target.value })}
                    placeholder="RAM GB"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  <input type="number" min="1" value={editTermsForm.max_storage_gb}
                    onChange={e => setEditTermsForm({ ...editTermsForm, max_storage_gb: e.target.value })}
                    placeholder="Storage GB"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
              </div>
              <button onClick={submitEditTerms} disabled={savingTerms}
                className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-50 mt-2">
                {savingTerms ? 'Saving...' : 'Save Terms'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal — typed-confirmation, same pattern as real
           account deletion ─────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border-2 border-red-500/20 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-400">Delete {deleteTarget.name}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  This permanently deletes the university and cascades to its departments, courses, enrollments,
                  invites, and template requests. Blocked if any real active students, running VMs, or real
                  Proxmox templates still exist. Suspend and wait, or clear those first.
                </p>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex-shrink-0">
                <X size={18} />
              </button>
            </div>
            {deleteError && (
              <div className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 mb-3">
                {deleteError}
              </div>
            )}
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              To confirm, type the institution's exact name <strong className="text-[var(--text-primary)]">{deleteTarget.name}</strong> below:
            </p>
            <input type="text" value={deleteConfirmInput} onChange={e => setDeleteConfirmInput(e.target.value)}
              placeholder={deleteTarget.name} autoComplete="off" autoCapitalize="off" spellCheck="false"
              className="w-full bg-[var(--bg-input)] border border-red-500/20 rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none mb-4 focus:border-red-500/50" />
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg-nav-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-semibold">
                Cancel
              </button>
              <button onClick={submitDelete} disabled={deleteConfirmInput !== deleteTarget.name || deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold disabled:opacity-30">
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Invoice Modal ────────────────────────────────────── */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Receipt size={18} /> New Invoice</h3>
              <button onClick={() => setShowInvoiceModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">University</label>
                <select value={invoiceForm.university_id}
                  onChange={e => setInvoiceForm({ ...invoiceForm, university_id: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]">
                  <option value="">Select...</option>
                  {active.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Amount (TZS)</label>
                <input type="number" min="1" value={invoiceForm.amount_tzs}
                  onChange={e => setInvoiceForm({ ...invoiceForm, amount_tzs: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Period start</label>
                  <input type="date" value={invoiceForm.billing_period_start}
                    onChange={e => setInvoiceForm({ ...invoiceForm, billing_period_start: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Period end</label>
                  <input type="date" value={invoiceForm.billing_period_end}
                    onChange={e => setInvoiceForm({ ...invoiceForm, billing_period_end: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Due date</label>
                <input type="date" value={invoiceForm.due_date}
                  onChange={e => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
              </div>
              <button onClick={submitInvoice} disabled={creatingInvoice}
                className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-50 mt-2">
                {creatingInvoice ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
