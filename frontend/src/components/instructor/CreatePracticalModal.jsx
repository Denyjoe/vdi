import React, { useState, useEffect } from 'react';
import { 
  X, FlaskConical, Calendar, Clock, Monitor, Users, FileText, 
  ChevronRight, ChevronLeft, Check, Loader2, AlertCircle, File
} from 'lucide-react';
import { classService } from '../../services/classService';
import { practicalService } from '../../services/practicalService';
import api from '../../services/api';
import useContextStore from '../../store/contextStore';

const SESSION_TYPES = [
  { id: 'lab', label: 'Lab Session', icon: <FlaskConical className="w-5 h-5 text-emerald-500" /> },
  { id: 'exam', label: 'Practical Exam', icon: <FileText className="w-5 h-5 text-red-500" /> },
  { id: 'assignment', label: 'VM Assignment', icon: <File className="w-5 h-5 text-indigo-500" /> }
];

const SUBMISSION_TYPES = [
  { id: 'file', label: 'File Upload Only', desc: 'Students upload a PDF, DOCX, etc.' },
  { id: 'lab', label: 'Virtual Lab (VM Snapshot)', desc: 'We take a snapshot of their VM state.' },
  { id: 'both', label: 'Both (File + VM Snapshot)', desc: 'Require both a file and VM state.' }
];

