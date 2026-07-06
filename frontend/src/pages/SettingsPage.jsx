import { useState, useEffect, useRef } from 'react'
import { User, Lock, Trash2, Globe, Shield, CreditCard, Camera, Activity, Save } from 'lucide-react'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import api from '../services/api'
import { toast } from 'react-hot-toast'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const { openUpgradeModal } = useUIStore()
  
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const fileInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    bio: user?.bio || '',
    country: user?.country || 'Tanzania',
    timezone_preference: user?.timezone_preference || 'Africa/Dar_es_Salaam'
  })
  
  const [passData, setPassData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [avatarPreview, setAvatarPreview] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.patch('/auth/me/update/', formData)
      setUser({ ...user, ...formData })
      toast.success('Profile updated successfully')
    } catch(err) {
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    if (passData.newPassword !== passData.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/me/change-password/', {
        old_password: passData.currentPassword,
        new_password: passData.newPassword,
      })
      toast.success('Password changed successfully')
      setPassData({currentPassword: '', newPassword: '', confirmPassword: ''})
    } catch(err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size cannot exceed 2MB')
      return
    }
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result)
    reader.readAsDataURL(file)
  }
  
  const saveAvatar = async () => {
    if (!selectedFile) return
    try {
      const fd = new FormData()
      fd.append('avatar', selectedFile)
      const res = await api.post('/auth/me/avatar/upload/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setUser({ ...user, avatar: res.data.data.avatar })
      toast.success('Avatar updated')
      setSelectedFile(null)
    } catch (err) {
      toast.error('Failed to update avatar')
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto text-[var(--text-primary)]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
        <p className="text-[var(--text-secondary)]">Manage your profile, preferences, and subscription.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('profile')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'profile' ? 'bg-indigo-500/10 text-indigo-400' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
          >
            <User size={18} /> Profile
          </button>
          <button 
            onClick={() => setActiveTab('security')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'security' ? 'bg-indigo-500/10 text-indigo-400' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
          >
            <Lock size={18} /> Security
          </button>
          <button 
            onClick={() => setActiveTab('subscription')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'subscription' ? 'bg-indigo-500/10 text-indigo-400' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
          >
            <CreditCard size={18} /> Subscription
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          
          {activeTab === 'profile' && (
            <>
              {/* Avatar Section */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500/30 bg-[#050B18]">
                    {avatarPreview || user?.avatar ? (
                      <img src={avatarPreview || user?.avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-indigo-400">
                        {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-indigo-500 transition-colors"
                  >
                    <Camera size={14} />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-1">{user?.first_name} {user?.last_name}</h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">{user?.email}</p>
                  {selectedFile && (
                    <button onClick={saveAvatar} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors">
                      Save Avatar
                    </button>
                  )}
                </div>
              </div>

              {/* Profile Details Form */}
              <form onSubmit={handleProfileUpdate} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2"><User size={20} className="text-indigo-400" /> Personal Information</h3>
                
                <div className="grid sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">First Name</label>
                    <input 
                      type="text" 
                      value={formData.first_name}
                      onChange={e => setFormData({...formData, first_name: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white/5 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Last Name</label>
                    <input 
                      type="text" 
                      value={formData.last_name}
                      onChange={e => setFormData({...formData, last_name: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white/5 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Bio</label>
                  <textarea 
                    value={formData.bio}
                    onChange={e => setFormData({...formData, bio: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white/5 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Country</label>
                    <input 
                      type="text" 
                      value={formData.country}
                      onChange={e => setFormData({...formData, country: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white/5 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Timezone</label>
                    <select 
                      value={formData.timezone_preference}
                      onChange={e => setFormData({...formData, timezone_preference: e.target.value})}
                      className="w-full px-4 py-2.5 bg-[#0D1526] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="Africa/Dar_es_Salaam">Africa/Dar_es_Salaam</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" disabled={loading} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2">
                    <Save size={16} /> {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </>
          )}

          {activeTab === 'security' && (
            <>
              {/* Password Change Form */}
              <form onSubmit={handlePasswordUpdate} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2"><Shield size={20} className="text-emerald-400" /> Change Password</h3>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Current Password</label>
                    <input 
                      type="password" 
                      value={passData.currentPassword}
                      onChange={e => setPassData({...passData, currentPassword: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white/5 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-emerald-500/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">New Password</label>
                    <input 
                      type="password" 
                      value={passData.newPassword}
                      onChange={e => setPassData({...passData, newPassword: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white/5 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-emerald-500/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={passData.confirmPassword}
                      onChange={e => setPassData({...passData, confirmPassword: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white/5 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-emerald-500/50"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" disabled={loading} className="px-6 py-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-medium hover:bg-emerald-600/30 transition-colors flex items-center gap-2">
                    <Lock size={16} /> {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </>
          )}

          {activeTab === 'subscription' && (
            <>
              {/* Subscription Details */}
              <div className="bg-gradient-to-br from-indigo-900/40 to-cyan-900/20 border border-indigo-500/30 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Globe size={120} />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-white mb-2">Current Plan</h3>
                  <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-500 text-white font-semibold text-sm mb-6 capitalize">
                    {user?.subscription?.plan_name?.replace('_', ' ') || 'Free Plan'}
                  </div>
                  
                  <div className="grid sm:grid-cols-3 gap-6 mb-8">
                    <div className="bg-black/20 rounded-xl p-4">
                      <p className="text-sm text-indigo-200 mb-1">Compute Hours</p>
                      <p className="text-2xl font-bold text-white">{user?.subscription?.compute_hours_used || 0} / {user?.subscription?.compute_hours_per_month === -1 ? '∞' : user?.subscription?.compute_hours_per_month}</p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4">
                      <p className="text-sm text-indigo-200 mb-1">Status</p>
                      <p className="text-2xl font-bold text-emerald-400 capitalize">{user?.subscription?.status || 'Active'}</p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4">
                      <p className="text-sm text-indigo-200 mb-1">Billing Cycle</p>
                      <p className="text-2xl font-bold text-white">Monthly</p>
                    </div>
                  </div>

                  <button onClick={openUpgradeModal} className="px-6 py-3 bg-white text-indigo-900 rounded-xl font-semibold hover:bg-indigo-50 transition-colors shadow-lg">
                    Upgrade Plan
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
