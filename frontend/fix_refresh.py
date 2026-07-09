import re

with open('src/pages/admin/VMPoolPage.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace the data fetching blocks:

fetch_block = '''  const [refreshing, setRefreshing] = useState(false)

  const fetchPoolStats = async () => {
    try {
      const res = await api.get('/vms/admin/pool/status/')
      setStats(res.data?.stats)
    } catch(e) {
      console.error(e)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/vms/admin/templates/')
      const data = Array.isArray(res.data) ? res.data : res.data?.data || []
      setTemplates(data)
    } catch(e) {
      console.error(e)
    }
  }

  const fetchPoolEntries = async () => {
    try {
      const res = await api.get('/vms/admin/pool/entries/')
      setPoolEntries(res.data.entries || [])
    } catch(e) {
      console.error(e)
    }
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await Promise.all([
        fetchPoolStats(),
        fetchTemplates(),
        fetchPoolEntries(),
      ])
    } catch(e) {
      console.error('Refresh failed:', e)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    handleRefresh()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchPoolStats()
      fetchPoolEntries()
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [autoRefresh])'''

code = re.sub(r'  const fetchEntries = useCallback.*?}, \[fetchData, autoRefresh\]\)', fetch_block, code, flags=re.DOTALL)

# Replace remaining fetchData() calls with handleRefresh()
code = code.replace('fetchData()', 'handleRefresh()')
code = code.replace('onClick={fetchData}', 'onClick={handleRefresh}')

# Replace the refresh button itself
old_btn = '''          <button 
            onClick={fetchData} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-[var(--border-color)] hover:bg-white/10 text-[var(--text-primary)] transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} /> Refresh
          </button>'''
old_btn2 = '''          <button 
            onClick={handleRefresh} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-[var(--border-color)] hover:bg-white/10 text-[var(--text-primary)] transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} /> Refresh
          </button>'''

new_btn = '''          <button onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}>
            <RefreshCw size={14} 
              style={{
                animation: refreshing ? 'spin 1s linear infinite' : 'none'
              }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
            <style>{
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            }</style>
          </button>'''

code = code.replace(old_btn2, new_btn)

with open('src/pages/admin/VMPoolPage.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Replacement successful")
