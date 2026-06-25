import api from './api';

export const analyticsService = {
  getOverview: () => api.get('/admin/analytics/overview/'),
  getSessionTrends: () => api.get('/admin/analytics/session-trends/'),
  getVMUsage: () => api.get('/admin/analytics/vm-usage/'),
  getActivity: () => api.get('/admin/analytics/activity/'),
  getAssignmentStats: () => api.get('/admin/analytics/assignments/')
};
