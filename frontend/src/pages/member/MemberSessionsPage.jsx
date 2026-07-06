import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Radio, Clock, Copy, Power, Eye, Users, MonitorPlay, LogOut, Activity } from 'lucide-react';
import api from '../../services/api';

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
  const [activeTab, setActiveTab] = useState('Active');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);

  useEffect(() => {
    fetchSessions();
  }, []);

  // Update durations every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
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
        navigate(`/workspace/${sessionData.id}?type=session`); // Note: user mentioned navigate to session.vm_id, but the join response might not give vm_id immediately, we'll navigate to session page or let user connect via active tab
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
    if (!window.confirm('End this session? All participants will be disconnected.')) return;
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

  const getCount = (tab) => {
    if (tab === 'Active') return activeSessions.length;
    if (tab === 'Upcoming') return upcomingSessions.length;
    if (tab === 'Past') return pastSessions.length;
    return 0;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 bg-[#080B10]">
      <div className="w-10 h-10 rounded-full border-4 border-[#00A3FF]/20 border-t-[#00A3FF] animate-spin"></div>
      <p className="text-slate-500 text-sm">Loading sessions...</p>
    </div>
  );

  const renderActiveList = () => (
    <div className="space-y-4">
      {activeSessions.length === 0 && (
        <div className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500">No active sessions. Join one with an invite code or create your own.</p>
        </div>
      )}
      {activeSessions.map(session => (
        session.is_host ? (
          <div key={session.id} className="relative overflow-hidden rounded-2xl mb-4">
            <div className="absolute inset-0 rounded-2xl p-[1px]">
              <div className="absolute inset-0 rounded-2xl opacity-60 blur-[1px]"
                style={{
                  background: 'linear-gradient(90deg, #00FF87, #00A3FF, #6C63FF, #FF6B00, #00FF87)',
                  backgroundSize: '300% 100%',
                  animation: 'ledFlow 4s linear infinite',
                }}
              />
            </div>
            
            <div className="relative bg-[#0F131A] rounded-2xl p-5 m-[1px]">
              <div className="flex flex-wrap items-start justify-between mb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00FF87]/10 flex items-center justify-center">
                    <Radio size={20} className="text-[#00FF87]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                        {session.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-[#00FF87]/10 text-[9px] font-bold text-[#00FF87] uppercase tracking-wider">
                        Live
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[9px] font-medium text-slate-400 uppercase">
                        {session.session_type || 'Custom'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Hosted by you · {session.participant_count || 0}/{session.max_participants || 0} participants
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/50 rounded-lg">
                    <Clock size={12} className="text-slate-500" />
                    <span className="text-xs font-mono text-slate-400">
                      {formatDuration(session.start_time || session.created_at)}
                    </span>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-900/50 rounded-lg">
                    <span className="text-xs font-mono text-slate-400 tracking-widest">
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
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 text-xs font-semibold hover:border-slate-500 active:scale-95 transition-all">
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
          <div key={session.id} className="bg-[#0F131A]/70 backdrop-blur-sm border border-[#00A3FF]/20 rounded-2xl p-5 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00A3FF]/10 flex items-center justify-center">
                  <Users size={20} className="text-[#00A3FF]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {session.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
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
                onClick={() => navigate(`/workspace/${session.id}?type=session`)}
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
        <div className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500">No upcoming sessions scheduled.</p>
        </div>
      )}
      {/* Simplify rendering since user focused on Active and Past */}
      {upcomingSessions.map(session => (
          <div key={session.id} className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-5 mb-4 opacity-75">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{session.name}</h3>
                <p className="text-xs text-slate-500">Starts: {formatDate(session.start_time)}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[9px] font-bold text-amber-500 uppercase tracking-wider">Scheduled</span>
            </div>
          </div>
      ))}
    </div>
  );

  const renderPastList = () => (
    <div className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-2xl overflow-hidden">
      {pastSessions.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm text-slate-500">No session history yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/50">
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-medium whitespace-nowrap">Name</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-medium whitespace-nowrap">Type</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-medium whitespace-nowrap">Date</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-medium whitespace-nowrap">Participants</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-medium whitespace-nowrap">Role</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pastSessions.map(s => (
                <tr key={s.id} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                  <td className="px-5 py-4 text-sm text-slate-200 whitespace-nowrap">
                    {s.name}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[9px] text-slate-400">
                      {s.session_type || 'Custom'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                    {formatDate(s.created_at)}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                    {s.participant_count || 0}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={`text-[9px] uppercase font-semibold ${s.is_host ? 'text-[#6C63FF]' : 'text-[#00A3FF]'}`}>
                      {s.is_host ? 'Host' : 'Joined'}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <button className="text-xs text-slate-500 hover:text-slate-200 active:scale-95 transition-all">
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
    <div className="min-h-[calc(100vh-56px)] bg-[#080B10] p-6 sm:p-8 text-slate-200 max-w-[1200px] mx-auto">
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
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            My Sessions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
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
                : 'bg-[#0F131A] text-slate-400 border border-slate-800/50 hover:border-slate-600'
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
        <div className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00A3FF]/10 flex items-center justify-center">
                <UserPlus size={20} className="text-[#00A3FF]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Join a Session</h3>
                <p className="text-xs text-slate-500 mt-0.5">
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
                className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-white font-mono tracking-widest placeholder-slate-600 outline-none focus:border-[#0066FF]/50 transition-colors w-full sm:w-36 text-center uppercase"
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
    </div>
  );
}
