import React, { useState, useEffect } from 'react';
import { 
  Building2, Server, Shield, AlertTriangle, Save, 
  Settings as SettingsIcon, Monitor, Edit2, CheckCircle, 
  X
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const AdminSettingsPage = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingCard, setSavingCard] = useState(null);

  useEffect(() => {
    fetchSettings();
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

  if (loading) return <div className="p-6 text-slate-400">Loading settings...</div>;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-500" />
          System Settings
        </h1>
        <p className="text-slate-400 mt-1">Configure system-wide behaviour and policies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        {/* CARD 1: Institution Info */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
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
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
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
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
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
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
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
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
            <button 
              onClick={() => handleSaveCard('access', ['allow_student_registration', 'require_enrollment_approval'])}
              disabled={savingCard === 'access'}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
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
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
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
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
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

    </div>
  );
};

export default AdminSettingsPage;
