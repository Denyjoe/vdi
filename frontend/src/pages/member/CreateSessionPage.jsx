import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, X, ArrowLeft, ArrowRight, Rocket, Check, Monitor as MonitorIcon, Database, Terminal, Shield, Globe, Clipboard, FolderUp, Usb, Monitor, Film, Fingerprint, Users, MousePointer, Timer, Eye } from 'lucide-react';
import api from '../../services/api';
import useUIStore from '../../store/uiStore';

const TemplateIcon = ({ icon, className, size = 16 }) => {
  switch (icon) {
    case 'monitor': return <MonitorIcon size={size} className={className} />;
    case 'database': return <Database size={size} className={className} />;
    case 'terminal': return <Terminal size={size} className={className} />;
    default: return <MonitorIcon size={size} className={className} />;
  }
};

const ControlToggle = ({ label, description, icon: Icon, value, onChange, onColor = '#00FF87' }) => (
  <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${value ? `bg-[#0F131A] border-slate-800/50` : 'bg-[#0F131A] border-slate-800/50'}`}
    style={value ? { backgroundColor: onColor + '08', borderColor: onColor + '25' } : {}}>
    <div className="flex items-center gap-3 flex-1">
      <Icon size={15} className={value ? `text-[${onColor}]` : 'text-slate-600'} style={value ? { color: onColor } : {}} />
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
    <button onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 active:scale-95 ${value ? '' : 'bg-slate-700'}`}
      style={value ? { backgroundColor: onColor } : {}}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${value ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  </div>
);

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [sessionName, setSessionName] = useState('');
  const [sessionDesc, setSessionDesc] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [duration, setDuration] = useState('2');
  const [scheduleType, setScheduleType] = useState('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [templates, setTemplates] = useState([]);
  const [launching, setLaunching] = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const [restrictions, setRestrictions] = useState({
    internet_access: true,
    clipboard: true,
    file_transfer: true,
    usb_access: false,
    screen_monitoring: false,
    session_recording: false,
    screen_watermark: false,
    interaction_mode: 'full_control',
    auto_shutdown_idle: false,
    idle_timeout_minutes: 15,
  });

  useEffect(() => {
    api.get('/vms/templates/').then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setTemplates(data);
    });
  }, []);

  const applyPreset = (preset) => {
    setActivePreset(preset);
    if (preset === 'open') {
      setRestrictions({
        internet_access: true, clipboard: true, file_transfer: true,
        usb_access: false, screen_monitoring: false, session_recording: false,
        screen_watermark: false, interaction_mode: 'full_control',
        auto_shutdown_idle: false, idle_timeout_minutes: 15,
      });
    } else if (preset === 'restricted') {
      setRestrictions({
        internet_access: true, clipboard: false, file_transfer: false,
        usb_access: false, screen_monitoring: true, session_recording: false,
        screen_watermark: false, interaction_mode: 'full_control',
        auto_shutdown_idle: false, idle_timeout_minutes: 15,
      });
    } else if (preset === 'lockdown') {
      setRestrictions({
        internet_access: false, clipboard: false, file_transfer: false,
        usb_access: false, screen_monitoring: true, session_recording: true,
        screen_watermark: true, interaction_mode: 'full_control',
        auto_shutdown_idle: true, idle_timeout_minutes: 15,
      });
    }
  };

  const canProceed = () => {
    if (step === 1) return sessionName.trim().length > 0;
    if (step === 2) return selectedTemplate != null;
    return true;
  };

  const handleLaunch = async () => {
    try {
      setLaunching(true);
      const payload = {
        name: sessionName,
        description: sessionDesc,
        required_vm_template: selectedTemplate.id,
        max_participants: maxParticipants,
        duration_hours: parseFloat(duration),
        restrictions: restrictions,
      };
      if (scheduleType === 'later' && scheduleDate && scheduleTime) {
        payload.scheduled_at = `${scheduleDate}T${scheduleTime}`;
      }
      const res = await api.post('/sessions/live/create/', payload);
      const data = res.data?.data || res.data;
      if (data?.id) {
        navigate(`/host/session/${data.id}`, { state: { session: data } });
      }
    } catch(e) {
      console.error('Create failed:', e);
      alert('Failed to create session: ' + (e.response?.data?.message || e.message));
    } finally {
      setLaunching(false);
    }
  };

  const renderStepDetails = () => (
    <div className="space-y-5">
      <div>
        <label className="text-[11px] uppercase tracking-widest text-slate-500 font-medium block mb-2">Session Name</label>
        <input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="e.g. Python Workshop, Network Security Lab..."
          className="w-full bg-[#0F131A] border border-slate-800/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-[#0066FF]/50 transition-colors" />
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-widest text-slate-500 font-medium block mb-2">
          Description <span className="text-slate-700 ml-1 normal-case tracking-normal">(optional)</span>
        </label>
        <textarea value={sessionDesc} onChange={e => setSessionDesc(e.target.value)} placeholder="Brief description for participants..." rows={3}
          className="w-full bg-[#0F131A] border border-slate-800/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none resize-none focus:border-[#0066FF]/50 transition-colors" />
      </div>
    </div>
  );

  const renderStepEnvironment = () => (
    <div className="space-y-5">
      <div>
        <label className="text-[11px] uppercase tracking-widest text-slate-500 font-medium block mb-3">Participant Environment</label>
        <p className="text-xs text-slate-600 mb-3 -mt-1">Each participant gets their own isolated desktop with this configuration</p>
        <div className="grid grid-cols-2 gap-3">
          {templates.map(t => (
            <button key={t.id} onClick={() => setSelectedTemplate(t)}
              className={`text-left p-4 rounded-xl border transition-all duration-200 active:scale-[0.98] ${selectedTemplate?.id === t.id ? 'bg-[#0066FF]/10 border-[#0066FF]/40 shadow-lg shadow-blue-500/10' : 'bg-[#0F131A] border-slate-800/50 hover:border-slate-600'}`}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedTemplate?.id === t.id ? 'bg-[#0066FF]/20' : 'bg-slate-800/50'}`}>
                  <TemplateIcon icon={t.icon} size={16} className={selectedTemplate?.id === t.id ? 'text-[#0066FF]' : 'text-slate-400'} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{t.name}</p>
                  <p className="text-[10px] text-slate-500">{t.os}</p>
                </div>
                {selectedTemplate?.id === t.id && <Check size={14} className="text-[#0066FF] ml-auto" />}
              </div>
              <div className="flex gap-2 mt-2">
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-400">{t.cpu_cores} vCPU</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-400">{t.ram_gb}GB RAM</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-400">{t.storage_gb}GB</span>
              </div>
              {!t.is_ready && <p className="text-[9px] text-slate-600 mt-2">Ready to use</p>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] uppercase tracking-widest text-slate-500 font-medium block mb-2">Max Participants</label>
          <input type="number" value={maxParticipants} onChange={e => setMaxParticipants(parseInt(e.target.value) || 10)} min={2} max={200}
            className="w-full bg-[#0F131A] border border-slate-800/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#0066FF]/50 transition-colors" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-widest text-slate-500 font-medium block mb-2">Duration</label>
          <select value={duration} onChange={e => setDuration(e.target.value)}
            className="w-full bg-[#0F131A] border border-slate-800/50 rounded-xl px-4 py-3 text-sm text-white outline-none appearance-none cursor-pointer focus:border-[#0066FF]/50">
            <option value="0.5">30 minutes</option>
            <option value="1">1 hour</option>
            <option value="1.5">1.5 hours</option>
            <option value="2">2 hours</option>
            <option value="3">3 hours</option>
            <option value="4">4 hours</option>
            <option value="6">6 hours</option>
            <option value="8">8 hours</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-widest text-slate-500 font-medium block mb-2">When to start</label>
        <div className="flex gap-3">
          <button onClick={() => setScheduleType('now')} className={`flex-1 p-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] ${scheduleType === 'now' ? 'bg-[#0066FF]/10 border-[#0066FF]/40 text-[#0066FF]' : 'bg-[#0F131A] border-slate-800/50 text-slate-400 hover:border-slate-600'}`}>Start Immediately</button>
          <button onClick={() => setScheduleType('later')} className={`flex-1 p-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] ${scheduleType === 'later' ? 'bg-[#0066FF]/10 border-[#0066FF]/40 text-[#0066FF]' : 'bg-[#0F131A] border-slate-800/50 text-slate-400 hover:border-slate-600'}`}>Schedule for Later</button>
        </div>
        {scheduleType === 'later' && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="bg-[#0F131A] border border-slate-800/50 rounded-xl px-4 py-3 text-sm text-white outline-none" />
            <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="bg-[#0F131A] border border-slate-800/50 rounded-xl px-4 py-3 text-sm text-white outline-none" />
          </div>
        )}
      </div>
    </div>
  );

  const renderStepControls = () => (
    <div className="space-y-6">
      <div>
        <label className="text-[11px] uppercase tracking-widest text-slate-500 font-medium block mb-3">Quick Presets</label>
        <div className="flex gap-2">
          <button onClick={() => applyPreset('open')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${activePreset === 'open' ? 'bg-[#00FF87]/10 border-[#00FF87]/30 text-[#00FF87]' : 'bg-[#0F131A] border-slate-800/50 text-slate-400 hover:border-slate-600'}`}>Open Access</button>
          <button onClick={() => applyPreset('restricted')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${activePreset === 'restricted' ? 'bg-[#FF6B00]/10 border-[#FF6B00]/30 text-[#FF6B00]' : 'bg-[#0F131A] border-slate-800/50 text-slate-400 hover:border-slate-600'}`}>Restricted</button>
          <button onClick={() => applyPreset('lockdown')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${activePreset === 'lockdown' ? 'bg-[#FF3366]/10 border-[#FF3366]/30 text-[#FF3366]' : 'bg-[#0F131A] border-slate-800/50 text-slate-400 hover:border-slate-600'}`}>Lockdown</button>
        </div>
      </div>
      <div>
        <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-3 flex items-center gap-2"><Shield size={13} className="text-[#00A3FF]" /> Access Controls</h3>
        <div className="space-y-2">
          <ControlToggle label="Internet Access" description="Participants can browse the web" icon={Globe} value={restrictions.internet_access} onChange={v => setRestrictions(r => ({...r, internet_access: v}))} onColor="#00FF87" />
          <ControlToggle label="Clipboard / Copy-Paste" description="Allow copy-paste between VM and local device" icon={Clipboard} value={restrictions.clipboard} onChange={v => setRestrictions(r => ({...r, clipboard: v}))} onColor="#00FF87" />
          <ControlToggle label="File Transfer" description="Allow file upload and download between VM and local device" icon={FolderUp} value={restrictions.file_transfer} onChange={v => setRestrictions(r => ({...r, file_transfer: v}))} onColor="#00FF87" />
          <ControlToggle label="USB Device Access" description="Allow USB devices to pass through to the VM" icon={Usb} value={restrictions.usb_access} onChange={v => setRestrictions(r => ({...r, usb_access: v}))} onColor="#00FF87" />
        </div>
      </div>
      <div>
        <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-3 flex items-center gap-2"><Eye size={13} className="text-[#6C63FF]" /> Monitoring</h3>
        <div className="space-y-2">
          <ControlToggle label="Live Screen Monitoring" description="View participant screens in real-time from the monitor dashboard" icon={Monitor} value={restrictions.screen_monitoring} onChange={v => setRestrictions(r => ({...r, screen_monitoring: v}))} onColor="#6C63FF" />
          <ControlToggle label="Session Recording" description="Record participant screen activity for later review" icon={Film} value={restrictions.session_recording} onChange={v => setRestrictions(r => ({...r, session_recording: v}))} onColor="#6C63FF" />
          <ControlToggle label="Screen Watermark" description="Display participant name on their desktop as an overlay watermark" icon={Fingerprint} value={restrictions.screen_watermark} onChange={v => setRestrictions(r => ({...r, screen_watermark: v}))} onColor="#6C63FF" />
        </div>
      </div>
      <div>
        <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-3 flex items-center gap-2"><Users size={13} className="text-[#FF6B00]" /> Participant Permissions</h3>
        <div className="space-y-2">
          <div className="bg-[#0F131A] border border-slate-800/50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <MousePointer size={14} className="text-slate-400" />
              <div>
                <p className="text-sm font-medium text-white">Interaction Mode</p>
                <p className="text-[11px] text-slate-500">Control how participants interact with their desktop</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRestrictions(r => ({...r, interaction_mode: 'full_control'}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${restrictions.interaction_mode === 'full_control' ? 'bg-[#00FF87]/10 border-[#00FF87]/30 text-[#00FF87]' : 'bg-slate-900/30 border-slate-800/50 text-slate-500'}`}>Full Control</button>
              <button onClick={() => setRestrictions(r => ({...r, interaction_mode: 'view_only'}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${restrictions.interaction_mode === 'view_only' ? 'bg-[#FF6B00]/10 border-[#FF6B00]/30 text-[#FF6B00]' : 'bg-slate-900/30 border-slate-800/50 text-slate-500'}`}>View Only</button>
            </div>
          </div>
          <ControlToggle label="Auto-Shutdown on Idle" description="Automatically stop participant VM after inactivity" icon={Timer} value={restrictions.auto_shutdown_idle} onChange={v => setRestrictions(r => ({...r, auto_shutdown_idle: v}))} onColor="#FF6B00" />
          {restrictions.auto_shutdown_idle && (
            <div className="pl-12">
              <label className="text-[10px] text-slate-500 block mb-1">Idle timeout (minutes)</label>
              <input type="number" value={restrictions.idle_timeout_minutes} onChange={e => setRestrictions(r => ({...r, idle_timeout_minutes: parseInt(e.target.value) || 15}))} min={5} max={120} className="w-24 bg-slate-900/50 border border-slate-800/50 rounded-lg px-3 py-2 text-xs text-white outline-none" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStepReview = () => (
    <div className="space-y-5">
      <div className="bg-[#0F131A] border border-slate-800/50 rounded-xl p-5">
        <h3 className="text-[10px] uppercase tracking-widest text-[#00A3FF] font-semibold mb-4">Session Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between"><span className="text-xs text-slate-500">Name</span><span className="text-sm font-semibold text-white">{sessionName}</span></div>
          {sessionDesc && <div className="flex justify-between"><span className="text-xs text-slate-500">Description</span><span className="text-xs text-slate-300 text-right max-w-[60%]">{sessionDesc}</span></div>}
          <div className="flex justify-between"><span className="text-xs text-slate-500">Template</span><span className="text-sm text-white">{selectedTemplate?.name}</span></div>
          <div className="flex justify-between"><span className="text-xs text-slate-500">Specs</span><span className="text-xs text-slate-300">{selectedTemplate?.cpu_cores} vCPU · {selectedTemplate?.ram_gb}GB RAM · {selectedTemplate?.os}</span></div>
          <div className="flex justify-between"><span className="text-xs text-slate-500">Participants</span><span className="text-sm text-white">up to {maxParticipants}</span></div>
          <div className="flex justify-between"><span className="text-xs text-slate-500">Duration</span><span className="text-sm text-white">{duration} hour{duration > 1 ? 's' : ''}</span></div>
          <div className="flex justify-between"><span className="text-xs text-slate-500">Start</span><span className="text-sm text-white">{scheduleType === 'now' ? 'Immediately' : `${scheduleDate} ${scheduleTime}`}</span></div>
        </div>
      </div>
      <div className="bg-[#0F131A] border border-slate-800/50 rounded-xl p-5">
        <h3 className="text-[10px] uppercase tracking-widest text-[#6C63FF] font-semibold mb-4">Session Controls</h3>
        <div className="grid grid-cols-2 gap-2">
          {[{ label: 'Internet', active: restrictions.internet_access }, { label: 'Clipboard', active: restrictions.clipboard }, { label: 'File Transfer', active: restrictions.file_transfer }, { label: 'Monitoring', active: restrictions.screen_monitoring }, { label: 'Recording', active: restrictions.session_recording }, { label: 'Watermark', active: restrictions.screen_watermark }].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-xs">
              <div className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-[#00FF87]' : 'bg-[#FF3366]'}`} />
              <span className="text-slate-400">{c.label}:</span>
              <span className={c.active ? 'text-[#00FF87]' : 'text-[#FF3366]'}>{c.active ? 'Allowed' : 'Blocked'}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs col-span-2 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00A3FF]" />
            <span className="text-slate-400">Mode:</span>
            <span className="text-[#00A3FF]">{restrictions.interaction_mode === 'full_control' ? 'Full Control' : 'View Only'}</span>
          </div>
        </div>
      </div>
      {selectedTemplate?.price_per_hour > 0 && (
        <div className="bg-[#0F131A] border border-[#FF6B00]/20 rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-widest text-[#FF6B00] font-semibold mb-3">Cost Estimate</h3>
          <div className="text-sm text-slate-300">TZS {selectedTemplate.price_per_hour.toLocaleString()}/hr x {maxParticipants} participants x {duration}hrs</div>
          <div className="text-lg font-bold text-white mt-1">= TZS {(selectedTemplate.price_per_hour * maxParticipants * duration).toLocaleString()} <span className="text-xs text-slate-500 font-normal ml-1">(maximum)</span></div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6">
      
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#0066FF]/10 flex items-center justify-center">
            <Radio size={18} className="text-[#0066FF]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Create Session
          </h1>
        </div>
        <p className="text-sm text-slate-500 ml-12">
          Set up a live session for participants
        </p>
      </div>
      
      {/* Step progress bar */}
      <div className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-6 mb-6">
        <div className="flex gap-2 mb-1">
          {['Details', 'Environment', 'Controls', 'Review'].map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${i + 1 <= step ? 'bg-[#0066FF]' : 'bg-slate-800/50'}`} />
              <p className={`text-[10px] mt-2 font-semibold uppercase tracking-wider ${i + 1 === step ? 'text-[#0066FF]' : i + 1 < step ? 'text-slate-400' : 'text-slate-600'}`}>
                {s}
              </p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Step content */}
      <div className="bg-[#0F131A]/70 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-6 mb-6">
        {step === 1 && renderStepDetails()}
        {step === 2 && renderStepEnvironment()}
        {step === 3 && renderStepControls()}
        {step === 4 && renderStepReview()}
      </div>
      
      {/* Navigation buttons */}
      <div className="flex justify-between">
        {step > 1 ? (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 text-sm font-medium hover:border-slate-500 active:scale-95 transition-all">
            <ArrowLeft size={15} />
            Back
          </button>
        ) : (
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 text-sm font-medium hover:border-slate-500 active:scale-95 transition-all">
            <ArrowLeft size={15} />
            Cancel
          </button>
        )}
        
        {step < 4 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-30 disabled:cursor-not-allowed">
            Continue
            <ArrowRight size={15} />
          </button>
        ) : (
          <button onClick={handleLaunch} disabled={launching}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#6C63FF] text-white text-sm font-semibold active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50">
            {launching ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Rocket size={15} />
                Launch Session
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
