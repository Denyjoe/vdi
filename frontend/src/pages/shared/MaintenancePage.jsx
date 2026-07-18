import React from 'react';
import { Settings } from 'lucide-react';

export default function MaintenancePage() {
  const theme = 'dark';

  return (
    <div className={`min-h-screen flex items-center justify-center bg-background ${theme}`} style={{ background: 'var(--bg-background)' }}>
      <div className="max-w-md w-full p-8 text-center" style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <div className="mx-auto w-16 h-16 mb-6 flex items-center justify-center rounded-full" style={{ background: 'var(--accent-primary-soft)' }}>
          <Settings size={32} style={{ color: 'var(--accent-primary)', animation: 'spin 4s linear infinite' }} />
        </div>
        
        <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          System Maintenance
        </h1>
        
        <p className="mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          CloudDesk is currently undergoing scheduled maintenance to improve our services.
          We will be back online shortly. Thank you for your patience!
        </p>
        
        <button 
          onClick={() => window.location.href = '/signin'}
          className="w-full py-3 rounded-xl font-semibold transition-colors"
          style={{ background: 'var(--accent-primary)', color: '#fff' }}
        >
          Check Status
        </button>
      </div>
    </div>
  );
}
