import api from './api';

export const classService = {
  getMyClasses: () => api.get('/classes/my-classes/'),
  getClassDetails: (id) => api.get(`/classes/${id}/`),
  getClassStudents: (id) => api.get(`/classes/${id}/students/`),
};
