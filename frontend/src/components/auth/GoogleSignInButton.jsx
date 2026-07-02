import { useGoogleLogin } from '@react-oauth/google'
import { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

export default function GoogleSignInButton({ onSuccess, onError, text = 'Continue with Google' }) {
  
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      try {
        const userInfoRes = await axios.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        )
        
        const res = await axios.post(
          'http://localhost:8000/api/auth/google/',
          { 
            access_token: tokenResponse.access_token,
            user_info: userInfoRes.data
          }
        )
        
        if (res.data.success) {
          const { user, access, refresh } = res.data.data
          login(user, access, refresh)
          
          if (onSuccess) {
            onSuccess(res.data.data)
          } else {
            if (user.role === 'admin') {
              navigate('/admin/dashboard')
            } else if (user.role === 'instructor') {
              navigate('/instructor/dashboard')
            } else {
              navigate('/member/dashboard')
            }
          }
        }
      } catch (err) {
        console.error('Google auth error:', err)
        if (onError) {
          onError(err)
        }
      } finally {
        setLoading(false)
      }
    },
    onError: (err) => {
      console.error('Google login failed:', err)
      if (onError) onError(err)
    }
  })

  return (
    <button
      type="button"
      onClick={() => handleGoogleLogin()}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 rounded-xl text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
      
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <svg className="w-5 h-5 flex-shrink-0" style={{ width: '20px', height: '20px', minWidth: '20px' }} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      
      <span>{loading ? 'Signing in...' : text}</span>
    </button>
  )
}
