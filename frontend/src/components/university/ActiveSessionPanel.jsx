import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Radio, Users, Clock, Pause, Play, Power, PlusCircle, Monitor, X,
  Shield, WifiOff, ClipboardX, ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import ExtendSessionModal from '../shared/ExtendSessionModal';
import GuacamoleEmbed from '../shared/GuacamoleEmbed';
import ConfirmDialog from '../shared/ConfirmDialog';
import useConfirm from '../../hooks/useConfirm';

/**
 * ActiveSessionPanel — Phase 2 (Premium Rebuild). The full, existing,
 * proven session-hosting toolkit (Take Control, Pause All, network
 * lockdown status, Extend, End) surfaced directly on the Lecturer
 * Dashboard's own course card the moment a real class session is
 * active — reusing the EXACT real endpoints, and the EXACT real
 * ExtendSessionModal/GuacamoleEmbed/ConfirmDialog components
 * HostSessionPage itself uses, not a rebuilt parallel version.
 *
 * "Network lockdown" here is the same real, existing behavior as
 * HostSessionPage: a status set once at session creation and displayed
 * live (Exam Mode / No Internet / No Copy-Paste badges) — there is no
 * live mid-session lockdown TOGGLE anywhere in the existing, proven
 * system, so this deliberately doesn't invent one; it surfaces the
 * real thing that exists.
 */
