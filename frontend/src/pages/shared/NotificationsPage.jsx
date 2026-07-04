import { useNotificationContext } from '../../context/NotificationContext';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationContext();
  const navigate = useNavigate();

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-indigo-500" />
            Notifications
          </h1>
          <p className="text-[var(--text-secondary)] mt-2 text-lg">Stay updated with your latest alerts and activities</p>
        </div>
        
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] rounded-xl transition-all border border-[var(--border-color)] hover:border-slate-600 shadow-lg shadow-slate-900/20"
          >
            <Check className="w-5 h-5" />
            <span>Mark all read</span>
            <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
              {unreadCount}
            </span>
          </button>
        )}
      </div>

      <div className="bg-navy-800 border border-navy-700 rounded-2xl shadow-xl overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-[var(--bg-card)]/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-[var(--border-color)]/50">
              <Bell className="w-10 h-10 text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">You're all caught up!</h3>
            <p className="text-[var(--text-secondary)] max-w-sm mx-auto">You don't have any notifications at the moment. We'll let you know when something new happens.</p>
          </div>
        ) : (
          <div className="divide-y divide-navy-700/50">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                className={`p-6 transition-all sm:flex sm:items-start gap-4 ${!notif.is_read ? 'bg-indigo-500/5' : 'hover:bg-[var(--bg-card)]/30'}`}
              >
                <div className="hidden sm:block mt-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                    !notif.is_read ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)]'
                  }`}>
                    <Bell className="w-5 h-5" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                    <h4 className={`text-lg ${!notif.is_read ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-primary)] font-medium'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-xs text-slate-500 whitespace-nowrap bg-[var(--bg-primary)]/50 px-2.5 py-1 rounded-md border border-[var(--border-color)] inline-block w-fit">
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <p className={`mb-4 ${!notif.is_read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {notif.message}
                  </p>
                  
                  <div className="flex items-center gap-3">
                    {notif.action_url && (
                      <button
                        onClick={() => handleNotificationClick(notif)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 text-sm font-medium rounded-lg transition-colors border border-indigo-500/20"
                      >
                        View Details
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                    
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
