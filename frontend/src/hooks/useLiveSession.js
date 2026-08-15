import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useLiveSession(user) {
  const [liveSession, setLiveSession] = useState(null);
  
  useEffect(() => {
    if (!user) return;

    const check = async () => {
      try {
        const res = await api.get('/sessions/live/');
        const data = res.data?.data || res.data;
        const sessions = Array.isArray(data) 
          ? data 
          : (data?.my_hosted || []);
        
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
