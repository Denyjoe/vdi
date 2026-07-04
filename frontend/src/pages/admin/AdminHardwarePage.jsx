/**
 * AdminHardwarePage
 *
 * Displays live simulated hardware metrics for the Proxmox host.
 * Sections: Status bar → 3 gauge/metric cards → CPU+RAM line chart & VM
 * pie chart → Storage pools table → Proxmox node status table.
 *
 * Auto-refreshes hardware stats every 10 seconds.
 * The CPU/RAM line chart appends one new data point per refresh
 * and discards the oldest to keep exactly 20 points.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Server, Monitor, ArrowDown, ArrowUp, Clock, Activity,
  RefreshCw, Wifi
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, BarChart, Bar,
  RadialBarChart, RadialBar
} from 'recharts';
import api from '../../services/api';

// ── Constants ────────────────────────────────────────────────────────────────

/** Returns a Tailwind / hex colour based on a 0-100 percentage value. */
const percentColor = (pct) => {
  if (pct < 50) return '#10B981';   // green
  if (pct < 75) return '#F59E0B';   // yellow
  return '#EF4444';                  // red
};

/**
 * Formats raw bytes-per-second into a human-readable string.
 * @param {number} bps - Bytes per second.
 * @returns {string} e.g. "3.4 MB/s" or "142 KB/s"
 */
const formatBandwidth = (bps) => {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
  return `${Math.round(bps / 1_000)} KB/s`;
};

/** Tooltip renderer for the line chart — dark themed. */
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-secondary)] mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold text-[var(--text-primary)]">{p.value}%</span>
        </p>
      ))}
    </div>
  );
};

/** Tooltip renderer for the storage bar. */
const StorageTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-primary)] font-semibold">{payload[0]?.payload?.name}</p>
      <p className="text-[var(--text-primary)]">Used: {payload[0]?.value} GB</p>
    </div>
  );
};

// ── Subcomponents ────────────────────────────────────────────────────────────

/**
 * A single radial gauge card.
 * @param {{ title, value, centerLine1, centerLine2, color }} props
 */
