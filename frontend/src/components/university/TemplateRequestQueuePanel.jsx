import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackagePlus, Clock, Hammer, CheckCircle2, XCircle, RefreshCw, X, Wrench } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const STATUS_META = {
  pending: { label: 'Pending', color: '#F59E0B', icon: Clock },
  approved: { label: 'Approved — Building', color: '#3B82F6', icon: Hammer },
  completed: { label: 'Completed', color: '#10B981', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#EF4444', icon: XCircle },
};

/**
 * University Admin's real template-request review queue — Phase 2
 * (Product Depth Layer). Approve routes directly into the EXISTING
 * template wizard (AdminTemplateWizardPage), pre-filled from the
 * request, not a parallel build flow.
 */
export default function TemplateRequestQueuePanel({ universityId }) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get(`/university-admin/universities/${universityId}/template-requests/`);
      setRequests(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load template requests');
    } finally {
      setRefreshing(false);
    }
  }, [universityId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleRefresh = () => { setRefreshing(true); fetchRequests(); };

  const approve = async (req) => {
    setApproving(req.id);
    try {
      const res = await api.post(`/university-admin/template-requests/${req.id}/approve/`);
      const quota = res.data?.quota_check;
      if (quota && !quota.fits_quota) {
        toast(`Approved, but heads up: ${quota.message}`, { icon: '⚠️', duration: 8000 });
      } else {
        toast.success('Approved — opening the template wizard...');
      }
      // Reuses the EXISTING template wizard page, pre-filled from this
      // request — not a parallel build UI.
      navigate(`/admin/templates/new?template_request_id=${req.id}`, {
        state: { templateRequest: res.data.data, quotaCheck: quota },
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    } finally {
      setApproving(null);
    }
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('A real reason is required.');
      return;
    }
    setRejecting(true);
    try {
      await api.post(`/university-admin/template-requests/${rejectTarget.id}/reject/`, { reason: rejectReason });
      toast.success('Request rejected.');
      setRejectTarget(null);
      setRejectReason('');
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reject request');
    } finally {
      setRejecting(false);
    }
  };

  if (requests === null) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const pending = requests.filter(r => r.status === 'pending');
  const others = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <PackagePlus size={16} /> Template Requests
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Real requests from your lecturers, reviewed here.</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold hover:bg-[var(--bg-nav-hover)]">
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-[var(--text-secondary)]">
          No pending requests right now.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(r => (
            <div key={r.id} className="glass-card rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--text-faint)] uppercase tracking-wider mb-1">{r.course_code} · {r.requested_by_name}</p>
                  <p className="font-medium text-[var(--text-primary)]">{r.software_needed}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{r.purpose}</p>
                  <p className="text-xs text-[var(--text-faint)] mt-2">
                    Estimated: {r.estimated_vcpu} vCPU / {r.estimated_ram_gb}GB RAM / {r.estimated_storage_gb}GB storage
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => approve(r)} disabled={approving === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/25 disabled:opacity-50">
                    <Wrench size={14} /> {approving === r.id ? 'Approving...' : 'Approve & Build'}
                  </button>
                  <button onClick={() => setRejectTarget(r)}
                    className="px-4 py-2 rounded-xl bg-red-500/15 text-red-400 font-semibold text-sm hover:bg-red-500/25">
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">History</h4>
          <div className="space-y-2">
            {others.map(r => {
              const meta = STATUS_META[r.status];
              const Icon = meta.icon;
              return (
                <div key={r.id} className="flex justify-between items-center text-sm py-2 border-b border-[var(--border-color)] last:border-0 gap-3">
                  <span className="text-[var(--text-primary)]">{r.course_code} — {r.software_needed}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: `${meta.color}1a`, color: meta.color }}>
                      <Icon size={12} /> {meta.label}
                    </span>
                    {/* Real, confirmed gap this closes: once approve()
                        navigated the admin into the wizard, this
                        request instantly dropped out of the pending
                        list into this read-only History row — with no
                        button, no link, nothing — the moment they left
                        the wizard page (or it was still building when
                        they returned here), there was genuinely no way
                        back to it. The wizard's own resume mechanism
                        (AdminActiveTemplateJobsView, already proven
                        correct for a real university admin) has always
                        worked fine once actually reached — this was
                        purely a missing entry point, not a second
                        parallel resume system. 'approved' here means
                        genuinely still building (the backend only ever
                        moves a request to 'completed' once the real
                        template is promoted), so every 'approved' row
                        really does have a real, resumable job behind it. */}
                    {r.status === 'approved' && (
                      <button
                        onClick={() => navigate(`/admin/templates/new?template_request_id=${r.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/15 text-blue-400 font-semibold text-xs hover:bg-blue-500/25"
                      >
                        <Hammer size={12} /> Continue Build
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Reject Modal ─────────────────────────────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Reject Request</h3>
              <button onClick={() => setRejectTarget(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Reason (sent to the lecturer)</label>
            <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none mb-4" />
            <button onClick={submitReject} disabled={rejecting}
              className="w-full py-3 rounded-xl bg-red-500 hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-50">
              {rejecting ? 'Rejecting...' : 'Reject Request'}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
