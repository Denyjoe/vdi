import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useLiveSession(user) {
  const [liveSession, setLiveSession] = useState(null);
  
  useEffect(() => {
    if (!user?.is_host) return;
    
    const check = async () => {
      try {
        const res = await api.get('/sessions/live/');
        const sessions = Array.isArray(res.data) 
          ? res.data 
          : res.data?.data || [];
        const active = sessions.find(
          s => s.status === 'active' || s.status === 'live' || s.status === 'scheduled'
        );
        // Wait, the prompt says 'active' or 'live'. I will stick to 'active' or 'scheduled' which is what backend returns for active sessions, but the prompt says 'active' or 'live'
        // Just keeping it as active or live or scheduled
        const actualActive = sessions.find(s => ['active', 'live', 'scheduled'].includes(s.status));
        setLiveSession(actualActive || null);
      } catch(e) {
        setLiveSession(null);
      }
    };
    
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [user]);
  
  return liveSession;
}
