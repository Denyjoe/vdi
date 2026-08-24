import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import useUIStore from '../../store/uiStore';
import useBreakpoint from '../../hooks/useBreakpoint';
import NotificationBell from '../shared/NotificationBell';
import ContextSwitcher from '../shared/ContextSwitcher';
import {
  Menu, Bell, Clock, Wifi, HelpCircle, BookOpen, Keyboard, 
  Mail, FileText, Shield, X, Monitor, MonitorPlay, Users, 
  Radio, Receipt 
} from 'lucide-react';
import useLiveSession from '../../hooks/useLiveSession';
import { signOutFirebase } from '../../config/firebase';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const theme = useThemeStore(s => s.theme);
  const { isMobile, isDesktop } = useBreakpoint();
  const { toggleMobileMenu } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();
  const liveSession = useLiveSession(user);

  const [localTime, setLocalTime] = useState('');
  const userTimezone = user?.timezone_preference || 'UTC';

  const [showHelp, setShowHelp] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const helpRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (helpRef.current && !helpRef.current.contains(e.target))
        setShowHelp(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowQuickGuide(false);
        setShowShortcuts(false);
        setShowHelp(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const updateClock = () => {
      try {
        const now = new Date();
        const options = { 
          timeZone: userTimezone, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: false
        };
        const formatter = new Intl.DateTimeFormat('en-GB', options);
        setLocalTime(formatter.format(now));
      } catch (e) {
        // Fallback if timezone is invalid
        const now = new Date();
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        setLocalTime(`${hours}:${minutes}:${seconds}`);
      }
    };
    
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [userTimezone]);

  const getPageLabel = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'COMMAND CENTER';
    if (path === '/workspaces') return 'ACTIVE TERMINAL STREAMS';
    if (path.startsWith('/workspace/')) return 'LIVE DESKTOP SESSION';
    if (path === '/sessions/my') return 'SESSION LOGS';
    if (path === '/account' || path === '/settings') return 'ACCOUNT TERMINAL';
    if (path.startsWith('/admin/dashboard')) return 'ADMIN CONSOLE';
    if (path.startsWith('/admin/vm-pool')) return 'NODE POOL MANAGER';
    if (path.startsWith('/admin/users')) return 'USER REGISTRY';
    if (path.startsWith('/admin/templates')) return 'TEMPLATE ENGINE';
    if (path.startsWith('/admin/analytics')) return 'ANALYTICS MATRIX';
    if (path.startsWith('/admin/settings')) return 'SYSTEM CONFIG';
    if (path.startsWith('/host/session')) return 'SESSION MONITOR';
    if (path.startsWith('/billing')) return 'BILLING & USAGE';
    return 'DASHBOARD';
  };

  const getInitials = () => {
    return `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  };
  
  const avatarUrl = user?.avatar_url || user?.avatar;

  const handleLogout = async () => {
    try {
      await signOutFirebase();
    } catch(e) {
      console.error('Firebase signout error:', e);
    }
    logout();
    navigate('/signin');
  };

  return (
    <>
      <nav 
        className="h-14 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50 border-b border-[var(--border-subtle)] transition-all duration-300"
        style={{ 
          background: theme === 'light'
            ? 'rgba(248, 250, 252, 0.85)'
            : 'rgba(8, 11, 16, 0.85)',
          backdropFilter: 'blur(12px)'
        }}
      >
        <style>{`
          @keyframes wifiBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          .wifi-blink {
            animation: wifiBlink 1.5s ease-in-out infinite;
            display: flex;
            align-items: center;
          }
          @keyframes bellWiggle {
            0%, 85%, 100% { transform: rotate(0); }
            88% { transform: rotate(-10deg); }
            91% { transform: rotate(10deg); }
            94% { transform: rotate(-8deg); }
            97% { transform: rotate(8deg); }
          }
          .bell-wiggle {
            animation: bellWiggle 3s ease-in-out infinite;
            transform-origin: top center;
          }
          @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
        
        <div className="flex items-center gap-3">
          {isMobile && (
            <button
              onClick={toggleMobileMenu}
              className="p-2 text-secondary hover:text-primary transition-colors rounded-lg hover:bg-nav-hover"
              aria-label="Toggle mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {isDesktop && (
                <>
                  <span className={`text-[11px] font-semibold uppercase tracking-[1.5px] ${theme === 'light' ? 'text-[#475569]' : 'text-[var(--text-muted)]'}`}>
                    Console
                  </span>
                  <span className={theme === 'light' ? 'text-[#94A3B8]' : 'text-[var(--text-faint)]'}>›</span>
                </>
              )}
              <span className={`text-[13px] font-semibold uppercase tracking-[1px] ${theme === 'light' ? 'text-[#0F172A]' : 'text-[var(--text-primary)]'}`}>
                {getPageLabel()}
              </span>
            </div>
            
            {liveSession && (
              <button
                onClick={() => navigate(`/host/session/${liveSession.id}`)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#16A34A]/5 border border-[#00FF87]/15 hover:bg-[#16A34A]/10 active:scale-95 transition-all">
                <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse shadow-lg shadow-green-500/50" />
                <span className="text-[10px] font-semibold text-[#15803D] uppercase tracking-wider">
                  Live Session
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          
          {isDesktop && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: theme === 'light' ? '#F0FDF4' : 'rgba(15, 23, 42, 0.5)',
              border: theme === 'light' ? '1px solid #BBF7D0' : '1px solid rgba(30, 41, 59, 0.5)',
            }}>
              <div className="wifi-blink">
                <Wifi size={13} style={{ color: theme === 'light' ? '#0284C7' : '#00A3FF' }} />
              </div>
              <span style={{ 
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1.5px'
              }}>
                <span style={{ color: 'var(--text-primary)' }}>GW-SSL:</span>{' '}
                <span style={{ color: 'var(--status-online)' }}>Secured</span>
              </span>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--status-online-dot)',
                boxShadow: theme === 'light' ? '0 0 0 3px rgba(22, 163, 74, 0.15)' : '0 0 6px rgba(0, 255, 135, 0.4)'
              }} />
            </div>
          )}
          
          {isDesktop && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas">
              <Clock size={12} className="text-muted" />
              <span className="text-[11px] font-mono font-medium text-secondary tabular-nums tracking-wider">
                {localTime}
              </span>
              <span className="text-[8px] text-faint font-semibold uppercase ml-0.5 truncate max-w-[80px]">
                {userTimezone.split('/').pop().replace('_', ' ')}
              </span>
            </div>
          )}
          
          <ContextSwitcher />

          <div ref={helpRef} className="relative">
            <button onClick={() => setShowHelp(!showHelp)}
              className="p-1.5 rounded-lg hover:bg-nav-hover transition-colors active:scale-95">
              <HelpCircle size={16} className="text-secondary hover:text-primary transition-colors" />
            </button>
            
            {showHelp && (
              <div className="absolute top-full right-0 mt-2 w-[280px] bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50"
                style={{ animation: 'fadeInDown 0.2s ease-out' }}>
                
                {/* Header */}
                <div className="px-4 py-3 border-b border-border-subtle">
                  <h3 className="text-sm font-bold text-primary">Help & Resources</h3>
                  <p className="text-[10px] text-muted mt-0.5">
                    Get started with Ospace
                  </p>
                </div>
                
                {/* Quick help items */}
                <div className="py-1">
                  <button onClick={() => {
                    setShowHelp(false);
                    setShowQuickGuide(true);
                  }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-[#0066FF]/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={13} className="text-[#0066FF]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Quick Start Guide</p>
                      <p className="text-[10px] text-muted mt-0.5">Learn the basics in 2 minutes</p>
                    </div>
                  </button>
                  
                  <button onClick={() => {
                    setShowHelp(false);
                    setShowShortcuts(true);
                  }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center flex-shrink-0">
                      <Keyboard size={13} className="text-[#6C63FF]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Keyboard Shortcuts</p>
                      <p className="text-[10px] text-muted mt-0.5">Speed up your workflow</p>
                    </div>
                  </button>
                  
                  <a href="mailto:support@ospace.io"
                    onClick={() => setShowHelp(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-[#16A34A]/10 flex items-center justify-center flex-shrink-0">
                      <Mail size={13} className="text-[#15803D]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Contact Support</p>
                      <p className="text-[10px] text-muted mt-0.5">support@ospace.io</p>
                    </div>
                  </a>
                  
                  <button onClick={() => {
                    setShowHelp(false);
                    navigate('/terms');
                  }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-nav-hover flex items-center justify-center flex-shrink-0">
                      <FileText size={13} className="text-secondary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Terms of Service</p>
                    </div>
                  </button>
                  
                  <button onClick={() => {
                    setShowHelp(false);
                    navigate('/privacy');
                  }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-nav-hover flex items-center justify-center flex-shrink-0">
                      <Shield size={13} className="text-secondary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Privacy Policy</p>
                    </div>
                  </button>
                </div>
                
                {/* Footer */}
                <div className="px-4 py-3 border-t border-border-subtle bg-canvas">
                  <p className="text-[9px] text-faint text-center">
                    Ospace v1.0.0 · Made in Tanzania
                  </p>
                </div>
              </div>
            )}
          </div>

          <NotificationBell />

          <div className="hidden sm:flex flex-col items-end">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
              {user?.role === 'admin' ? (
                  <span className="text-purple-400 font-bold tracking-wide uppercase">Admin</span>
              ) : (
                  <span className="text-muted uppercase tracking-wide font-medium">Member</span>
              )}
            </p>
          </div>

          <div className="relative">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[var(--bg-card)] flex items-center justify-center border border-[var(--border-color)] shadow-sm cursor-pointer hover:border-slate-600 transition-colors" onClick={() => navigate('/profile')}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[var(--text-primary)] font-bold text-sm tracking-wider">
                  {getInitials()}
                </span>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* QUICK START GUIDE MODAL */}
      {showQuickGuide && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget)
              setShowQuickGuide(false);
          }}>
          <div className="bg-sidebar border border-border rounded-2xl w-[520px] max-w-[90vw] max-h-[80vh] overflow-hidden shadow-2xl shadow-black/50 flex flex-col"
            style={{ animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-[#0066FF]" />
                <h2 className="text-base font-bold text-primary">
                  Quick Start Guide
                </h2>
              </div>
              <button onClick={() => setShowQuickGuide(false)}
                className="p-1.5 rounded-lg hover:bg-nav-hover text-secondary hover:text-primary active:scale-95 transition-all">
                <X size={16} />
              </button>
            </div>
            
            {/* Content */}
            <div className="px-6 py-5 overflow-y-auto custom-scrollbar space-y-5 flex-1">
              {[
                {
                  step: '1',
                  title: 'Launch a Workspace',
                  desc: 'Go to Overview and browse available templates. Click Launch on any template to create your cloud desktop.',
                  icon: Monitor,
                  color: '#0066FF',
                },
                {
                  step: '2',
                  title: 'Connect to Your Desktop',
                  desc: 'Once your workspace is running, click Connect to open your virtual desktop right in your browser.',
                  icon: MonitorPlay,
                  color: '#00FF87',
                },
                {
                  step: '3',
                  title: 'Join a Session',
                  desc: 'Enter an invite code from your host to join a live session. You will get your own isolated environment.',
                  icon: Users,
                  color: '#6C63FF',
                },
                {
                  step: '4',
                  title: 'Host a Session',
                  desc: 'Upgrade to a host plan to create sessions. Share the invite code and monitor participants in real-time.',
                  icon: Radio,
                  color: '#FF6B00',
                },
                {
                  step: '5',
                  title: 'Track Your Usage',
                  desc: 'Visit Billing to see your hours used, spending, and payment history. Download receipts anytime.',
                  icon: Receipt,
                  color: '#00A3FF',
                },
              ].map(item => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: item.color + '15' }}>
                      <item.icon size={16} style={{ color: item.color }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-primary)]">
                        STEP {item.step}
                      </span>
                      <h3 className="text-sm font-semibold text-primary">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-xs text-secondary mt-1.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-border-subtle flex justify-end flex-shrink-0">
              <button onClick={() => setShowQuickGuide(false)}
                className="px-5 py-2 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-95 transition-all">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KEYBOARD SHORTCUTS MODAL */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget)
              setShowShortcuts(false);
          }}>
          <div className="bg-sidebar border border-border rounded-2xl w-[440px] max-w-[90vw] overflow-hidden shadow-2xl"
            style={{ animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard size={16} className="text-[#6C63FF]" />
                <h2 className="text-base font-bold text-primary">
                  Keyboard Shortcuts
                </h2>
              </div>
              <button onClick={() => setShowShortcuts(false)}
                className="p-1.5 rounded-lg hover:bg-nav-hover text-secondary hover:text-primary active:scale-95 transition-all">
                <X size={16} />
              </button>
            </div>
            
            <div className="px-6 py-5 space-y-3">
              {[
                { keys: ['Ctrl', 'Shift', 'F'], desc: 'Toggle fullscreen (in desktop view)' },
                { keys: ['Ctrl', 'Shift', 'D'], desc: 'Disconnect from workspace' },
                { keys: ['Esc'], desc: 'Close modals and panels' },
                { keys: ['Ctrl', 'K'], desc: 'Open search' },
                { keys: ['?'], desc: 'Show this help' },
              ].map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs text-secondary">
                    {shortcut.desc}
                  </span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((k, j) => (
                      <kbd key={j} className="px-2 py-1 rounded-md bg-[var(--bg-elevated)] border border-border-strong text-[10px] font-mono text-secondary min-w-[24px] text-center">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="px-6 py-3 border-t border-border-subtle">
              <button onClick={() => setShowShortcuts(false)}
                className="w-full py-2 rounded-xl bg-slate-800/30 text-secondary text-xs font-medium hover:bg-nav-hover active:scale-[0.98] transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
