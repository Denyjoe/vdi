import { useState } from 'react';
import { X, Send, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { assignmentService } from '../../services/assignmentService';

export default function SubmitAssignmentModal({ isOpen, onClose, assignment, onSuccess }) {
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !assignment) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (assignment.max_file_size_mb) {
      const maxSize = assignment.max_file_size_mb * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        toast.error(`File too large. Max size is ${assignment.max_file_size_mb} MB`);
        e.target.value = '';
        setFile(null);
        return;
      }
    }
    setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file to submit');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('assignment_id', assignment.id);
      formData.append('file', file);
      if (notes) formData.append('notes', notes);

      await assignmentService.submitAssignment(formData);
      toast.success('Assignment submitted successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error?.non_field_errors?.[0] || 'Failed to submit assignment';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-navy-800 rounded-xl shadow-xl w-full max-w-lg mx-4 border border-navy-700">
        <div className="flex items-start justify-between p-6 border-b border-[var(--border-color)]">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{assignment.title}</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Submit your work</p>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 bg-[var(--bg-primary)]/50 border-b border-[var(--border-color)] grid grid-cols-2 gap-4">
          <div>
            <span className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Due Date</span>
            <span className={`text-sm font-medium ${assignment.is_overdue ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
              {new Date(assignment.due_date).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Max File Size</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{assignment.max_file_size_mb} MB</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Select File <span className="text-red-400">*</span></label>
            <div className="relative">
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="submission-file-upload"
                required
              />
              <label
                htmlFor="submission-file-upload"
                className="w-full bg-[var(--bg-primary)] border-2 border-dashed border-slate-600 rounded-xl px-4 py-8 text-center cursor-pointer flex flex-col items-center justify-center hover:border-indigo-500 hover:bg-[var(--bg-card)] transition-all group"
              >
                <FolderOpen className={`w-8 h-8 mb-3 ${file ? 'text-indigo-400' : 'text-muted group-hover:text-indigo-400'} transition-colors`} />
                <span className="text-[var(--text-primary)] font-medium mb-1">
                  {file ? file.name : 'Click to select a file'}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `Maximum size: ${assignment.max_file_size_mb} MB`}
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Notes for Lecturer (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional information..."
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !file}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-primary font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Submit Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
