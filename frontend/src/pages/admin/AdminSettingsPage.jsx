import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Server, Shield, CreditCard, Save, Activity, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [savingSection, setSavingSection] = useState(null);
  
  // Platform Config
  const [platformConfig, setPlatformConfig] = useState({
    platform_name: 'CloudDesk',
    support_email: 'admin@clouddesk.io',
    allow_registration: true,
    maintenance_mode: false,
    system_announcement: ''
  });

  // Resource Limits
  const [resourceLimits, setResourceLimits] = useState({
    max_vms_per_user: 1,
    max_concurrent_vms: 3,
    vm_provisioning_timeout: 300,
    auto_shutdown_idle: true,
    idle_timeout_mins: 30
  });

  // Infrastructure Status
  const [infraStats, setInfraStats] = useState(null);
  const [testingInfra, setTestingInfra] = useState(false);

  // Plans (Mocked for now since backend might not have them yet)
  const plans = [
    { id: 1, name: 'Free', price: '$0/mo', hours: '5hrs', users: 'No host' },
    { id: 2, name: 'Personal', price: '$9/mo', hours: '20hrs', users: '10 users' },
    { id: 3, name: 'Pro Host', price: '$19/mo', hours: '80hrs', users: '50 users' },
    { id: 4, name: 'Institution', price: '$99/mo', hours: 'Unlimited', users: '200 users' }
  ];

  useEffect(() => {
    // Load config from localStorage for frontend-only state
    const savedPlatform = localStorage.getItem('clouddesk_platform_config');
    const savedLimits = localStorage.getItem('clouddesk_resource_limits');
    
    if (savedPlatform) setPlatformConfig(JSON.parse(savedPlatform));
    if (savedLimits) setResourceLimits(JSON.parse(savedLimits));

    testConnections();
  }, []);

  const handlePlatformChange = (k, v) => setPlatformConfig(p => ({ ...p, [k]: v }));
  const handleLimitChange = (k, v) => setResourceLimits(p => ({ ...p, [k]: v }));

  const savePlatformConfig = async () => {
    setSavingSection('platform');
    // Simulate API delay
    await new Promise(r => setTimeout(r, 600));
    localStorage.setItem('clouddesk_platform_config', JSON.stringify(platformConfig));
    toast.success('Platform configuration saved');
    setSavingSection(null);
  };

  const saveResourceLimits = async () => {
    setSavingSection('limits');
    // Simulate API delay
    await new Promise(r => setTimeout(r, 600));
    localStorage.setItem('clouddesk_resource_limits', JSON.stringify(resourceLimits));
    toast.success('Resource limits saved');
    setSavingSection(null);
  };

  const testConnections = async () => {
    setTestingInfra(true);
    try {
      const res = await api.get('/vms/admin/system-stats/');
      if (res.data.success) {
        setInfraStats(res.data);
      }
    } catch (err) {
      toast.error('Failed to contact infrastructure');
    } finally {
      setTestingInfra(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-fade-in p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-500" />
          System Settings
        </h1>
        <p className="text-slate-400 mt-1">Configure platform behaviour, limits, and infrastructure</p>
      </div>

      <div className="space-y-8">
        {/* SECTION 1: Platform Config */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Platform Configuration</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Platform Name</label>
                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={platformConfig.platform_name} onChange={e => handlePlatformChange('platform_name', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Support Email</label>
                <input type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={platformConfig.support_email} onChange={e => handlePlatformChange('support_email', e.target.value)} />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div>
                <p className="text-white font-medium text-sm">Allow Registration</p>
                <p className="text-slate-500 text-xs">Allow users to sign up for free</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={platformConfig.allow_registration} onChange={e => handlePlatformChange('allow_registration', e.target.checked)} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div>
                <p className="text-white font-medium text-sm">Maintenance Mode</p>
                <p className="text-slate-500 text-xs">Block non-admin access</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={platformConfig.maintenance_mode} onChange={e => handlePlatformChange('maintenance_mode', e.target.checked)} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">System Announcement</label>
              <textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white h-20 resize-none"
                placeholder="Message shown to all users..."
                value={platformConfig.system_announcement} onChange={e => handlePlatformChange('system_announcement', e.target.value)} />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/30 flex justify-end">
            <button onClick={savePlatformConfig} disabled={savingSection === 'platform'} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Save size={16} />
              {savingSection === 'platform' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>

        {/* SECTION 2: Subscription Plans */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Subscription Plans</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map(p => (
                <div key={p.id} className="bg-slate-900/80 border border-slate-700 rounded-lg p-5 flex flex-col text-center hover:border-indigo-500/50 transition-colors group">
                  <h3 className="text-lg font-bold text-white mb-2">{p.name}</h3>
                  <p className="text-2xl font-bold text-indigo-400 mb-4">{p.price}</p>
                  <div className="space-y-2 mb-6 flex-1">
                    <p className="text-sm text-slate-300">{p.hours}</p>
                    <p className="text-sm text-slate-400">{p.users}</p>
                  </div>
                  <button className="w-full py-2 bg-slate-800 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white rounded-md text-sm font-medium transition-colors border border-slate-700 group-hover:border-indigo-500">
                    Edit Plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: VM & Resource Limits */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold text-white">VM & Resource Limits</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Max VMs per User</label>
                <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={resourceLimits.max_vms_per_user} onChange={e => handleLimitChange('max_vms_per_user', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Max Concurrent VMs</label>
                <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={resourceLimits.max_concurrent_vms} onChange={e => handleLimitChange('max_concurrent_vms', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">VM Provisioning Timeout (s)</label>
                <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={resourceLimits.vm_provisioning_timeout} onChange={e => handleLimitChange('vm_provisioning_timeout', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Idle Timeout (minutes)</label>
                <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={resourceLimits.idle_timeout_mins} onChange={e => handleLimitChange('idle_timeout_mins', e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 mt-4">
              <div>
                <p className="text-white font-medium text-sm">Auto-shutdown Idle VMs</p>
                <p className="text-slate-500 text-xs">Stop VMs automatically after idle timeout</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={resourceLimits.auto_shutdown_idle} onChange={e => handleLimitChange('auto_shutdown_idle', e.target.checked)} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/30 flex justify-end">
            <button onClick={saveResourceLimits} disabled={savingSection === 'limits'} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Save size={16} />
              {savingSection === 'limits' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>

        {/* SECTION 4 & 5 Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Infrastructure */}
          <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Infrastructure</h2>
            </div>
            <div className="p-6 flex-1 space-y-4">
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Proxmox Host</p>
                <p className="text-sm text-slate-300 font-mono">192.168.1.13 (pve)</p>
                <p className="text-sm mt-2 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${infraStats?.proxmox?.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  <span className={infraStats?.proxmox?.status === 'online' ? 'text-emerald-400' : 'text-red-400'}>
                    {infraStats?.proxmox?.status === 'online' ? 'Connected' : 'Offline'}
                  </span>
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Guacamole URL</p>
                <p className="text-sm text-slate-300 font-mono">localhost:8080</p>
                <p className="text-sm mt-2 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${infraStats?.guacamole?.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  <span className={infraStats?.guacamole?.status === 'online' ? 'text-emerald-400' : 'text-red-400'}>
                    {infraStats?.guacamole?.status === 'online' ? 'Connected' : 'Offline'}
                  </span>
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/30">
              <button onClick={testConnections} disabled={testingInfra} className="w-full flex justify-center items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <RefreshCw size={16} className={testingInfra ? "animate-spin" : ""} />
                Test Connections
              </button>
            </div>
          </section>

          {/* Payment Configuration */}
          <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Payment Configuration</h2>
            </div>
            <div className="p-6 flex-1 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                <span className="text-sm text-slate-400">Payment Provider</span>
                <span className="text-sm text-white font-medium">AzamPay</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                <span className="text-sm text-slate-400">Environment</span>
                <span className="text-sm px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">Sandbox</span>
              </div>
              <div className="py-2 border-b border-slate-700/50">
                <span className="text-sm text-slate-400 block mb-2">Supported Methods</span>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">☑ M-Pesa</span>
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">☑ Airtel Money</span>
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">☑ Tigo Pesa</span>
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">☑ Halopesa</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-slate-400">Status</span>
                <span className="text-sm flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Connected
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
