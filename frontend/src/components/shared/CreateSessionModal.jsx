import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Monitor, ShieldAlert, Lock, Clock, Calendar } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function CreateSessionModal({ onClose, onCreated }) {
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    session_type: 'workshop',
    required_vm_template_id: null,
    start_time: '',
    end_time: '',
    max_participants: 50,
    restrict_internet: false,
    is_exam_mode: false,
    password: '',
    auto_end: true
  });
  
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setStep(1);
    // set default times (start in 1 hr, end in 3 hrs)
    const start = new Date();
    start.setHours(start.getHours() + 1);
    const end = new Date(start);
    end.setHours(end.getHours() + 2);
    
    const maxP = user?.subscription?.max_session_participants || 10;
    
    setFormData(prev => ({
      ...prev,
      start_time: start.toISOString().slice(0, 16),
      end_time: end.toISOString().slice(0, 16),
      max_participants: maxP
    }));
    
    api.get('/vms/templates/').then(res => {
      setTemplates(res.data?.data || []);
    }).catch(console.error);
  }, [user]);

  const handleClose = () => {
    if (onClose) onClose();
  };

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    setCreating(true);
    try {
      const res = await api.post('/sessions/live/create/', {
        ...formData,
        required_vm_template: formData.required_vm_template_id
      });
      
      const session = res.data.data;
      
      // Auto-start session immediately
      await api.post(`/sessions/live/${session.id}/start/`);
      
      // Go directly to monitor
      if (onCreated) {
        onCreated(session);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating session. Check your plan limits.');
    } finally {
      setCreating(false);
    }
  };

  const sessionTypes = [
    { id: 'lab', icon: '🧪', label: 'Lab / Practical' },
    { id: 'exam', icon: '📝', label: 'Exam / Assessment' },
    { id: 'workshop', icon: '🎓', label: 'Workshop / Tutorial' },
    { id: 'training', icon: '💻', label: 'Training Session' },
    { id: 'other', icon: '📋', label: 'Other' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">
            Create Live Session
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto no-scrollbar flex-1">
          
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Session Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                  placeholder="e.g. AutoCAD Practical — Wednesday Class"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Session Type</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {sessionTypes.map(t => (
                    <div 
                      key={t.id}
                      onClick={() => {
                        setFormData({...formData, session_type: t.id, is_exam_mode: t.id === 'exam'});
                      }}
                      className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        formData.session_type === t.id 
                          ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-2xl">{t.icon}</span>
                      <span className="text-xs font-medium text-center">{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <label className="block text-sm font-medium text-slate-300">Which VM should participants use?</label>
              
              <div 
                onClick={() => setFormData({...formData, required_vm_template_id: null})}
                className={`cursor-pointer p-4 rounded-xl border flex items-center gap-4 transition-all ${
                  formData.required_vm_template_id === null
                    ? 'bg-indigo-500/10 border-indigo-500' 
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="p-3 bg-slate-700 rounded-lg text-slate-300"><Monitor size={20} /></div>
                <div>
                  <h4 className="text-white font-medium">Let them choose (Any Template)</h4>
                  <p className="text-sm text-slate-400">Participants can pick any available VM template</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                {templates.map(t => (
                  <div 
                    key={t.id}
                    onClick={() => setFormData({...formData, required_vm_template_id: t.id})}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      formData.required_vm_template_id === t.id
                        ? 'bg-indigo-500/10 border-indigo-500 relative overflow-hidden' 
                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {formData.required_vm_template_id === t.id && (
                      <div className="absolute top-0 right-0 bg-indigo-500 text-white p-1 rounded-bl-lg">
                        <CheckCircle size={14} />
                      </div>
                    )}
                    <h4 className="text-white font-medium truncate">{t.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{t.os} • {t.cpu_cores} Cores • {t.ram_gb}GB RAM</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Start Date & Time</label>
                  <input 
                    type="datetime-local" 
                    value={formData.start_time}
                    onChange={e => setFormData({...formData, start_time: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">End Date & Time</label>
                  <input 
                    type="datetime-local" 
                    value={formData.end_time}
                    onChange={e => setFormData({...formData, end_time: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <Clock size={14} /> Session times shown in your local timezone
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Max Participants</label>
                <input 
                  type="number" 
                  min="1" max={user?.subscription?.max_session_participants || 10}
                  value={formData.max_participants}
                  onChange={e => setFormData({...formData, max_participants: parseInt(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                />
                <p className="text-xs text-indigo-400 mt-2">Your plan allows up to {user?.subscription?.max_session_participants || 10} participants.</p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.restrict_internet}
                    onChange={e => setFormData({...formData, restrict_internet: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-800 bg-slate-700"
                  />
                  <div>
                    <span className="text-white font-medium flex items-center gap-2">
                      <ShieldAlert size={16} className="text-amber-400" /> Restrict Internet Access
                    </span>
                    <p className="text-xs text-slate-400 mt-1">Block outside internet inside VMs</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.is_exam_mode}
                    onChange={e => setFormData({...formData, is_exam_mode: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-800 bg-slate-700"
                  />
                  <div>
                    <span className="text-white font-medium flex items-center gap-2">
                      <Lock size={16} className="text-red-400" /> Exam Mode
                    </span>
                    <p className="text-xs text-slate-400 mt-1">Activates strict settings and shows exam watermark</p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Session Password (Optional)</label>
                <input 
                  type="text" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                  placeholder="Leave empty for code-only access"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-6 bg-slate-800 rounded-2xl border border-slate-700 space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Session Name</p>
                  <p className="text-lg font-bold text-white">{formData.name}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Type</p>
                    <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded-lg uppercase tracking-wider font-bold">
                      {formData.session_type}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Participants</p>
                    <p className="text-sm text-white font-medium">Up to {formData.max_participants}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Start</p>
                    <p className="text-sm text-white font-medium">{new Date(formData.start_time).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">End</p>
                    <p className="text-sm text-white font-medium">{new Date(formData.end_time).toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Virtual Machine</p>
                  <p className="text-sm text-white font-medium">
                    {formData.required_vm_template_id 
                      ? templates.find(t => t.id === formData.required_vm_template_id)?.name 
                      : 'Any Template'}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        {step < 6 && (
          <div className="p-6 border-t border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
            {step > 1 ? (
              <button onClick={handlePrev} className="px-4 py-2 text-slate-400 hover:text-white font-medium">
                Back
              </button>
            ) : <div></div>}
            
            {step < 5 ? (
              <button 
                onClick={handleNext} 
                disabled={step === 1 && !formData.name}
                className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                Next Step
              </button>
            ) : (
              <button 
                onClick={handleSubmit} 
                disabled={creating}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : 'Create Session'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
