import sys
import re

with open('src/pages/member/DesktopSessionPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add disconnectedByAdmin state
if 'const [disconnectedByAdmin, setDisconnectedByAdmin] = useState(false);' not in content:
    content = content.replace(
        'const [error, setError] = useState(null);',
        'const [error, setError] = useState(null);\n  const [disconnectedByAdmin, setDisconnectedByAdmin] = useState(false);'
    )

# Add polling useEffect
poll_effect = """
  // Poll for admin force disconnect
  useEffect(() => {
    if (!id) return;
    const checkStatus = async () => {
      try {
        const res = await api.get(/workspaces//);
        const status = res.data?.status;
        if (status === 'stopped' || status === 'error' || status === 'deleted') {
          setDisconnectedByAdmin(true);
        }
      } catch (e) {
        if (e.response?.status === 404) {
          setDisconnectedByAdmin(true);
        }
      }
    };
    
    // Poll every 8 seconds
    const interval = setInterval(checkStatus, 8000);
    return () => clearInterval(interval);
  }, [id]);
"""

if '// Poll for admin force disconnect' not in content:
    # insert after the first useEffect
    content = content.replace('useEffect(() => {\n    initGuacamole();', poll_effect + '\n  useEffect(() => {\n    initGuacamole();')


# Add overlay JSX
overlay_jsx = """
      {disconnectedByAdmin && (
        <div style={{
          position: 'fixed', inset: 0,
          zIndex: 100,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}>
          <AlertCircle size={40} style={{ color: '#FF6B00' }} />
          <p style={{
            color: 'white',
            fontSize: '16px',
            fontWeight: 600,
          }}>
            This session was ended by an administrator
          </p>
          <button onClick={() => navigate('/workspaces')}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              background: '#0066FF',
              color: 'white',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}>
            Back to Workspaces
          </button>
        </div>
      )}
"""

if 'This session was ended by an administrator' not in content:
    content = content.replace(
        '<div className="flex-1 bg-black relative" ref={containerRef}>',
        '<div className="flex-1 bg-black relative" ref={containerRef}>' + overlay_jsx
    )

with open('src/pages/member/DesktopSessionPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated DesktopSessionPage")
