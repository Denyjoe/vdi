import { useState, useEffect } from 'react';
import { vmService } from '../../services/vmService';
import { 
  RefreshCw, Power, Monitor, 
  Play, Square, Trash2, Eye, Server
} from 'lucide-react';
import Toast from '../../components/shared/Toast';

export default function AdminVMsPage() {
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const fetchVMs = async () => {
    setLoading(true);
    try {
      const res = await vmService.adminGetAllVMs();
      setVms(res.data.data);
    } catch (error) {
      console.error("Failed to fetch VMs:", error);
      setToast({ show: true, message: 'Failed to load VMs', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVMs();
  }, []);

  const handleForceStop = async (id) => {
    try {
      await vmService.adminForceStop(id);
      setToast({ show: true, message: 'VM forcefully stopped', type: 'success' });
      fetchVMs();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to force stop VM';
      setToast({ show: true, message: errorMsg, type: 'error' });
    }
  };

  const stats = {
    total: vms.length,
    running: vms.filter(vm => vm.status === 'running').length,
    stopped: vms.filter(vm => vm.status === 'stopped').length,
    provisioning: vms.filter(vm => vm.status === 'provisioning').length,
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {toast.show && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ show: false, message: '', type: '' })} 
        />
      )}

      {/* Header & Refresh */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white font-inter">All Virtual Machines</h1>
        <button 
          onClick={fetchVMs}
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex items-center gap-4">
          <div className="bg-indigo-500/20 p-3 rounded-lg"><Server className="w-5 h-5 text-indigo-400" /></div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total VMs</p>
            <p className="text-xl font-bold text-white">{stats.total}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex items-center gap-4">
          <div className="bg-emerald-500/20 p-3 rounded-lg"><Play className="w-5 h-5 text-emerald-400" /></div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Running</p>
            <p className="text-xl font-bold text-emerald-400">{stats.running}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex items-center gap-4">
          <div className="bg-slate-600/20 p-3 rounded-lg"><Square className="w-5 h-5 text-slate-400" /></div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Stopped</p>
            <p className="text-xl font-bold text-slate-300">{stats.stopped}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex items-center gap-4">
          <div className="bg-yellow-500/20 p-3 rounded-lg"><RefreshCw className="w-5 h-5 text-yellow-400" /></div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Provisioning</p>
            <p className="text-xl font-bold text-yellow-400">{stats.provisioning}</p>
          </div>
        </div>
      </div>

      {/* VMs Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-medium">VM Name</th>
                <th className="px-6 py-4 font-medium">Owner</th>
                <th className="px-6 py-4 font-medium">Template</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">CPU%</th>
                <th className="px-6 py-4 font-medium">RAM%</th>
                <th className="px-6 py-4 font-medium">Allocated At</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {vms.length === 0 && !loading && (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                    No Virtual Machines found.
                  </td>
                </tr>
              )}
              {vms.map(vm => (
                <tr key={vm.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{vm.name}</td>
                  <td className="px-6 py-4 text-slate-400">{vm.owner}</td>
                  <td className="px-6 py-4 text-slate-400">{vm.template?.name}</td>
                  <td className="px-6 py-4">
                    {vm.status === 'provisioning' && <span className="text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded text-xs font-medium border border-yellow-400/20">Provisioning</span>}
                    {vm.status === 'running' && <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs font-medium border border-emerald-400/20">Running</span>}
                    {vm.status === 'stopped' && <span className="text-slate-400 bg-slate-400/10 px-2 py-1 rounded text-xs font-medium border border-slate-400/20">Stopped</span>}
                    {vm.status === 'error' && <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded text-xs font-medium border border-red-400/20">Error</span>}
                    {vm.status === 'deleted' && <span className="text-slate-500 bg-slate-800 px-2 py-1 rounded text-xs font-medium border border-slate-700">Deleted</span>}
                  </td>
                  <td className="px-6 py-4">{vm.status === 'running' ? `${vm.cpu_usage}%` : '-'}</td>
                  <td className="px-6 py-4">{vm.status === 'running' ? `${vm.ram_usage}%` : '-'}</td>
                  <td className="px-6 py-4 text-slate-400">{formatDate(vm.allocated_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="View Detail">
                        <Eye className="w-4 h-4" />
                      </button>
                      {vm.status === 'running' && (
                        <button 
                          onClick={() => handleForceStop(vm.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <Power className="w-3 h-3" />
                          Force Stop
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
