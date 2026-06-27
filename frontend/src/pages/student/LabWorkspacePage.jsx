import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  FlaskConical, Upload, X, Monitor, Cpu, Server, Check, Loader2, RefreshCw
} from 'lucide-react';
import { practicalService } from '../../services/practicalService';
import { vmService } from '../../services/vmService';
import { sessionService } from '../../services/sessionService';

export default function LabWorkspacePage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(location.state?.session || null);
  const [accessRecord, setAccessRecord] = useState(null);
  const [vm, setVm] = useState(location.state?.vm || null);
  
  const [loading, setLoading] = useState(!session);
  const [error, setError] = useState(null);
  
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerExpired, setTimerExpired] = useState(false);
  
  const [autoProvisioning, setAutoProvisioning] = useState(!!location.state?.autoProvision);
  const [provisionProgress, setProvisionProgress] = useState(0);

  // Submit states
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const submitPanelRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!session) {
          const res = await practicalService.getPracticalDetail(sessionId);
          if (res.data.success) setSession(res.data.data);
        }
        
        const accessRes = await practicalService.getMyAccess(sessionId);
        if (accessRes.data.success) {
          setAccessRecord(accessRes.data.data);
        }

        // Handle auto-provisioning
        if (location.state?.autoProvision) {
          startAutoProvision(location.state.session || session);
        } else if (!vm) {
          // If no VM provided in state, check if they have one running
          const vmsRes = await vmService.getMyVMs();
          const running = (vmsRes.data.data || []).find(v => v.status === 'running');
          if (running) {
            setVm(running);
            await sessionService.connect(running.id);
          }
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load workspace data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sessionId]);

  const startAutoProvision = async (sessionData) => {
    setAutoProvisioning(true);
    try {
      // Find template to request
      const tplId = sessionData?.required_vm_template;
      if (!tplId) {
        // Just get the first available template if none required
        const tplRes = await vmService.getTemplates();
        if (tplRes.data.success && tplRes.data.data.length > 0) {
          const id = tplRes.data.data[0].id;
          await vmService.requestVM(id, "Auto-provisioned for lab");
        }
      } else {
        await vmService.requestVM(tplId, "Auto-provisioned for lab");
      }

      // Simulate 8 second provisioning progress
      let p = 0;
      const progressInt = setInterval(() => {
        p += 12;
        setProvisionProgress(Math.min(95, p));
      }, 1000);

      // Poll until running
      const pollInt = setInterval(async () => {
        const checkRes = await vmService.getMyVMs();
        const running = (checkRes.data.data || []).find(v => v.status === 'running');
        if (running) {
          clearInterval(pollInt);
          clearInterval(progressInt);
          setProvisionProgress(100);
          setVm(running);
          await sessionService.connect(running.id);
          setTimeout(() => setAutoProvisioning(false), 1000);
        }
      }, 3000);

    } catch (err) {
      console.error(err);
      setError("Failed to auto-provision VM.");
      setAutoProvisioning(false);
    }
  };

  // Main Countdown Timer
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, new Date(session.end_time) - new Date());
      setTimeLeft(remaining);
      if (remaining === 0 && !timerExpired) {
        setTimerExpired(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [session, timerExpired]);

  // VM Status Polling (simulated CPU/RAM)
  const [vmStats, setVmStats] = useState({ cpu: 0, ram: 0 });
  useEffect(() => {
    if (!vm || autoProvisioning) return;
    const statTimer = setInterval(() => {
      setVmStats({
        cpu: Math.floor(Math.random() * 20) + 10, // 10-30% simulated
        ram: Math.floor(Math.random() * 15) + 40  // 40-55% simulated
      });
    }, 10000);
    // initial
    setVmStats({ cpu: 12, ram: 42 });
    return () => clearInterval(statTimer);
  }, [vm, autoProvisioning]);

  const handleDisconnect = () => {
    if (window.confirm("Your VM will remain running. You can reconnect later. Leave lab?")) {
      if (session?.id) sessionService.disconnect(session.id).catch(e => console.error(e));
      navigate('/student/practicals');
    }
  };

  const handleTakeSnapshot = async () => {
    setSnapshotLoading(true);
    // simulate snapshot delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSnapshot({
      id: `sim-snap-${Date.now()}`,
      taken_at: new Date()
    });
    setSnapshotLoading(false);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (notes) formData.append('notes', notes);
      if (snapshot) formData.append('vm_snapshot_id', snapshot.id);
      formData.append('submission_type', file ? 'file' : 'snapshot');
      
      const res = await practicalService.submitWork(sessionId, formData);
      if (res.data.success) {
        setAccessRecord(res.data.data);
      }
    } catch (err) {
      alert("Failed to submit work: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeSpan = (ms) => {
    if (ms === null) return '--:--:--';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-blue-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (error) return <div className="h-screen bg-slate-950 flex items-center justify-center text-red-400">{error}</div>;
  if (!session) return <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400">Session not found</div>;

  const isLowTime = timeLeft !== null && timeLeft < 600000;
  const isCriticalTime = timeLeft !== null && timeLeft < 300000;
  const isSubmitted = accessRecord?.status === 'submitted' || accessRecord?.submitted_at;
  
  const subType = session.submission_type || 'both';
  const needsFile = subType === 'file' || subType === 'both';
  const needsSnapshot = subType === 'lab_snapshot' || subType === 'both';
  const canSubmit = (!needsFile || file) && (!needsSnapshot || snapshot);

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden fixed inset-0 z-[100]">
      {/* TOP BAR (56px) */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FlaskConical className="w-5 h-5 text-emerald-500 shrink-0" />
          <h1 className="text-white font-bold truncate">{session.name}</h1>
          <div className="w-px h-4 bg-slate-700 shrink-0" />
          <span className="text-slate-400 text-sm truncate">{session.class_name}</span>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center justify-center mx-4 min-w-[150px]">
          <div className={`font-mono text-xl font-bold tabular-nums tracking-wider ${isCriticalTime ? 'text-red-500 animate-pulse' : isLowTime ? 'text-amber-400' : 'text-white'}`}>
            {formatTimeSpan(timeLeft)}
          </div>
          {session.submission_deadline && (
            <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
              Submit by: {new Date(session.submission_deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center justify-end gap-4 flex-1">
          {vm && !autoProvisioning && (
            <div className="hidden lg:flex items-center gap-3 px-3 py-1 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Connected</span>
              </div>
              <div className="w-px h-3 bg-slate-600" />
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-blue-400" /> {vmStats.cpu}%</span>
                <span className="flex items-center gap-1"><Server className="w-3 h-3 text-purple-400" /> {vmStats.ram}%</span>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => submitPanelRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20 whitespace-nowrap">
            <Upload className="w-4 h-4" /> Submit Work
          </button>
          
          <button 
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 hover:bg-red-500/10 text-red-400 rounded-lg text-sm font-medium transition-colors">
            <X className="w-4 h-4" /> Leave
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: VM Desktop (65%) */}
        <div className="w-[65%] relative bg-black flex flex-col items-center justify-center border-r border-slate-800">
          
          {/* Watermarks */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            <div className={`px-4 py-1 rounded-full text-xs font-bold shadow-lg uppercase tracking-widest ${session.session_type === 'exam' ? 'bg-red-600 text-white shadow-red-600/50 animate-pulse' : 'bg-emerald-500/80 text-emerald-50 backdrop-blur shadow-emerald-500/20'}`}>
              {session.session_type === 'exam' ? '📝 EXAM MODE' : '🧪 Lab Mode'}
            </div>
          </div>
          
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
            {session.instructions?.includes('internet') && (
              <span className="px-3 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-bold shadow shadow-red-900">🚫 No Internet</span>
            )}
            {session.instructions?.includes('copy') && (
              <span className="px-3 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-bold shadow shadow-red-900">🚫 No Copy-Paste</span>
            )}
          </div>

          {autoProvisioning ? (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur z-20 flex flex-col items-center justify-center">
              <div className="w-24 h-24 relative mb-6">
                <svg className="w-full h-full text-slate-700" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" stroke="currentColor"/>
                </svg>
                <svg className="w-full h-full absolute inset-0 text-blue-500 transform -rotate-90 transition-all duration-1000 ease-out" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" stroke="currentColor" strokeDasharray="283" strokeDashoffset={283 - (283 * provisionProgress / 100)}/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-white text-xl">
                  {provisionProgress}%
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 animate-pulse">Provisioning your VM...</h2>
              <p className="text-blue-400 font-medium flex items-center gap-2 mb-1">
                <Monitor className="w-4 h-4" /> {session.vm_template_name || 'Lab Environment'}
              </p>
              <p className="text-slate-500 text-sm">This takes about 8 seconds</p>
            </div>
          ) : !vm ? (
            <div className="text-center text-slate-500">
              <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No Virtual Machine Connected</p>
              <button 
                onClick={() => startAutoProvision(session)}
                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                Request VM
              </button>
            </div>
          ) : (
            // Simulated Desktop Display
            <div className="w-full h-full relative overflow-hidden bg-[#0078D7] flex flex-col shadow-inner">
              <div className="absolute inset-0 opacity-20 pointer-events-none" 
                   style={{backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)', backgroundSize: '30px 30px'}} />
              
              <div className="flex-1 p-6 relative">
                {/* Fake Desktop Icons */}
                <div className="grid grid-cols-1 gap-6 w-24">
                  {['Recycle Bin', session.vm_template_name?.includes('AutoCAD') ? 'AutoCAD 2024' : 'MATLAB', 'Lab Files'].map((label, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 group cursor-pointer hover:bg-white/10 p-2 rounded">
                      <div className="w-10 h-10 bg-white/20 rounded border border-white/30 flex items-center justify-center">
                        <File className="w-5 h-5 text-white/80" />
                      </div>
                      <span className="text-white text-xs text-center drop-shadow-md font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fake Windows Taskbar */}
              <div className="h-10 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-2 shrink-0 border-t border-white/10 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 hover:bg-white/10 rounded flex items-center justify-center cursor-pointer transition-colors">
                    <div className="grid grid-cols-2 gap-0.5">
                      {[1,2,3,4].map(i => <div key={i} className="w-2 h-2 bg-blue-400 rounded-sm"/>)}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-white/10 mx-1" />
                  <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center cursor-pointer">
                    <File className="w-4 h-4 text-blue-200" />
                  </div>
                </div>
                <div className="flex items-center text-xs text-white/90 gap-4 hover:bg-white/10 px-2 py-1 rounded cursor-default">
                  <span>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Session Info (35%) */}
        <div className="w-[35%] bg-slate-900 overflow-y-auto custom-scrollbar p-6 space-y-6">
          
          {/* Card 1: Session Info */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-white font-bold text-sm">Session Details</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h4 className="text-lg font-bold text-white mb-1">{session.name}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Instructor: {session.lecturer_name}</span>
                  <span>•</span>
                  <span>{session.class_name}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Started</span>
                  <span className="text-slate-300">{new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Ends</span>
                  <span className="text-slate-300">{new Date(session.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>

              {session.instructions && (
                <div>
                  <h5 className="text-xs font-bold text-slate-400 mb-1.5 uppercase">Instructions</h5>
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                    {session.instructions}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Submit Your Work */}
          <div ref={submitPanelRef} className={`bg-slate-800 rounded-xl border-2 transition-colors ${isSubmitted ? 'border-emerald-500/50' : 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]'} overflow-hidden`}>
            <div className={`px-4 py-3 border-b flex justify-between items-center ${isSubmitted ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
              <h3 className="text-white font-bold text-sm">Submit Your Work</h3>
              {isSubmitted ? (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Submitted
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase rounded border border-amber-500/30">
                  Not Yet Submitted
                </span>
              )}
            </div>
            
            <div className="p-4 space-y-6">
              
              {isSubmitted ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                    <Check className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-1">Work Submitted!</h4>
                  <p className="text-slate-400 text-sm mb-4">
                    At {new Date(accessRecord.submitted_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  
                  {timeLeft > 0 && (
                    <button 
                      onClick={() => setAccessRecord({...accessRecord, status: 'resubmitting'})}
                      className="text-blue-400 text-sm hover:underline">
                      Resubmit work
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {needsFile && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-300 mb-2">1. Upload File</h4>
                      
                      {!file ? (
                        <div className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors group bg-slate-900/50">
                          <Upload className="w-8 h-8 text-slate-500 group-hover:text-blue-400 mx-auto mb-2 transition-colors" />
                          <p className="text-sm text-slate-300 font-medium mb-1 group-hover:text-white">Click to browse or drag file here</p>
                          <p className="text-[11px] text-slate-500">Max size: {session.max_file_size_mb || 10}MB</p>
                          {/* Hidden file input for simulation */}
                          <input type="file" className="hidden" id="fileUpload" onChange={(e) => setFile(e.target.files[0])} />
                          <label htmlFor="fileUpload" className="absolute inset-0 cursor-pointer" />
                        </div>
                      ) : (
                        <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                              <File className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{file.name}</p>
                              <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button onClick={() => setFile(null)} className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-red-500/10 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      
                      <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional notes for your instructor..."
                        className="w-full mt-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none h-16"
                      />
                    </div>
                  )}

                  {needsSnapshot && (
                    <div className={needsFile ? "pt-5 border-t border-slate-700/50" : ""}>
                      <h4 className="text-sm font-bold text-slate-300 mb-2">{needsFile ? '2. ' : '1. '}Capture VM Snapshot</h4>
                      <p className="text-xs text-slate-400 mb-3">Saves your current VM state for the instructor to review.</p>
                      
                      {!snapshot ? (
                        <button 
                          onClick={handleTakeSnapshot}
                          disabled={snapshotLoading || !vm || autoProvisioning}
                          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                          {snapshotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4" />}
                          {snapshotLoading ? "Capturing State..." : "Take VM Snapshot"}
                        </button>
                      ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                          <div className="flex items-center gap-2 text-emerald-400 mb-1">
                            <Check className="w-4 h-4" /> <span className="font-bold text-sm">Snapshot Captured</span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-slate-400 font-mono">{snapshot.id}</span>
                            <button onClick={() => setSnapshot(null)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" /> Retake
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <button 
                      onClick={handleSubmit}
                      disabled={!canSubmit || submitting}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-base">
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                      {submitting ? "Submitting..." : "Submit Work Now"}
                    </button>
                    {(!canSubmit && !submitting) && (
                      <p className="text-[11px] text-center text-slate-500 mt-2">
                        {needsFile && !file ? "Upload a file to submit. " : ""}
                        {needsSnapshot && !snapshot ? "Capture a snapshot to submit." : ""}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
