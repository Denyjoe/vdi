import { useState, useEffect, useRef } from 'react';
import { 
  X, Bell, Check, CheckCheck, 
  Monitor, Clock, CreditCard, 
  Users, Megaphone, Zap
} from 'lucide-react';
import api from '../../services/api';

export default function NotificationsDrawer({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const drawerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications/');
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || res.data?.data || [];
      setNotifications(data);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch(e) {
      console.error(e);
    }
  };

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read/`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch(e) {
      console.error(e);
    }
  };

  const getIcon = (type) => {
    const icons = {
      workspace_ready: { icon: Monitor, color: '#00FF87', bg: '#00FF8715' },
      hours_low: { icon: Clock, color: '#FF6B00', bg: '#FF6B0015' },
      payment_confirmed: { icon: CreditCard, color: '#6C63FF', bg: '#6C63FF15' },
      session_invite: { icon: Users, color: '#00A3FF', bg: '#00A3FF15' },
      workspace_stopped: { icon: Zap, color: '#FF3366', bg: '#FF336615' },
      system: { icon: Megaphone, color: '#64748B', bg: '#64748B15' },
    };
    return icons[type] || icons.system;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filtered = notifications.filter(n => filter === 'all' ? true : !n.is_read);

  if (!isOpen) return null;

  return (
    <>
      {/* Subtle backdrop */}
      <div 
        className="fixed inset-0 z-[58] bg-black/40"
        onClick={onClose}
      />
      
      {/* Drawer — slides from right */}
      <div 
        ref={drawerRef}
        className="fixed top-0 right-0 bottom-0 z-[59] w-[380px] flex flex-col"
        style={{
          background: 'rgba(10, 14, 20, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
        
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#0066FF]/15 flex items-center justify-center">
              <Bell size={16} className="text-[#0066FF]" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white tracking-tight">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <p className="text-[10px] text-slate-500">
                  {unreadCount} unread
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all">
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white active:scale-95 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>
        
        {/* Filter tabs */}
        <div className="px-5 py-3 flex gap-2 border-b border-white/[0.06] flex-shrink-0">
          {['all', 'unread'].map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 active:scale-95 ${
                filter === f
                  ? 'bg-[#0066FF]/15 text-[#0066FF]'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 bg-[#0066FF]/20 text-[#0066FF] px-1.5 py-0.5 rounded-full text-[9px]">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        
        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-slate-700 border-t-[#0066FF] rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                <Bell size={24} className="text-slate-600" />
              </div>
              <p className="text-[13px] font-semibold text-slate-300">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
              <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed max-w-[220px]">
                {filter === 'unread'
                  ? 'You are all caught up'
                  : 'Activity will appear here as you use CloudDesk'}
              </p>
            </div>
          ) : (
            /* Group by date */
            <div>
              {groupByDate(filtered).map(({ date, items }) => (
                <div key={date}>
                  {/* Date header */}
                  <div className="px-5 py-2 sticky top-0 bg-[#0A0E14]/80 backdrop-blur-sm z-10">
                    <p className="text-[9px] uppercase tracking-[2px] text-slate-600 font-semibold">
                      {date}
                    </p>
                  </div>
                  
                  {/* Notification items */}
                  {items.map(notif => {
                    const { icon: Icon, color, bg } = getIcon(notif.notification_type || notif.type);
                    return (
                      <div key={notif.id}
                        onClick={() => {
                          if (!notif.is_read) markRead(notif.id);
                        }}
                        className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-all duration-200 group border-b border-white/[0.03] ${
                          !notif.is_read
                            ? 'bg-[#0066FF]/[0.03] hover:bg-[#0066FF]/[0.06]'
                            : 'hover:bg-white/[0.02]'
                        }`}>
                        
                        {/* Icon */}
                        <div className="relative flex-shrink-0 mt-0.5">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                            <Icon size={16} style={{ color }} />
                          </div>
                          {!notif.is_read && (
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#0066FF] border-2 border-[#0A0E14]" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] leading-tight ${
                            !notif.is_read ? 'text-white font-semibold' : 'text-slate-300 font-medium'
                          }`}>
                            {notif.title}
                          </p>
                          {notif.message && (
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                              {notif.message}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-600 mt-1.5">
                            {formatTime(notif.created_at)}
                          </p>
                        </div>
                        
                        {/* Read indicator */}
                        {!notif.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markRead(notif.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-all flex-shrink-0">
                            <Check size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] flex-shrink-0">
          <p className="text-[10px] text-slate-600 text-center">
            Notifications clear after 30 days
          </p>
        </div>
        
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.06);
            border-radius: 3px;
          }
        `}</style>
      </div>
    </>
  );
}

// Helper: group notifications by date
function groupByDate(notifications) {
  const groups = {};
  const now = new Date();
  
  notifications.forEach(n => {
    const date = new Date(n.created_at);
    const diff = now - date;
    const days = Math.floor(diff / 86400000);
    
    let label;
    if (days === 0) label = 'Today';
    else if (days === 1) label = 'Yesterday';
    else if (days < 7) label = date.toLocaleDateString('en-US', { weekday: 'long' });
    else label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  });
  
  return Object.entries(groups).map(([date, items]) => ({ date, items }));
}
