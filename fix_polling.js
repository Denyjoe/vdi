const fs = require('fs');

let content = fs.readFileSync('frontend/src/pages/member/DesktopSessionPage.jsx', 'utf8');

const startMarker = '// Workspace Polling';
const endMarker = '// Session timer (countdown)';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found");
  process.exit(1);
}

const consolidatedCode = // Consolidated Polling Loop
  const lastKnownStatus = useRef(null);
  const [disconnectedByAdmin, setDisconnectedByAdmin] = useState(false);

  useEffect(() => {
    let intervalId;
    let hardTimeoutId;

    // For workspaces during provisioning, we poll faster.
    const pollInterval = (type === 'workspace' && wsLoading) ? 3000 : 8000;

    const poll = async () => {
      try {
        if (type === 'workspace') {
          const res = await api.get(\/workspaces/\/\);
          const wsData = res.data.data || res.data;
          const status = wsData.vm_details?.status || wsData.status;
          
          if (status === 'error' || status === 'stopped' || status === 'deleted') {
             setDisconnectedByAdmin(true);
             if (wsLoading) setWsLoading(false);
          } else if (status === 'running' || wsData.status === 'active') {
             const url = wsData.vm_details?.guacamole_url;
             if (url && status !== lastKnownStatus.current) {
               lastKnownStatus.current = status;
               setWorkspace(prev => ({
                 ...prev,
                 ...wsData,
                 vm_details: {
                   ...(prev?.vm_details || {}),
                   ...wsData.vm_details,
                   guacamole_url: prev?.vm_details?.guacamole_url || url,
                   status: status
                 }
               }));
               if (wsLoading) setWsLoading(false);
             }
          }
        } else {
          // Session polling
          const res = await sessionService.getLiveSession(sessionId);
          if (!res.data.success || !res.data.data || String(res.data.data.id) !== String(sessionId)) {
            setDisconnectedByAdmin(true);
            return;
          }
          const sData = res.data.data;
          
          if (sData.status === 'ended') {
            setDisconnectedByAdmin(true);
            return;
          }
          
          const myParticipant = sData.participants?.find(p => p.user?.id === user?.id);
          if (myParticipant) {
             const pStatus = myParticipant.status;
             const vmStatus = myParticipant.vm_status;
             
             if (pStatus === 'removed' || pStatus === 'disconnected' || vmStatus === 'stopped') {
                setDisconnectedByAdmin(true);
                return;
             }
             
             setSessionData(prev => {
                if (!prev) return prev;
                
                const newState = {
                   ...prev,
                   session_scheduled_end_at: sData.scheduled_end_at
                };
                
                if (vmStatus !== lastKnownStatus.current) {
                   lastKnownStatus.current = vmStatus;
                   newState.guacamole_url = prev.guacamole_url || myParticipant.guacamole_url;
                   newState.vm_status = vmStatus;
                }
                
                return newState;
             });
          } else {
             setDisconnectedByAdmin(true);
          }
        }
      } catch (err) {
        // ignore single transient network errors
      }
    };

    poll(); // Initial immediate poll
    intervalId = setInterval(poll, pollInterval);

    if (type === 'workspace' && wsLoading) {
      hardTimeoutId = setTimeout(() => {
        setWsLoading(false);
        setDisconnectedByAdmin(true);
        setWorkspace(prev => ({
          ...prev,
          vm_details: {
            ...(prev?.vm_details || {}),
            status: 'error',
            isTimeout: true,
            notes: "This workspace is taking longer than expected to start. On current infrastructure, cold starts can take up to 5 minutes."
          }
        }));
      }, 330000);
    }

    return () => {
      clearInterval(intervalId);
      if (hardTimeoutId) clearTimeout(hardTimeoutId);
    };
  }, [type, sessionId, user, wsLoading]);

  ;

const newContent = content.substring(0, startIndex) + consolidatedCode + content.substring(endIndex);
fs.writeFileSync('frontend/src/pages/member/DesktopSessionPage.jsx', newContent, 'utf8');
console.log("Rewrite successful");
