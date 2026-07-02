import { useState, useEffect } from 'react';
import {
  FileText, Archive, Compass, File, Download,
  Calendar, Clock, AlertCircle, CheckCircle, Send, FolderOpen,
  Video, Music, Image as ImageIcon, Code2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { classService } from '../../services/classService';
import { assignmentService } from '../../services/assignmentService';
import SubmitAssignmentModal from '../../components/student/SubmitAssignmentModal';

export default function StudentMaterialsPage({ defaultTab = 'materials' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  
  // Materials state
  const [files, setFiles] = useState([]);
  
  // Assignments state
  const [assignments, setAssignments] = useState([]);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  
  // Modals state
  const [submitAssignmentOpen, setSubmitAssignmentOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (activeTab === 'materials' && selectedClassId) {
      loadFiles(selectedClassId);
    } else if (activeTab === 'assignments') {
      loadAssignments();
    }
  }, [activeTab, selectedClassId]);

  const loadClasses = async () => {
    try {
      const res = await classService.getEnrolledClasses();
      const clsData = res.data?.data || [];
      setClasses(clsData);
      if (clsData.length > 0) {
        setSelectedClassId(clsData[0].id.toString());
      }
    } catch (error) {
      toast.error('Failed to load classes');
    }
  };

  const loadFiles = async (classId) => {
    try {
      const res = await assignmentService.getClassFiles(classId);
      setFiles(res.data?.data || []);
    } catch (error) {
      toast.error('Failed to load files');
    }
  };

  const loadAssignments = async () => {
    setIsAssignmentsLoading(true);
    try {
      const res = await assignmentService.getStudentAssignments();
      setAssignments(res.data?.data || []);
    } catch (error) {
      toast.error('Failed to load assignments');
    } finally {
      setIsAssignmentsLoading(false);
    }
  };

  /**
   * Returns a colour-coded Lucide icon based on the file extension.
   * @param {string} ext - The raw file extension string (case-insensitive).
   * @returns {JSX.Element} Lucide icon component.
   */
  const getFileIcon = (ext) => {
    const extLower = ext?.toLowerCase() || '';
    switch (extLower) {
      case 'pdf':
        return <FileText className="w-8 h-8 text-red-400" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-8 h-8 text-indigo-400" />;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <FileText className="w-8 h-8 text-green-400" />;
      case 'ppt':
      case 'pptx':
        return <FileText className="w-8 h-8 text-orange-400" />;
      case 'zip':
      case 'rar':
      case '7z':
        return <Archive className="w-8 h-8 text-yellow-400" />;
      case 'dwg':
      case 'dxf':
        return <Compass className="w-8 h-8 text-purple-400" />;
      case 'mp4':
      case 'avi':
      case 'mov':
        return <Video className="w-8 h-8 text-pink-400" />;
      case 'mp3':
      case 'wav':
        return <Music className="w-8 h-8 text-indigo-400" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return <ImageIcon className="w-8 h-8 text-cyan-400" />;
      case 'py':
        return <Code2 className="w-8 h-8 text-yellow-400" />;
      case 'js':
      case 'html':
      case 'css':
        return <Code2 className="w-8 h-8 text-green-400" />;
      default:
        return <File className="w-8 h-8 text-gray-400" />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Class Resources</h1>
        <p className="text-slate-400 mt-2 text-lg">Access study materials and submit assignments</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 mb-8">
        <button
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'materials'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('materials')}
        >
          Class Materials
        </button>
        <button
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'assignments'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('assignments')}
        >
          Assignments
        </button>
      </div>

      {/* TAB 1: MATERIALS */}
      {activeTab === 'materials' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {classes.length > 1 && (
            <div className="max-w-xs mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Filter by Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full bg-navy-800 border border-navy-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {!selectedClassId ? (
            <div className="bg-navy-800 rounded-2xl p-16 text-center border border-navy-700 border-dashed">
              <p className="text-slate-400">Please select a class to view files.</p>
            </div>
          ) : files.length === 0 ? (
            <div className="bg-navy-800 rounded-2xl p-16 text-center border border-navy-700 border-dashed">
              <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4 opacity-50" />
              <p className="text-xl font-medium text-white mb-2">No materials uploaded yet</p>
              <p className="text-slate-400">Your lecturer will upload class materials here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {files.map(file => (
                <div key={file.id} className="bg-navy-800 rounded-2xl p-5 border border-navy-700 hover:border-slate-600 transition-all shadow-lg group">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-slate-900 rounded-xl group-hover:scale-105 transition-transform">
                      {getFileIcon(file.file_extension)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white truncate" title={file.title}>{file.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">Uploaded {new Date(file.uploaded_at).toLocaleDateString()}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-medium px-2 py-1 bg-slate-900 text-slate-300 rounded-md">
                          {file.file_extension || 'FILE'}
                        </span>
                        <span className="text-xs text-slate-500">{file.file_size_display}</span>
                      </div>
                    </div>
                  </div>
                  {file.description && (
                    <p className="text-sm text-slate-400 mb-5 line-clamp-2">{file.description}</p>
                  )}
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full gap-2 px-4 py-2.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl font-medium transition-colors mt-auto"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {isAssignmentsLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="bg-navy-800 rounded-2xl p-16 text-center border border-navy-700 border-dashed">
              <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4 opacity-50" />
              <p className="text-xl font-medium text-white mb-2">No Pending Assignments</p>
              <p className="text-slate-400">You're all caught up! Assignments from your enrolled classes will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignments.map(assign => (
                <div key={assign.id} className={`bg-navy-800 rounded-2xl p-6 border transition-all shadow-lg flex flex-col ${
                  assign.has_submitted ? 'border-green-500/30 bg-green-900/10' : 'border-navy-700 hover:border-slate-600'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1 leading-tight">{assign.title}</h3>
                      <p className="text-sm text-slate-400">{assign.class_room.name}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 mb-6 line-clamp-3 flex-grow">{assign.description}</p>

                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-700/50 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {assign.is_overdue && !assign.has_submitted ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : assign.time_until_due?.includes('hour') || assign.time_until_due?.includes('minute') ? (
                          <Clock className="w-5 h-5 text-amber-500" />
                        ) : (
                          <Calendar className="w-5 h-5 text-indigo-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-0.5">Due Date</p>
                        <p className={`text-sm font-medium ${
                          assign.is_overdue && !assign.has_submitted ? 'text-red-400' : 'text-slate-200'
                        }`}>
                          {new Date(assign.due_date).toLocaleString()}
                        </p>
                        {!assign.is_overdue && !assign.has_submitted && (
                          <p className={`text-xs mt-1 font-medium ${
                            assign.time_until_due?.includes('hour') || assign.time_until_due?.includes('minute') 
                              ? 'text-amber-400' : 'text-slate-400'
                          }`}>
                            {assign.time_until_due}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto">
                    {assign.has_submitted ? (
                      <div className="flex items-center justify-between px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                        <div className="flex items-center gap-2 text-green-400 font-medium">
                          <CheckCircle className="w-5 h-5" />
                          Submitted ✓
                        </div>
                        <button className="text-sm text-slate-400 hover:text-white underline decoration-slate-500 underline-offset-2 transition-colors">
                          View
                        </button>
                      </div>
                    ) : assign.is_overdue ? (
                      <div className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-slate-500 font-medium rounded-xl text-center flex items-center justify-center gap-2 cursor-not-allowed">
                        <AlertCircle className="w-5 h-5" />
                        Submission Closed
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedAssignment(assign);
                          setSubmitAssignmentOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20"
                      >
                        <Send className="w-5 h-5" />
                        Submit Assignment
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <SubmitAssignmentModal
        isOpen={submitAssignmentOpen}
        onClose={() => setSubmitAssignmentOpen(false)}
        assignment={selectedAssignment}
        onSuccess={loadAssignments}
      />

    </div>
  );
}
