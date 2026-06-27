import api from './api';

export const practicalService = {
  getLecturerPracticals: () => api.get('/sessions/practical-sessions/'),
  createPractical: (data) => api.post('/sessions/practical-sessions/', data),
  getPracticalDetail: (id) => api.get(`/sessions/practical-sessions/${id}/`),
  updatePractical: (id, data) => api.patch(`/sessions/practical-sessions/${id}/`, data),
  startPractical: (id) => api.post(`/sessions/practical-sessions/${id}/start/`),
  endPractical: (id) => api.post(`/sessions/practical-sessions/${id}/end/`),
  getMonitorData: (id) => api.get(`/sessions/practical-sessions/${id}/monitor/`),
  getMyAccess: (id) => api.get(`/sessions/practical-sessions/${id}/my-access/`),
  
  getStudentPracticals: () => api.get('/sessions/practical-sessions/student/'),
  submitWork: (id, formData) => api.post(`/sessions/practical-sessions/${id}/submit/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};
