import React, { useState, useEffect, useRef } from 'react';
import { 
  X, User, Lock, Bell, Palette, Code, 
  AlertTriangle, Camera, Shield, Key, 
  RefreshCw, Trash2, Check, Copy,
  ChevronDown, Search, Eye, EyeOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useSettingsStore from '../../store/settingsStore';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';

const COUNTRIES = [
  { code: 'TZ', name: 'Tanzania', timezone: 'Africa/Dar_es_Salaam' },
  { code: 'KE', name: 'Kenya', timezone: 'Africa/Nairobi' },
  { code: 'UG', name: 'Uganda', timezone: 'Africa/Kampala' },
  { code: 'RW', name: 'Rwanda', timezone: 'Africa/Kigali' },
  { code: 'NG', name: 'Nigeria', timezone: 'Africa/Lagos' },
  { code: 'GH', name: 'Ghana', timezone: 'Africa/Accra' },
  { code: 'ZA', name: 'South Africa', timezone: 'Africa/Johannesburg' },
  { code: 'ET', name: 'Ethiopia', timezone: 'Africa/Addis_Ababa' },
  { code: 'EG', name: 'Egypt', timezone: 'Africa/Cairo' },
  { code: 'MA', name: 'Morocco', timezone: 'Africa/Casablanca' },
  { code: 'US', name: 'United States', timezone: 'America/New_York' },
  { code: 'GB', name: 'United Kingdom', timezone: 'Europe/London' },
  { code: 'DE', name: 'Germany', timezone: 'Europe/Berlin' },
  { code: 'FR', name: 'France', timezone: 'Europe/Paris' },
  { code: 'IN', name: 'India', timezone: 'Asia/Kolkata' },
  { code: 'CN', name: 'China', timezone: 'Asia/Shanghai' },
  { code: 'JP', name: 'Japan', timezone: 'Asia/Tokyo' },
  { code: 'AE', name: 'United Arab Emirates', timezone: 'Asia/Dubai' },
  { code: 'SA', name: 'Saudi Arabia', timezone: 'Asia/Riyadh' },
  { code: 'BR', name: 'Brazil', timezone: 'America/Sao_Paulo' },
  { code: 'CA', name: 'Canada', timezone: 'America/Toronto' },
  { code: 'AU', name: 'Australia', timezone: 'Australia/Sydney' },
  { code: 'SG', name: 'Singapore', timezone: 'Asia/Singapore' },
  { code: 'MY', name: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' },
  { code: 'ID', name: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'PK', name: 'Pakistan', timezone: 'Asia/Karachi' },
  { code: 'BD', name: 'Bangladesh', timezone: 'Asia/Dhaka' },
  { code: 'MW', name: 'Malawi', timezone: 'Africa/Blantyre' },
  { code: 'MZ', name: 'Mozambique', timezone: 'Africa/Maputo' },
  { code: 'ZM', name: 'Zambia', timezone: 'Africa/Lusaka' },
  { code: 'ZW', name: 'Zimbabwe', timezone: 'Africa/Harare' },
  { code: 'CD', name: 'DR Congo', timezone: 'Africa/Kinshasa' },
  { code: 'CM', name: 'Cameroon', timezone: 'Africa/Douala' },
  { code: 'CI', name: 'Ivory Coast', timezone: 'Africa/Abidjan' },
  { code: 'SN', name: 'Senegal', timezone: 'Africa/Dakar' },
  { code: 'BW', name: 'Botswana', timezone: 'Africa/Gaborone' },
  { code: 'NA', name: 'Namibia', timezone: 'Africa/Windhoek' },
  { code: 'SO', name: 'Somalia', timezone: 'Africa/Mogadishu' },
  { code: 'SD', name: 'Sudan', timezone: 'Africa/Khartoum' },
  { code: 'BI', name: 'Burundi', timezone: 'Africa/Bujumbura' },
].sort((a, b) => a.name.localeCompare(b.name));

export default function SettingsPanel() {
  const { isOpen, activeTab, closeSettings, setTab } = useSettingsStore();
  const user = useAuthStore(s => s.user);
  const panelRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') closeSettings();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeSettings]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { 
      document.body.style.overflow = ''; 
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'developer', label: 'Developer', icon: Code },
    { id: 'danger', label: 'Account Removal', icon: AlertTriangle },
  ];

  return (
    <>
      {/* Backdrop — blurred background */}
      <div 
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={closeSettings}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      />
      
      {/* Panel — Centered Modal */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center pointer-events-none">
        <div 
          ref={panelRef}
          className="border rounded-2xl w-[700px] max-w-[90vw] h-[550px] max-h-[80vh] flex overflow-hidden pointer-events-auto"
          style={{ 
            background: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
            boxShadow: 'var(--shadow-2xl, 0 25px 50px rgba(0,0,0,0.5))',
            animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' 
          }}
        >
        {/* Left sidebar — tabs */}
        <div className="w-[180px] flex-shrink-0 border-r flex flex-col" style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}>
          
          {/* Panel header */}
          <div className="px-4 py-5 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-sm font-bold text-primary tracking-tight">
              Settings
            </h2>
          </div>
          
          {/* Tab navigation */}
          <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
            {tabs.map(tab => (
              <button key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-200 active:scale-[0.97]
                  ${activeTab === tab.id
                    ? 'bg-[#0066FF]/10 text-[#0066FF]'
                    : tab.id === 'danger'
                      ? 'text-red-400/60 hover:text-red-400 hover:bg-red-500/5'
                      : 'text-secondary hover:text-primary hover:bg-nav-hover'
                  }`}>
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
          </nav>
          
          {/* User info at bottom */}
          <div className="px-4 py-4 border-t border-border-subtle">
            <div className="flex items-center gap-2.5">
              {user?.avatar ? (
                <img src={user.avatar} 
                  className="w-8 h-8 rounded-full object-cover" 
                  alt=""
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }} />
              ) : null}
              <div className={`w-8 h-8 rounded-full bg-[#6C63FF]/20 items-center justify-center text-[11px] font-bold text-[#6C63FF] ${user?.avatar ? 'hidden' : 'flex'}`}>
                {user?.first_name?.[0]}
                {user?.last_name?.[0]}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-primary truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[9px] text-muted truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right content area */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Content header with close */}
          <div className="h-14 px-6 flex items-center justify-between border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              {tabs.find(t => t.id === activeTab)?.label}
            </h3>
            <button onClick={closeSettings}
              className="p-1.5 rounded-lg hover:bg-nav-hover text-secondary hover:text-primary active:scale-95 transition-all">
              <X size={18} />
            </button>
          </div>
          
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {activeTab === 'profile' && <ProfileTab user={user} />}
            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'notifications' && <NotificationsTab user={user} />}
            {activeTab === 'appearance' && <AppearanceTab />}
            {activeTab === 'developer' && <DeveloperTab />}
            {activeTab === 'danger' && <DangerTab />}
          </div>
        </div>
      </div>
    </div>
      
    {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 4px;
        }
      `}</style>
    </>
  );
}

function ProfileTab({ user }) {
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    country: user?.country || '',
    timezone: user?.timezone_preference || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef(null);

  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (countryRef.current && !countryRef.current.contains(e.target)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredCountries = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/auth/profile/', {
        first_name: form.first_name,
        last_name: form.last_name,
        country: form.country,
        timezone: form.timezone,
      });
      
      // Update auth store immediately
      const authStore = useAuthStore.getState();
      if (authStore.setUser) {
        authStore.setUser({
          ...authStore.user,
          first_name: form.first_name,
          last_name: form.last_name,
          country: form.country,
          timezone_preference: form.timezone,
        });
      }
      // Refresh user data from API
      try {
        const meRes = await api.get('/auth/me/');
        const userData = meRes.data?.data || meRes.data;
        if (authStore.setUser) {
          authStore.setUser(userData);
        }
      } catch {}
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Max 5MB.');
      return;
    }
    
    try {
      setAvatarUploading(true);
      const formData = new FormData();
      formData.append('avatar', file);
      
      const res = await api.post('/auth/avatar/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Update auth store with new avatar
      const avatarUrl = res.data?.avatar_url;
      if (avatarUrl) {
        const authStore = useAuthStore.getState();
        if (authStore.setUser) {
          authStore.setUser({
            ...authStore.user,
            avatar: avatarUrl,
          });
        }
      }
      
      // Also refresh user data
      try {
        const meRes = await api.get('/auth/me/');
        const userData = meRes.data?.data || meRes.data;
        const authStore = useAuthStore.getState();
        if (authStore.setUser) {
          authStore.setUser(userData);
        }
      } catch {}
      
    } catch(e) {
      console.error('Avatar upload failed:', e);
      alert('Failed to upload. ' + (e.response?.data?.message || ''));
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Avatar section */}
      <div className="flex items-center gap-5 pb-6 border-b border-border-subtle">
        <div className="relative group">
          <div className="w-20 h-20 rounded-2xl bg-[#6C63FF]/15 flex items-center justify-center text-2xl font-bold text-[#6C63FF] ring-2 ring-slate-700 overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} className="w-full h-full object-cover" alt="" 
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                }} />
            ) : null}
            <div className={`w-full h-full items-center justify-center ${user?.avatar ? 'hidden' : 'flex'}`}>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
          </div>
          <button onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-[#0066FF] flex items-center justify-center text-primary shadow-lg active:scale-95 transition-all">
            <Camera size={13} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">Profile Photo</p>
          <p className="text-[11px] text-muted mt-1">JPEG, PNG or WebP. Max 5MB.</p>
        </div>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-2">First Name</label>
          <input value={form.first_name}
            onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
            className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-primary outline-none focus:border-blue-500 transition-colors" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-2">Last Name</label>
          <input value={form.last_name}
            onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
            className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-primary outline-none focus:border-blue-500 transition-colors" />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-2">Email Address</label>
        <input value={user?.email || ''} disabled
          className="w-full bg-card/50 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-muted cursor-not-allowed" />
      </div>

      {/* Country searchable dropdown */}
      <div ref={countryRef} className="relative">
        <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-2">Country</label>
        
        <button onClick={() => setShowCountryDropdown(!showCountryDropdown)}
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-left flex items-center justify-between focus:border-blue-500 transition-colors"
          style={{ color: form.country ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          <span>{form.country || 'Select your country'}</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
        
        {showCountryDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden max-h-[280px] flex flex-col">
            
            {/* Search input */}
            <div className="p-2 border-b border-border-subtle flex-shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  placeholder="Search countries..."
                  autoFocus
                  className="w-full bg-sidebar border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-primary placeholder-muted outline-none focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Country list */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {filteredCountries.map(c => (
                <button key={c.code}
                  onClick={() => {
                    setForm(f => ({
                      ...f, 
                      country: c.name,
                      timezone: c.timezone
                    }));
                    setShowCountryDropdown(false);
                    setCountrySearch('');
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between
                    ${form.country === c.name
                      ? 'bg-[#0066FF]/10 text-[#0066FF]'
                      : 'text-secondary hover:bg-nav-hover'
                    }`}>
                  <span>{c.name}</span>
                  {form.country === c.name && (
                    <Check size={13} className="text-[#0066FF]" />
                  )}
                </button>
              ))}
              {filteredCountries.length === 0 && (
                <p className="px-4 py-6 text-xs text-muted text-center">
                  No countries found
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <button onClick={handleSave} disabled={saving}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-all
          ${saved ? 'bg-[#00FF87]/10 border border-[#00FF87]/20 text-[#00FF87]' : 'bg-[#0066FF] text-white hover:bg-[#0052CC] shadow-lg shadow-blue-500/20'}`}>
        {saved ? <><Check size={15} /> Saved</> : saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function SecurityTab() {
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async () => {
    if (form.new_password !== form.confirm_password) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (form.new_password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    try {
      setSaving(true);
      await api.post('/auth/change-password/', form);
      setMessage({ type: 'success', text: 'Password updated' });
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch(e) {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Failed to update password' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-primary mb-1">Change Password</h3>
        <p className="text-xs text-muted">Update your password to keep your account secure</p>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2
          ${message.type === 'success' ? 'bg-[#00FF87]/10 border border-[#00FF87]/20 text-[#00FF87]' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {message.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
          {message.text}
        </div>
      )}

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-2">Current Password</label>
        <div className="relative">
          <input type={showCurrent ? 'text' : 'password'}
            value={form.current_password}
            onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
            className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-primary outline-none focus:border-blue-500 transition-colors pr-10" />
          <button onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
            {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-2">New Password</label>
        <div className="relative">
          <input type={showNew ? 'text' : 'password'}
            value={form.new_password}
            onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
            className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-primary outline-none focus:border-blue-500 transition-colors pr-10" />
          <button onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
            {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-2">Confirm New Password</label>
        <input type="password" value={form.confirm_password}
          onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-primary outline-none focus:border-blue-500 transition-colors" />
      </div>

      <button onClick={handleSubmit} disabled={saving || !form.current_password || !form.new_password}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-30">
        {saving ? 'Updating...' : 'Update Password'}
      </button>
    </div>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    workspace_ready: true,
    hours_low: true,
    payment: true,
    session_invite: true,
    announcements: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/auth/notification-preferences/')
      .then(res => setPrefs(res.data))
      .catch(() => {});
  }, []);

  const handleToggle = (key) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/auth/notification-preferences/', prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const items = [
    { key: 'workspace_ready', label: 'Workspace Ready', desc: 'When your virtual machine finishes provisioning' },
    { key: 'hours_low', label: 'Free Hours Running Low', desc: 'When you have less than 1 hour remaining' },
    { key: 'payment', label: 'Payment Confirmed', desc: 'When a payment is successfully processed' },
    { key: 'session_invite', label: 'Session Invitations', desc: 'When you receive a session invite' },
    { key: 'announcements', label: 'System Announcements', desc: 'Platform updates and maintenance notices' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-primary mb-1">Notification Preferences</h3>
        <p className="text-xs text-muted">Choose what you want to be notified about</p>
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.key}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300
              ${prefs[item.key] ? 'bg-[#00FF87]/5 border-[#00FF87]/10' : 'bg-card border-border'}`}>
            <div>
              <p className="text-sm font-medium text-primary">{item.label}</p>
              <p className="text-[11px] text-muted mt-0.5">{item.desc}</p>
            </div>
            <button onClick={() => handleToggle(item.key)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 active:scale-95 ${prefs[item.key] ? 'bg-[#00FF87]' : 'bg-slate-700'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${prefs[item.key] ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      <button onClick={handleSave}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-all
          ${saved ? 'bg-[#00FF87]/10 border border-[#00FF87]/20 text-[#00FF87]' : 'bg-[#0066FF] text-white hover:bg-[#0052CC]'}`}>
        {saved ? <><Check size={15} /> Saved</> : 'Save Preferences'}
      </button>
    </div>
  );
}

function AppearanceTab() {
  const theme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme) || useThemeStore(s => s.toggleTheme);
  
  const applyTheme = (newTheme) => {
    if (setTheme) {
      setTheme(newTheme);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-primary mb-1">Appearance</h3>
        <p className="text-xs text-muted">Customize how CloudDesk looks</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Dark mode card */}
        <button onClick={() => applyTheme('dark')}
          className={`p-5 rounded-2xl border-2 transition-all duration-300 active:scale-[0.97]
            ${theme === 'dark' ? 'border-[#0066FF] bg-[#0066FF]/5' : 'border-border hover:border-slate-600'}`}>
          <div className="bg-canvas rounded-xl p-3 mb-4 border border-border-subtle h-20 flex flex-col justify-center">
            <div className="h-1.5 w-10 bg-slate-700 rounded mb-2" />
            <div className="h-1.5 w-16 bg-slate-800 rounded mb-2" />
            <div className="h-1.5 w-12 bg-slate-800 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-primary text-left">Dark</p>
              <p className="text-[10px] text-muted mt-0.5 text-left">Easier on the eyes</p>
            </div>
            {theme === 'dark' && (
              <div className="w-5 h-5 rounded-full bg-[#0066FF] flex items-center justify-center">
                <Check size={12} color="white" />
              </div>
            )}
          </div>
        </button>

        {/* Light mode card */}
        <button onClick={() => applyTheme('light')}
          className={`p-5 rounded-2xl border-2 transition-all duration-300 active:scale-[0.97]
            ${theme === 'light' ? 'border-[#0066FF] bg-[#0066FF]/5' : 'border-border hover:border-slate-600'}`}>
          <div className="bg-white rounded-xl p-3 mb-4 border border-gray-200 h-20 flex flex-col justify-center">
            <div className="h-1.5 w-10 bg-gray-300 rounded mb-2" />
            <div className="h-1.5 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-1.5 w-12 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-primary text-left">Light</p>
              <p className="text-[10px] text-muted mt-0.5 text-left">Classic bright interface</p>
            </div>
            {theme === 'light' && (
              <div className="w-5 h-5 rounded-full bg-[#0066FF] flex items-center justify-center">
                <Check size={12} color="white" />
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

function DeveloperTab() {
  const [tokenInfo, setTokenInfo] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  useEffect(() => {
    api.get('/auth/api-token/')
      .then(res => setTokenInfo(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    console.log('handleGenerate called');
    try {
      setGenerating(true);
      console.log('Calling API...');
      const res = await api.post('/auth/api-token/generate/');
      console.log('API response:', res.data);
      const data = res.data;
      if (data.key) {
        setNewKey(data.key);
        setTokenInfo({ ...data, exists: true });
      } else if (data.data?.key) {
        // Just in case it's wrapped in data: { key: ... }
        setNewKey(data.data.key);
        setTokenInfo({ ...data.data, exists: true });
      }
    } catch(e) {
      console.error('Full error:', e);
      console.error('Response status:', e.response?.status);
      console.error('Response data:', e.response?.data);
      alert('Failed to generate token: ' + 
        (e.response?.data?.message || e.response?.data?.detail || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    try {
      await api.post('/auth/api-token/revoke/');
      setTokenInfo({ exists: false });
      setNewKey(null);
      setShowRevokeConfirm(false);
    } catch(e) {
      console.error(e);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="text-secondary text-sm">Loading API Info...</div>;

  return (
    <div className="space-y-6">
      
      {/* Info banner */}
      <div className="bg-card rounded-2xl border border-border p-6">
        
        <h2 className="text-base font-bold text-primary mb-1">API Access</h2>
        <p className="text-xs text-muted mb-6">
          Use API tokens to access CloudDesk programmatically. Integrate with your tools, automate workspace provisioning, or build custom workflows.
        </p>
        
        {/* Security warning */}
        <div className="flex gap-3 px-4 py-3 bg-[#FF6B00]/5 border border-[#FF6B00]/15 rounded-xl mb-6">
          <Shield size={16} className="text-[#FF6B00] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#FF6B00]">Security Notice</p>
            <p className="text-[11px] text-secondary mt-0.5">
              Your API token has the same access as your account. Never share it publicly, commit it to code repositories, or expose it in client-side code. Treat it like a password.
            </p>
          </div>
        </div>
        
        {/* New key display */}
        {newKey && (
          <div className="mb-6 p-4 bg-[#00FF87]/5 border border-[#00FF87]/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-[#00FF87]" />
              <p className="text-xs font-bold text-[#00FF87]">Copy your token now — it will not be shown again</p>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <code className="flex-1 bg-sidebar px-4 py-3 rounded-xl text-xs font-mono text-primary border border-border select-all break-all">
                {newKey}
              </code>
              <button onClick={copyKey}
                className={`px-4 py-3 rounded-xl text-xs font-semibold transition-all active:scale-95 flex-shrink-0
                ${copied ? 'bg-[#00FF87]/10 border border-[#00FF87]/20 text-[#00FF87]' : 'bg-[#0066FF] text-primary'}`}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
        
        {/* Token info or generate */}
        {tokenInfo?.exists ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-sidebar rounded-xl p-4 border border-border-subtle">
                <p className="text-[9px] uppercase tracking-widest text-muted font-semibold mb-1">Token</p>
                <p className="text-sm font-mono text-primary">{tokenInfo.prefix}••••••••••••</p>
              </div>
              <div className="bg-sidebar rounded-xl p-4 border border-border-subtle">
                <p className="text-[9px] uppercase tracking-widest text-muted font-semibold mb-1">Created</p>
                <p className="text-sm text-primary">{new Date(tokenInfo.created_at).toLocaleDateString()}</p>
              </div>
              <div className="bg-sidebar rounded-xl p-4 border border-border-subtle">
                <p className="text-[9px] uppercase tracking-widest text-muted font-semibold mb-1">Last Used</p>
                <p className="text-sm text-primary">{tokenInfo.last_used_at ? new Date(tokenInfo.last_used_at).toLocaleDateString() : 'Never'}</p>
              </div>
              <div className="bg-sidebar rounded-xl p-4 border border-border-subtle">
                <p className="text-[9px] uppercase tracking-widest text-muted font-semibold mb-1">Calls Today</p>
                <p className="text-sm text-primary">{tokenInfo.calls_today} <span className="text-muted text-xs"> / 1,000</span></p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => {
                console.log('Generate clicked');
                handleGenerate();
              }} disabled={generating}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00] text-xs font-semibold hover:bg-[#FF6B00]/20 active:scale-95 transition-all">
                <RefreshCw size={13} />
                Regenerate Token
              </button>
              <button onClick={() => setShowRevokeConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 active:scale-95 transition-all">
                <Trash2 size={13} />
                Revoke Token
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed border-border rounded-xl bg-sidebar">
            <Code size={32} className="text-faint mx-auto mb-3" />
            <p className="text-sm text-secondary mb-1">No API token generated</p>
            <p className="text-xs text-muted mb-5 max-w-sm mx-auto">
              Generate a token to access CloudDesk API from scripts, integrations, or custom tools.
            </p>
            <button onClick={() => {
                console.log('Generate clicked');
                handleGenerate();
              }} disabled={generating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
              <Key size={15} />
              {generating ? 'Generating...' : 'Generate API Token'}
            </button>
          </div>
        )}
        
        {/* Usage example */}
        <div className="mt-6 pt-6 border-t border-border-subtle">
          <p className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-3">Usage Example</p>
          <div className="bg-sidebar rounded-xl p-4 border border-border-subtle overflow-x-auto">
            <code className="text-[11px] font-mono text-secondary leading-relaxed whitespace-pre-wrap">
{`curl -X GET \\
  https://clouddesk.io/api/workspaces/ \\
  -H "X-API-Key: sk-cd-your-token-here"`}
            </code>
          </div>
          <p className="text-[10px] text-faint mt-2">Rate limit: 1,000 requests/day</p>
        </div>
      </div>
      
      {/* Revoke confirmation modal */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-primary mb-2">Revoke API Token?</h3>
            <p className="text-xs text-secondary mb-5">
              This immediately invalidates your token. Any scripts or integrations using it will stop working.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRevokeConfirm(false)}
                className="px-4 py-2 rounded-xl bg-nav-hover border border-border-strong text-secondary text-xs font-semibold active:scale-95 transition-all">
                Cancel
              </button>
              <button onClick={handleRevoke}
                className="px-4 py-2 rounded-xl bg-red-500 text-primary text-xs font-semibold active:scale-95 transition-all">
                Revoke Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DangerTab() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const logout = useAuthStore(s => s.logout);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.post('/auth/delete-account/', { password });
      logout();
      navigate('/signin');
    } catch(e) {
      alert(e.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl border-2 border-red-500/20 bg-red-500/5">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-400">Delete Your Account</h3>
            <p className="text-xs text-secondary mt-1 leading-relaxed">
              If you no longer need your CloudDesk account, you can permanently remove it here. All your workspaces, session history, and billing data will be deleted.
            </p>
          </div>
        </div>

        {!confirm ? (
          <button onClick={() => setConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 active:scale-95 transition-all">
            <Trash2 size={14} />
            Request Account Deletion
          </button>
        ) : (
          <div className="mt-4 pt-4 border-t border-red-500/10">
            <p className="text-xs text-secondary mb-3">Enter your password to confirm:</p>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"
              className="w-full bg-sidebar border border-red-500/20 rounded-xl px-4 py-2.5 text-sm text-primary outline-none mb-3 focus:border-red-500/50" />
            <div className="flex gap-3">
              <button onClick={() => { setConfirm(false); setPassword(''); }}
                className="px-4 py-2.5 rounded-xl bg-nav-hover border border-border-strong text-secondary text-xs font-semibold active:scale-95 transition-all">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={!password || deleting}
                className="px-4 py-2.5 rounded-xl bg-red-500 text-primary text-xs font-bold active:scale-95 transition-all disabled:opacity-30">
                {deleting ? 'Deleting...' : 'Request Account Deletion'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
