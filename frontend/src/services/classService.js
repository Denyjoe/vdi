/**
 * classService — all API calls for Class Management.
 *
 * Covers lecturer CRUD, enrollment requests, student browsing/requests,
 * and admin-level class operations.
 */
import api from './api';

export const classService = {
  // ── Lecturer ────────────────────────────────────────────────
  /** Lecturer: get their own classes */
  getMyClasses: () => api.get('/classes/my-classes/'),
  /** Lecturer: create a new class */
  createClass: (data) => api.post('/classes/create/', data),
  /** Lecturer: update a class */
  updateClass: (id, data) => api.patch(`/classes/${id}/update/`, data),
  /** Lecturer: get full class detail (includes enrolled students) */
  getClassDetails: (id) => api.get(`/classes/${id}/`),
  /** Lecturer: get enrolled students list */
  getClassStudents: (id) => api.get(`/classes/${id}/students/`),
  /** Lecturer: remove a student from class */
  removeStudent: (classId, studentId) => api.delete(`/classes/${classId}/students/${studentId}/`),
  /** Lecturer: get enrollment requests for a class */
  getEnrollmentRequests: (classId, status = '') =>
    api.get(`/classes/${classId}/requests/${status ? `?status=${status}` : ''}`),
  /** Lecturer: approve an enrollment request */
  approveRequest: (requestId) => api.post(`/classes/requests/${requestId}/approve/`),
  /** Lecturer: reject an enrollment request */
  rejectRequest: (requestId, reason) => api.post(`/classes/requests/${requestId}/reject/`, { reason }),

  // ── Student ─────────────────────────────────────────────────
  /** Student: get enrolled classes */
  getEnrolledClasses: () => api.get('/classes/enrolled/'),
  /** Student: get available classes (not yet enrolled) */
  getAvailableClasses: () => api.get('/classes/available/'),
  /** Student: request to join a class */
  requestEnrollment: (classId, message = '') => api.post(`/classes/${classId}/request/`, { message }),
  /** Student: cancel a pending request */
  cancelRequest: (requestId) => api.delete(`/classes/requests/${requestId}/cancel/`),
  /** Student: get all their own requests */
  getMyRequests: () => api.get('/classes/my-requests/'),

  // ── Admin ───────────────────────────────────────────────────
  /** Admin: list all classes */
  getAllClasses: () => api.get('/admin/classes/'),
  /** Admin: create a class for any lecturer */
  adminCreateClass: (data) => api.post('/admin/classes/create/', data),
  /** Admin: directly enroll a student */
  adminEnrollStudent: (classId, studentId) =>
    api.post(`/admin/classes/${classId}/enroll/`, { student_id: studentId }),
};
