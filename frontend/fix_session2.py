import sys

with open('src/pages/member/DesktopSessionPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add session polling for non-workspace
session_poll = """
  // Session Polling (for participants)
  useEffect(() => {
    if (type === 'workspace') return;
    
    let intervalId;
    const fetchSessionStatus = async () => {
      try {
        const res = await sessionService.getActiveSession();
        if (!res.data.success || !res.data.data || String(res.data.data.id) !== String(sessionId)) {
          setDisconnectedByAdmin(true);
        }
      } catch (err) {
        setDisconnectedByAdmin(true);
      }
    };
    
    intervalId = setInterval(fetchSessionStatus, 8000);
    return () => clearInterval(intervalId);
  }, [type, sessionId]);
"""

if '// Session Polling (for participants)' not in content:
    content = content.replace(
        "// Sync workspace data to sessionData for simulated fallback",
        session_poll + "\n  // Sync workspace data to sessionData for simulated fallback"
    )

with open('src/pages/member/DesktopSessionPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated session polling")
