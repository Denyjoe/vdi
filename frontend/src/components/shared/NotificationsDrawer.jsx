import { useState, useEffect, useRef } from 'react';
import {
 X, Bell, Check, CheckCheck,
 Monitor, Clock, CreditCard,
 Users, Megaphone, Zap,
 AlertTriangle, MessageSquare
} from 'lucide-react';
import api from '../../services/api';
import useThemeStore from '../../store/themeStore';

export default function NotificationsDrawer({ isOpen, onClose }) {
 const [notifications, setNotifications] = useState([]);
 const [loading, setLoading] = useState(false);
 const [filter, setFilter] = useState('all');
 const theme = useThemeStore(s => s.theme);
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
 const isLight = theme === 'light';
 const icons = {
 workspace_ready: { icon: Monitor, color: isLight ? '#15803D' : '#00FF87', bg: isLight ? '#DCFCE7' : '#00FF8715' },
 hours_balance_low: { icon: Clock, color: '#FF6B00', bg: '#FF6B0015' },
 payment_confirmed: { icon: CreditCard, color: '#6C63FF', bg: '#6C63FF15' },
 session_invite: { icon: Users, color: '#00A3FF', bg: '#00A3FF15' },
 workspace_stopped: { icon: Zap, color: isLight ? '#B91C1C' : '#FF3366', bg: isLight ? '#FEE2E2' : '#FF336615' },
 workspace_idle: { icon: AlertTriangle, color: '#F59E0B', bg: '#F59E0B15' },
 direct_message: { icon: MessageSquare, color: '#00A3FF', bg: '#00A3FF15' },
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
 background: theme === 'light' ? 'rgba(248, 250, 252, 0.98)' : 'rgba(8, 11, 16, 0.98)',
 backdropFilter: 'blur(20px)',
 WebkitBackdropFilter: 'blur(20px)',
 borderLeft: theme === 'light' ? '1px solid #E2E8F0' : '1px solid #1E293B',
 boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
 animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
 }}>
 
 {/* Header */}
 <div className="px-5 py-4 flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] flex-shrink-0">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-[#0066FF]/15 flex items-center justify-center">
 <Bell size={16} className="text-[#0066FF]" />
 </div>
 <div>
 <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-white tracking-tight">
 Notifications
 </h2>
 {unreadCount > 0 && (
 <p className="text-[10px] text-[#475569] dark:text-slate-300 ">
 {unreadCount} unread
 </p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2">
 {unreadCount > 0 && (
 <button onClick={markAllRead}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#334155] dark:text-slate-200 hover:text-[#0F172A] dark:hover:text-white dark:text-white hover:bg-white/5 active:scale-95 transition-all">
 <CheckCheck size={13} />
 Mark all read
 </button>
 )}
 <button onClick={onClose}
 className="p-1.5 rounded-lg hover:bg-white/5 text-[#334155] dark:text-slate-200 hover:text-[#0F172A] dark:hover:text-white dark:text-white active:scale-95 transition-all">
 <X size={16} />
 </button>
 </div>
 </div>
 
 {/* Filter tabs */}
 <div className="px-5 py-3 flex gap-2 border-b flex-shrink-0" style={{ borderColor: theme === 'light' ? '#E2E8F0' : '#1E293B' }}>
 {['all', 'unread'].map(f => (
 <button key={f}
 onClick={() => setFilter(f)}
 style={{
 color: undefined
 }}
 className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 active:scale-95 ${
 filter === f
 ? (theme === 'light' ? 'bg-[#2563EB] text-[#FFFFFF]' : 'bg-[#0066FF]/15 text-[#0066FF]')
 : (theme === 'light' ? 'text-[#475569] dark:text-slate-300 hover:bg-[#E2E8F0]' : 'hover:text-primary hover:bg-[var(--bg-nav-hover)]')
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
 <div className="w-6 h-6 border-2 border-[var(--border-color)] border-t-[#0066FF] rounded-full animate-spin" />
 </div>
 ) : filtered.length === 0 ? (
 /* Empty state */
 <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
 <div style={{ background: 'var(--bg-canvas)', borderColor: theme === 'light' ? '#E2E8F0' : '#1E293B' }} className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-4">
 <Bell size={24} className="text-[#64748B] dark:text-slate-400 " />
 </div>
 <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white ">
 {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
 </p>
 <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1.5 leading-relaxed max-w-[220px]">
 {filter === 'unread'
 ? 'You are all caught up'
 : 'Activity will appear here as you use Ospace'}
 </p>
 </div>
 ) : (
 /* Group by date */
 <div>
 {groupByDate(filtered).map(({ date, items }) => (
 <div key={date}>
 {/* Date header */}
 <div className="px-5 py-2 sticky top-0 bg-[#F1F5F9] dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#1E293B] backdrop-blur-sm z-10">
 <p style={{ fontWeight: 600, letterSpacing: '2px' }} className="text-[9px] uppercase text-[#64748B] dark:text-slate-400">
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
 className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-all duration-200 group border-b border-[#E2E8F0] dark:border-[#1E293B] hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!notif.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10 ' : 'bg-white dark:bg-transparent '}`}>
 
 {/* Icon */}
 <div className="relative flex-shrink-0 mt-0.5">
 <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: bg }}>
 <Icon size={16} style={{ color }} />
 </div>
 {!notif.is_read && (
 <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#2563EB] border-2 border-[#FFFFFF]" />
 )}
 </div>
 
 {/* Content */}
 <div className="flex-1 min-w-0">
 <p className={`text-[13px] leading-tight ${
 !notif.is_read ? 'font-semibold text-[#0F172A] dark:text-white ' : 'font-medium text-[#334155] dark:text-slate-200'
 }`}>
 {notif.title}
 </p>
 {notif.message && (
 <p className="text-[11px] text-[#475569] dark:text-slate-300 mt-1 leading-relaxed line-clamp-2">
 {notif.message}
 </p>
 )}
 <p className="text-[10px] text-[#64748B] dark:text-slate-400 mt-1.5">
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
 className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[var(--bg-nav-hover)] text-[#475569] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white transition-all flex-shrink-0">
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
 <div className="px-5 py-3 border-t flex-shrink-0" style={{ borderColor: theme === 'light' ? '#E2E8F0' : '#1E293B' }}>
 <p className="text-[10px] text-[#64748B] dark:text-slate-400 text-center">
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
 background: var(--border-color);
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
