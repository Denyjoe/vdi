import { useState, useEffect, useRef } from 'react';
import { vmService } from '../../services/vmService';
import { 
  Monitor, Compass, BarChart2, Code2, Palette, Network, 
  RefreshCw, Play, Square, Trash2, Cpu, MemoryStick,
  Shield, Building2, BrainCircuit, Smartphone, Database, Film, Globe, Server
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import Toast from '../../components/shared/Toast';

/** Map icon name strings (stored in DB) to Lucide components. */
const ICON_MAP = {
  Compass: <Compass className="w-12 h-12 text-blue-400" />,
  BarChart2: <BarChart2 className="w-12 h-12 text-blue-400" />,
  Code2: <Code2 className="w-12 h-12 text-blue-400" />,
  Palette: <Palette className="w-12 h-12 text-blue-400" />,
  Network: <Network className="w-12 h-12 text-blue-400" />,
  Shield: <Shield className="w-12 h-12 text-blue-400" />,
  Building2: <Building2 className="w-12 h-12 text-blue-400" />,
  BrainCircuit: <BrainCircuit className="w-12 h-12 text-blue-400" />,
  Smartphone: <Smartphone className="w-12 h-12 text-blue-400" />,
  Database: <Database className="w-12 h-12 text-blue-400" />,
  Film: <Film className="w-12 h-12 text-blue-400" />,
  Globe: <Globe className="w-12 h-12 text-blue-400" />,
  Server: <Server className="w-12 h-12 text-blue-400" />,
  Monitor: <Monitor className="w-12 h-12 text-blue-400" />,
};

export default function StudentVMsPage() {
  const [vms, setVms] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [requestNotes, setRequestNotes] = useState('');
  const [requesting, setRequesting] = useState(false);

  // Polling Refs
  const pollingRef = useRef(null);

  const fetchVMs = async () => {
    try {
      const res = await vmService.getMyVMs();
      setVms(res.data.data);
    } catch (error) {
      console.error("Failed to fetch VMs:", error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await vmService.getTemplates();
      setTemplates(res.data.data || res.data); // Handle API nesting correctly
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchVMs(), fetchTemplates()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    return () => stopPolling();
  }, []);

  // Polling Logic
  useEffect(() => {
    const hasProvisioning = vms.some(vm => vm.status === 'provisioning');
    
    if (hasProvisioning) {
      startPolling();
    } else {
      stopPolling();
    }
    
    return () => stopPolling();
  }, [vms]);

  const startPolling = () => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      // Re-fetch VMs to see if any have completed provisioning
      await fetchVMs();
    }, 3000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleRequestClick = (template) => {
    setSelectedTemplate(template);
    setRequestNotes('');
    setShowModal(true);
  };

  const handleConfirmRequest = async () => {
    setRequesting(true);
    try {
      await vmService.requestVM(selectedTemplate.id, requestNotes);
      setToast({ show: true, message: 'VM requested! Provisioning will take about 8 seconds.', type: 'success' });
      setShowModal(false);
      await fetchVMs();
    } catch (err) {
      const errorMsg = err.response?.data?.error?.non_field_errors?.[0] || 'Failed to request VM';
      setToast({ show: true, message: errorMsg, type: 'error' });
    } finally {
      setRequesting(false);
    }
  };

  const handleAction = async (vmId, action) => {
    try {
      if (action === 'start') await vmService.startVM(vmId);
      if (action === 'stop') await vmService.stopVM(vmId);
      if (action === 'delete') await vmService.deleteVM(vmId);
      await fetchVMs();
    } catch (err) {
      const errorMsg = err.response?.data?.error || `Failed to ${action} VM`;
      setToast({ show: true, message: errorMsg, type: 'error' });
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '0h 0m 0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const getTemplateIcon = (template) => {
    return ICON_MAP[template.icon] || ICON_MAP['Monitor'];
  };

  const hasActiveVM = vms.some(vm => ['provisioning', 'running'].includes(vm.status));

  if (loading) {
    return <div className="flex justify-center items-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-8">
      {toast.show && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ show: false, message: '', type: '' })} 
        />
      )}

      {/* SECTION A — My Virtual Machines */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">My Virtual Machines</h2>
        
        {vms.length === 0 ? (
          <EmptyState 
            icon={<Monitor className="w-16 h-16 text-slate-500 mx-auto" />}
            title="No Virtual Machines Yet"
            description="Request a VM from the catalog below to get started"
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {vms.map(vm => (
              <div key={vm.id} className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{vm.name}</h3>
                    <p className="text-slate-400 text-sm">{vm.template?.name}</p>
                  </div>
                  <div>
                    {vm.status === 'provisioning' && (
                      <span className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-medium border border-yellow-500/30">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Provisioning...
                      </span>
                    )}
                    {vm.status === 'running' && (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-medium border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                        Running
                      </span>
                    )}
                    {vm.status === 'stopped' && (
                      <span className="inline-flex items-center gap-1.5 bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs font-medium border border-slate-600">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                        Stopped
                      </span>
                    )}
                    {vm.status === 'error' && (
                      <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-medium border border-red-500/30">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                        Error
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                {vm.status === 'running' && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 uppercase font-semibold tracking-wider">CPU Usage</span>
                        <span className="text-slate-300">{vm.cpu_usage}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${vm.cpu_usage < 50 ? 'bg-emerald-500' : vm.cpu_usage < 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(vm.cpu_usage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 uppercase font-semibold tracking-wider">RAM Usage</span>
                        <span className="text-slate-300">{vm.ram_usage}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${vm.ram_usage < 50 ? 'bg-emerald-500' : vm.ram_usage < 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(vm.ram_usage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-400">
                      <span className="font-medium">Uptime:</span> {formatUptime(vm.uptime_seconds)}
                    </div>
                  </div>
                )}

                {vm.status === 'provisioning' && (
                  <div className="py-8 text-center">
                    <p className="text-slate-400 text-sm animate-pulse">Preparing your VM...</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-4 pt-4 border-t border-slate-700">
                  {vm.status === 'running' && (
                    <>
                      <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                        <Monitor className="w-4 h-4" />
                        Connect
                      </button>
                      <button 
                        onClick={() => handleAction(vm.id, 'stop')}
                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2 px-4 rounded-lg text-sm font-medium transition-colors border border-red-500/20 flex items-center justify-center gap-2"
                      >
                        <Square className="w-4 h-4" />
                        Stop
                      </button>
                    </>
                  )}
                  {vm.status === 'stopped' && (
                    <>
                      <button 
                        onClick={() => handleAction(vm.id, 'start')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start
                      </button>
                      <button 
                        onClick={() => handleAction(vm.id, 'delete')}
                        className="flex-1 hover:bg-red-500/10 text-red-400 py-2 px-4 rounded-lg text-sm font-medium transition-colors border border-red-500/30 flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION B — VM Template Catalog */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">VM Template Catalog</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <div key={template.id} className="bg-slate-800 rounded-xl shadow-md border border-slate-700 flex flex-col overflow-hidden">
              <div className="bg-gradient-to-br from-blue-900 to-slate-800 p-8 flex items-center justify-center border-b border-slate-700">
                {getTemplateIcon(template)}
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="text-lg font-bold text-white mb-1">{template.name}</h3>
                <p className="text-slate-400 text-sm mb-4">{template.os}</p>
                
                <div className="flex items-center gap-4 text-sm text-slate-300 mb-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                  <div className="flex items-center gap-1.5" title="CPU Cores">
                    <Cpu className="w-4 h-4 text-slate-400" />
                    <span>{template.cpu_cores}</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="RAM">
                    <MemoryStick className="w-4 h-4 text-slate-400" />
                    <span>{template.ram_gb} GB</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Storage">
                    <Monitor className="w-4 h-4 text-slate-400" />
                    <span>{template.storage_gb} GB</span>
                  </div>
                </div>

                <div className="mb-6 flex-1">
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-2">Included Software</p>
                  <div className="flex flex-wrap gap-2">
                    {template.software_list?.slice(0, 3).map((sw, idx) => (
                      <span key={idx} className="bg-slate-700/50 text-slate-300 px-2.5 py-1 rounded-md text-xs border border-slate-600/50">
                        {sw}
                      </span>
                    ))}
                    {template.software_list?.length > 3 && (
                      <span className="bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md text-xs border border-slate-700">
                        +{template.software_list.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => handleRequestClick(template)}
                  disabled={hasActiveVM}
                  title={hasActiveVM ? "You already have an active VM" : ""}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    hasActiveVM 
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Request This VM
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Request Modal */}
      {showModal && selectedTemplate && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-2">Request {selectedTemplate.name}</h3>
            <p className="text-slate-400 text-sm mb-4">
              This will provision a new virtual machine with {selectedTemplate.cpu_cores} CPUs, {selectedTemplate.ram_gb}GB RAM, and {selectedTemplate.storage_gb}GB storage.
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Any specific requirements? (Optional)
              </label>
              <textarea 
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                rows="3"
                placeholder="e.g. Need this for my final project..."
              ></textarea>
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowModal(false)}
                disabled={requesting}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmRequest}
                disabled={requesting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {requesting && <RefreshCw className="w-4 h-4 animate-spin" />}
                {requesting ? 'Requesting...' : 'Request VM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
