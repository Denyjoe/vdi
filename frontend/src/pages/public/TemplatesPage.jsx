import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Cpu, HardDrive, Monitor, Code2, Compass, Terminal, Palette, Network, Database, Shield, Globe, Film, Smartphone } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

import OsIcon, { OS_ICONS } from '../../components/shared/OsIcon';

const TEMPLATE_ICONS = {
  Code2, Compass, Terminal, Palette,
  Network, Database, Shield, Cpu,
  Monitor, Globe, Film, Smartphone,
  HardDrive,
};

const TemplateIcon = ({ iconName, templateName, size = 20, color, className }) => {
  if (templateName && OS_ICONS[templateName]) {
    return <span className={className} style={{ display: 'inline-flex', color }}><OsIcon templateName={templateName} size={size} color="currentColor" /></span>
  }
  const IconComponent = TEMPLATE_ICONS[iconName] || Monitor;
  return <IconComponent size={size} color={color} className={className} />;
};

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/vms/templates/');
      if (res.data?.success) {
        setTemplates(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = () => {
    if (user) {
      navigate('/workspaces');
    } else {
      navigate('/signin');
    }
  };

  const getGradientByOS = (os) => {
    const o = (os || '').toLowerCase();
    if (o.includes('windows')) return 'from-blue-900/60 to-indigo-900/40 border-blue-500/20';
    if (o.includes('linux') || o.includes('ubuntu') || o.includes('debian')) return 'from-orange-900/60 to-red-900/40 border-orange-500/20';
    if (o.includes('kali')) return 'from-purple-900/60 to-fuchsia-900/40 border-purple-500/20';
    return 'from-slate-800 to-slate-900 border-border-strong';
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const isWindows = (t.os || '').toLowerCase().includes('windows');
    const isLinux = (t.os || '').toLowerCase().includes('linux') || (t.os || '').toLowerCase().includes('ubuntu');
    const isKali = (t.os || '').toLowerCase().includes('kali');
    
    let category = 'Other';
    if (isWindows) category = 'Windows';
    else if (isKali) category = 'Kali';
    else if (isLinux) category = 'Linux';
    
    const matchesTab = activeTab === 'All' || category === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col font-inter">
      <PublicNavbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 animate-fade-in-up">
            <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-6 tracking-tight">
              Virtual Workspaces
            </h1>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
              Choose from our curated collection of professional environments. Pre-configured with the tools you need.
            </p>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
            <div className="flex space-x-2 bg-white/5 p-1 rounded-xl backdrop-blur-sm border border-[var(--border-color)]">
              {['All', 'Windows', 'Linux', 'Kali'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
              <input
                type="text"
                placeholder="Search environments, software..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-muted focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all backdrop-blur-sm"
              />
            </div>
          </div>

          {loading ? (
             <div className="flex justify-center items-center py-24">
                 <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredTemplates.map(template => {
                return (
                  <div key={template.id} className="group flex flex-col bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
                    <div className={`p-8 bg-gradient-to-br ${getGradientByOS(template.os)} border-b`}>
                      <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-6 shadow-inner border border-white/10">
                        <TemplateIcon iconName={template.icon} templateName={template.name} className="w-8 h-8 text-primary" size={32} />
                      </div>
                      <h3 className="text-2xl font-bold text-primary mb-2">{template.name}</h3>
                      <p className="text-primary/70 font-medium">{template.os}</p>
                    </div>

                    <div className="p-8 flex-1 flex flex-col">
                      <p className="text-[var(--text-secondary)] mb-8 flex-1 leading-relaxed">
                        {template.description || 'Pre-configured workspace ready for use.'}
                      </p>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-white/5 rounded-xl p-4 border border-[var(--border-color)]">
                          <div className="flex items-center gap-2 text-indigo-400 mb-1">
                            <Cpu className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Compute</span>
                          </div>
                          <p className="text-[var(--text-primary)] font-semibold">{template.cpu_cores} Cores</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-[var(--border-color)]">
                          <div className="flex items-center gap-2 text-emerald-400 mb-1">
                            <HardDrive className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Memory</span>
                          </div>
                          <p className="text-[var(--text-primary)] font-semibold">{template.ram_gb} GB</p>
                        </div>
                      </div>

                      <div className="mb-8">
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Included Software</h4>
                        <div className="flex flex-wrap gap-2">
                          {(template.software_list || []).map((software, index) => (
                            <span key={index} className="px-3 py-1.5 bg-white/5 text-[var(--text-primary)] rounded-lg text-sm border border-[var(--border-color)]">
                              {software}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleLaunch}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                      >
                        Launch Workspace <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && filteredTemplates.length === 0 && (
            <div className="text-center py-24 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">No templates found</h3>
              <p className="text-[var(--text-secondary)]">Try adjusting your search or category filters.</p>
            </div>
          )}
        </div>
      </main>

      <footer className="py-8 bg-[#050B18] border-t border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-6 text-center text-[var(--text-secondary)] text-sm">
          <p>© 2026 CloudDesk. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
