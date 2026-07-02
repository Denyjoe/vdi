import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Cpu, MemoryStick, HardDrive } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';
import useAuthStore from '../../store/authStore';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const templates = [
    {
      id: 1, name: 'AutoCAD Workstation', icon: '📐', os: 'Windows 10 Pro', category: 'Windows', cpu: 4, ram: 8, storage: 60,
      description: 'Professional CAD design environment',
      software: ['AutoCAD 2024', 'AutoCAD LT']
    },
    {
      id: 2, name: 'MATLAB Lab', icon: '📊', os: 'Windows 10 Pro', category: 'Windows', cpu: 4, ram: 16, storage: 80,
      description: 'Mathematical computing environment',
      software: ['MATLAB R2023', 'Simulink', 'Signal Processing Toolbox']
    },
    {
      id: 3, name: 'Programming Environment', icon: '💻', os: 'Ubuntu 22.04 LTS', category: 'Linux', cpu: 2, ram: 4, storage: 40,
      description: 'Full-stack development workspace',
      software: ['VS Code', 'Python 3.11', 'Node.js', 'Git', 'PostgreSQL']
    },
    {
      id: 4, name: 'Graphic Design Studio', icon: '🎨', os: 'Windows 10 Pro', category: 'Windows', cpu: 4, ram: 8, storage: 80,
      description: 'Creative design environment',
      software: ['Photoshop 2024', 'Illustrator 2024', 'Premiere Pro']
    },
    {
      id: 5, name: 'Network Lab', icon: '🌐', os: 'Ubuntu 22.04 LTS', category: 'Linux', cpu: 2, ram: 4, storage: 40,
      description: 'Network engineering environment',
      software: ['Cisco Packet Tracer', 'Wireshark', 'GNS3', 'PuTTY']
    },
    {
      id: 6, name: 'Cybersecurity Lab', icon: '🛡️', os: 'Kali Linux 2024', category: 'Kali', cpu: 4, ram: 8, storage: 60,
      description: 'Penetration testing and security',
      software: ['Metasploit', 'Wireshark', 'Burp Suite', 'Nmap', 'John the Ripper']
    },
    {
      id: 7, name: 'Civil Engineering Suite', icon: '🏢', os: 'Windows 10 Pro', category: 'Windows', cpu: 4, ram: 16, storage: 100,
      description: 'Structural and civil engineering tools',
      software: ['AutoCAD Civil 3D', 'Revit 2024', 'SAP2000', 'ETABS']
    },
    {
      id: 8, name: 'Data Science Lab', icon: '🧠', os: 'Ubuntu 22.04 LTS', category: 'Linux', cpu: 4, ram: 16, storage: 80,
      description: 'Machine learning and data analysis',
      software: ['Python 3.11', 'Jupyter Lab', 'TensorFlow', 'PyTorch', 'Pandas']
    },
    {
      id: 9, name: 'Mobile Development Studio', icon: '📱', os: 'Ubuntu 22.04 LTS', category: 'Linux', cpu: 4, ram: 8, storage: 60,
      description: 'Android and Flutter development',
      software: ['Android Studio', 'Flutter SDK', 'VS Code', 'Firebase CLI']
    },
    {
      id: 10, name: 'Database Administration Lab', icon: '🗄️', os: 'Ubuntu 22.04 LTS', category: 'Linux', cpu: 2, ram: 4, storage: 60,
      description: 'Database management environment',
      software: ['MySQL Workbench', 'pgAdmin 4', 'MongoDB Compass', 'Redis']
    },
    {
      id: 11, name: 'Video Production Suite', icon: '🎬', os: 'Windows 10 Pro', category: 'Windows', cpu: 8, ram: 32, storage: 200,
      description: 'Professional video editing',
      software: ['DaVinci Resolve', 'Adobe Premiere Pro', 'After Effects']
    },
    {
      id: 12, name: 'Web Development Studio', icon: '🌐', os: 'Ubuntu 22.04 LTS', category: 'Linux', cpu: 2, ram: 4, storage: 40,
      description: 'Full-stack web development',
      software: ['VS Code', 'Node.js LTS', 'React', 'Docker', 'Nginx']
    }
  ];

  const handleLaunch = () => {
    if (user) {
      navigate('/dashboard'); // Real implementation would go to specific VM request
    } else {
      navigate('/register');
    }
  };

  const getGradientByOS = (category) => {
    switch (category) {
      case 'Windows': return 'from-blue-900 to-blue-800';
      case 'Linux': return 'from-orange-900 to-orange-800';
      case 'Kali': return 'from-purple-900 to-purple-800';
      default: return 'from-slate-800 to-slate-900';
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'All' || t.category === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="min-h-screen bg-[#050B18]">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">12+ Professional VM Templates</h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Launch powerful tools instantly. No installation required.
          </p>

          <div className="max-w-2xl mx-auto flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search templates, software, or OS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0D1526] border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {['All', 'Windows', 'Linux', 'Kali'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-[#0D1526] border border-white/10 text-slate-400 hover:text-white hover:border-white/30'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Templates Grid */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map(t => (
              <div key={t.id} className="glass-card rounded-2xl overflow-hidden flex flex-col hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-1 shadow-lg shadow-black/20">
                {/* Top Section */}
                <div className={`p-6 bg-gradient-to-br ${getGradientByOS(t.category)} relative`}>
                  <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-white/90">
                    {t.os}
                  </div>
                  <div className="text-5xl mb-2">{t.icon}</div>
                </div>
                
                {/* Bottom Section */}
                <div className="p-6 flex-1 flex flex-col bg-[#0D1526]">
                  <h3 className="text-xl font-bold text-white mb-2">{t.name}</h3>
                  <p className="text-sm text-slate-400 mb-6 h-10 line-clamp-2">{t.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-300 mb-6 bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-slate-400" /> {t.cpu} Cores</div>
                    <div className="flex items-center gap-1.5"><MemoryStick className="w-4 h-4 text-slate-400" /> {t.ram}GB RAM</div>
                    <div className="flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-slate-400" /> {t.storage}GB</div>
                  </div>
                  
                  <div className="mb-6 flex-1">
                    <div className="flex flex-wrap gap-2">
                      {t.software.slice(0, 3).map(sw => (
                        <span key={sw} className="text-xs px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {sw}
                        </span>
                      ))}
                      {t.software.length > 3 && (
                        <span className="text-xs px-2 py-1 rounded bg-white/5 text-slate-400 border border-white/10">
                          +{t.software.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleLaunch}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25"
                  >
                    Launch This VM →
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {filteredTemplates.length === 0 && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-white mb-2">No templates found</h3>
              <p className="text-slate-400">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
