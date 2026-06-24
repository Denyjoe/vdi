import api from './api';

export const vmService = {
  getTemplates: () => 
    api.get('/vms/templates/'),
  
  getMyVMs: () => 
    api.get('/vms/my-vms/'),
  
  requestVM: (template_id, notes) =>
    api.post('/vms/request/', { template_id, notes }),
  
  getVMDetail: (id) => 
    api.get(`/vms/${id}/`),
  
  getVMStatus: (id) => 
    api.get(`/vms/${id}/status/`),
  
  stopVM: (id) => 
    api.post(`/vms/${id}/stop/`),
  
  startVM: (id) => 
    api.post(`/vms/${id}/start/`),
  
  deleteVM: (id) => 
    api.delete(`/vms/${id}/`),
  
  adminGetAllVMs: () =>
    api.get('/admin/vms/'),
  
  adminForceStop: (id) =>
    api.post(`/admin/vms/${id}/force-stop/`)
};
