import { useState, useRef, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import { useNotificationContext } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

const formatTimeAgo = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  const toggleNotifications = () => setIsOpen(!isOpen);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={toggleNotifications}
        className="relative p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors active:scale-95"
      >
        <Bell size={16} 
          className={`text-slate-400 hover:text-slate-200 transition-colors ${unreadCount > 0 ? 'bell-wiggle' : ''}`} 
        />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[#FF3366] text-[9px] font-bold text-white px-1 shadow-lg shadow-red-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-[#0F131A] rounded-2xl shadow-2xl shadow-black/50 border border-slate-800/50 overflow-hidden z-50">
          <div className="flex items-center justify-between p-4 border-b border-slate-800/50 bg-[#0F131A]">
            <h3 className="font-semibold text-slate-100 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[11px] font-medium text-[#0066FF] hover:text-[#0052CC] flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto no-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {notifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 hover:bg-slate-800/30 cursor-pointer transition-colors flex gap-3
                      ${!notif.is_read ? 'border-l-2 border-[#0066FF] bg-[#0066FF]/5' : 'border-l-2 border-transparent'}`}
                  >
                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      notif.notification_type === 'workspace_ready' ? 'bg-[#00FF87]'
                      : notif.notification_type === 'session_invite' ? 'bg-[#00A3FF]'
                      : notif.notification_type === 'payment_confirmed' ? 'bg-[#6C63FF]'
                      : notif.notification_type === 'workspace_stopped' ? 'bg-[#FF6B00]'
                      : 'bg-slate-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <p className={`text-sm ${!notif.is_read ? 'text-white font-medium' : 'text-slate-300'}`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-500 ml-2 whitespace-nowrap shrink-0">
                          {formatTimeAgo(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-slate-800/50 bg-[#0F131A] text-center">
            <button 
              onClick={() => { setIsOpen(false); navigate('/notifications'); }}
              className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
