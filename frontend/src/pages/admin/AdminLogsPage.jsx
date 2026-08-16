/**
 * AdminLogsPage — full activity log viewer for admins.
 *
 * Features:
 *   - Columns: Time | User | Action | Description | IP Address
 *   - Color-coded action badges (VM=blue, Session=purple, Auth=green, Assignment=amber, Admin=red)
 *   - Date range filter (24h, 7d, 30d, all)
 *   - Search by user email or action
 *   - Auto-refreshes every 30 seconds
 *   - "Export CSV" button for filtered logs
 *
 * Data source: GET /api/admin/logs/
 *
 * @returns {JSX.Element}
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useBreakpoint from '../../hooks/useBreakpoint';
import {
  ScrollText, Search, X, Download, RefreshCw, Activity
} from 'lucide-react';
import api from '../../services/api';

/** Auto-refresh interval in milliseconds */
const AUTO_REFRESH_MS = 30000;

/** Date range filter options */
const DATE_RANGES = [
  { key: '24h', label: 'Last 24h' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

/**
 * Maps action keywords to color classes for the action badge.
 * @param {string} action - The log action string.
 * @returns {string} Tailwind classes for the badge.
 */
const getActionBadgeClass = (action) => {
  const lowered = (action || '').toLowerCase();
  if (lowered.includes('vm') || lowered.includes('virtual'))
    return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
  if (lowered.includes('session') || lowered.includes('connect') || lowered.includes('disconnect'))
    return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  if (lowered.includes('login') || lowered.includes('register') || lowered.includes('auth') || lowered.includes('logout'))
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (lowered.includes('assignment') || lowered.includes('submission') || lowered.includes('submit'))
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (lowered.includes('admin') || lowered.includes('deactivate') || lowered.includes('activate') || lowered.includes('delete'))
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  return 'bg-[var(--bg-card-hover)]/50 text-primary border-slate-600';
};

export default function AdminLogsPage() {
  const { isMobile } = useBreakpoint();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef(null);

  /**
   * Fetches activity logs from the backend.
   * @param {boolean} [silent=false] - If true, don't show full loading spinner.
   */
  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const response = await api.get('/admin/logs/');
      if (response.data.success) {
        setLogs(response.data.data);
      }
      setError('');
    } catch (err) {
      setError('Failed to load activity logs.');
      console.error('AdminLogsPage fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();

    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(() => fetchLogs(true), AUTO_REFRESH_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchLogs]);

  /**
   * Filters logs by date range and search query.
   * @returns {Array} Filtered log entries.
   */
  const filteredLogs = useMemo(() => {
    const now = new Date();
    return logs.filter((log) => {
      // Date range filter
      if (dateRange !== 'all') {
        const logDate = new Date(log.timestamp);
        let cutoff;
        if (dateRange === '24h') cutoff = new Date(now - 24 * 60 * 60 * 1000);
        else if (dateRange === '7d') cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
        else if (dateRange === '30d') cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
        if (logDate < cutoff) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const userField = (log.user || log.user_email || '').toLowerCase();
        const actionField = (log.action || '').toLowerCase();
        const descField = (log.description || '').toLowerCase();
        if (
          !userField.includes(query) &&
          !actionField.includes(query) &&
          !descField.includes(query)
        )
          return false;
      }

      return true;
    });
  }, [logs, dateRange, searchQuery]);

  /**
   * Exports the currently filtered logs as a CSV file download.
   */
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Description', 'IP Address'];
    const csvRows = [
      headers.join(','),
      ...filteredLogs.map((log) =>
        [
          `"${formatTimestamp(log.timestamp)}"`,
          `"${log.user || log.user_email || 'System'}"`,
          `"${log.action || ''}"`,
          `"${(log.description || '').replace(/"/g, '""')}"`,
          `"${log.ip_address || 'N/A'}"`,
        ].join(',')
      ),
    ];
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dit_vdi_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Formats an ISO timestamp to a human-readable string.
   * @param {string} ts - ISO timestamp string.
   * @returns {string} Formatted datetime.
   */
  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Activity className="animate-spin text-indigo-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Activity Logs</h2>
          <p className="text-[var(--text-secondary)] mt-1">
            {filteredLogs.length} log entries
            {isRefreshing && (
              <span className="ml-2 text-indigo-400 text-xs">
                <RefreshCw className="w-3 h-3 inline animate-spin mr-1" />
                Refreshing...
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchLogs(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-card-hover)] hover:bg-slate-600 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by user, action, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date range tabs */}
        <div className="flex gap-1 bg-[var(--bg-card)] p-1 rounded-lg border border-[var(--border-color)]">
          {DATE_RANGES.map((range) => (
            <button
              key={range.key}
              onClick={() => setDateRange(range.key)}
              className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                dateRange === range.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-primary hover:bg-[var(--bg-card-hover)]'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-md overflow-hidden">
        {isMobile ? (
          // Real, measured mobile bug: internal scrollWidth 486px vs
          // clientWidth 302px at 375px (even with Description/IP already
          // hidden via md:/lg: classes). Stacked cards, full description.
          <div className="flex flex-col gap-2 p-3">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <div key={log.id} className="border border-[var(--border-color)]/50 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${getActionBadgeClass(log.action)}`}
                    >
                      {log.action}
                    </span>
                    <span className="text-[var(--text-primary)] text-[10px] whitespace-nowrap">{formatTimestamp(log.timestamp)}</span>
                  </div>
                  <p className="text-[var(--text-primary)] text-sm mb-1" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {log.user || log.user_email || 'System'}
                  </p>
                  {log.description && (
                    <p className="text-[var(--text-secondary)] text-xs mb-1" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{log.description}</p>
                  )}
                  {log.ip_address && (
                    <p className="text-muted text-[10px] font-mono">{log.ip_address}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center text-[var(--text-secondary)]">
                <ScrollText className="w-10 h-10 mx-auto mb-3 text-faint" />
                No activity logs found for the selected filters.
              </div>
            )}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50">
                <th className="text-left px-6 py-4 text-[var(--text-secondary)] font-medium whitespace-nowrap">Time</th>
                <th className="text-left px-6 py-4 text-[var(--text-secondary)] font-medium">User</th>
                <th className="text-left px-6 py-4 text-[var(--text-secondary)] font-medium">Action</th>
                <th className="text-left px-6 py-4 text-[var(--text-secondary)] font-medium hidden md:table-cell">Description</th>
                <th className="text-left px-6 py-4 text-[var(--text-secondary)] font-medium hidden lg:table-cell">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-card-hover)]/30 transition-colors"
                  >
                    <td className="px-6 py-4 text-[var(--text-primary)] text-xs whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-primary)] text-sm">
                      {log.user || log.user_email || 'System'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getActionBadgeClass(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)] text-sm max-w-xs truncate hidden md:table-cell">
                      {log.description || '—'}
                    </td>
                    <td className="px-6 py-4 text-muted text-xs font-mono hidden lg:table-cell">
                      {log.ip_address || 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-secondary)]">
                    <ScrollText className="w-10 h-10 mx-auto mb-3 text-faint" />
                    No activity logs found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <p className="text-xs text-muted text-center">
        Auto-refreshes every 30 seconds
      </p>
    </div>
  );
}
