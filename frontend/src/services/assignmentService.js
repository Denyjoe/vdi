import api from './api';

export const assignmentService = {
  // File/Materials
  uploadFile: (formData) =>
    api.post('/assignments/files/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }),

  getClassFiles: (classId) =>
    api.get(`/assignments/files/${classId}/`),

  deleteFile: (fileId) =>
    api.delete(`/assignments/files/${fileId}/`),

  // Assignments
  getLecturerAssignments: (classId) =>
    api.get('/assignments/lecturer/', {
      params: classId ? { class_id: classId } : {}
    }),

  createAssignment: (data) =>
    api.post('/assignments/create/', data),

  updateAssignment: (id, data) =>
    api.patch(`/assignments/${id}/`, data),

  deleteAssignment: (id) =>
    api.delete(`/assignments/${id}/`),

  getStudentAssignments: () =>
    api.get('/assignments/student/'),

  // Submissions
  submitAssignment: (formData) =>
    api.post('/assignments/submit/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }),

  getMySubmissions: () =>
    api.get('/assignments/my-submissions/'),

  getAssignmentSubmissions: (assignmentId) =>
    api.get(`/assignments/${assignmentId}/submissions/`),

  downloadSubmission: (submissionId) =>
    api.get(`/assignments/submissions/${submissionId}/download/`, {
      responseType: 'blob'
    })
};
