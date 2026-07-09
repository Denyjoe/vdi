import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'

const GOOGLE_CLIENT_ID = '219072862206-699323t6jpvet4f81rcs9vevthi9vo4r.apps.googleusercontent.com'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            fontFamily: 'Inter, sans-serif',
          },
          success: { iconTheme: { primary: 'var(--status-online)', secondary: 'var(--bg-elevated)' } },
          error: { iconTheme: { primary: 'var(--status-error)', secondary: 'var(--bg-elevated)' } },
        }}
      />
    </GoogleOAuthProvider>
  </StrictMode>,
)
