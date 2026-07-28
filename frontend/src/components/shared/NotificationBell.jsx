import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import useUIStore from '../../store/uiStore';
import api from '../../services/api';

export default function NotificationBell() {
  const { openNotifications } = useUIStore();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await api.get('/notifications/unread-count/');
        setUnreadCount(res.data?.count || 0);
      } catch(e) {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button 
      onClick={openNotifications}
      className="relative p-1.5 rounded-lg hover:bg-nav-hover active:scale-95 transition-all"
    >
      <Bell size={16} 
        className={`transition-colors ${unreadCount > 0 ? 'text-[var(--text-primary)] bell-wiggle' : 'text-secondary'}`} 
      />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1 shadow-lg shadow-red-500/30">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
