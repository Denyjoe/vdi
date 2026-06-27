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
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-blue-500" />
            Notifications
          </h1>
          <p className="text-slate-400 mt-2 text-lg">Stay updated with your latest alerts and activities</p>
        </div>
        
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700 hover:border-slate-600 shadow-lg shadow-slate-900/20"
          >
            <Check className="w-5 h-5" />
            <span>Mark all read</span>
            <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
              {unreadCount}
            </span>
          </button>
        )}
      </div>

      <div className="bg-navy-800 border border-navy-700 rounded-2xl shadow-xl overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700/50">
              <Bell className="w-10 h-10 text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">You're all caught up!</h3>
            <p className="text-slate-400 max-w-sm mx-auto">You don't have any notifications at the moment. We'll let you know when something new happens.</p>
          </div>
        ) : (
          <div className="divide-y divide-navy-700/50">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                className={`p-6 transition-all sm:flex sm:items-start gap-4 ${!notif.is_read ? 'bg-blue-500/5' : 'hover:bg-slate-800/30'}`}
              >
                <div className="hidden sm:block mt-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                    !notif.is_read ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    <Bell className="w-5 h-5" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                    <h4 className={`text-lg ${!notif.is_read ? 'text-white font-semibold' : 'text-slate-300 font-medium'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-xs text-slate-500 whitespace-nowrap bg-slate-900/50 px-2.5 py-1 rounded-md border border-slate-800 inline-block w-fit">
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <p className={`mb-4 ${!notif.is_read ? 'text-slate-300' : 'text-slate-400'}`}>
                    {notif.message}
                  </p>
                  
                  <div className="flex items-center gap-3">
                    {notif.action_url && (
                      <button
                        onClick={() => handleNotificationClick(notif)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 text-sm font-medium rounded-lg transition-colors border border-blue-500/20"
                      >
                        View Details
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                    
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
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
