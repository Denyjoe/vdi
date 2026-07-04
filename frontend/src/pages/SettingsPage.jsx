import { useState } from 'react'
import { User, Lock, Trash2, Globe, Shield, CreditCard, ChevronRight, Zap } from 'lucide-react'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import api from '../services/api'
import { toast } from 'react-hot-toast'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { openUpgradeModal } = useUIStore()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    currentPassword: '',
    newPassword: '',
  })

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.patch('/auth/profile/', {
        first_name: formData.firstName,
        last_name: formData.lastName,
      })
      toast.success('Profile updated successfully')
    } catch(err) {
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Endpoint depends on implementation
      await api.post('/auth/password/change/', {
        current_password: formData.currentPassword,
        new_password: formData.newPassword,
      })
      toast.success('Password changed successfully')
      setFormData({...formData, currentPassword: '', newPassword: ''})
    } catch(err) {
      toast.error('Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      padding: '32px',
      maxWidth: '1000px',
      margin: '0 auto',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{marginBottom: '32px'}}>
        <h1 style={{color: 'white', fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0'}}>
          Settings
        </h1>
        <p style={{color: '#94a3b8', fontSize: '15px', margin: 0}}>
          Manage your account preferences and subscription
        </p>
      </div>

      <div style={{display: 'grid', gap: '24px'}}>
        
        {/* ACCOUNT SETTINGS */}
        <section style={{
          background: '#0d1526',
          border: '1px solid #1e293b',
          borderRadius: '20px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px',
              borderRadius: '10px',
              background: 'rgba(99,102,241,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <User size={20} color="#818cf8" />
            </div>
            <div>
              <h2 style={{color: 'white', fontSize: '18px', fontWeight: 600, margin: 0}}>
                Account Settings
              </h2>
              <p style={{color: '#64748b', fontSize: '13px', margin: '2px 0 0'}}>
                Update your personal information
              </p>
            </div>
          </div>
          
          <div style={{padding: '24px'}}>
            <form onSubmit={handleProfileUpdate} style={{display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px'}}>
              <div>
                <label style={{color: '#94a3b8', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px'}}>Email Address (Read Only)</label>
                <input 
                  type="email" 
                  value={user?.email || ''} 
                  disabled
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid #1e293b',
                    color: '#64748b', fontSize: '14px', cursor: 'not-allowed'
                  }}
                />
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div>
                  <label style={{color: '#94a3b8', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px'}}>First Name</label>
                  <input 
                    type="text" 
                    value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid #1e293b',
                      color: 'white', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{color: '#94a3b8', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px'}}>Last Name</label>
                  <input 
                    type="text" 
                    value={formData.lastName}
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid #1e293b',
                      color: 'white', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>
              </div>
              <button 
                type="submit"
                disabled={loading}
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 24px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}>
                Save Changes
              </button>
            </form>
          </div>
        </section>

        {/* SECURITY & PASSWORD */}
        <section style={{
          background: '#0d1526', border: '1px solid #1e293b', borderRadius: '20px', overflow: 'hidden'
        }}>
          <div style={{
            padding: '24px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Lock size={20} color="#34d399" />
            </div>
            <div>
              <h2 style={{color: 'white', fontSize: '18px', fontWeight: 600, margin: 0}}>Security</h2>
              <p style={{color: '#64748b', fontSize: '13px', margin: '2px 0 0'}}>Update your password and secure your account</p>
            </div>
          </div>
          
          <div style={{padding: '24px'}}>
            <form onSubmit={handlePasswordUpdate} style={{display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px'}}>
              <div>
                <label style={{color: '#94a3b8', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px'}}>Current Password</label>
                <input 
                  type="password" 
                  value={formData.currentPassword}
                  onChange={e => setFormData({...formData, currentPassword: e.target.value})}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid #1e293b',
                    color: 'white', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{color: '#94a3b8', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px'}}>New Password</label>
                <input 
                  type="password" 
                  value={formData.newPassword}
                  onChange={e => setFormData({...formData, newPassword: e.target.value})}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid #1e293b',
                    color: 'white', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>
              <button 
                type="submit"
                disabled={loading || !formData.currentPassword || !formData.newPassword}
                style={{
                  alignSelf: 'flex-start', padding: '10px 24px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b',
                  color: 'white', fontWeight: 600, fontSize: '14px',
                  cursor: (loading || !formData.currentPassword || !formData.newPassword) ? 'not-allowed' : 'pointer'
                }}>
                Update Password
              </button>
            </form>
          </div>
        </section>

        {/* SUBSCRIPTION */}
        {user?.role !== 'admin' && (
        <section style={{
          background: '#0d1526', border: '1px solid #1e293b', borderRadius: '20px', overflow: 'hidden'
        }}>
          <div style={{
            padding: '24px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <CreditCard size={20} color="#fbbf24" />
            </div>
            <div>
              <h2 style={{color: 'white', fontSize: '18px', fontWeight: 600, margin: 0}}>Subscription</h2>
              <p style={{color: '#64748b', fontSize: '13px', margin: '2px 0 0'}}>Manage your billing and plan</p>
            </div>
          </div>
          
          <div style={{padding: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '24px'}}>
            <div>
              <p style={{color: '#94a3b8', fontSize: '14px', marginBottom: '8px'}}>Current Plan</p>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <span style={{
                  color: 'white', fontSize: '24px', fontWeight: 700, textTransform: 'capitalize'
                }}>
                  {user?.subscription?.plan_name?.replace('_', ' ') || 'Free Plan'}
                </span>
                {user?.is_host && (
                  <span style={{
                    padding: '4px 10px', borderRadius: '20px', background: 'rgba(99,102,241,0.15)',
                    color: '#818cf8', fontSize: '12px', fontWeight: 600
                  }}>
                    Host Enabled
                  </span>
                )}
              </div>
              <p style={{color: '#64748b', fontSize: '13px', marginTop: '12px'}}>
                {user?.is_host 
                  ? `You can host sessions with up to ${user.subscription?.max_participants || 50} participants.` 
                  : 'You are on the free tier. Upgrade to host your own sessions.'}
              </p>
            </div>

            <div>
              {!user?.is_host ? (
                <button 
                  onClick={openUpgradeModal}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                    borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: 'white', fontWeight: 600, fontSize: '15px', border: 'none',
                    cursor: 'pointer', boxShadow: '0 4px 15px rgba(99,102,241,0.3)'
                  }}>
                  <Zap size={18} />
                  Upgrade to Host
                </button>
              ) : (
                <button 
                  style={{
                    padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid #1e293b', color: 'white', fontWeight: 600, fontSize: '14px',
                    cursor: 'pointer'
                  }}>
                  Manage Billing
                </button>
              )}
              {user?.is_host && (
                <p style={{
                  color: '#ef4444', fontSize: '13px', textAlign: 'center', marginTop: '12px', cursor: 'pointer'
                }}>
                  Cancel Subscription
                </p>
              )}
            </div>
          </div>
        </section>
        )}

        {/* PREFERENCES */}
        <section style={{
          background: '#0d1526', border: '1px solid #1e293b', borderRadius: '20px', overflow: 'hidden'
        }}>
          <div style={{
            padding: '24px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(6,182,212,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Globe size={20} color="#06b6d4" />
            </div>
            <div>
              <h2 style={{color: 'white', fontSize: '18px', fontWeight: 600, margin: 0}}>Preferences</h2>
              <p style={{color: '#64748b', fontSize: '13px', margin: '2px 0 0'}}>Region and language settings</p>
            </div>
          </div>
          
          <div style={{padding: '24px'}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px'}}>
              <div>
                <label style={{color: '#94a3b8', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px'}}>Language</label>
                <select 
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid #1e293b',
                    color: 'white', fontSize: '14px', outline: 'none', appearance: 'none'
                  }}>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label style={{color: '#94a3b8', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px'}}>Timezone</label>
                <select 
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid #1e293b',
                    color: 'white', fontSize: '14px', outline: 'none', appearance: 'none'
                  }}>
                  <option value="EAT">East Africa Time (EAT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* DANGER ZONE */}
        <section style={{
          background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '20px', padding: '24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px'
        }}>
          <div>
            <h2 style={{color: '#f87171', fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0'}}>Delete Account</h2>
            <p style={{color: '#fca5a5', fontSize: '13px', margin: 0}}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
          <button style={{
            padding: '12px 24px', borderRadius: '10px', background: '#ef4444', color: 'white',
            fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <Trash2 size={16} />
            Delete Account
          </button>
        </section>

      </div>
    </div>
  )
}
