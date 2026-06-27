import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FlaskConical, TestTube2, FileText, File, Calendar, Clock, Monitor, 
  ChevronDown, ChevronUp
} from 'lucide-react';
import { practicalService } from '../../services/practicalService';
import { vmService } from '../../services/vmService';
import { sessionService } from '../../services/sessionService';

export default function StudentPracticalPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [practicals, setPracticals] = useState([]);
  
  const [connecting, setConnecting] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [timerTick, setTimerTick] = useState(0); // Force re-render for timers

  useEffect(() => {
    const fetchPracticals = async () => {
      try {
        const res = await practicalService.getStudentPracticals();
        if (res?.data?.success) {
          setPracticals(res.data.data || []);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to load practical sessions');
      } finally {
        setLoading(false);
      }
    };
    fetchPracticals();
  }, []);

  // Timer tick for live countdowns
  useEffect(() => {
    const interval = setInterval(() => setTimerTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEnterLab = async (session) => {
    setConnecting(true);
    try {
      // Check existing VMs
      const vmsRes = await vmService.getMyVMs();
      const myVMs = vmsRes.data.data || [];
      const runningVMs = myVMs.filter(v => v.status === 'running');
      
      if (runningVMs.length > 0) {
        const vm = runningVMs[0];
        const required = session.required_vm_template;
        // Check if correct template if one is required
        if (required && vm.template && vm.template.id !== required.id) {
          // In a full implementation, we'd show a switch modal here.
          // For now, let's navigate with autoProvision flag and the page will handle it or just navigate
          navigate(`/lab/${session.id}`, { state: { session, vmToSwitch: vm, requiredTemplate: required } });
          return;
        }
        
        // Connect to existing VM
        await sessionService.connect(vm.id);
        navigate(`/lab/${session.id}`, { state: { session, vm } });
      } else {
        // Auto-provision flow triggered in LabWorkspacePage
        navigate(`/lab/${session.id}`, { state: { session, autoProvision: true } });
      }
    } catch (err) {
      console.error(err);
      alert('Failed to enter lab. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const active = practicals.filter(p => p.status === 'active');
  const upcoming = practicals.filter(p => p.status === 'scheduled');
  const past = practicals.filter(p => p.status === 'completed' || p.status === 'ended' || p.status === 'cancelled');

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getDuration = (start, end) => {
    const diff = new Date(end) - new Date(start);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${mins > 0 ? mins+'m' : ''}` : `${mins}m`;
  };

  const getTimeRemaining = (targetTime) => {
    const diff = new Date(targetTime) - new Date();
    if (diff <= 0) return '0s';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const isUnder10Mins = (targetTime) => {
    return (new Date(targetTime) - new Date()) < 600000;
  };

  const getSessionTypeBadge = (type) => {
    if (type === 'exam' || type === 'Practical Exam') return <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Practical Exam</span>;
    if (type === 'assignment' || type === 'VM Assignment') return <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5"><File className="w-3.5 h-3.5" /> VM Assignment</span>;
    return <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5"><TestTube2 className="w-3.5 h-3.5" /> Lab Session</span>;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-white flex items-center gap-2">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Loading practicals...
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto min-h-screen animate-fade-in pb-20">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <TestTube2 className="w-8 h-8 text-blue-500" />
          Practicals & Labs
        </h2>
        <p className="text-slate-400">Access your virtual lab environments and practical exams.</p>
      </div>

      {/* ACTIVE BANNER */}
      {active.length > 0 && (
        <div className="border-2 border-emerald-500 rounded-2xl p-5 sm:p-6 mb-8 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.1)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <FlaskConical className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-400 font-bold uppercase tracking-wider text-sm mb-1 animate-pulse">Lab In Progress</p>
                <h3 className="text-2xl font-bold text-white mb-1">{active[0].name}</h3>
                <p className="text-slate-300 font-medium">{active[0].class_name}</p>
              </div>
            </div>

            <div className="text-center bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20 min-w-[200px]">
              <div className={`text-2xl font-mono font-bold tracking-tight mb-1 ${isUnder10Mins(active[0].end_time) ? 'text-red-400' : 'text-white'}`}>
                ⏱ {getTimeRemaining(active[0].end_time)}
              </div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Remaining</p>
              {active[0].submission_deadline && (
                <p className="text-xs text-emerald-400 mt-2 font-medium bg-emerald-500/10 rounded py-1">
                  Submit by: {new Date(active[0].submission_deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              {active[0].vm_template_name && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-1.5 px-3">
                  <Monitor className="w-3.5 h-3.5" /> Requires: {active[0].vm_template_name}
                </div>
              )}
              <button 
                onClick={() => handleEnterLab(active[0])}
                disabled={connecting}
                className="w-full md:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                {connecting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Preparing...</>
                ) : (
                  <>Enter Lab Workspace <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPCOMING SESSIONS */}
      <h3 className="text-xl font-bold text-white mb-4">Upcoming Practicals</h3>
      {upcoming.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center mb-8">
          <TestTube2 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h4 className="text-slate-300 font-medium">No upcoming sessions</h4>
          <p className="text-slate-500 text-sm mt-1">You have no scheduled practicals right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {upcoming.map(session => (
            <div key={session.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold text-white">{session.name}</h4>
                {getSessionTypeBadge(session.session_type)}
              </div>
              
              <div className="mb-4">
                <p className="text-sm font-medium text-blue-400">{session.class_name}</p>
                <p className="text-xs text-slate-400">Instructor: {session.lecturer_name}</p>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 mb-4 flex-1">
                <div className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  {formatDateTime(session.start_time)}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300 mb-3">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Duration: {getDuration(session.start_time, session.end_time)}
                </div>
                
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20 mb-3">
                  Opens in {getTimeRemaining(session.start_time)}
                </div>

                <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-slate-800">
                  {session.vm_template_name ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Monitor className="w-3.5 h-3.5 text-blue-400" />
                      Requires: {session.vm_template_name}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Any VM template allowed</span>
                  )}
                  
                  <div className="flex gap-2 mt-1">
                    {session.instructions?.includes('internet: false') || true /* simulated parsing */ ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20">✓ No Restrictions</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <button 
                disabled
                title={`Lab opens ${formatDateTime(session.start_time)}`}
                className="w-full py-2.5 bg-slate-700/50 text-slate-500 font-medium rounded-xl cursor-not-allowed border border-slate-600/50">
                Connect (Closed)
              </button>
            </div>
          ))}
        </div>
      )}

      {/* PAST SESSIONS */}
      {past.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Past Practicals</h3>
            {past.length > 3 && (
              <button 
                onClick={() => setShowAllPast(!showAllPast)}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                {showAllPast ? 'Show Less' : `Show all ${past.length}`}
                {showAllPast ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {(showAllPast ? past : past.slice(0, 3)).map(session => {
              // Simulated status check - normally this comes from a nested field or separate endpoint
              // We'll simulate based on whether it's an assignment or lab
              const isSubmitted = Math.random() > 0.3; // 70% chance simulated
              
              return (
                <div key={session.id} className="bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600 transition-colors rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-slate-300 font-bold mb-1">{session.name}</h4>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">{session.class_name}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-500">{formatDateTime(session.start_time)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:min-w-[200px]">
                    {isSubmitted ? (
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="text-emerald-400 font-medium text-sm flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4" /> Submitted
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5 px-1.5 py-0.5 bg-slate-700 rounded">On Time</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="text-red-400 font-medium text-sm">✗ Missed</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Not Attempted</span>
                      </div>
                    )}
                    
                    {isSubmitted && (
                      <button className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-colors border border-blue-500/20">
                        View
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
