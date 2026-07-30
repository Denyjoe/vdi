import { useState, useEffect } from 'react';
import { Users, Monitor, Activity, DollarSign, Wifi, TrendingUp, Clock, Server, Video, Wallet, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell } from 'recharts';
import api from '../../services/api';
import toast from 'react-hot-toast';

function EmptyChartState({ icon: Icon, message, submessage }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '200px',
      gap: '10px',
    }}>
      <div style={{
        width: '44px', height: '44px',
        borderRadius: '12px',
        background: 'var(--bg-input)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={20} style={{ color: 'var(--text-faint)' }} />
      </div>
      <p style={{
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
      }}>{message}</p>
      {submessage && (
        <p style={{
          fontSize: '11px',
          color: 'var(--text-faint)',
          textAlign: 'center',
          maxWidth: '260px',
        }}>{submessage}</p>
      )}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_users: 0,
    new_users_week: 0,
    total_vms: 0,
    total_sessions: 0,
    sessions_week: 0,
    total_revenue_tzs: 0,
    revenue_week: 0,
  });

  const [sessionsDaily, setSessionsDaily] = useState([]);
  const [revenueMonthly, setRevenueMonthly] = useState([]);
  const [userGrowth, setUserGrowth] = useState([]);
  const [revenueBreakdown, setRevenueBreakdown] = useState({ total: 0, breakdown: [] });
  const [vmTemplates, setVmTemplates] = useState([]);
  const [topUsers, setTopUsers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // These all live under analytics_urls.py, which config/urls.py mounts
        // at 'api/admin/' — NOT 'api/users/admin/'. Every one of these calls
        // was 404ing (confirmed directly against the running server), which
        // is why this whole page silently showed all-zero/empty stats and
        // charts: Promise.allSettled swallowed the rejections and every
        // `if (X.status === 'fulfilled' ...)` check below just skipped.
        const [statsRes, sessionsRes, revenueRes, growthRes, breakdownRes, templatesRes] = await Promise.allSettled([
          api.get('/admin/platform-stats/'),
          api.get('/admin/analytics/sessions-daily/'),
          api.get('/admin/analytics/revenue-monthly/'),
          api.get('/admin/analytics/user-growth/'),
          api.get('/admin/analytics/revenue-breakdown/'),
          api.get('/admin/analytics/vm-usage/'),
        ]);

        if (statsRes.status === 'fulfilled' && statsRes.value.data.success) {
          setStats(statsRes.value.data.data);
        }

        if (sessionsRes.status === 'fulfilled' && sessionsRes.value.data.sessions) {
          setSessionsDaily(sessionsRes.value.data.sessions);
        }

        if (revenueRes.status === 'fulfilled' && revenueRes.value.data.revenue) {
          setRevenueMonthly(revenueRes.value.data.revenue);
        }

        if (growthRes.status === 'fulfilled' && growthRes.value.data.growth) {
          setUserGrowth(growthRes.value.data.growth);
        }

        if (breakdownRes.status === 'fulfilled' && breakdownRes.value.data.breakdown) {
          setRevenueBreakdown({
            total: breakdownRes.value.data.total,
            breakdown: breakdownRes.value.data.breakdown
          });
        }

        if (templatesRes.status === 'fulfilled' && templatesRes.value.data.success) {
          const templates = templatesRes.value.data.data.by_template.map(t => ({
            name: t.template_name,
            count: t.vm_count || 0
          }));
          setVmTemplates(templates);

          // Real per-user usage, ranked by workspace count — this used to
          // read `usersListRes.data.success`, a field that endpoint never
          // returns (it returns {users, total, counts}), so this branch
          // never ran and "Top Users" silently showed "No activity
          // recorded yet" regardless of real usage. The vm-usage endpoint
          // above already computes the real ranking, so use that instead.
          const realTopUsers = (templatesRes.value.data.data.top_users || []).map(u => ({
            name: u.name,
            email: u.email,
            vms: u.vm_count || 0,
            hours: u.total_session_hours || 0,
          }));
          setTopUsers(realTopUsers);
        }
      } catch (err) {
        console.error('Failed to load analytics', err);
        toast.error('Failed to load some analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleExportReport = async () => {
    try {
      const token = localStorage.getItem('dit_access_token');
      const response = await fetch('/api/admin/analytics/export/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clouddesk_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch(e) {
      console.error(e);
      alert('Export failed: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[var(--text-secondary)] font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const hasSessionData = sessionsDaily.some(d => d.count > 0);
  const hasRevenueData = revenueMonthly.some(d => d.revenue > 0);
  const hasUserGrowth = userGrowth.some(d => d.total_users > 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Analytics Overview</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Platform performance and usage metrics</p>
        </div>
        <button onClick={handleExportReport}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
          }}>
          <Download size={14} />
          Export Report
        </button>
      </div>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '18px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>Total Users</p>
          <p style={{
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '6px',
          }}>{stats.total_users}</p>
          {stats.new_users_week > 0 && (
            <p style={{
              fontSize: '11px',
              color: 'var(--status-online)',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <TrendingUp size={11} />
              +{stats.new_users_week} this week
            </p>
          )}
        </div>

        {/* Total VMs */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '18px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>Total VMs</p>
          <p style={{
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '6px',
          }}>{stats.total_vms}</p>
        </div>

        {/* Total Sessions */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '18px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>Total Sessions</p>
          <p style={{
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '6px',
          }}>{stats.total_sessions}</p>
          {stats.sessions_week > 0 && (
            <p style={{
              fontSize: '11px',
              color: 'var(--status-online)',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <TrendingUp size={11} />
              +{stats.sessions_week} this week
            </p>
          )}
        </div>

        {/* Total Revenue */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '18px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>Total Revenue</p>
          <p style={{
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '6px',
          }}>TZS {stats.total_revenue_tzs?.toLocaleString()}</p>
          {stats.revenue_week > 0 && (
            <p style={{
              fontSize: '11px',
              color: 'var(--status-online)',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <TrendingUp size={11} />
              +TZS {stats.revenue_week.toLocaleString()} this week
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Charts - Sessions & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Sessions (Last 7 Days)</h3>
          <div className="h-[300px]">
            {hasSessionData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sessionsDaily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sessionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day_label" stroke="var(--text-faint)" fontSize={11} />
                  <YAxis stroke="var(--text-faint)" fontSize={11} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                  }} />
                  <Area type="monotone" dataKey="count" stroke="var(--accent-primary)" fill="url(#sessionGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState 
                icon={Video}
                message="No sessions yet this week"
                submessage="Session activity will appear here once hosts start running sessions" />
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Revenue Over Time</h3>
          <div className="h-[300px]">
            {hasRevenueData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueMonthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--text-faint)" fontSize={11} />
                  <YAxis stroke="var(--text-faint)" fontSize={11} allowDecimals={false} tickFormatter={(v) => `TZS ${v.toLocaleString()}`} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    formatter={(value) => [`TZS ${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState 
                icon={Wallet}
                message="No revenue yet"
                submessage="Revenue history will appear here once users make payments" />
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Charts - User Growth & Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">User Growth (6 Months)</h3>
          <div className="h-[300px]">
            {hasUserGrowth ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--text-faint)" fontSize={11} />
                  <YAxis stroke="var(--text-faint)" fontSize={11} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Line type="monotone" dataKey="total_users" name="Total Users" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent-primary)', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState 
                icon={Users}
                message="No users yet"
                submessage="User growth will appear here as people join the platform" />
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Template Popularity</h3>
          <div className="h-[300px]">
            {vmTemplates.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vmTemplates} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                  <XAxis type="number" stroke="var(--chart-text)" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="var(--chart-text)" width={100} tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Bar dataKey="count" name="Launch Count" fill="var(--status-info)" radius={[0, 4, 4, 0]} maxBarSize={30}>
                    {vmTemplates.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--accent-primary)' : 'var(--status-info)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-[var(--border-color)] rounded-xl">
                <div className="text-center text-[var(--text-secondary)]">
                  <Monitor className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
                  <p>No template launches yet</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Revenue Breakdown & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '20px',
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '16px',
          }}>Revenue Breakdown</h3>
          
          {revenueBreakdown.total > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {revenueBreakdown.breakdown.map(item => {
                const pct = revenueBreakdown.total > 0 ? Math.round((item.amount / revenueBreakdown.total) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        TZS {item.amount.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-primary)', borderRadius: '3px', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyChartState 
              icon={Wallet}
              message="No revenue recorded yet"
              submessage="Revenue breakdown by source will appear here once payments are processed" />
          )}
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl shadow-md border border-[var(--border-color)] overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-[var(--border-color)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recent Users</h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-primary)]/50 text-[var(--text-primary)]">
                <tr>
                  <th className="px-6 py-4 font-medium w-16 text-center">#</th>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium text-center">VMs</th>
                  <th className="px-6 py-4 font-medium text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-[var(--text-primary)]">
                {topUsers.length > 0 ? (
                  topUsers.map((user, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-primary)] transition-colors">
                      <td className="px-6 py-4 text-center font-bold text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[var(--text-primary)]">{user.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{user.email}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-[var(--text-primary)] font-medium">{user.vms}</td>
                      <td className="px-6 py-4 text-right text-indigo-400 font-medium">{user.hours}h</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-[var(--text-muted)]">
                      No activity recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
