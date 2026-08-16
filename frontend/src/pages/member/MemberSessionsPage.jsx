import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Radio, Clock, Copy, Power, Eye, Users, MonitorPlay, LogOut, Activity } from 'lucide-react';
import api from '../../services/api';
import useBreakpoint from '../../hooks/useBreakpoint';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import useConfirm from '../../hooks/useConfirm';

const formatDuration = (startedAt) => {
  if (!startedAt) return '00:00:00';
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = Math.max(0, now - start);
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  const s = Math.floor((diffMs % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function MemberSessionsPage() {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [activeTab, setActiveTab] = useState('Active');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);

  const [viewingSession, setViewingSession] = useState(null);
  const [viewingParticipants, setViewingParticipants] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);

  useEffect(() => {
    fetchSessions(true);
    // fetchSessions used to only ever run once — a session joined or
    // started elsewhere (another tab, an invite-code join) never showed
    // up here without a full page reload. Poll every 10s, matching the
    // same cadence used on the Workspaces page.
    const interval = setInterval(() => fetchSessions(false), 10000);
    return () => clearInterval(interval);
  }, []);

  // Update durations every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Fetches live sessions from the backend and categorizes them.
   * @param {boolean} isInitial - If true, shows the full-page loading spinner.
   *   Background polls pass false to update data silently without UI flicker.
   */
  const fetchSessions = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await api.get('/sessions/live/');
      const data = res.data?.data || res.data;
      
      const allSessions = [
        ...(data.my_hosted || []).map(s => ({...s, is_host: true})),
        ...(data.joined || []).map(s => ({...s, is_host: false})),
      ];
      
      // Deduplicate by ID
      const uniqueSessionsMap = new Map();
      allSessions.forEach(s => {
          if (!uniqueSessionsMap.has(s.id)) uniqueSessionsMap.set(s.id, s);
      });
      const uniqueSessions = Array.from(uniqueSessionsMap.values());
      
      setActiveSessions(uniqueSessions.filter(s => s.status === 'active' || s.status === 'running'));
      setUpcomingSessions(uniqueSessions.filter(s => s.status === 'scheduled'));
      setPastSessions(uniqueSessions.filter(s => s.status === 'ended' || s.status === 'completed'));
    } catch(e) {
      console.error(e);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const handleJoinSession = async () => {
    if (!joinCode.trim()) return;
    try {
      setJoining(true);
      setError('');
      const res = await api.post('/sessions/live/join/', { invite_code: joinCode.trim() });
      const sessionData = res.data?.data?.session || res.data?.data || res.data;
      if (sessionData?.id) {
        navigate(`/session/${sessionData.id}?type=session`);
      }
      setJoinCode('');
      fetchSessions();
    } catch(e) {
      console.error('Join failed:', e);
      setError(e.response?.data?.message || 'Invalid or expired invite code');
    } finally {
      setJoining(false);
    }
  };

  const handleEndSession = async (id) => {
    const ok = await confirm('End Session', 'End this session? All participants will be disconnected.', true);
    if (!ok) return;
    try {
      await api.post(`/sessions/live/${id}/end/`);
      fetchSessions();
    } catch(e) {
      console.error(e);
    }
  };

  const handleLeaveSession = async (id) => {
    try {
      await api.post(`/sessions/live/${id}/leave/`);
      fetchSessions();
    } catch(e) {
      console.error(e);
    }
  };

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
  };

  // The list endpoint already returns everything needed for the summary
  // (hours_purchased, amount_paid_tzs, restrictions, participant_count,
  // session_type, timestamps) except the actual participant list — that's
  // only attached by the single-session detail endpoint, so fetch it here
  // rather than eagerly for every row in the table.
  const handleViewSession = async (session) => {
    setViewingSession(session);
    setViewingParticipants(null);
    setViewingLoading(true);
    try {
      const res = await api.get(`/sessions/live/${session.id}/`);
      const data = res.data?.data || res.data;
      setViewingParticipants(data?.participants || []);
    } catch (e) {
      console.error('Failed to load session detail:', e);
      setViewingParticipants([]);
    } finally {
      setViewingLoading(false);
    }
  };

  const closeViewSession = () => {
    setViewingSession(null);
    setViewingParticipants(null);
  };

  const formatSessionType = (type) => {
    if (!type) return 'Custom';
    return type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const RESTRICTION_LABELS = {
    clipboard: 'Clipboard Sync',
    file_transfer: 'File Transfer',
    screen_monitoring: 'Screen Monitoring',
    session_recording: 'Session Recording',
  };

  const getCount = (tab) => {
    if (tab === 'Active') return activeSessions.length;
    if (tab === 'Upcoming') return upcomingSessions.length;
    if (tab === 'Past') return pastSessions.length;
    return 0;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 bg-canvas">
      <div className="w-10 h-10 rounded-full border-4 border-[#00A3FF]/20 border-t-[#00A3FF] animate-spin"></div>
      <p className="text-muted text-sm">Loading sessions...</p>
    </div>
  );

  const renderActiveList = () => (
    <div className="space-y-4">
      {activeSessions.length === 0 && (
        <div className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-muted">No active sessions. Join one with an invite code or create your own.</p>
        </div>
      )}
      {activeSessions.map(session => (
        session.is_host ? (
          <div key={session.id} className="relative overflow-hidden rounded-2xl mb-4">
            <div className="absolute inset-0 rounded-2xl p-[1px]">
              <div className="absolute inset-0 rounded-2xl "
                style={{
                  opacity: 'var(--led-opacity, 0.6)',
                filter: 'blur(var(--led-blur, 1px))',
                background: 'linear-gradient(90deg, #00FF87, #00A3FF, #6C63FF, #FF6B00, #00FF87)',
                  backgroundSize: '300% 100%',
                  animation: 'ledFlow 4s linear infinite',
                }}
              />
            </div>
            
            <div className="relative bg-card rounded-2xl p-5 m-[1px]">
              <div className="flex flex-wrap items-start justify-between mb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00FF87]/10 flex items-center justify-center">
                    <Radio size={20} className="text-[#00FF87]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-primary uppercase tracking-wide">
                        {session.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-[#00FF87]/10 text-[9px] font-bold text-[#00FF87] uppercase tracking-wider">
                        Live
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[9px] font-medium text-secondary uppercase">
                        {session.session_type || 'Custom'}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Hosted by you · {session.participant_count || 0}/{session.max_participants || 0} participants
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas rounded-lg">
                    <Clock size={12} className="text-muted" />
                    <span className="text-xs font-mono text-secondary">
                      {formatDuration(session.start_time || session.created_at)}
                    </span>
                  </div>
                  <div className="px-3 py-1.5 bg-canvas rounded-lg">
                    <span className="text-xs font-mono text-secondary tracking-widest">
                      {session.invite_code}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/host/session/${session.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0066FF] text-white text-xs font-semibold hover:bg-[#0052CC] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
                  <Eye size={14} />
                  Monitor
                </button>
                <button
                  onClick={() => copyInviteCode(session.invite_code)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nav-hover border border-border-strong text-secondary text-xs font-semibold hover:border-slate-500 active:scale-95 transition-all">
                  <Copy size={14} />
                  Share Code
                </button>
                <button
                  onClick={() => handleEndSession(session.id)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 active:scale-95 transition-all">
                  <Power size={14} />
                  End
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div key={session.id} className="bg-card/70 backdrop-blur-sm border border-[#00A3FF]/20 rounded-2xl p-5 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00A3FF]/10 flex items-center justify-center">
                  <Users size={20} className="text-[#00A3FF]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-primary">
                    {session.name}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Hosted by {session.host_details?.first_name || 'Host'} · {session.session_type || 'Custom'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#00A3FF] animate-pulse" />
                <span className="text-[10px] font-semibold text-[#00A3FF] uppercase tracking-wider">
                  Connected
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/session/${session.id}?type=session`)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0066FF] text-white text-xs font-semibold hover:bg-[#0052CC] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
                <MonitorPlay size={14} />
                Connect to Desktop
              </button>
              <button
                onClick={() => handleLeaveSession(session.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 active:scale-95 transition-all">
                <LogOut size={14} />
                Leave
              </button>
            </div>
          </div>
        )
      ))}
    </div>
  );

  const renderUpcomingList = () => (
    <div className="space-y-4">
      {upcomingSessions.length === 0 && (
        <div className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-muted">No upcoming sessions scheduled.</p>
        </div>
      )}
      {/* Simplify rendering since user focused on Active and Past */}
      {upcomingSessions.map(session => (
          <div key={session.id} className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-5 mb-4 opacity-75">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-primary">{session.name}</h3>
                <p className="text-xs text-muted">Starts: {formatDate(session.start_time)}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[9px] font-bold text-amber-500 uppercase tracking-wider">Scheduled</span>
            </div>
          </div>
      ))}
    </div>
  );

  const renderPastList = () => (
    <div className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl overflow-hidden">
      {pastSessions.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm text-muted">No session history yet.</p>
        </div>
      ) : isMobile ? (
        /* Real, measured mobile bug (Ospace responsive audit): this
           table used to render at full desktop width inside a raw
           overflow-x:auto wrapper - 6 whitespace-nowrap columns force
           the table far wider than a 375px viewport, so reading a
           past session meant scrolling horizontally with no visible
           scrollbar affordance. On mobile it's now a stacked card per
           session (same pattern already used by the Admin tables),
           showing every field vertically instead. Desktop keeps the
           original table unchanged. */
        <div className="flex flex-col gap-3 p-3">
          {pastSessions.map(s => (
            <div key={s.id} className="border border-border rounded-xl p-4 bg-card/50">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-primary break-words">{s.name}</span>
                <span className={`shrink-0 text-[9px] uppercase font-semibold ${s.is_host ? 'text-[#6C63FF]' : 'text-[#00A3FF]'}`}>
                  {s.is_host ? 'Host' : 'Joined'}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[9px] text-secondary">
                  {s.session_type || 'Custom'}
                </span>
              </div>
              <div className="text-xs text-secondary mb-1">
                <span className="text-muted">Date:</span> {formatDate(s.created_at)}
              </div>
              <div className="text-xs text-secondary mb-3">
                <span className="text-muted">Participants:</span> {s.participant_count || 0}
              </div>
              <button
                onClick={() => handleViewSession(s)}
                className="w-full text-center text-xs font-semibold text-muted hover:text-primary active:scale-95 transition-all py-2 rounded-lg bg-canvas">
                View
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-muted font-medium whitespace-nowrap">Name</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-muted font-medium whitespace-nowrap">Type</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-muted font-medium whitespace-nowrap">Date</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-muted font-medium whitespace-nowrap">Participants</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-muted font-medium whitespace-nowrap">Role</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-muted font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pastSessions.map(s => (
                <tr key={s.id} className="border-b border-border-subtle hover:bg-[var(--bg-nav-hover)] transition-colors">
                  <td className="px-5 py-4 text-sm text-primary whitespace-nowrap">
                    {s.name}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[9px] text-secondary">
                      {s.session_type || 'Custom'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-secondary whitespace-nowrap">
                    {formatDate(s.created_at)}
                  </td>
                  <td className="px-5 py-4 text-xs text-secondary whitespace-nowrap">
                    {s.participant_count || 0}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={`text-[9px] uppercase font-semibold ${s.is_host ? 'text-[#6C63FF]' : 'text-[#00A3FF]'}`}>
                      {s.is_host ? 'Host' : 'Joined'}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleViewSession(s)}
                      className="text-xs text-muted hover:text-primary active:scale-95 transition-all">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-56px)] bg-canvas p-6 sm:p-8 text-primary max-w-[1200px] mx-auto">
      <style>{`
        @keyframes ledFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      {/* SECTION A — PAGE HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">
            My Sessions
          </h1>
          <p className="text-sm text-muted mt-1">
            Live sessions and session history
          </p>
        </div>
      </div>

      {/* SECTION B — FILTER TABS */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['Active', 'Upcoming', 'Past'].map(tab => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 ${
              activeTab === tab
                ? 'bg-[#0066FF] text-white shadow-lg shadow-blue-500/30'
                : 'bg-card text-secondary border border-border hover:border-slate-600'
            }`}>
            {tab}
            <span className="ml-1.5 text-[10px] opacity-60">
              ({getCount(tab)})
            </span>
          </button>
        ))}
      </div>

      {/* SECTION C — JOIN SESSION CARD (Always top of Active tab) */}
      {activeTab === 'Active' && (
        <div className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00A3FF]/10 flex items-center justify-center">
                <UserPlus size={20} className="text-[#00A3FF]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">Join a Session</h3>
                <p className="text-xs text-muted mt-0.5">
                  Enter an invite code to join a live session
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE..."
                maxLength={8}
                className="bg-canvas border border-border rounded-xl px-4 py-2.5 text-sm text-primary font-mono tracking-widest placeholder-muted outline-none focus:border-blue-500 transition-colors w-full sm:w-36 text-center uppercase"
              />
              <button
                onClick={handleJoinSession}
                disabled={joinCode.length < 6 || joining}
                className="px-5 py-2.5 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20">
                {joining ? '...' : 'Join'}
              </button>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        </div>
      )}

      {activeTab === 'Active' && renderActiveList()}
      {activeTab === 'Upcoming' && renderUpcomingList()}
      {activeTab === 'Past' && renderPastList()}

      {viewingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeViewSession(); }}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-primary">{viewingSession.name}</h2>
                <p className="text-xs text-muted mt-1">
                  {formatSessionType(viewingSession.session_type)} · {formatDate(viewingSession.start_time || viewingSession.created_at)}
                </p>
              </div>
              <button onClick={closeViewSession} className="text-muted hover:text-primary transition-colors">
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-1">Hours Purchased</p>
                  <p className="text-sm font-semibold text-primary">{viewingSession.hours_purchased ?? '—'}h</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-1">Session Duration</p>
                  <p className="text-sm font-semibold text-primary">
                    {viewingSession.start_time && viewingSession.scheduled_end_at
                      ? `${((new Date(viewingSession.scheduled_end_at) - new Date(viewingSession.start_time)) / 3600000).toFixed(1)}h`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-1">Amount Paid</p>
                  <p className="text-sm font-semibold text-primary">
                    {viewingSession.amount_paid_tzs != null ? `TZS ${Number(viewingSession.amount_paid_tzs).toLocaleString()}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-1">Status</p>
                  <p className="text-sm font-semibold text-primary capitalize">{viewingSession.status || '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-2">
                  Participants ({viewingSession.participant_count ?? 0})
                </p>
                {viewingLoading ? (
                  <p className="text-xs text-muted">Loading participants…</p>
                ) : viewingParticipants && viewingParticipants.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {viewingParticipants.map((p, i) => (
                      <div key={p.id || i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-nav-hover)]">
                        <span className="text-xs text-primary font-medium">
                          {p.user?.first_name ? `${p.user.first_name} ${p.user.last_name || ''}`.trim() : (p.user?.email || 'Unknown')}
                        </span>
                        <span className="text-[10px] text-muted">{p.user?.email}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">No participants joined this session.</p>
                )}
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-2">Restrictions Applied</p>
                {viewingSession.restrictions && Object.keys(viewingSession.restrictions).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(viewingSession.restrictions).map(([key, value]) => (
                      <span key={key} className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${
                        value === true ? 'bg-emerald-500/10 text-emerald-400' : value === false ? 'bg-[var(--bg-nav-hover)] text-muted' : 'bg-[var(--bg-nav-hover)] text-secondary'
                      }`}>
                        {RESTRICTION_LABELS[key] || key}: {typeof value === 'boolean' ? (value ? 'On' : 'Off') : String(value)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">No restrictions recorded.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
