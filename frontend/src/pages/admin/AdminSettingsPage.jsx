import React, { useState, useEffect } from 'react';
import { 
  Building2, Server, Shield, AlertTriangle, Save, 
  Settings as SettingsIcon, Monitor, Edit2, CheckCircle, 
  X, Plus, Eye, EyeOff
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const AdminSettingsPage = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingCard, setSavingCard] = useState(null);
  
  // Stream management state
  const [streams, setStreams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [streamFilter, setStreamFilter] = useState({ dept: '', level: '' });
  
  const [newStream, setNewStream] = useState({
    department_id: '',
    programme_id: '',
    year_of_study: 1,
    group_number: 1,
    code: '',
    name: ''
  });

  useEffect(() => {
    fetchSettings();
    fetchAcademicData();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings/');
      if (res.data.success) {
        const flatSettings = {};
        Object.keys(res.data.data).forEach(key => {
          flatSettings[key] = res.data.data[key].value;
        });
        setSettings(flatSettings);
      }
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAcademicData = async () => {
    try {
      const [streamsRes, deptsRes, progsRes] = await Promise.all([
        api.get('/classes/streams/'),
        api.get('/classes/departments/'),
        api.get('/classes/programmes/')
      ]);
      if (streamsRes.data.success) setStreams(streamsRes.data.data);
      if (deptsRes.data.success) setDepartments(deptsRes.data.data);
      if (progsRes.data.success) setProgrammes(progsRes.data.data);
    } catch (err) {
      toast.error('Failed to load academic data');
    } finally {
      setLoadingStreams(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveCard = async (cardName, keys) => {
    setSavingCard(cardName);
    try {
      const promises = keys.map(key => 
        api.patch(`/admin/settings/${key}/`, { value: settings[key] })
      );
      await Promise.all(promises);
      toast.success('Settings saved');
      // Trigger a reload of public settings globally if needed
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSavingCard(null);
    }
  };

  const generateStreamCode = () => {
    if (!newStream.programme_id) return;
    const prog = programmes.find(p => p.id === parseInt(newStream.programme_id));
    if (!prog) return;
    
    // Simple mock logic for auto-generating code based on year and group
    const yearStr = new Date().getFullYear().toString().slice(-2);
    const code = `${prog.code.split('-')[0]}${yearStr} ${prog.code.split('-')[1] || 'GRP'}-${newStream.group_number}`;
    const name = `${prog.name} Year ${newStream.year_of_study} Group ${newStream.group_number}`;
    
    setNewStream(prev => ({ ...prev, code, name }));
  };

  useEffect(() => {
    generateStreamCode();
  }, [newStream.programme_id, newStream.year_of_study, newStream.group_number]);

  const handleCreateStream = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/classes/streams/create/', newStream);
      if (res.data.success) {
        toast.success('Stream created');
        setStreams([...streams, res.data.data]);
        setShowStreamModal(false);
      }
    } catch (err) {
      toast.error('Failed to create stream');
    }
  };

  const toggleStreamActive = async (id, currentStatus) => {
    try {
      const res = await api.patch(`/classes/streams/${id}/`, { is_active: !currentStatus });
      if (res.data.success) {
        setStreams(streams.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s));
        toast.success(currentStatus ? 'Stream deactivated' : 'Stream activated');
      }
    } catch (err) {
      toast.error('Failed to update stream');
    }
  };

  if (loading) return <div className="p-6 text-slate-400">Loading settings...</div>;

  const filteredStreams = streams.filter(s => {
    if (streamFilter.dept && s.department?.code !== streamFilter.dept) return false;
    if (streamFilter.level && s.programme?.level !== streamFilter.level) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-500" />
          System Settings
        </h1>
        <p className="text-slate-400 mt-1">Configure system-wide behaviour and policies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        {/* CARD 1: Institution Info */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Institution Information</h2>
          </div>
          
          <div className="space-y-4 flex-grow">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Institution Name</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                value={settings.institution_name || ''} onChange={e => handleChange('institution_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Short Name</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                value={settings.institution_short_name || ''} onChange={e => handleChange('institution_short_name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Academic Year</label>
                <input type="text" placeholder="2025/2026" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={settings.current_academic_year || ''} onChange={e => handleChange('current_academic_year', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Semester</label>
                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={settings.current_semester || '1'} onChange={e => handleChange('current_semester', e.target.value)}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
            <button 
              onClick={() => handleSaveCard('institution', ['institution_name', 'institution_short_name', 'current_academic_year', 'current_semester'])}
              disabled={savingCard === 'institution'}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {savingCard === 'institution' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* CARD 2: VM & Session Limits */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
              <Server className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">VM & Session Limits</h2>
          </div>
          
          <div className="space-y-4 flex-grow">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Max VMs per Student</label>
              <input type="number" min="1" max="5" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                value={settings.max_vms_per_student || '1'} onChange={e => handleChange('max_vms_per_student', e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">How many VMs can one student run at the same time</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Max Session Hours</label>
                <input type="number" min="1" max="24" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={settings.max_session_hours || '8'} onChange={e => handleChange('max_session_hours', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Auto-disconnect after</p>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Provisioning Timeout (s)</label>
                <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={settings.vm_provisioning_timeout || '300'} onChange={e => handleChange('vm_provisioning_timeout', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Max File Upload Size (MB)</label>
              <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                value={settings.max_file_upload_mb || '100'} onChange={e => handleChange('max_file_upload_mb', e.target.value)} />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
            <button 
              onClick={() => handleSaveCard('limits', ['max_vms_per_student', 'max_session_hours', 'vm_provisioning_timeout', 'max_file_upload_mb'])}
              disabled={savingCard === 'limits'}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {savingCard === 'limits' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* CARD 3: Access Control */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-500/20 text-red-400 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Access Control</h2>
          </div>
          
          <div className="space-y-6 flex-grow">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-medium">Allow Student Registration</h3>
                <p className="text-sm text-slate-500 mt-1">If OFF, only admin can create student accounts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" 
                  checked={settings.allow_student_registration === 'true'}
                  onChange={e => handleChange('allow_student_registration', e.target.checked ? 'true' : 'false')} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
            
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-medium">Require Enrollment Approval</h3>
                <p className="text-sm text-slate-500 mt-1">If OFF, students are auto-enrolled when they request</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" 
                  checked={settings.require_enrollment_approval === 'true'}
                  onChange={e => handleChange('require_enrollment_approval', e.target.checked ? 'true' : 'false')} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
            <button 
              onClick={() => handleSaveCard('access', ['allow_student_registration', 'require_enrollment_approval'])}
              disabled={savingCard === 'access'}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {savingCard === 'access' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* CARD 4: System Status */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">System Status</h2>
          </div>
          
          <div className="space-y-6 flex-grow">
            <div className="flex items-start justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
              <div>
                <h3 className="text-white font-medium">Maintenance Mode</h3>
                <p className="text-sm text-slate-500 mt-1">When ON, only admins can access the system</p>
                {settings.maintenance_mode === 'true' && (
                  <p className="text-xs text-red-400 mt-2">⚠️ This will log out all students and lecturers</p>
                )}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" 
                  checked={settings.maintenance_mode === 'true'}
                  onChange={e => handleChange('maintenance_mode', e.target.checked ? 'true' : 'false')} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-1">System Announcement</label>
              <textarea 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white h-24 resize-none"
                placeholder="Leave empty for no announcement..."
                maxLength="500"
                value={settings.system_announcement || ''} 
                onChange={e => handleChange('system_announcement', e.target.value)}
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-slate-500">Shown to all users on their dashboard.</p>
                <p className="text-xs text-slate-500">{(settings.system_announcement || '').length} / 500</p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
            <button 
              onClick={() => handleSaveCard('status', ['maintenance_mode', 'system_announcement'])}
              disabled={savingCard === 'status'}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {savingCard === 'status' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="mb-12">
        <h2 className="text-lg font-semibold text-white mb-4">How students will see this:</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 relative overflow-hidden">
          {/* Mock Dashboard Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Monitor className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">{settings.institution_short_name || 'DIT'} VDI System</h3>
                <p className="text-slate-400 text-sm">{settings.institution_name || 'Institution Name'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-300 text-sm">Academic Year: <span className="font-semibold text-white">{settings.current_academic_year || '-'}</span></p>
              <p className="text-slate-400 text-xs">Semester: {settings.current_semester || '-'}</p>
            </div>
          </div>

          {/* Mock Announcement */}
          {settings.system_announcement && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-amber-200 text-sm">{settings.system_announcement}</p>
            </div>
          )}
        </div>
      </div>

      {/* Academic Year Management */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Academic Year & Stream Management</h2>
            <p className="text-sm text-slate-400 mt-1">Manage course streams and groups for each academic year</p>
          </div>
          <button 
            onClick={() => setShowStreamModal(true)}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Stream
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <select 
            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-4 py-2 outline-none focus:border-blue-500"
            value={streamFilter.dept}
            onChange={e => setStreamFilter({...streamFilter, dept: e.target.value})}
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.code}>{d.code} - {d.name}</option>)}
          </select>
          <select 
            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-4 py-2 outline-none focus:border-blue-500"
            value={streamFilter.level}
            onChange={e => setStreamFilter({...streamFilter, level: e.target.value})}
          >
            <option value="">All Programmes</option>
            <option value="diploma">Diploma</option>
            <option value="bachelor">Bachelor</option>
            <option value="master">Master</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs uppercase bg-slate-900/50 text-slate-300">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Code</th>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingStreams ? (
                <tr><td colSpan="6" className="text-center py-8">Loading streams...</td></tr>
              ) : filteredStreams.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8">No streams found.</td></tr>
              ) : (
                filteredStreams.map(stream => (
                  <tr key={stream.id} className="border-b border-slate-700 hover:bg-slate-750">
                    <td className="px-4 py-3 font-medium text-white">{stream.code}</td>
                    <td className="px-4 py-3">{stream.programme?.name}</td>
                    <td className="px-4 py-3">Year {stream.year_of_study}</td>
                    <td className="px-4 py-3">Group {stream.group_number}</td>
                    <td className="px-4 py-3">
                      {stream.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <button 
                        onClick={() => toggleStreamActive(stream.id, stream.is_active)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                        title={stream.is_active ? "Deactivate" : "Activate"}
                      >
                        {stream.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stream Modal */}
      {showStreamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">Add New Stream</h2>
              <button onClick={() => setShowStreamModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateStream} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Department</label>
                <select required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={newStream.department_id} onChange={e => setNewStream({...newStream, department_id: e.target.value})}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Programme</label>
                <select required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  disabled={!newStream.department_id}
                  value={newStream.programme_id} onChange={e => setNewStream({...newStream, programme_id: e.target.value})}>
                  <option value="">Select Programme</option>
                  {programmes.filter(p => !newStream.department_id || p.department_id == newStream.department_id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Year of Study</label>
                  <input type="number" min="1" max="5" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                    value={newStream.year_of_study} onChange={e => setNewStream({...newStream, year_of_study: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Group Number</label>
                  <input type="number" min="1" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                    value={newStream.group_number} onChange={e => setNewStream({...newStream, group_number: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Generated Code</label>
                <input type="text" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={newStream.code} onChange={e => setNewStream({...newStream, code: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Generated Name</label>
                <input type="text" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={newStream.name} onChange={e => setNewStream({...newStream, name: e.target.value})} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700 mt-6">
                <button type="button" onClick={() => setShowStreamModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                  Create Stream
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;
