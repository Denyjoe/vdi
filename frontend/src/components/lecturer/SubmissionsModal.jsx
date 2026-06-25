import { useState, useEffect } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { assignmentService } from '../../services/assignmentService';

export default function SubmissionsModal({ isOpen, onClose, assignment }) {
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && assignment) {
      loadSubmissions();
    }
  }, [isOpen, assignment]);

  const loadSubmissions = async () => {
    setIsLoading(true);
    try {
      const res = await assignmentService.getAssignmentSubmissions(assignment.id);
      setSubmissions(res.data?.data || []);
    } catch (error) {
      toast.error('Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (subId, fileName) => {
    try {
      const res = await assignmentService.downloadSubmission(subId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || `submission_${subId}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  if (!isOpen || !assignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-navy-800 rounded-xl shadow-xl w-full max-w-5xl mx-4 border border-navy-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">{assignment.title} — Submissions</h2>
            <p className="text-slate-400 mt-1 text-sm">
              Due: {new Date(assignment.due_date).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="text-sm font-medium text-slate-300">
            <span className="text-white">{assignment.submission_count}</span> of <span className="text-white">{assignment.enrolled_student_count || '?'}</span> students submitted
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <AlertCircle className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-base font-medium text-white">No Submissions Yet</p>
              <p className="text-sm mt-1">Students have not submitted any files for this assignment.</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">Student</th>
                    <th className="px-6 py-4 font-medium">ID</th>
                    <th className="px-6 py-4 font-medium">Submitted At</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">File</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {submissions.map(sub => (
                    <tr key={sub.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{sub.student?.full_name}</div>
                        <div className="text-xs text-slate-400">{sub.student?.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">{sub.student?.student_id}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {new Date(sub.submitted_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {sub.is_late ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            Late
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                            On Time
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white truncate max-w-[150px]" title={sub.file_name}>
                          {sub.file_name}
                        </div>
                        <div className="text-xs text-slate-400">{sub.file_size_display}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDownload(sub.id, sub.file_name)}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors inline-flex items-center gap-1.5"
                          title="Download File"
                        >
                          <Download className="w-4 h-4" />
                          <span className="text-xs font-medium">Download</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
