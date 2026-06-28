import { useState, useEffect, useRef } from 'react';
import useAuthStore from '../store/authStore';
import api from '../services/api';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // Fetch initial list
    api.get('/notifications/')
      .then(res => {
        if (res.data.success) {
          setNotifications(res.data.data);
          setUnreadCount(res.data.data.filter(n => !n.is_read).length);
        }
      })
      .catch(console.error);

    // Connect WebSocket
    const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    const wsUrl = `${WS_BASE_URL}/ws/notifications/?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log("Notifications WS connected");
    };
    
    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'notification') {
        const notif = data.data;
        setNotifications(prev => [notif, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Optional: show browser toast here
      }
    };

    ws.current.onclose = () => setIsConnected(false);

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [isAuthenticated, token]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read/`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead, isConnected };
}
