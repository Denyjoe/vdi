import useBreakpoint from '../../hooks/useBreakpoint';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, ArrowLeft, Rocket, Monitor as MonitorIcon, Database, Terminal, Check, X } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const SESSION_TYPES = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'lab', label: 'Lab' },
  { value: 'exam', label: 'Exam' },
  { value: 'lecture', label: 'Lecture' },
  { value: 'study_group', label: 'Study Group' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
];

const TemplateIcon = ({ icon, className, size = 16 }) => {
  switch (icon) {
    case 'monitor': return <MonitorIcon size={size} className={className} />;
    case 'database': return <Database size={size} className={className} />;
    case 'terminal': return <Terminal size={size} className={className} />;
    default: return <MonitorIcon size={size} className={className} />;
  }
};

const ControlToggle = ({ label, description, value, onChange, onColor = 'var(--accent-primary)' }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderRadius: '12px',
    background: value ? 'rgba(0,102,255,0.1)' : 'var(--bg-input)',
    border: `1px solid ${value ? 'rgba(0,102,255,0.3)' : 'var(--border-subtle)'}`,
    transition: 'all 0.2s'
  }}>
    <div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{description}</div>
    </div>
    <button onClick={() => onChange(!value)}
      style={{
        position: 'relative',
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        background: value ? onColor : 'var(--border-strong)',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.3s'
      }}>
      <div style={{
        position: 'absolute',
        top: '2px',
        left: value ? '22px' : '2px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transition: 'all 0.3s'
      }} />
    </button>
  </div>
);

const sectionCard = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  padding: '24px',
};

const sectionTitle = {
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: '20px',
};

