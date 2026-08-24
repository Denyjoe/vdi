import { useState, useEffect, useCallback } from 'react';
import { Cpu, MemoryStick, HardDrive, RefreshCw, Server, CheckCircle2, XCircle, PauseCircle, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import GaugeCard, { percentColor } from '../shared/GaugeCard';

const VM_STATUS_META = {
  running: { label: 'Running', color: '#10B981', icon: CheckCircle2 },
  stopped: { label: 'Stopped', color: '#6B7280', icon: PauseCircle },
  provisioning: { label: 'Provisioning', color: '#F59E0B', icon: RefreshCw },
  error: { label: 'Error', color: '#EF4444', icon: XCircle },
};

/**
 * University Hardware & Performance — Phase 1 (Product Depth Layer).
 * Reuses GaugeCard (extracted from the platform's own Admin Hardware
 * page) so this reads as the same product, not a thinner side feature.
 */
export default function UniversityHardwarePanel({ universityId }) {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHardware = useCallback(async () => {
    try {
      const res = await api.get(`/university-admin/universities/${universityId}/hardware/`);
      setData(res.data?.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load hardware usage');
    } finally {
      setRefreshing(false);
    }
  }, [universityId]);

  useEffect(() => { fetchHardware(); }, [fetchHardware]);

  const handleRefresh = () => { setRefreshing(true); fetchHardware(); };

  if (!data) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const gauges = [
    { key: 'vcpu', title: 'vCPU', used: data.vcpu_used, max: data.vcpu_max, unit: '' },
    { key: 'ram_gb', title: 'RAM', used: data.ram_gb_used, max: data.ram_gb_max, unit: 'GB' },
    { key: 'storage_gb', title: 'Storage', used: data.storage_gb_used, max: data.storage_gb_max, unit: 'GB' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Server size={16} /> Hardware & Performance
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Real usage against your institution's approved quota.
            {!data.proxmox_reachable && (
              <span className="inline-flex items-center gap-1 text-amber-400 ml-2">
                <AlertTriangle size={12} /> Some live status checks were unreachable — showing last-known state.
              </span>
            )}
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold hover:bg-[var(--bg-nav-hover)]">
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {gauges.map(g => (
          <GaugeCard
            key={g.key}
            title={g.title}
            value={data.percent_used[g.key]}
            centerLine1={`${g.used}${g.unit ? ' ' + g.unit : ''}`}
            centerLine2={`of ${g.max}${g.unit ? ' ' + g.unit : ''} (${data.percent_used[g.key]}%)`}
            color={percentColor(data.percent_used[g.key])}
          />
        ))}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Cpu size={14} /> What's consuming the quota
        </h4>
        {data.templates.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No templates built for this university yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-faint)] uppercase text-xs tracking-wider border-b border-[var(--border-color)]">
                  <th className="py-2 pr-4">Template</th>
                  <th className="py-2 pr-4">vCPU</th>
                  <th className="py-2 pr-4">RAM</th>
                  <th className="py-2 pr-4">Storage</th>
                </tr>
              </thead>
              <tbody>
                {data.templates.map(t => (
                  <tr key={t.id} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="py-2 pr-4 text-[var(--text-primary)] font-medium">{t.name}</td>
                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{t.cpu_cores}</td>
                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{t.ram_gb} GB</td>
                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{t.storage_gb} GB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.running_vms.length > 0 && (
          <>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-6 mb-3 flex items-center gap-2">
              <MemoryStick size={14} /> Active workspaces right now ({data.running_vms.length})
            </h4>
            <div className="space-y-1">
              {data.running_vms.map(vm => (
                <div key={vm.id} className="flex justify-between text-sm py-1.5 border-b border-[var(--border-color)] last:border-0">
                  <span className="text-[var(--text-primary)]">{vm.name} <span className="text-[var(--text-faint)]">({vm.template_name})</span></span>
                  <span className="text-[var(--text-secondary)]">{vm.owner_email} · {vm.cpu_cores} vCPU / {vm.ram_gb}GB</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <HardDrive size={14} /> VM Health ({data.vm_health.length})
        </h4>
        {data.vm_health.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No VMs provisioned for this university yet.</p>
        ) : (
          <div className="space-y-2">
            {data.vm_health.map(vm => {
              const meta = VM_STATUS_META[vm.db_status] || { label: vm.db_status, color: '#6B7280', icon: HardDrive };
              const Icon = meta.icon;
              return (
                <div key={vm.id} className="flex justify-between items-center text-sm py-1.5 border-b border-[var(--border-color)] last:border-0">
                  <span className="text-[var(--text-primary)]">{vm.name} <span className="text-[var(--text-faint)]">({vm.template_name})</span></span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: `${meta.color}1a`, color: meta.color }}>
                    <Icon size={12} /> {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
