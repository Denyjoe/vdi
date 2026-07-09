import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/components/layout/Sidebar.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Import Radio icon
if 'Radio' not in content:
    content = re.sub(r'(import {[^}]*)', r'\1 Radio,', content, count=1)

# Add state and effect for polling
state_code = """
  const [liveSessionCount, setLiveSessionCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const fetchCount = async () => {
      try {
        const res = await api.get('/sessions/admin/live/');
        setLiveSessionCount(res.data.total_active || 0);
      } catch(e) {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => clearInterval(interval);
  }, [user]);
"""
if 'liveSessionCount' not in content:
    content = re.sub(r'(const user = useStore\(state => state\.user\);)', r'\1' + state_code, content)

# Modify NavItem to accept badge prop
navitem_def = "function NavItem({ icon: Icon, label, path, onClick, collapsed, active, accent }) {"
new_navitem_def = "function NavItem({ icon: Icon, label, path, onClick, collapsed, active, accent, badge }) {"
if new_navitem_def not in content:
    content = content.replace(navitem_def, new_navitem_def)

# Add badge logic to NavItem
badge_jsx = """
      {!collapsed && badge && (
        <span style={{
          marginLeft: 'auto',
          padding: '2px 7px',
          borderRadius: '9999px',
          fontSize: '10px',
          fontWeight: 700,
          background: 'var(--status-online-bg)',
          color: 'var(--status-online)',
        }}>
          {badge}
        </span>
      )}
      {collapsed && badge && (
        <span style={{
          position: 'absolute',
          top: '2px', right: '2px',
          width: '8px', height: '8px',
          borderRadius: '50%',
          background: 'var(--status-online)',
        }} />
      )}
"""
if 'badge &&' not in content:
    content = re.sub(r'(</button>\s*)$', badge_jsx + r'\1', content, flags=re.MULTILINE) # Not right, wait. Let's just insert it before </button>
    content = content.replace("    </button>", badge_jsx + "    </button>")

# Add Live Sessions to Admin links
admin_sessions_link = """
          <NavItem 
            icon={Radio}
            label="Live Sessions"
            path="/admin/sessions"
            collapsed={collapsed}
            active={location.pathname === '/admin/sessions'}
            badge={liveSessionCount > 0 ? liveSessionCount : null}
          />
"""
if 'path="/admin/sessions"' not in content:
    content = re.sub(r'(<NavItem[^>]*label="Dashboard"[^>]*/>)', r'\1' + admin_sessions_link, content)


with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/components/layout/Sidebar.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
