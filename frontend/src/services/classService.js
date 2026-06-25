import api from './api';

export const classService = {
  /** Lecturer: get their own classes */
  getMyClasses: () => api.get('/classes/my-classes/'),
  /** Student: get enrolled classes */
  getEnrolledClasses: () => api.get('/classes/enrolled/'),
  getClassDetails: (id) => api.get(`/classes/${id}/`),
  getClassStudents: (id) => api.get(`/classes/${id}/students/`),
};
