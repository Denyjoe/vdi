import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { classService } from '../../services/classService';
import { assignmentService } from '../../services/assignmentService';

export default function CreateAssignmentModal({ isOpen, onClose, onSuccess }) {
  const [classes, setClasses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    class_room: '',
    title: '',
    description: '',
    due_date: '',
    max_file_size_mb: 20
  });

  useEffect(() => {
    if (isOpen) {
      loadClasses();
      setFormData({
        class_room: '',
        title: '',
        description: '',
        due_date: '',
        max_file_size_mb: 20
      });
    }
  }, [isOpen]);

  const loadClasses = async () => {
    try {
      const res = await classService.getMyClasses();
      const clsData = res.data?.data || [];
      setClasses(clsData);
      if (clsData.length > 0) {
        setFormData(prev => ({ ...prev, class_room: clsData[0].id }));
      }
    } catch (error) {
      toast.error('Failed to load classes');
    }
  };

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.class_room) {
      toast.error('Please select a class');
      return;
    }

    const selectedDate = new Date(formData.due_date);
    if (selectedDate <= new Date()) {
      toast.error('Due date must be in the future');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create local ISO string
      const payload = {
        ...formData,
        due_date: selectedDate.toISOString(),
      };
      await assignmentService.createAssignment(payload);
      toast.success('Assignment created successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to create assignment';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-navy-800 rounded-xl shadow-xl w-full max-w-lg mx-4 border border-navy-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Create Assignment</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Select Class <span className="text-red-400">*</span></label>
            <select
              name="class_room"
              value={formData.class_room}
              onChange={handleChange}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a class...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Assignment Title <span className="text-red-400">*</span></label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g. AutoCAD Floor Plan"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description <span className="text-red-400">*</span></label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Detailed instructions for students..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Due Date & Time <span className="text-red-400">*</span></label>
              <input
                type="datetime-local"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Max File Size (MB) <span className="text-red-400">*</span></label>
              <input
                type="number"
                name="max_file_size_mb"
                value={formData.max_file_size_mb}
                onChange={handleChange}
                required
                min="1"
                max="100"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Create Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
