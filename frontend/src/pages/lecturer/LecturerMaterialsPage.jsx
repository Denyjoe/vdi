import { useState, useEffect } from 'react';
import {
  FileText, Archive, Compass, File, Upload, Download,
  Trash2, Plus, Calendar, Clock, AlertCircle, Eye, Pencil,
  FolderOpen, Video, Music, Image as ImageIcon, Code2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { classService } from '../../services/classService';
import { assignmentService } from '../../services/assignmentService';
import ConfirmModal from '../../components/shared/ConfirmModal';
import CreateAssignmentModal from '../../components/lecturer/CreateAssignmentModal';
import SubmissionsModal from '../../components/lecturer/SubmissionsModal';

export default function LecturerMaterialsPage({ defaultTab = 'materials' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  
  // Materials state
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState({ title: '', description: '', file: null });
  
  // Assignments state
  const [assignments, setAssignments] = useState([]);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  
  // Modals state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null); // { id, type: 'file' | 'assignment' }
  const [createAssignmentOpen, setCreateAssignmentOpen] = useState(false);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
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
      const res = await classService.getMyClasses();
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
      const res = await assignmentService.getLecturerAssignments();
      setAssignments(res.data?.data || []);
    } catch (error) {
      toast.error('Failed to load assignments');
    } finally {
      setIsAssignmentsLoading(false);
    }
  };

  const handleUploadFile = async (e) => {
    e.preventDefault();
    if (!uploadData.file || !uploadData.title || !selectedClassId) return;

    const formData = new FormData();
    formData.append('class_room_id', selectedClassId);
    formData.append('title', uploadData.title);
    formData.append('description', uploadData.description);
    formData.append('file', uploadData.file);

    setIsUploading(true);
    try {
      await assignmentService.uploadFile(formData);
      toast.success('File uploaded successfully');
      setUploadData({ title: '', description: '', file: null });
      loadFiles(selectedClassId);
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      if (itemToDelete.type === 'file') {
        await assignmentService.deleteFile(itemToDelete.id);
        toast.success('File deleted');
        loadFiles(selectedClassId);
      } else if (itemToDelete.type === 'assignment') {
        await assignmentService.deleteAssignment(itemToDelete.id);
        toast.success('Assignment deleted');
        loadAssignments();
      }
    } catch (error) {
      toast.error(`Failed to delete ${itemToDelete.type}`);
    } finally {
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
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
        return <FileText className="w-8 h-8 text-blue-400" />;
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

  const getClassEnrolledCount = (classId) => {
    const cls = classes.find(c => c.id === parseInt(classId) || c.id === classId);
    return cls?.enrolled_students?.length || 0;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Materials & Assignments</h1>
        <p className="text-slate-400 mt-2 text-lg">Manage class resources and student tasks</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 mb-8">
        <button
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'materials'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('materials')}
        >
          Class Materials
        </button>
        <button
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'assignments'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('assignments')}
        >
          Assignments
        </button>
      </div>

      {/* TAB 1: MATERIALS */}
      {activeTab === 'materials' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Upload Card */}
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-6">Upload Material</h2>
            <form onSubmit={handleUploadFile} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                >
                  <option value="">Select a class...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={uploadData.title}
                  onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                  placeholder="e.g. Week 1 Slides"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">File</label>
                <div className="relative">
                  <input
                    type="file"
                    onChange={(e) => setUploadData({ ...uploadData, file: e.target.files[0] })}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.dwg,.dxf,.zip,.rar,.7z,.mp4,.avi,.mov,.mp3,.wav,.png,.jpg,.jpeg,.gif,.txt,.csv,.py,.js,.html,.css"
                  />
                  <label
                    htmlFor="file-upload"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white cursor-pointer flex items-center justify-between hover:bg-slate-800 transition-colors"
                  >
                    <span className="truncate text-slate-400">
                      {uploadData.file ? uploadData.file.name : 'Choose file...'}
                    </span>
                    <FolderOpen className="w-5 h-5 text-slate-500" />
                  </label>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Supported: PDF, Word, PowerPoint, Excel, AutoCAD, ZIP, images, videos and more (max 100MB)
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="submit"
                  disabled={isUploading || !uploadData.file || !uploadData.title || !selectedClassId}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                >
                  {isUploading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  Upload
                </button>
              </div>
            </form>
          </div>

          {/* Files List */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Class Files</h3>
            {!selectedClassId ? (
              <div className="bg-navy-800 rounded-2xl p-12 text-center border border-navy-700 border-dashed">
                <p className="text-slate-400">Please select a class to view files.</p>
              </div>
            ) : files.length === 0 ? (
              <div className="bg-navy-800 rounded-2xl p-12 text-center border border-navy-700 border-dashed">
                <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 font-medium">No materials uploaded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {files.map(file => (
                  <div key={file.id} className="bg-navy-800 rounded-2xl p-5 border border-navy-700 hover:border-slate-600 transition-all shadow-lg group">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 bg-slate-900 rounded-xl">
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
                      <p className="text-sm text-slate-400 mb-4 line-clamp-2">{file.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                      <a
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                      <button
                        onClick={() => {
                          setItemToDelete({ id: file.id, type: 'file' });
                          setDeleteConfirmOpen(true);
                        }}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Delete File"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">All Assignments</h2>
            <button
              onClick={() => setCreateAssignmentOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-5 h-5" />
              Create Assignment
            </button>
          </div>

          {isAssignmentsLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="bg-navy-800 rounded-2xl p-16 text-center border border-navy-700 border-dashed">
              <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-white mb-2">No Assignments Created</p>
              <p className="text-slate-400 max-w-md mx-auto">You haven't created any assignments yet. Click the button above to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {assignments.map(assign => {
                const enrolled = getClassEnrolledCount(assign.class_room.id);
                
                return (
                <div key={assign.id} className="bg-navy-800 rounded-2xl p-6 border border-navy-700 hover:border-slate-600 transition-all shadow-lg">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">{assign.title}</h3>
                      <p className="text-sm text-slate-400">{assign.class_room.name}</p>
                    </div>
                    {assign.is_overdue ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        OVERDUE
                      </div>
                    ) : assign.time_until_due?.includes('hour') || assign.time_until_due?.includes('minute') ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        Due Soon
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        Active
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-slate-300 mb-6 line-clamp-2">{assign.description}</p>

                  <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-900 rounded-xl border border-slate-700/50">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Due Date</p>
                      <p className={`text-sm font-medium ${assign.is_overdue ? 'text-red-400' : 'text-slate-300'}`}>
                        {new Date(assign.due_date).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Submissions</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{assign.submission_count}</span>
                        <span className="text-sm text-slate-400">/ {enrolled || '?'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-5 border-t border-slate-700">
                    <button
                      onClick={() => {
                        setSelectedAssignment({...assign, enrolled_student_count: enrolled});
                        setSubmissionsOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Submissions
                    </button>

                    <div className="flex gap-2">
                      <button 
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="Edit Assignment (Coming Soon)"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setItemToDelete({ id: assign.id, type: 'assignment' });
                          setDeleteConfirmOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Delete Assignment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={`Delete ${itemToDelete?.type === 'file' ? 'File' : 'Assignment'}`}
        message={`Are you sure you want to delete this ${itemToDelete?.type}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      <CreateAssignmentModal
        isOpen={createAssignmentOpen}
        onClose={() => setCreateAssignmentOpen(false)}
        onSuccess={loadAssignments}
      />

      <SubmissionsModal
        isOpen={submissionsOpen}
        onClose={() => setSubmissionsOpen(false)}
        assignment={selectedAssignment}
      />

    </div>
  );
}
