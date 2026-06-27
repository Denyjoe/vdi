import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, UserCircle, GraduationCap, Monitor, Activity, 
  Clock, FileCheck, TestTube2, BookOpen, Users, ClipboardList, 
  FlaskConical, Shield, Layout, Save, Edit2, Loader2, ChevronDown
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  
  // Stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    department: user?.department?.id || '',
    programme: user?.programme?.id || '',
    year_of_study: user?.year_of_study || 1
  });
  
  // Options state
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  
  // Password state
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [passData, setPassData] = useState({
    old_password: '',
    new_password: '',
    confirm_new_password: ''
  });
  const [passError, setPassError] = useState('');
  
  // Avatar state
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [saving, setSaving] = useState(false);
  
  // Initials
  const getInitials = () => {
    return `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  };
  
  // Avatar fallback gradient
  const getGradient = () => {
    if (user?.role === 'admin') return 'from-red-600 to-red-800';
    if (user?.role === 'lecturer') return 'from-purple-600 to-purple-800';
    return 'from-blue-600 to-blue-800';
  };

  useEffect(() => {
    fetchStats();
    if (user?.role !== 'admin') {
      fetchDepartments();
    }
  }, []);
  
  useEffect(() => {
    if (formData.department && user?.role === 'student') {
      fetchProgrammes(formData.department);
    } else {
      setProgrammes([]);
    }
  }, [formData.department]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/auth/profile/stats/');
      setStats(res.data.data);
    } catch (err) {
      toast.error('Failed to load profile stats');
    } finally {
      setStatsLoading(false);
    }
  };
  
  const fetchDepartments = async () => {
    try {
      const res = await api.get('/classes/departments/');
      setDepartments(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };
  
  const fetchProgrammes = async (deptId) => {
    try {
      const res = await api.get('/classes/programmes/');
      // Filter by department id if API doesn't do it
      const filtered = (res.data.data || []).filter(p => p.department_id === parseInt(deptId) || p.department === deptId || p.department?.id === parseInt(deptId));
      
      // If the API returns full objects we handle it, but wait, if it just returns all programmes, we filter.
      // The instruction says `Filter by selected department: ?department_code=CS`.
      // Let's just pass dept_id or handle whatever is returned.
      // Actually let's just use all and filter client side if needed, or if API doesn't support filter.
      // Wait, standard DRF doesn't filter unless implemented. Let's filter on frontend.
      const dept = departments.find(d => d.id === parseInt(deptId));
      let query = '';
      if (dept && dept.code) {
         const progRes = await api.get(`/classes/programmes/?department_code=${dept.code}`);
         setProgrammes(progRes.data.data || []);
      } else {
         setProgrammes(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size cannot exceed 2MB');
      return;
    }
    
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };
  
  const saveAvatar = async () => {
    if (!selectedFile) return;
    
    try {
      const formData = new FormData();
      formData.append('avatar', selectedFile);
      
      const res = await api.post('/auth/profile/avatar/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUser({ ...user, avatar_url: res.data.data.avatar_url, avatar: res.data.data.avatar_url });
      toast.success('Photo updated!');
      setSelectedFile(null);
      setAvatarPreview(null);
    } catch (err) {
      toast.error('Failed to upload photo');
    }
  };
  
  const removeAvatar = async () => {
    try {
      await api.delete('/auth/profile/avatar/');
      setUser({ ...user, avatar_url: null, avatar: null });
      toast.success('Photo removed');
      setAvatarPreview(null);
      setSelectedFile(null);
    } catch (err) {
      toast.error('Failed to remove photo');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPassError('');
    if (passData.new_password !== passData.confirm_new_password) {
      setPassError('New passwords do not match');
      return;
    }
    if (passData.new_password.length < 8) {
      setPassError('Password must be at least 8 characters');
      return;
    }
    
    try {
      await api.post('/auth/change-password/', passData);
      toast.success('Password updated successfully!');
      setPasswordExpanded(false);
      setPassData({ old_password: '', new_password: '', confirm_new_password: '' });
    } catch (err) {
      setPassError(err.response?.data?.error?.old_password?.[0] || 'Failed to change password');
    }
  };

  const handleProfileSave = async () => {
    if (!formData.first_name) {
      toast.error('First name is required');
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
      };
      
      if (user?.role === 'student') {
        payload.department = formData.department || null;
        payload.programme = formData.programme || null;
        payload.year_of_study = formData.year_of_study || null;
      } else if (user?.role === 'lecturer') {
        payload.department = formData.department || null;
      }
      
      const res = await api.patch('/auth/profile/update/', payload);
      setUser(res.data.data);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };
  
  const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const avatarSrc = avatarPreview || user?.avatar_url || user?.avatar;

  // Group programmes by level for student
  const groupedProgrammes = programmes.reduce((acc, p) => {
    const lvl = p.level?.toUpperCase() || 'OTHER';
    if (!acc[lvl]) acc[lvl] = [];
    acc[lvl].push(p);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">My Profile</h1>
      
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* LEFT COLUMN - 35% */}
        <div className="lg:w-[35%] flex flex-col gap-6">
          
          {/* Avatar Card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col items-center text-center">
            
            <div className="relative mb-4">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-blue-500" />
              ) : (
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getGradient()} flex items-center justify-center border-4 border-slate-700`}>
                  <span className="text-2xl font-bold text-white tracking-wider">{getInitials()}</span>
                </div>
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
            />
            
            {avatarPreview ? (
              <div className="flex gap-2 mb-4">
                <button 
                  onClick={saveAvatar}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save Photo
                </button>
                <button 
                  onClick={() => { setAvatarPreview(null); setSelectedFile(null); }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors mb-2"
              >
                <Camera className="w-4 h-4" /> Change Photo
              </button>
            )}
            
            {!avatarPreview && (user?.avatar || user?.avatar_url) && (
              <button onClick={removeAvatar} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                Remove Photo
              </button>
            )}
            
            <div className="mt-4 w-full border-t border-slate-700 pt-4">
              <h2 className="text-xl font-bold text-white mb-1">{user?.first_name} {user?.last_name}</h2>
              <div className="flex flex-col items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize
                  ${user?.role === 'admin' ? 'bg-red-500/20 text-red-400' : 
                    user?.role === 'lecturer' ? 'bg-purple-500/20 text-purple-400' : 
                    'bg-blue-500/20 text-blue-400'}`}
                >
                  {user?.role}
                </span>
                <p className="text-sm text-slate-400">{user?.email}</p>
                {user?.role === 'student' && user?.stream && (
                  <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-medium rounded-full mt-1 border border-blue-500/30">
                    {user?.stream?.code}
                  </span>
                )}
                {stats?.member_since && (
                  <p className="text-xs text-slate-500 mt-2">Member since {formatDate(stats.member_since)}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Stats Card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-800/50">
              <h3 className="font-semibold text-white">Activity Stats</h3>
            </div>
            
            <div className="p-0">
              {statsLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : !stats ? (
                <div className="p-4 text-center text-slate-400 text-sm">Stats unavailable</div>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {user?.role === 'student' && (
                    <>
                      <StatRow icon={<GraduationCap />} label="Classes Enrolled" value={stats.enrolled_classes} color="text-blue-400" bg="bg-blue-500/10" />
                      <StatRow icon={<Monitor />} label="VMs Created" value={stats.total_vms} color="text-purple-400" bg="bg-purple-500/10" />
                      <StatRow icon={<Activity />} label="Sessions" value={stats.total_sessions} color="text-green-400" bg="bg-green-500/10" />
                      <StatRow icon={<Clock />} label="Connected" value={`${stats.total_session_hours} hrs`} color="text-amber-400" bg="bg-amber-500/10" />
                      <StatRow icon={<FileCheck />} label="Assignments Submitted" value={stats.assignments_submitted} color="text-indigo-400" bg="bg-indigo-500/10" />
                      <StatRow icon={<TestTube2 />} label="Practicals Submitted" value={stats.practicals_submitted} color="text-pink-400" bg="bg-pink-500/10" />
                    </>
                  )}
                  
                  {user?.role === 'lecturer' && (
                    <>
                      <StatRow icon={<BookOpen />} label="Classes" value={stats.total_classes} color="text-blue-400" bg="bg-blue-500/10" />
                      <StatRow icon={<Users />} label="Total Students" value={stats.total_students} color="text-purple-400" bg="bg-purple-500/10" />
                      <StatRow icon={<ClipboardList />} label="Assignments" value={stats.total_assignments} color="text-green-400" bg="bg-green-500/10" />
                      <StatRow icon={<FlaskConical />} label="Practicals" value={stats.practicals_conducted} color="text-amber-400" bg="bg-amber-500/10" />
                      <StatRow icon={<Shield />} label="Exams Conducted" value={stats.exams_conducted} color="text-red-400" bg="bg-red-500/10" />
                    </>
                  )}
                  
                  {user?.role === 'admin' && (
                    <>
                      <StatRow icon={<Users />} label="Total Users" value={stats.total_users} color="text-blue-400" bg="bg-blue-500/10" />
                      <StatRow icon={<Monitor />} label="Total VMs" value={stats.total_vms} color="text-purple-400" bg="bg-purple-500/10" />
                      <StatRow icon={<Activity />} label="Sessions" value={stats.total_sessions} color="text-green-400" bg="bg-green-500/10" />
                      <StatRow icon={<Layout />} label="VM Templates" value={stats.total_templates} color="text-amber-400" bg="bg-amber-500/10" />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          
        </div>
        
        {/* RIGHT COLUMN - 65% */}
        <div className="lg:w-[65%] flex flex-col gap-6">
          
          {/* Personal Info */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
              <h3 className="font-bold text-white">Personal Information</h3>
              <Edit2 className="w-4 h-4 text-slate-400" />
            </div>
            
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">First Name</label>
                <input 
                  type="text" 
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Last Name</label>
                <input 
                  type="text" 
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Phone Number</label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+255 7XX XXX XXX"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-slate-900/50 border border-slate-800 text-slate-500 rounded-lg px-4 py-2.5 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">Contact admin to change email</p>
              </div>
            </div>
          </div>
          
          {/* Academic Info */}
          {user?.role !== 'admin' && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                <h3 className="font-bold text-white">Academic Information</h3>
              </div>
              
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Department</label>
                  <select 
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} {d.code ? `(${d.code})` : ''}</option>
                    ))}
                  </select>
                </div>
                
                {user?.role === 'student' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Year of Study</label>
                      <select 
                        value={formData.year_of_study}
                        onChange={(e) => setFormData({...formData, year_of_study: parseInt(e.target.value)})}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      >
                        {[1, 2, 3, 4].map(y => (
                          <option key={y} value={y}>Year {y}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Programme</label>
                      <select 
                        value={formData.programme}
                        onChange={(e) => setFormData({...formData, programme: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      >
                        <option value="">Select Programme</option>
                        {Object.entries(groupedProgrammes).map(([level, progs]) => (
                          <optgroup key={level} label={level}>
                            {progs.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">DIT Registration Number</label>
                      <input 
                        type="text" 
                        value={user?.student_id || ''}
                        disabled
                        className="w-full bg-slate-900/50 border border-slate-800 text-slate-500 rounded-lg px-4 py-2.5 cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-500 mt-1">Contact admin to update</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* Change Password */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden transition-all duration-300">
            <div 
              className="p-5 bg-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-750"
              onClick={() => setPasswordExpanded(!passwordExpanded)}
            >
              <h3 className="font-bold text-white flex items-center gap-2">
                Change Password 
                <ChevronDown className={`w-4 h-4 transition-transform ${passwordExpanded ? 'rotate-180' : ''}`} />
              </h3>
            </div>
            
            {passwordExpanded && (
              <form onSubmit={handlePasswordSubmit} className="p-5 border-t border-slate-700 bg-slate-800/30 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  {passError && <div className="p-3 mb-2 bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg">{passError}</div>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Current Password</label>
                  <input 
                    type="password" 
                    value={passData.old_password}
                    onChange={(e) => setPassData({...passData, old_password: e.target.value})}
                    required
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
                <div className="hidden md:block"></div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">New Password</label>
                  <input 
                    type="password" 
                    value={passData.new_password}
                    onChange={(e) => setPassData({...passData, new_password: e.target.value})}
                    required
                    minLength={8}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Confirm New Password</label>
                  <input 
                    type="password" 
                    value={passData.confirm_new_password}
                    onChange={(e) => setPassData({...passData, confirm_new_password: e.target.value})}
                    required
                    minLength={8}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
                
                <div className="md:col-span-2 mt-2">
                  <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                    Update Password
                  </button>
                </div>
              </form>
            )}
          </div>
          
          {/* Save Button */}
          <button 
            onClick={handleProfileSave}
            disabled={saving}
            className="w-full flex justify-center items-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-600/20"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
          
        </div>
        
      </div>
    </div>
  );
}

function StatRow({ icon, label, value, color, bg }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bg} ${color} flex items-center justify-center`}>
          {React.cloneElement(icon, { className: 'w-5 h-5' })}
        </div>
        <span className="text-slate-300 font-medium">{label}</span>
      </div>
      <span className="text-xl font-bold text-white">{value}</span>
    </div>
  );
}