export default function CreatePracticalModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    class_room: '',
    session_type: 'lab',
    
    start_time: '',
    end_time: '',
    submission_deadline: '',
    same_as_end_time: true,
    
    required_vm_template: '',
    restrict_internet: false,
    restrict_copy_paste: false,
    allow_late: true,
    grace_period: 30,
    
    submission_type: 'both',
    max_file_size: 10,
    instructions: ''
  });

  useEffect(() => {
    // Set default dates (today + 1 hr, + 3 hrs)
    const now = new Date();
    now.setMinutes(0, 0, 0); // round to hour
    
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const deadline = new Date(end.getTime() + 30 * 60 * 1000);
    
    const fmt = (d) => {
      // pad manually to deal with timezone offset properly for input type=datetime-local
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d - tzOffset)).toISOString().slice(0, 16);
      return localISOTime;
    };

    setFormData(prev => ({
      ...prev,
      start_time: fmt(start),
      end_time: fmt(end),
      submission_deadline: fmt(deadline)
    }));

    // Fetch classes & templates
    const fetchData = async () => {
      try {
        const [clsRes, tplRes] = await Promise.all([
          classService.getMyClasses(),
          api.get('/vms/templates/', { params: { context: useContextStore.getState().contextParam() } })
        ]);
        if (clsRes.data.success) setClasses(clsRes.data.data);
        if (tplRes.data.success) setTemplates(tplRes.data.data);
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNext = () => {
    if (step === 1 && (!formData.name || !formData.class_room)) {
      setError("Please fill all required fields.");
      return;
    }
    setError('');
    setStep(s => Math.min(5, s + 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      // Use end time if same_as_end_time is checked
      const deadline = formData.same_as_end_time ? formData.end_time : formData.submission_deadline;
      
      const payload = {
        name: formData.name,
        session_type: formData.session_type,
        class_room: parseInt(formData.class_room, 10),
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        submission_deadline: new Date(deadline).toISOString(),
        required_vm_template: formData.required_vm_template ? parseInt(formData.required_vm_template, 10) : null,
        submission_type: formData.submission_type,
        instructions: formData.instructions,
      };

      const res = await practicalService.createPractical(payload);
      if (res.data.success) {
        onCreated(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  // Preview computations
  const getDurationHours = () => {
    if (!formData.start_time || !formData.end_time) return 0;
    const s = new Date(formData.start_time);
    const e = new Date(formData.end_time);
    return Math.max(0, (e - s) / 3600000).toFixed(1);
  };

  const getDeadlineDiffMins = () => {
    if (formData.same_as_end_time) return 0;
    if (!formData.end_time || !formData.submission_deadline) return 0;
    const e = new Date(formData.end_time);
    const d = new Date(formData.submission_deadline);
    return Math.max(0, (d - e) / 60000).toFixed(0);
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const selectedClassObj = classes.find(c => c.id.toString() === formData.class_room);
  const selectedTemplateObj = templates.find(t => t.id.toString() === formData.required_vm_template);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-indigo-500" /> Create Practical Session
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Step {step} of 5</p>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-card)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[var(--bg-card)] h-1 shrink-0">
          <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${(step/5)*100}%` }} />
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">1. Basic Info</h3>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Session Name <span className="text-red-400">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleChange}
                  placeholder="e.g. AutoCAD Lab 1: Floor Plan"
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-muted focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Select Class <span className="text-red-400">*</span></label>
                <select name="class_room" value={formData.class_room} onChange={handleChange}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500">
                  <option value="">Select a class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">Session Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SESSION_TYPES.map(type => (
                    <label key={type.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formData.session_type === type.id ? 'bg-indigo-500/10 border-indigo-500' : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-slate-600'}`}>
                      <input type="radio" name="session_type" value={type.id} checked={formData.session_type === type.id} onChange={handleChange} className="hidden" />
                      {type.icon}
                      <span className={`text-sm font-medium ${formData.session_type === type.id ? 'text-indigo-400' : 'text-[var(--text-primary)]'}`}>{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">2. Schedule</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Start Date & Time</label>
                  <input type="datetime-local" name="start_time" value={formData.start_time} onChange={handleChange}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">End Date & Time</label>
                  <input type="datetime-local" name="end_time" value={formData.end_time} onChange={handleChange}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-[var(--text-primary)]">Submission Deadline</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="same_as_end_time" checked={formData.same_as_end_time} onChange={handleChange} className="w-4 h-4 rounded text-indigo-500 focus:ring-0 bg-[var(--bg-card)] border-[var(--border-color)]" />
                    <span className="text-sm text-[var(--text-secondary)]">Same as end time</span>
                  </label>
                </div>
                {!formData.same_as_end_time && (
                  <input type="datetime-local" name="submission_deadline" value={formData.submission_deadline} onChange={handleChange}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                )}
              </div>

              <div className="bg-[var(--bg-card)]/50 rounded-xl p-4 border border-[var(--border-color)]/50 flex items-center justify-around text-center">
                <div>
                  <p className="text-xs text-[var(--text-secondary)] mb-1">Duration</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{getDurationHours()} hours</p>
                </div>
                {!formData.same_as_end_time && (
                  <div>
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Submission Window</p>
                    <p className="text-lg font-bold text-emerald-400">+{getDeadlineDiffMins()} mins</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">3. VM & Restrictions</h3>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Required VM Template (Optional)</label>
                <select name="required_vm_template" value={formData.required_vm_template} onChange={handleChange}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500">
                  <option value="">Any template (Student chooses)</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {selectedTemplateObj && (
                  <p className="text-xs text-[var(--text-secondary)] mt-2 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" /> 
                    Specs: {selectedTemplateObj.cores} CPU Cores, {selectedTemplateObj.memory_gb}GB RAM
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-[var(--border-color)] space-y-4">
                <label className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]/50 cursor-pointer hover:border-slate-600 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Restrict Internet Access</p>
                    <p className="text-xs text-[var(--text-secondary)]">Block external websites during this session (recommended for exams).</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${formData.restrict_internet ? 'bg-red-500' : 'bg-[var(--bg-card-hover)]'}`}>
                    <input type="checkbox" name="restrict_internet" checked={formData.restrict_internet} onChange={handleChange} className="sr-only" />
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.restrict_internet ? 'translate-x-6' : ''}`} />
                  </div>
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]/50 cursor-pointer hover:border-slate-600 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Restrict Copy & Paste</p>
                    <p className="text-xs text-[var(--text-secondary)]">Prevent copying text into or out of the VM.</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${formData.restrict_copy_paste ? 'bg-red-500' : 'bg-[var(--bg-card-hover)]'}`}>
                    <input type="checkbox" name="restrict_copy_paste" checked={formData.restrict_copy_paste} onChange={handleChange} className="sr-only" />
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.restrict_copy_paste ? 'translate-x-6' : ''}`} />
                  </div>
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]/50 cursor-pointer hover:border-slate-600 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Allow Late Submissions</p>
                    <p className="text-xs text-[var(--text-secondary)]">Accept submissions after the deadline (marked as late).</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${formData.allow_late ? 'bg-emerald-500' : 'bg-[var(--bg-card-hover)]'}`}>
                    <input type="checkbox" name="allow_late" checked={formData.allow_late} onChange={handleChange} className="sr-only" />
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.allow_late ? 'translate-x-6' : ''}`} />
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">4. Submission Settings</h3>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">Submission Type</label>
                <div className="space-y-3">
                  {SUBMISSION_TYPES.map(type => (
                    <label key={type.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formData.submission_type === type.id ? 'bg-indigo-500/10 border-indigo-500' : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-slate-600'}`}>
                      <input type="radio" name="submission_type" value={type.id} checked={formData.submission_type === type.id} onChange={handleChange} className="mt-1" />
                      <div>
                        <p className={`text-sm font-medium ${formData.submission_type === type.id ? 'text-indigo-400' : 'text-primary'}`}>{type.label}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{type.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {(formData.submission_type === 'file' || formData.submission_type === 'both') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Max File Size (MB)</label>
                    <input type="number" name="max_file_size" value={formData.max_file_size} onChange={handleChange} min="1" max="500"
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Allowed Types (Exts)</label>
                    <input type="text" placeholder=".pdf, .docx, .dwg"
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-muted focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Instructions for Students</label>
                <textarea name="instructions" value={formData.instructions} onChange={handleChange} rows="4"
                  placeholder="Detailed instructions shown to students when they join the session..."
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-muted focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">5. Review & Create</h3>
              
              <div className="bg-[var(--bg-card)]/80 border border-[var(--border-color)] rounded-2xl p-5 space-y-4">
                <div className="pb-4 border-b border-[var(--border-color)]/50">
                  <h4 className="text-xl font-bold text-[var(--text-primary)] mb-1">{formData.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-400">
                      {SESSION_TYPES.find(t => t.id === formData.session_type)?.label}
                    </span>
                    <span className="text-sm text-[var(--text-secondary)]">for {selectedClassObj?.name}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                  <div>
                    <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Schedule</p>
                    <p className="text-sm text-[var(--text-primary)]">{formatDateTime(formData.start_time)}</p>
                    <p className="text-sm text-[var(--text-primary)]">to {formatDateTime(formData.end_time)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Submission</p>
                    <p className="text-sm text-emerald-400 font-medium">By {formatDateTime(formData.same_as_end_time ? formData.end_time : formData.submission_deadline)}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{SUBMISSION_TYPES.find(t=>t.id===formData.submission_type)?.label}</p>
                  </div>
                  <div className="col-span-2 mt-2">
                    <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Environment</p>
                    <p className="text-sm text-[var(--text-primary)] flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-muted" />
                      {selectedTemplateObj ? selectedTemplateObj.name : 'Any Template'}
                    </p>
                    {(formData.restrict_internet || formData.restrict_copy_paste) && (
                      <p className="text-xs text-red-400 mt-1 flex gap-3">
                        {formData.restrict_internet && <span>🚫 No Internet</span>}
                        {formData.restrict_copy_paste && <span>🚫 No Copy/Paste</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[var(--bg-card)] border-t border-[var(--border-color)] shrink-0 flex items-center justify-between">
          <button 
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1 || loading}
            className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] bg-[var(--bg-card-hover)] hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          
          {step < 5 ? (
            <button 
              onClick={handleNext}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-bold text-[var(--text-primary)] bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-70">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Create Practical Session
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