const GaugeCard = ({ title, value, centerLine1, centerLine2, color }) => {
  const data = [{ name: title, value: Math.max(0, Math.min(100, value)) }];
  return (
    <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-color)] shadow-md flex flex-col items-center">
      <h3 className="text-[var(--text-secondary)] text-sm font-medium mb-4">{title}</h3>
      <div className="relative w-full" style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="90%"
            innerRadius="80%" outerRadius="100%"
            barSize={14}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              background={{ fill: '#334155' }}
              dataKey="value"
              cornerRadius={8}
              fill={color}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Centre overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 pointer-events-none">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{centerLine1}</p>
          {centerLine2 && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{centerLine2}</p>}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function AdminHardwarePage() {
  const getVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);      // 20 data points
  const [loading, setLoading] = useState(true);
  const [secondsSince, setSecondsSince] = useState(0);
  const lastRefreshed = useRef(Date.now());
  const intervalRef = useRef(null);
  const tickRef = useRef(null);

  // ── API Calls ──────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/hardware/');
      setStats(res.data.data);
      lastRefreshed.current = Date.now();
      setSecondsSince(0);
    } catch (err) {
      console.error('Hardware stats fetch failed:', err);
      console.error('Full error:', err);
      console.error('Response:', err.response?.data);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/admin/hardware/cpu-history/');
      const newPoints = res.data.data;
      setHistory(prev => {
        // Append the latest point and keep only 20
        const latest = newPoints[newPoints.length - 1];
        const merged = [...prev, latest].slice(-20);
        return merged.length > 0 ? merged : newPoints;
      });
    } catch (err) {
      console.error('CPU history fetch failed:', err);
      console.error('Full error:', err);
      console.error('Response:', err.response?.data);
    }
  }, []);

  // ── Bootstrap ──────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          api.get('/admin/hardware/'),
          api.get('/admin/hardware/cpu-history/')
        ]);
        setStats(statsRes.data.data);
        setHistory(historyRes.data.data);
      } catch (err) {
        console.error('Initial hardware load failed:', err);
        console.error('Full error:', err);
        console.error('Response:', err.response?.data);
      } finally {
        setLoading(false);
      }
    };
    init();

    // Auto-refresh stats + history every 10 seconds
    intervalRef.current = setInterval(() => {
      fetchStats();
      fetchHistory();
    }, 10_000);

    // Tick the "last updated X seconds ago" counter
    tickRef.current = setInterval(() => {
      setSecondsSince(Math.round((Date.now() - lastRefreshed.current) / 1000));
    }, 1_000);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(tickRef.current);
    };
  }, [fetchStats, fetchHistory]);

  // ── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-[var(--text-secondary)]">Loading hardware stats...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-400">Failed to load hardware stats. Check server connection.</p>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────

  const node = stats.nodes[0];
  const vmSum = stats.vm_summary;
  const cpuColor = percentColor(stats.cpu_percent);
  const ramColor = percentColor(stats.ram_percent);
  const nodeHealth = (pct) => {
    if (pct < 60) return { label: 'Healthy', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
    if (pct < 80) return { label: 'Moderate', cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' };
    return { label: 'High Load', cls: 'text-red-400 bg-red-400/10 border-red-400/20' };
  };
  const avgNodePct = (node.cpu_percent + node.ram_percent) / 2;
  const health = nodeHealth(avgNodePct);

  const pieData = [
    { name: 'Running', value: vmSum.running, color: '#10B981' },
    { name: 'Stopped', value: vmSum.stopped, color: '#6B7280' },
    { name: 'Provisioning', value: vmSum.provisioning, color: '#F59E0B' },
  ].filter(d => d.value > 0);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] font-inter">Hardware & Resources</h1>
        <span className="text-xs text-slate-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Last updated {secondsSince}s ago
        </span>
      </div>

      {/* ── 1. Server Status Bar ──────────────────────────────────────── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-6 py-4 flex flex-wrap items-center gap-4 text-sm shadow-md">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-[var(--text-primary)] font-semibold">{node.name}</span>
        </div>

        <span className="hidden sm:block h-4 w-px bg-slate-600" />
        <span className="text-[var(--text-secondary)]">Proxmox VE {stats.proxmox_version}</span>

        <span className="hidden sm:block h-4 w-px bg-slate-600" />
        <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <Server className="w-3.5 h-3.5" />
          Uptime: <span className="text-[var(--text-primary)]">{stats.uptime_days} days</span>
        </span>

        <span className="hidden sm:block h-4 w-px bg-slate-600" />
        <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <Monitor className="w-3.5 h-3.5" />
          <span className="text-emerald-400 font-medium">{vmSum.running}</span> running
          <span className="text-slate-500">/</span>
          <span className="text-[var(--text-primary)]">{vmSum.total}</span> total VMs
        </span>
      </div>

      {/* ── 2. Three Metric Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Gauge */}
        <GaugeCard
          title="CPU Utilization"
          value={stats.cpu_percent}
          centerLine1={`${stats.cpu_percent}%`}
          color={cpuColor}
        />

        {/* RAM Gauge */}
        <GaugeCard
          title="Memory Usage"
          value={stats.ram_percent}
          centerLine1={`${stats.ram_used_gb} GB`}
          centerLine2={`of ${stats.ram_total_gb} GB  •  ${stats.ram_percent}%`}
          color={ramColor}
        />

        {/* Network I/O */}
        <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-color)] shadow-md flex flex-col justify-center gap-6">
          <h3 className="text-[var(--text-secondary)] text-sm font-medium text-center">Network I/O</h3>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400">
                <ArrowDown className="w-5 h-5" />
                <span className="text-[var(--text-primary)] text-sm">IN</span>
              </div>
              <span className="text-[var(--text-primary)] font-bold text-lg">
                {formatBandwidth(stats.network.bytes_in_per_sec)}
              </span>
            </div>
            <div className="h-px bg-[var(--bg-card-hover)]" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <ArrowUp className="w-5 h-5" />
                <span className="text-[var(--text-primary)] text-sm">OUT</span>
              </div>
              <span className="text-[var(--text-primary)] font-bold text-lg">
                {formatBandwidth(stats.network.bytes_out_per_sec)}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1">
            <Wifi className="w-3 h-3" />
            Interface: {stats.network.interface}
          </p>
        </div>
      </div>

      {/* ── 3. Charts Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart — CPU & RAM History */}
        <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-color)] shadow-md lg:col-span-2">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5">
            CPU & RAM — Last 20 Minutes
          </h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={getVar('--chart-grid')} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke={getVar('--chart-text')}
                  tick={{ fontSize: 11, fill: 'var(--chart-text)' }}
                  interval={3}
                />
                <YAxis
                  stroke={getVar('--chart-text')}
                  tick={{ fontSize: 11, fill: 'var(--chart-text)' }}
                  domain={[0, 100]}
                  tickFormatter={v => `${v}%`}
                />
                <RechartsTooltip content={<DarkTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                  formatter={v => <span style={{ color: 'var(--text-secondary)' }}>{v}</span>}
                />
                <Line
                  type="monotone" dataKey="cpu" name="CPU"
                  stroke={getVar('--info')} strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone" dataKey="ram" name="RAM"
                  stroke={getVar('--accent')} strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart — VM Status Distribution */}
        <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-color)] shadow-md">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2 text-center">
            VM Status Distribution
          </h3>
          {pieData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <Monitor className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-[var(--text-secondary)] text-sm">No VMs provisioned yet</p>
            </div>
          ) : (
            <>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      outerRadius={80} innerRadius={48}
                      dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8 }}
                      itemStyle={{ color: 'var(--text-heading)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-col gap-2 mt-3">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-[var(--text-primary)]">{d.name}</span>
                    </span>
                    <span className="text-[var(--text-primary)] font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 4. Storage Pools Table ────────────────────────────────────── */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Storage Pools</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-[var(--text-primary)]">
            <thead className="text-xs uppercase text-[var(--text-secondary)] bg-[var(--bg-primary)]/50 border-b border-[var(--border-color)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Pool Name</th>
                <th className="px-6 py-3 text-left font-medium">Type</th>
                <th className="px-6 py-3 text-right font-medium">Used</th>
                <th className="px-6 py-3 text-right font-medium">Total</th>
                <th className="px-6 py-3 text-right font-medium">% Used</th>
                <th className="px-6 py-3 font-medium min-w-[180px]">Usage Bar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {stats.storage_pools.map((pool) => {
                const pct = (pool.used_gb / pool.total_gb) * 100;
                const barColor = pct < 60 ? '#10B981' : pct < 80 ? '#F59E0B' : '#EF4444';
                return (
                  <tr key={pool.name} className="hover:bg-[var(--bg-card-hover)]/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{pool.name}</td>
                    <td className="px-6 py-4">
                      <span className="bg-[var(--bg-card-hover)] border border-slate-600 px-2 py-0.5 rounded text-xs">
                        {pool.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">{pool.used_gb} GB</td>
                    <td className="px-6 py-4 text-right text-[var(--text-secondary)]">{pool.total_gb} GB</td>
                    <td className="px-6 py-4 text-right font-medium"
                      style={{ color: barColor }}
                    >
                      {pct.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-[var(--bg-card-hover)] rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. Proxmox Nodes Table ────────────────────────────────────── */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Proxmox Nodes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-[var(--text-primary)]">
            <thead className="text-xs uppercase text-[var(--text-secondary)] bg-[var(--bg-primary)]/50 border-b border-[var(--border-color)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Node Name</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">CPU %</th>
                <th className="px-6 py-3 text-right font-medium">RAM %</th>
                <th className="px-6 py-3 text-right font-medium">VMs</th>
                <th className="px-6 py-3 text-left font-medium">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {stats.nodes.map((n) => {
                const avg = (n.cpu_percent + n.ram_percent) / 2;
                const h = nodeHealth(avg);
                return (
                  <tr key={n.name} className="hover:bg-[var(--bg-card-hover)]/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-[var(--text-primary)] flex items-center gap-2">
                      <Server className="w-4 h-4 text-[var(--text-secondary)]" />
                      {n.name}
                    </td>
                    <td className="px-6 py-4">
                      {n.status === 'online' ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded text-xs font-medium w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Online
                        </span>
                      ) : (
                        <span className="text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded text-xs font-medium">
                          Offline
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right" style={{ color: percentColor(n.cpu_percent) }}>
                      {n.cpu_percent}%
                    </td>
                    <td className="px-6 py-4 text-right" style={{ color: percentColor(n.ram_percent) }}>
                      {n.ram_percent}%
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--text-primary)] font-medium">{n.vm_count}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${h.cls}`}>
                        {h.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