const labelStyle = {
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-muted)',
  fontWeight: 600,
  display: 'block',
  marginBottom: '8px',
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
};

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isDesktop } = useBreakpoint();
  
  const [sessionName, setSessionName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [sessionType, setSessionType] = useState('lecture');
  
  const [templates, setTemplates] = useState([]);
  
  const [hours, setHours] = useState(1);
  const [customHours, setCustomHours] = useState('1');
  const [rate, setRate] = useState(5000);
  
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutPayload, setCheckoutPayload] = useState(null);
  
  const [restrictions, setRestrictions] = useState({
    clipboard: true,
    file_transfer: true,
    screen_monitoring: false,
    session_recording: false,
    interaction_mode: 'full_control',
  });

  const [restrictInternet, setRestrictInternet] = useState(false);
  const [allowedDomainsInput, setAllowedDomainsInput] = useState('');

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
    const domains = allowedDomainsInput
      .split(',')
      .map(d => d.trim())
      .filter(Boolean);

    setCheckoutPayload({
      name: 'Custom Session',
      price: { TZS: hours * rate },
      payload: {
        name: sessionName,
        session_type: sessionType,
        vm_template: selectedTemplate.id,
        max_participants: maxParticipants,
        hours: hours,
        restrictions: restrictions,
        restrict_internet: restrictInternet || domains.length > 0,
        allowed_domains: domains
      }
    });
    
    setShowCheckout(true);
  };

  const handleCheckoutSuccess = (data) => {
    setShowCheckout(false);
    if (data?.id) {
      navigate(`/host/session/${data.id}`, { state: { session: data } });
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
              Session Type
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              {SESSION_TYPES.map(t => (
                <button key={t.value}
                  onClick={() => setSessionType(t.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: sessionType === t.value
                      ? '2px solid var(--accent-primary)'
                      : '1px solid var(--border-color)',
                    background: sessionType === t.value
                      ? 'var(--accent-primary-soft)'
                      : 'var(--bg-input)',
                    color: sessionType === t.value
                      ? 'var(--accent-primary)'
                      : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
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
              <ControlToggle
                label="Network Lockdown"
                description="Block all internet access from participant VMs except whitelisted domains"
                value={restrictInternet}
                onChange={setRestrictInternet}
                onColor="var(--accent-primary)"
              />
              {restrictInternet && (
                <div>
                  <label style={labelStyle}>
                    Allowed Domains (comma-separated)
                  </label>
                  <input
                    value={allowedDomainsInput}
                    onChange={e => setAllowedDomainsInput(e.target.value)}
                    placeholder="e.g. github.com, docs.python.org"
                    style={inputStyle}
                  />
                  {/* Honest limitation, not hidden: whitelisting resolves each
                      domain to its current IP(s) at lockdown time (plus a few
                      known ecosystems' real CIDR ranges - GitHub, Google,
                      Wikipedia, etc.) rather than tracking DNS live, so a
                      host setting this up for a real exam should know large,
                      many-server sites can be unreliable. */}
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Best for simple, single-IP sites (e.g. institutional LMS). Large sites with many servers (Google, YouTube) may not work reliably.
                  </p>
                </div>
              )}
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

// Inline component extending CheckoutModal for sessions
function CheckoutSessionModal({ payload, isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('payment'); 
  const [phoneNumber, setPhoneNumber] = useState('');
  const [provider, setProvider] = useState('mpesa');
  const [error, setError] = useState(null);

  const handlePay = async () => {
    if (!phoneNumber) {
      setError('Please enter your mobile money number');
      return;
    }
    
    setStep('processing');
    setError(null);
    
    try {
      const res = await api.post('/sessions/live/pay-and-start/', {
        ...payload.payload,
        phone_number: phoneNumber,
        provider: provider,
      });
      
      if (res.data.success) {
        setStep('success');
        setTimeout(() => {
          onSuccess(res.data.data);
        }, 2000);
      } else {
        setError(res.data.message || 'Payment failed');
        setStep('payment');
      }
    } catch(e) {
      setError(e.response?.data?.message || 'Payment failed. Please try again.');
      setStep('payment');
    }
  };

  if (!isOpen || !payload) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 70,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
    }} onClick={(e) => {
      if (e.target === e.currentTarget && step !== 'processing') 
        onClose();
    }}>
      <div style={{
        background: 'var(--bg-card, #1E293B)',
        border: '1px solid var(--border-color, #334155)',
        borderRadius: '20px',
        width: '440px',
        maxWidth: '90vw',
        boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1))',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color, #334155)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
            Pay for {payload.payload.hours}hr Session
          </h3>
          {step !== 'processing' && (
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #94A3B8)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ padding: '24px' }}>
          {step === 'payment' && (
            <>
              <div style={{
                padding: '16px', borderRadius: '12px', background: 'var(--bg-input, rgba(15, 23, 42, 0.5))',
                marginBottom: '20px', textAlign: 'center',
              }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted, #94A3B8)' }}>You'll be charged</p>
                <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                  TZS {(payload.price?.TZS || 0).toLocaleString()}
                </p>
              </div>

              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted, #94A3B8)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Payment Method
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['mpesa', 'airtel', 'tigo', 'halopesa'].map(p => (
                  <button key={p} onClick={() => setProvider(p)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize',
                      border: provider === p ? '2px solid var(--accent-primary, #0066FF)' : '1px solid var(--border-color, #334155)',
                      background: provider === p ? 'var(--accent-primary-soft, rgba(0,102,255,0.1))' : 'var(--bg-input, transparent)',
                      color: provider === p ? 'var(--accent-primary, #0066FF)' : 'var(--text-secondary, #64748B)',
                    }}>
                    {p}
                  </button>
                ))}
              </div>

              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted, #94A3B8)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Mobile Number
              </label>
              <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="e.g. 0712345678"
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color, #334155)', background: 'var(--bg-input, transparent)', color: 'var(--text-primary, #F8FAFC)', fontSize: '14px', marginBottom: '8px' }}
              />
              
              <p style={{ fontSize: '10px', color: 'var(--text-faint, #475569)', marginBottom: '16px' }}>
                Sandbox mode — no real charge will occur.
              </p>

              {error && <p style={{ fontSize: '12px', color: 'var(--status-error, #EF4444)', marginBottom: '12px' }}>{error}</p>}

              <button onClick={handlePay}
                style={{ width: '100%', padding: '14px', borderRadius: '10px', background: 'var(--accent-primary, #0066FF)', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                Pay TZS {(payload.price?.TZS || 0).toLocaleString()}
              </button>
            </>
          )}

          {step === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: '16px' }}>
              <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border-color, #334155)', borderTopColor: 'var(--accent-primary, #0066FF)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary, #64748B)' }}>Starting your session...</p>
            </div>
          )}

          {step === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0', gap: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--status-online-bg, rgba(34, 197, 94, 0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={28} style={{ color: 'var(--status-online, #22C55E)' }} />
              </div>
              <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>Session Started!</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted, #94A3B8)' }}>Redirecting to monitor...</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
