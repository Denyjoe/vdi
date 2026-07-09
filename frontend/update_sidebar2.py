import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/components/layout/Sidebar.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Import api
if 'import api' not in content:
    content = re.sub(r"(import .*? from 'react';)", r"\1\nimport api from '../../services/api';", content)

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
    content = re.sub(r'(const { user, logout } = useAuthStore\(\);)', r'\1' + state_code, content)

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/components/layout/Sidebar.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
