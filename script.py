import sys

with open('frontend/src/pages/member/CreateSessionPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_block = content.split('export default function CreateSessionPage()')[0]
if 'useBreakpoint' not in import_block:
    import_block = "import useBreakpoint from '../../hooks/useBreakpoint';\n" + import_block

checkout_modal_block = content.split('// Inline component extending CheckoutModal for sessions')[1]

new_component = '''export default function CreateSessionPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isDesktop } = useBreakpoint();
  
  const [sessionName, setSessionName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [maxParticipants, setMaxParticipants] = useState(10);
  
  const [templates, setTemplates] = useState([]);
  
  const [hours, setHours] = useState(1);
  const [customHours, setCustomHours] = useState('1');
  const [rate, setRate] = useState(5000);
  
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutPayload, setCheckoutPayload] = useState(null);
  
  const [restrictions, setRestrictions] = useState({
    internet_access: true,
    clipboard: true,
    file_transfer: true,
    screen_monitoring: false,
    session_recording: false,
    interaction_mode: 'full_control',
  });

  useEffect(() => {
    api.get('/vms/templates/').then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setTemplates(data);
    });
    api.get('/config/session-rate/').then(res => {
      if (res.data.success) {
        setRate(res.data.rate_tzs);
      }
    }).catch(err => console.error(err));
  }, []);

  const canProceed = () => {
    return sessionName.trim().length > 0 && selectedTemplate != null && hours >= 0.5 && hours <= 24;
  };

  const handleStartCheckout = () => {
    if (!canProceed()) return;
    
    setCheckoutPayload({
      name: 'Custom Session',
      price: { TZS: hours * rate },
      payload: {
        name: sessionName,
        vm_template: selectedTemplate.id,
        max_participants: maxParticipants,
        hours: hours,
        restrictions: restrictions
      }
    });
    
    setShowCheckout(true);
  };

  const handleCheckoutSuccess = (data) => {
    setShowCheckout(false);
    if (data?.id) {
      navigate(/host/session/, { state: { session: data } });
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto pb-12">

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{
            width: '44px', height: '44px',
            borderRadius: '12px',
            background: 'var(--accent-primary-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Radio size={20} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}>Create Session</h1>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              margin: 0,
            }}>Set up a live session and pay per hour</p>
          </div>
        </div>
        
        <button onClick={() => navigate(-1)} style={{
           background: 'transparent', border: '1px solid var(--border-color)', 
           color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '10px',
           fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <ArrowLeft size={16} /> Cancel
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isDesktop ? '1.5fr 1fr' : '1fr',
        gap: '24px',
        alignItems: 'start',
      }}>
        
        {/* Left Column — Session Details */}
        <div style={sectionCard}>
          <h3 style={sectionTitle}>
            Session Details
          </h3>
          
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>
              Session Name
            </label>
            <input 
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              placeholder="e.g. Intro to Python Lab"
              style={inputStyle} 
            />
          </div>
          
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>
              VM Template
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
              gap: '10px',
            }}>
              {templates.map(t => (
                <button key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    border: selectedTemplate?.id === t.id
                      ? '2px solid var(--accent-primary)'
                      : '1px solid var(--border-color)',
                    background: selectedTemplate?.id === t.id
                      ? 'var(--accent-primary-soft)'
                      : 'var(--bg-input)',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer'
                  }}>
                  <MonitorIcon size={18} style={{ color: selectedTemplate?.id === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                  <div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}>{t.name}</div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}>
                      {t.cpu_cores} vCPU · {t.ram_gb}GB RAM
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label style={labelStyle}>
              Max Participants
            </label>
            <input type="number"
              min="1" max="100"
              value={maxParticipants}
              onChange={e => setMaxParticipants(parseInt(e.target.value) || 1)}
              style={inputStyle} 
            />
          </div>
        </div>

        {/* Right Column */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          
          {/* Environment Controls */}
          <div style={sectionCard}>
            <h3 style={sectionTitle}>
              Environment Controls
            </h3>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <ControlToggle 
                label="Internet Access" 
                description="Allow VM to reach external networks" 
                value={restrictions.internet_access} 
                onChange={v => setRestrictions({...restrictions, internet_access: v})} 
                onColor="var(--accent-primary)" 
              />
              <ControlToggle 
                label="Clipboard Sync" 
                description="Allow copy/paste between local and VM" 
                value={restrictions.clipboard} 
                onChange={v => setRestrictions({...restrictions, clipboard: v})} 
                onColor="var(--accent-primary)" 
              />
              <ControlToggle 
                label="File Transfer" 
                description="Allow uploading/downloading files" 
                value={restrictions.file_transfer} 
                onChange={v => setRestrictions({...restrictions, file_transfer: v})} 
                onColor="var(--accent-primary)" 
              />
            </div>
          </div>

          {/* Duration & Pricing */}
          <div style={sectionCard}>
            <h3 style={sectionTitle}>
              Duration & Pricing
            </h3>
            
            <label style={labelStyle}>
              How long do you need?
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '16px',
            }}>
              {[1, 2, 3].map(h => (
                <button key={h}
                  onClick={() => { setHours(h); setCustomHours(h.toString()); }}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: hours === h
                      ? '2px solid var(--accent-primary)'
                      : '1px solid var(--border-color)',
                    background: hours === h
                      ? 'var(--accent-primary-soft)'
                      : 'var(--bg-input)',
                    textAlign: 'center',
                    cursor: 'pointer'
                  }}>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}>{h}h</div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}>
                    TZS {(h * rate).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
            
            <label style={labelStyle}>Or enter custom hours</label>
            <input type="number" 
              min="0.5" max="24" step="0.5"
              value={customHours}
              onChange={e => {
                setCustomHours(e.target.value);
                setHours(parseFloat(e.target.value) || 0);
              }}
              style={{ ...inputStyle, marginBottom: '20px' }}
            />

            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: 'var(--accent-primary-soft)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}>Total Cost</span>
              <span style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--accent-primary)',
              }}>
                TZS {(hours * rate).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Pay button — full width inside right column */}
          <button onClick={handleStartCheckout} disabled={!canProceed()}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '12px',
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              fontSize: '15px',
              fontWeight: 700,
              cursor: canProceed() ? 'pointer' : 'not-allowed',
              opacity: canProceed() ? 1 : 0.5,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}>
            <Rocket size={18} /> Pay & Start Session
          </button>
        </div>

      </div>

      {showCheckout && checkoutPayload && (
        <CheckoutSessionModal 
          payload={checkoutPayload}
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
}

// Inline component extending CheckoutModal for sessions'''

with open('frontend/src/pages/member/CreateSessionPage.jsx', 'w', encoding='utf-8') as f:
    f.write(import_block + new_component + checkout_modal_block)

print('Rewrite complete!')
