import api from './api';

export const sessionService = {
  connect: (vm_id) =>
    api.post('/sessions/connect/', { vm_id }),

  disconnect: (session_id) =>
    api.post(`/sessions/${session_id}/disconnect/`),

  getActiveSession: () =>
    api.get('/sessions/active/'),

  getLiveSession: (id) =>
    api.get(`/sessions/live/${id}/`),

  getMySessions: () =>
    api.get('/sessions/my-sessions/'),

  lecturerGetActiveSessions: () =>
    api.get('/sessions/lecturer/active/'),

  lecturerTerminate: (session_id) =>
    api.post(`/sessions/lecturer/terminate/${session_id}/`),

  adminGetSessions: (params) =>
    api.get('/admin/sessions/', { params }),

  adminTerminate: (session_id) =>
    api.post(`/admin/sessions/${session_id}/terminate/`),

  // Exam Sessions (Lecturer)
  getExamSessions: () =>
    api.get('/sessions/exam-sessions/'),
  
  createExamSession: (data) =>
    api.post('/sessions/exam-sessions/', data),
    
  startExamSession: (id) =>
    api.post(`/sessions/exam-sessions/${id}/start/`),
    
  endExamSession: (id) =>
    api.post(`/sessions/exam-sessions/${id}/end/`),
    
  getMonitorData: () =>
    api.get('/sessions/lecturer/monitor/'),

  // Exam Sessions (Student)
  getStudentActiveExam: () =>
    api.get('/sessions/exam-sessions/active/'),
};
