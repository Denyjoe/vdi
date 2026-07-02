import { useState, useEffect, useRef } from 'react';
import { 
  Camera, UserCircle, Monitor, Activity, 
  Clock, Users, Shield, Save, Edit2, Loader2, ChevronDown, MapPin, Calendar, Globe, History, Zap, CheckCircle2
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  
  // Stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  
  // UI state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    bio: user?.bio || '',
    website: user?.website || '',
    country: user?.country || 'Tanzania',
    timezone_preference: user?.timezone_preference || 'Africa/Dar_es_Salaam'
  });
  
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

  useEffect(() => {
    fetchStats();
    fetchActivity();
  }, []);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/stats/');
      if (res.data?.success) setStats(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchActivity = async () => {
    // Simulated or fetched activity
    setRecentActivity([
      { id: 1, action: "Logged in from Chrome on Windows", time: "2 hours ago" },
      { id: 2, action: "Updated profile details", time: "1 day ago" },
      { id: 3, action: "Joined session 'System Architecture'", time: "3 days ago" }
    ]);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('File size cannot exceed 2MB');
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
      setUser({ ...user, avatar: res.data.data.avatar });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedFile) {
        await saveAvatar();
      }

      if (passExpandedAndFilled) {
        if (passData.new_password !== passData.confirm_new_password) {
          setPassError("New passwords don't match");
          setSaving(false);
          return;
        }
        await api.post('/auth/profile/password/', {
          old_password: passData.old_password,
          new_password: passData.new_password
        });
      }

      const res = await api.put('/auth/profile/', formData);
      if (res.data?.success) {
        setUser({ ...user, ...res.data.data });
        setIsEditing(false);
        setPassData({ old_password: '', new_password: '', confirm_new_password: '' });
        setPasswordExpanded(false);
      }
    } catch (err) {
      alert('Failed to update profile: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    return `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  };

  const passExpandedAndFilled = passwordExpanded && passData.new_password;
  const memberSince = new Date(user?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const avatarUrl = avatarPreview || (user?.avatar ? (user.avatar.startsWith('http') ? user.avatar : `http://localhost:8000${user.avatar}`) : null);

  const countries = [
    "Tanzania", "Kenya", "Uganda", "Rwanda", "Nigeria", "Ghana", 
    "South Africa", "United States", "United Kingdom", "India", "Other"
  ];

  return (
    <div className="min-h-full pb-12 animate-[fadeIn_0.3s_ease-out]">
      {/* ─── SECTION 1: PROFILE HEADER ─── */}
      <div className="relative mb-16">
        <div className="h-40 bg-gradient-to-b from-indigo-900/20 to-transparent border-b border-[#1e293b]"></div>
        
        <div className="max-w-7xl mx-auto px-8 relative">
          <div className="absolute -top-12 left-8">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border-4 border-[#030712] overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : getInitials()}
              </div>
              
              {isEditing && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-start justify-between pt-16">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-white">{user?.first_name} {user?.last_name}</h1>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {user?.role}
                </span>
              </div>
              
              <div className="text-slate-400 text-sm mb-4">
                @{user?.email?.split('@')[0]}
              </div>

              {user?.bio ? (
                <p className="text-slate-300 max-w-2xl text-sm mb-4">{user.bio}</p>
              ) : isEditing ? (
                <p className="text-slate-500 italic text-sm mb-4">Add a bio below...</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                {user?.country && (
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {user.country}</span>
                )}
                {user?.website && (
                  <a href={user.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                    <Globe className="w-3.5 h-3.5" /> {user.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Member since {memberSince}</span>
              </div>
            </div>

            <div className="mt-6 md:mt-0">
              {isEditing ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-300 hover:text-white transition-colors font-medium text-sm">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium text-sm transition-colors border border-white/10 flex items-center gap-2">
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 space-y-8">
        {/* ─── SECTION 2: STATS ROW ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {user?.role === 'instructor' ? (
            <>
              <div className="glass-card p-5 rounded-xl border border-white/5">
                <div className="text-3xl font-bold bg-gradient-to-br from-indigo-400 to-cyan-400 text-transparent bg-clip-text mb-1">{stats?.sessions_hosted || 0}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sessions Hosted</div>
              </div>
              <div className="glass-card p-5 rounded-xl border border-white/5">
                <div className="text-3xl font-bold bg-gradient-to-br from-indigo-400 to-cyan-400 text-transparent bg-clip-text mb-1">{stats?.groups_created || 0}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Groups Created</div>
              </div>
              <div className="glass-card p-5 rounded-xl border border-white/5">
                <div className="text-3xl font-bold bg-gradient-to-br from-indigo-400 to-cyan-400 text-transparent bg-clip-text mb-1">{stats?.total_members || 0}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Members</div>
              </div>
              <div className="glass-card p-5 rounded-xl border border-white/5">
                <div className="text-3xl font-bold bg-gradient-to-br from-indigo-400 to-cyan-400 text-transparent bg-clip-text mb-1">{stats?.total_participants || 0}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Participants</div>
              </div>
            </>
          ) : (
            <>
              <div className="glass-card p-5 rounded-xl border border-white/5">
                <div className="text-3xl font-bold bg-gradient-to-br from-indigo-400 to-cyan-400 text-transparent bg-clip-text mb-1">{stats?.workspaces || 0}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Workspaces</div>
              </div>
              <div className="glass-card p-5 rounded-xl border border-white/5">
                <div className="text-3xl font-bold bg-gradient-to-br from-indigo-400 to-cyan-400 text-transparent bg-clip-text mb-1">{stats?.sessions_joined || 0}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sessions</div>
              </div>
              <div className="glass-card p-5 rounded-xl border border-white/5">
                <div className="text-3xl font-bold bg-gradient-to-br from-indigo-400 to-cyan-400 text-transparent bg-clip-text mb-1">{stats?.groups_joined || 0}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Groups</div>
              </div>
              <div className="glass-card p-5 rounded-xl border border-white/5">
                <div className="text-3xl font-bold bg-gradient-to-br from-indigo-400 to-cyan-400 text-transparent bg-clip-text mb-1">{stats?.hours_used_this_month?.toFixed(1) || '0.0'}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Hours Used</div>
              </div>
            </>
          )}
        </div>

        {/* ─── SECTION 3: TWO COLUMNS ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* LEFT COLUMN (60%) */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* SUBSCRIPTION CARD */}
            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-400" /> Subscription Plan
                </h3>
                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-sm font-bold capitalize border border-indigo-500/20">
                  {user?.subscription?.display_name || 'Free Plan'}
                </span>
              </div>
              
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-300">Monthly Usage</span>
                    <span className="text-sm font-bold text-white">
                      {user?.subscription?.plan_name === 'institution' ? 'Unlimited' : `${stats?.hours_used_this_month?.toFixed(1) || 0} / ${user?.subscription?.compute_hours_per_month || 0} hrs`}
                    </span>
                  </div>
                  
                  {user?.subscription?.plan_name !== 'institution' && (
                    <>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                          style={{ width: `${Math.min(((stats?.hours_used_this_month || 0) / (user?.subscription?.compute_hours_per_month || 1)) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500">{user?.subscription?.hours_remaining?.toFixed(1)} hours remaining</span>
                        {(((stats?.hours_used_this_month || 0) / (user?.subscription?.compute_hours_per_month || 1)) * 100) > 80 && (
                          <span className="text-amber-400 font-medium">Running low</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                  <div className="text-slate-400 text-sm">
                    Plan Price: <span className="text-white font-bold">$0/month</span> {/* Simulated */}
                  </div>
                  <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors">
                    Manage Subscription
                  </button>
                </div>
              </div>
            </div>

            {/* RECENT ACTIVITY */}
            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-400" /> Recent Activity
                </h3>
              </div>
              <div className="p-2">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      <span className="text-sm font-medium text-slate-300">{activity.action}</span>
                    </div>
                    <span className="text-xs text-slate-500">{activity.time}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN (40%) */}
          <div className="lg:col-span-2">
            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">Profile Details</h3>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Personal Info */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">First Name</label>
                      <input 
                        type="text" 
                        value={formData.first_name}
                        onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                        disabled={!isEditing}
                        className="w-full px-4 py-2.5 bg-[#030712] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Last Name</label>
                      <input 
                        type="text" 
                        value={formData.last_name}
                        onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                        disabled={!isEditing}
                        className="w-full px-4 py-2.5 bg-[#030712] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Bio</label>
                    <textarea 
                      value={formData.bio}
                      onChange={(e) => setFormData({...formData, bio: e.target.value})}
                      disabled={!isEditing}
                      rows="3"
                      className="w-full px-4 py-2.5 bg-[#030712] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 resize-none"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Website URL</label>
                    <input 
                      type="url" 
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      disabled={!isEditing}
                      placeholder="https://"
                      className="w-full px-4 py-2.5 bg-[#030712] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Country</label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      disabled={!isEditing}
                      className="w-full px-4 py-2.5 bg-[#030712] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 appearance-none"
                    >
                      {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {isEditing && (
                  <div className="pt-6 border-t border-white/5">
                    <button 
                      onClick={() => setPasswordExpanded(!passwordExpanded)}
                      className="flex items-center justify-between w-full p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-white font-medium">
                        <Shield className="w-5 h-5 text-indigo-400" /> Change Password
                      </div>
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${passwordExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {passwordExpanded && (
                      <div className="mt-4 p-4 border border-white/5 rounded-xl space-y-4 bg-[#050B18]">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Current Password</label>
                          <input 
                            type="password" 
                            value={passData.old_password}
                            onChange={(e) => setPassData({...passData, old_password: e.target.value})}
                            className="w-full px-4 py-2 bg-[#030712] border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">New Password</label>
                          <input 
                            type="password" 
                            value={passData.new_password}
                            onChange={(e) => setPassData({...passData, new_password: e.target.value})}
                            className="w-full px-4 py-2 bg-[#030712] border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Confirm New Password</label>
                          <input 
                            type="password" 
                            value={passData.confirm_new_password}
                            onChange={(e) => setPassData({...passData, confirm_new_password: e.target.value})}
                            className="w-full px-4 py-2 bg-[#030712] border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        {passError && <p className="text-red-400 text-sm">{passError}</p>}
                      </div>
                    )}
                  </div>
                )}
                
                {isEditing && (
                  <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 mt-4"
                  >
                    {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