export default function ActiveSessionPanel({ session: initialSession, courseCode, onEnded }) {
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [session, setSession] = useState(initialSession);
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [controlSession, setControlSession] = useState(null);
  const [pauseBusy, setPauseBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const warningShownRef = useRef(false);

  const fetchMonitor = useCallback(async () => {
    try {
      const res = await api.get(`/sessions/live/${initialSession.id}/monitor/`);
      const data = res.data?.data || res.data;
      if (data.session) setSession(prev => ({ ...prev, ...data.session }));
      setParticipants(data.participants || []);
    } catch (e) {
      // A 403/404 here almost always means the session just ended
      // (auto-end on expiry, or ended from elsewhere) — let the parent
      // course list refresh pick that up rather than erroring loudly.
    }
  }, [initialSession.id]);

  useEffect(() => {
    fetchMonitor();
    const interval = setInterval(fetchMonitor, 5000);
    return () => clearInterval(interval);
  }, [fetchMonitor]);

  useEffect(() => {
    if (!session?.scheduled_end_at) return;
    const interval = setInterval(() => {
      const end = new Date(session.scheduled_end_at).getTime();
      const diff = end - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        clearInterval(interval);
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.scheduled_end_at]);

  const anyPaused = participants.some(p => p.is_being_controlled);

  const handlePauseAll = async () => {
    const ok = await confirm(
      'Pause All Participants',
      'Pause all participants? They will see a message that their session is paused for review. Their work is safe and time keeps counting.',
      false,
    );
    if (!ok) return;
    setPauseBusy(true);
    try {
      await api.post(`/sessions/live/${initialSession.id}/pause-all/`);
      await fetchMonitor();
    } catch (e) {
      toast.error('Failed to pause: ' + (e.response?.data?.message || e.message));
    } finally {
      setPauseBusy(false);
    }
  };

  const handleResumeAll = async () => {
    setPauseBusy(true);
    try {
      await api.post(`/sessions/live/${initialSession.id}/resume-all/`);
      await fetchMonitor();
    } catch (e) {
      toast.error('Failed to resume: ' + (e.response?.data?.message || e.message));
    } finally {
      setPauseBusy(false);
    }
  };

  const handleExtendSuccess = (newScheduledEndAt) => {
    setShowExtendModal(false);
    setSession(prev => ({ ...prev, scheduled_end_at: newScheduledEndAt }));
    warningShownRef.current = false;
    toast.success('Session extended.');
  };

  const handleEndSession = async () => {
    const ok = await confirm('End Session', 'End this session? All participants will be disconnected.', true);
    if (!ok) return;
    try {
      await api.post(`/sessions/live/${initialSession.id}/end/`);
      toast.success('Session ended.');
      onEnded?.();
    } catch (e) {
      toast.error('Failed to end session: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleTakeControl = async (participant) => {
    const name = participant.user?.first_name || participant.user_name || participant.user?.email || 'this user';
    const ok = await confirm(
      'Take Control',
      `Take control of ${name}'s session? They will be temporarily disconnected while you have control. Their work is saved and they can reconnect once you release control.`,
      true,
    );
    if (!ok) return;
    try {
      const res = await api.post(`/sessions/live/${initialSession.id}/control-participant/${participant.id}/`);
      if (res.data.success) {
        setControlSession({ participant, controlUrl: res.data.control_url });
      }
    } catch (e) {
      toast.error('Failed to take control: ' + (e.response?.data?.message || e.message));
    }
  };

  const releaseControl = async () => {
    if (controlSession) {
      try {
        await api.post(`/sessions/live/${initialSession.id}/release-control/${controlSession.participant.id}/`);
      } catch (e) { /* ignore */ }
    }
    setControlSession(null);
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/[0.04] overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between bg-emerald-500/10 border-b border-emerald-500/20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex-shrink-0">Live</span>
          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{session.name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] flex-shrink-0">
          <Clock size={12} />
          <span className="font-mono">{timeLeft || '--:--:--'}</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowParticipants(s => !s)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] font-medium hover:bg-[var(--bg-nav-hover)]">
            <Users size={12} /> {participants.length}/{session.max_participants || 0} joined
          </button>
          {session.is_exam_mode && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] text-xs font-semibold">
              <Shield size={12} /> Exam Mode
            </span>
          )}
          {session.restrict_internet && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">
              <WifiOff size={12} /> Network Lockdown
            </span>
          )}
          {session.restrict_copy_paste && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold">
              <ClipboardX size={12} /> No Copy-Paste
            </span>
          )}
        </div>

        {/* The full, real toolkit — same endpoints HostSessionPage calls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={anyPaused ? handleResumeAll : handlePauseAll} disabled={pauseBusy || participants.length === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
            {anyPaused ? <Play size={13} /> : <Pause size={13} />} {anyPaused ? 'Resume All' : 'Pause All'}
          </button>
          <button onClick={() => setShowExtendModal(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20">
            <PlusCircle size={13} /> Extend
          </button>
          <Link to={`/host/session/${initialSession.id}`}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold hover:bg-[var(--bg-nav-hover)]">
            <ExternalLink size={13} /> Full View
          </Link>
          <button onClick={handleEndSession}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20">
            <Power size={13} /> End
          </button>
        </div>

        {/* Real, live participant list with real Take Control per row —
            same real endpoint + GuacamoleEmbed HostSessionPage uses. */}
        {showParticipants && (
          <div className="pt-2 border-t border-[var(--border-color)] space-y-1.5 max-h-56 overflow-y-auto">
            {participants.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] py-2">No one has joined yet.</p>
            ) : participants.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1.5">
                <span className="text-[var(--text-primary)] truncate">
                  {p.user?.first_name || p.user_name || p.user?.email || 'Participant'}
                  {p.is_being_controlled && <span className="ml-1.5 text-amber-400">(paused)</span>}
                </span>
                <button onClick={() => handleTakeControl(p)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-nav-hover)] flex-shrink-0">
                  <Monitor size={11} /> Take Control
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showExtendModal && (
        <ExtendSessionModal
          isOpen={showExtendModal}
          onClose={() => setShowExtendModal(false)}
          sessionId={initialSession.id}
          onSuccess={handleExtendSuccess}
        />
      )}

      {controlSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-amber-500/30 rounded-2xl overflow-hidden w-[95vw] sm:w-[85vw] h-[90vh] sm:h-[80vh] flex flex-col shadow-2xl">
            <div className="h-12 px-4 flex items-center justify-between bg-amber-500/10 border-b border-amber-500/20">
              <div className="flex items-center gap-3 truncate">
                <Monitor size={16} className="text-amber-500" />
                <span className="text-sm font-semibold text-amber-500 truncate">
                  Controlling: {controlSession.participant.user?.first_name || controlSession.participant.user?.email || 'User'}
                </span>
              </div>
              <button onClick={releaseControl} className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-500">
                <X size={18} />
              </button>
            </div>
            <GuacamoleEmbed
              url={controlSession.controlUrl}
              title={`Controlling: ${controlSession.participant.user?.first_name || 'User'}`}
              tunnelActive={participants.find(p => p.id === controlSession.participant.id)?.guac_connected || false}
            />
            <div className="h-10 px-4 flex items-center justify-end gap-2 bg-[var(--bg-canvas)] border-t border-[var(--border-color)]">
              <button onClick={releaseControl}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold">
                Release Control
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
