import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FlaskConical, Plus, Clock, Users, Play, AlertCircle, 
  Eye, StopCircle, CheckCircle, Monitor, X, Bell, ChevronDown, ChevronRight, FileText
} from 'lucide-react';
import { practicalService } from '../../services/practicalService';
import CreatePracticalModal from '../../components/instructor/CreatePracticalModal';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-red-900/20 text-red-400 h-screen">
          <h1 className="text-2xl font-bold mb-4">React Crashed</h1>
          <pre className="whitespace-pre-wrap">{this.state.error?.toString()}</pre>
          <pre className="whitespace-pre-wrap mt-4 text-xs opacity-70">{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function LecturerPracticalPageContent() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [practicals, setPracticals] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Live Monitor State
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [monitorData, setMonitorData] = useState(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const monitorIntervalRef = useRef(null);

  // Group 3 Toggle
  const [showEnded, setShowEnded] = useState(false);

  const fetchPracticals = async () => {
    try {
      const res = await practicalService.getLecturerPracticals();
      if (res?.data?.success) {
        setPracticals(res.data.data || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err?.message || 'Failed to load practical sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPracticals();
  }, []);

  // Monitor polling effect
  useEffect(() => {
    if (selectedSessionId) {
      const fetchMonitor = async () => {
        try {
          const res = await practicalService.getMonitorData(selectedSessionId);
          if (res.data.success) {
            setMonitorData(res.data.data);
          }
        } catch (err) {
          console.error("Monitor fetch error:", err);
        }
      };

      setMonitorLoading(true);
      fetchMonitor().finally(() => setMonitorLoading(false));

      monitorIntervalRef.current = setInterval(fetchMonitor, 5000);
    } else {
      setMonitorData(null);
    }

    return () => {
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    };
  }, [selectedSessionId]);

  const handleStartSession = async (id) => {
    try {
      await practicalService.startPractical(id);
      fetchPracticals();
    } catch (err) {
      alert("Failed to start session.");
    }
  };

  const handleEndSession = async (id) => {
    if (!window.confirm("Are you sure you want to end this session for all students?")) return;
    try {
      await practicalService.endPractical(id);
      if (selectedSessionId === id) setSelectedSessionId(null);
      fetchPracticals();
    } catch (err) {
      alert("Failed to end session.");
    }
  };

  const handleClassCreated = (newClass) => {
    setShowCreateModal(false);
    fetchPracticals();
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getTimeRemaining = (targetTime, isStart = false) => {
    if (!targetTime) return 'Unknown';
    const diff = new Date(targetTime) - new Date();
    if (diff <= 0) return isStart ? 'Started' : 'Ended';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  const getSessionTypeBadge = (type) => {
    if (type === 'exam' || type === 'Practical Exam') return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-red-500/20 text-red-400 border border-red-500/30">Exam</span>;
    if (type === 'assignment' || type === 'VM Assignment') return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Assignment</span>;
    return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Lab Session</span>;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-white flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Loading practicals...
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8">
      <div className="text-red-400 text-lg mb-2">Error loading practicals</div>
      <div className="text-slate-400 text-sm">{error}</div>
    </div>
  );

  const activeSessions = practicals.filter(p => p.status === 'active');
  const scheduled = practicals.filter(p => p.status === 'scheduled');
  const ended = practicals.filter(p => p.status === 'completed' || p.status === 'ended');

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden flex flex-col animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <FlaskConical className="w-8 h-8 text-indigo-500" />
            Practical Sessions & Labs
          </h2>
          <p className="text-slate-400 mt-1">Manage timed lab sessions for your classes</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4" /> Create Practical Session
        </button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* LEFT COLUMN: Sessions List (60%) */}
        <div className="w-3/5 overflow-y-auto pr-2 pb-12 space-y-8 custom-scrollbar">
          
          {/* GROUP 1: Active Now */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-lg font-bold text-emerald-400">Active Now</h3>
              <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full">{activeSessions.length}</span>
            </div>
            {activeSessions.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-center text-slate-500 text-sm">
                No active sessions currently.
              </div>
            ) : (
              <div className="space-y-4">
                {activeSessions.map(session => {
                  const isLowTime = new Date(session.end_time) - new Date() < 600000; // < 10 mins
                  const isSelected = selectedSessionId === session.id;
                  const submittedCount = session.attendance_count || 0;
                  const totalCount = session.total_students || 0;
                  
                  return (
                    <div key={session.id} className={`bg-slate-800 border rounded-2xl p-5 shadow-lg transition-all ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500/50 bg-slate-800/80' : 'border-slate-700 hover:border-slate-600'}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <h4 className="text-white font-bold text-lg">{session.name}</h4>
                            {getSessionTypeBadge(session.session_type)}
                          </div>
                          <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {session.class_name}
                          </span>
                        </div>
                        <div className={`text-sm font-bold flex flex-col items-end ${isLowTime ? 'text-red-400' : 'text-emerald-400'}`}>
                          <span>{getTimeRemaining(session.end_time)} remaining</span>
                          <span className="text-xs font-normal text-slate-400 mt-0.5">Ends {formatDateTime(session.end_time)}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                          <p className="text-xs text-slate-400 mb-1">Progress</p>
                          <div className="flex items-end justify-between mb-1.5">
                            <span className="text-sm font-medium text-white">{submittedCount} of {totalCount} submitted</span>
                            <span className="text-xs text-slate-500">{totalCount > 0 ? Math.round((submittedCount/totalCount)*100) : 0}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${totalCount > 0 ? (submittedCount/totalCount)*100 : 0}%` }} />
                          </div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                          <p className="text-xs text-slate-400 mb-1">Required Template</p>
                          {session.vm_template_name ? (
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
                              <Monitor className="w-4 h-4 text-slate-500" />
                              {session.vm_template_name}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500 italic">Any template</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => setSelectedSessionId(isSelected ? null : session.id)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                            isSelected 
                              ? 'bg-indigo-600 text-white shadow-lg shadow-blue-500/20' 
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                          }`}>
                          <Eye className="w-4 h-4" />
                          {isSelected ? 'Monitoring...' : 'Monitor Live'}
                        </button>
                        <button 
                          onClick={() => handleEndSession(session.id)}
                          className="px-4 py-2 bg-transparent hover:bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                          <StopCircle className="w-4 h-4" /> End Session
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* GROUP 2: Scheduled */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-indigo-400">Scheduled</h3>
              <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full">{scheduled.length}</span>
            </div>
            {scheduled.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-center text-slate-500 text-sm">
                No scheduled sessions.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {scheduled.map(session => (
                  <div key={session.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-md flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-white font-bold mb-1 truncate">{session.name}</h4>
                        <div className="flex items-center gap-2">
                          {getSessionTypeBadge(session.session_type)}
                          <span className="text-slate-400 text-xs truncate max-w-[120px]">{session.class_name}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 mb-4 flex-1">
                      <div className="flex items-center gap-2 text-sm text-indigo-400 font-medium mb-1">
                        <Clock className="w-4 h-4" />
                        Starts in {getTimeRemaining(session.start_time, true)}
                      </div>
                      <div className="text-xs text-slate-400 space-y-1">
                        <p>From: {formatDateTime(session.start_time)}</p>
                        <p>Until: {formatDateTime(session.end_time)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleStartSession(session.id)}
                        className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                        <Play className="w-4 h-4" /> Start Now
                      </button>
                      <button className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* GROUP 3: Ended */}
          <section>
            <button 
              onClick={() => setShowEnded(!showEnded)}
              className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-400">Ended Sessions</h3>
                <span className="bg-slate-900 text-slate-500 text-xs px-2 py-0.5 rounded-full">{ended.length}</span>
              </div>
              {showEnded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
            </button>
            
            {showEnded && (
              <div className="mt-4 space-y-3">
                {ended.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm py-4">No ended sessions.</div>
                ) : (
                  ended.map(session => (
                    <div key={session.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-slate-300 font-bold text-sm mb-1">{session.name}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{session.class_name}</span>
                          <span>•</span>
                          <span>Ended {formatDateTime(session.end_time)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-xs">
                          <p className="text-slate-300">{session.attendance_count || 0} / {session.total_students || 0}</p>
                          <p className="text-slate-500">Submitted</p>
                        </div>
                        <button className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg transition-colors" title="View Report">
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

        </div>

        {/* RIGHT COLUMN: Live Monitor (40%) */}
        <div className="w-2/5 bg-slate-900 border border-slate-700 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          {!selectedSessionId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Eye className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-300 mb-2">Live Monitor Panel</h3>
              <p className="text-sm max-w-xs">Select an "Active Now" session from the left to monitor student progress in real-time.</p>
            </div>
          ) : (
            <>
              {/* Monitor Header */}
              <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-white font-bold truncate max-w-[200px]" title={monitorData?.name}>
                    {monitorData?.name || 'Loading...'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-emerald-400 font-medium">Monitoring Live</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    {monitorData?.students?.filter(s => s.status === 'in_progress').length || 0}
                    <span className="text-sm text-slate-500 font-normal"> / {monitorData?.students?.length || 0}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Connected</p>
                </div>
              </div>
              
              {/* Monitor Grid */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900/50">
                {monitorLoading && !monitorData && (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                
                <div className="space-y-3">
                  {monitorData?.students?.map(student => {
                    const isWorking = student.status === 'in_progress';
                    const isSubmitted = student.status === 'submitted';
                    const isMissed = student.status === 'missed';
                    
                    return (
                      <div key={student.id} className={`bg-slate-800 border rounded-xl p-4 transition-colors ${isWorking ? 'border-indigo-500/30' : 'border-slate-700'}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-bold text-white">{student.name}</h4>
                            <p className="text-[11px] text-slate-400">{student.student_id} • {student.year}</p>
                          </div>
                          
                          {isWorking && <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse">Working</span>}
                          {isSubmitted && <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Submitted ✓</span>}
                          {isMissed && <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-red-500/20 text-red-400 border border-red-500/30">Missed</span>}
                          {student.status === 'not_started' && <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-700 text-slate-400 border border-slate-600">Not Started</span>}
                        </div>
                        
                        {isWorking && (
                          <div className="space-y-3 mt-2 pt-3 border-t border-slate-700/50">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400">VM: <span className="text-slate-200">{student.vm_name || 'Allocating...'}</span></span>
                              <span className="text-slate-400">Time: <span className="text-indigo-400 font-mono">{student.duration || '0m 0s'}</span></span>
                            </div>
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>CPU</span><span>{student.cpu_usage}%</span></div>
                                <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full" style={{ width: `${student.cpu_usage}%` }} /></div>
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>RAM</span><span>{student.ram_usage}%</span></div>
                                <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden"><div className="bg-purple-500 h-full" style={{ width: `${student.ram_usage}%` }} /></div>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-1">
                                <Bell className="w-3 h-3" /> Warn
                              </button>
                              <button className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-1">
                                <X className="w-3 h-3" /> Terminate
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {isSubmitted && (
                          <div className="mt-2 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                            <div className="text-xs text-slate-400">
                              At {formatDateTime(student.submitted_at)}
                            </div>
                            <button className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[11px] font-medium transition-colors">
                              Download
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {monitorData?.students?.length === 0 && (
                    <div className="text-center text-slate-500 text-sm py-10">
                      No students enrolled in this session's class.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreatePracticalModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleClassCreated}
        />
      )}
    </div>
  );
}

export default function LecturerPracticalPage() {
  return (
    <ErrorBoundary>
      <LecturerPracticalPageContent />
    </ErrorBoundary>
  );
}
