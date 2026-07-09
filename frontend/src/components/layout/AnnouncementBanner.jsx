import React, { useState, useEffect } from 'react';
import { Megaphone, X } from 'lucide-react';
import api from '../../services/api';

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState('');
  const [dismissed, setDismissed] = useState(
    sessionStorage.getItem('announcement_dismissed') === 'true'
  );
  
  useEffect(() => {
    api.get('/config/announcement/')
      .then(res => setAnnouncement(res.data.announcement || ''))
      .catch(() => {});
  }, []);
  
  if (!announcement || dismissed) return null;
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 20px',
      background: 'var(--accent-primary-soft)',
      borderBottom: '1px solid var(--accent-primary)',
    }}>
      <Megaphone size={14} style={{ color: 'var(--accent-primary)' }} />
      <span style={{
        fontSize: '13px',
        color: 'var(--text-primary)',
        flex: 1,
      }}>{announcement}</span>
      <button onClick={() => {
        sessionStorage.setItem('announcement_dismissed', 'true');
        setDismissed(true);
      }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}>
        <X size={14} />
      </button>
    </div>
  );
}
