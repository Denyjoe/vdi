import { useState, useEffect } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { classService } from '../../services/classService';
import { vmService } from '../../services/vmService';
import { sessionService } from '../../services/sessionService';

export default function CreateExamModal({ isOpen, onClose, onSuccess }) {
  const [classes, setClasses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    class_room: '',
    starts_at: '',
    ends_at: '',
    allowed_vm_template: '',
    restrict_internet: true,
    restrict_copy_paste: true,
    instructions: '',
    grace_period_minutes: 5,
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
      // Reset form on open
      setFormData({
        name: '',
        class_room: '',
        starts_at: '',
        ends_at: '',
        allowed_vm_template: '',
        restrict_internet: true,
        restrict_copy_paste: true,
        instructions: '',
        grace_period_minutes: 5,
      });
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [classesRes, templatesRes] = await Promise.all([
        classService.getMyClasses(),
        vmService.getTemplates()
      ]);
      setClasses(classesRes.data?.data || []);
      setTemplates(templatesRes.data?.data || []);
      
      // Default class selection
      if (classesRes.data?.data?.length > 0) {
        setFormData(prev => ({ ...prev, class_room: classesRes.data.data[0].id }));
      }
    } catch (error) {
      toast.error('Failed to load required data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.class_room || !formData.starts_at || !formData.ends_at) {
      toast.error("Please fill in all required fields.");
      return;
    }
    
    if (new Date(formData.ends_at) <= new Date(formData.starts_at)) {
      toast.error("End time must be after start time.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        allowed_vm_template: formData.allowed_vm_template || null
      };
      
      await sessionService.createExamSession(payload);
      toast.success("Exam session created successfully!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to create exam session";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-primary)]/80 backdrop-blur-sm">
      <div className="bg-[var(--bg-card)] rounded-xl shadow-xl w-full max-w-2xl border border-[var(--border-color)] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">New Exam Session</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Create a monitored session for an assessment</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <form id="createExamForm" onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    Exam Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. CAD Practical Exam 1"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    Select Class <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="class_room"
                    value={formData.class_room}
                    onChange={handleChange}
                    required
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a class...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      Start Date & Time <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      name="starts_at"
                      value={formData.starts_at}
                      onChange={handleChange}
                      required
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      End Date & Time <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      name="ends_at"
                      value={formData.ends_at}
                      onChange={handleChange}
                      required
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    Allowed VM Template (Optional)
                  </label>
                  <select
                    name="allowed_vm_template"
                    value={formData.allowed_vm_template}
                    onChange={handleChange}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Any template</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">If selected, students can only use VMs based on this template during the exam.</p>
                </div>
              </div>

              <div className="bg-[var(--bg-primary)]/50 rounded-lg border border-[var(--border-color)] p-4">
                <div className="flex items-center gap-2 mb-4 text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                  <h3 className="font-medium">Restrictions</h3>
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="restrict_internet"
                      checked={formData.restrict_internet}
                      onChange={handleChange}
                      className="w-5 h-5 rounded border-slate-600 bg-[var(--bg-primary)] text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                    />
                    <div>
                      <div className="text-[var(--text-primary)]">Restrict Internet Access</div>
                      <div className="text-xs text-[var(--text-secondary)]">Blocks external websites (simulated)</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="restrict_copy_paste"
                      checked={formData.restrict_copy_paste}
                      onChange={handleChange}
                      className="w-5 h-5 rounded border-slate-600 bg-[var(--bg-primary)] text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                    />
                    <div>
                      <div className="text-[var(--text-primary)]">Restrict Copy & Paste</div>
                      <div className="text-xs text-[var(--text-secondary)]">Prevents clipboard sharing with local machine (simulated)</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Instructions for Students
                </label>
                <textarea
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Instructions shown to students when they join the exam..."
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Grace period (Minutes)
                </label>
                <input
                  type="number"
                  name="grace_period_minutes"
                  value={formData.grace_period_minutes}
                  onChange={handleChange}
                  min="0"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">Minutes after end before force-termination.</p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border-color)] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-card)] border border-slate-600 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="createExamForm"
            disabled={isSubmitting || isLoading}
            className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              'Create Exam Session'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
