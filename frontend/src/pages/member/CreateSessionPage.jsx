import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, ArrowLeft, Rocket, Monitor as MonitorIcon, Database, Terminal, Check, X } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import CheckoutModal from '../../components/shared/CheckoutModal';

const TemplateIcon = ({ icon, className, size = 16 }) => {
  switch (icon) {
    case 'monitor': return <MonitorIcon size={size} className={className} />;
    case 'database': return <Database size={size} className={className} />;
    case 'terminal': return <Terminal size={size} className={className} />;
    default: return <MonitorIcon size={size} className={className} />;
  }
};

const ControlToggle = ({ label, description, value, onChange, onColor = '#00FF87' }) => (
  <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${value ? 'bg-card border-border' : 'bg-card border-border'}`}
    style={value ? { backgroundColor: onColor + '08', borderColor: onColor + '25' } : {}}>
    <div className="flex items-center gap-3 flex-1">
      <div>
        <p className="text-sm font-medium text-primary">{label}</p>
        <p className="text-[11px] text-muted mt-0.5">{description}</p>
      </div>
    </div>
    <button onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 active:scale-95 ${value ? '' : 'bg-[var(--border-strong)]'}`}
      style={value ? { backgroundColor: onColor } : {}}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${value ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  </div>
);

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
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
    
    // Instead of using a normal plan, we mock a plan object for the CheckoutModal
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
      navigate(`/host/session/${data.id}`, { state: { session: data } });
    }
  };

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6">
      
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#0066FF]/10 flex items-center justify-center">
            <Radio size={18} className="text-[#0066FF]" />
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">
            Create Session
          </h1>
        </div>
        <p className="text-sm text-muted ml-12">
          Set up a live session and pay per hour
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        
        {/* Left Column: Details */}
        <div className="space-y-6">
          <div className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-primary mb-4">Session Details</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Session Name</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={e => setSessionName(e.target.value)}
                  className="w-full bg-input border border-border-strong rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:border-[#0066FF] transition-colors"
                  placeholder="e.g. Intro to Python Lab"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">VM Template</label>
                <div className="grid grid-cols-1 gap-2">
                  {templates.map(t => (
                    <div key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedTemplate?.id === t.id ? 'bg-[#0066FF]/10 border-[#0066FF]' : 'bg-input border-border-strong hover:border-slate-500'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedTemplate?.id === t.id ? 'bg-[#0066FF]/20 text-[#0066FF]' : 'bg-card text-muted'}`}>
                        <TemplateIcon icon={t.icon} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-primary">{t.name}</p>
                        <p className="text-[11px] text-muted">{t.cpu_cores} vCPU • {t.ram_gb}GB RAM</p>
                      </div>
                      {selectedTemplate?.id === t.id && <Check size={16} className="text-[#0066FF]" />}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Max Participants</label>
                <input
                  type="number"
                  min="1" max="100"
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(parseInt(e.target.value) || 1)}
                  className="w-full bg-input border border-border-strong rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:border-[#0066FF] transition-colors"
                />
              </div>
            </div>
          </div>
          
        </div>

        {/* Right Column: Controls */}
        <div className="space-y-6">
          <div className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-primary mb-4">Environment Controls</h3>
            <div className="space-y-4">
              <ControlToggle 
                label="Clipboard Sync" 
                description="Allow copy/paste between local and VM" 
                value={restrictions.clipboard} 
                onChange={v => setRestrictions({...restrictions, clipboard: v})} 
                onColor="#00A3FF" 
              />
              <ControlToggle 
                label="File Transfer" 
                description="Allow uploading/downloading files" 
                value={restrictions.file_transfer} 
                onChange={v => setRestrictions({...restrictions, file_transfer: v})} 
                onColor="#FFB800" 
              />
            </div>
          </div>
          
          <div className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-primary mb-4">Duration & Pricing</h3>
            
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">How long do you need?</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              {[1, 2, 3].map(h => (
                <button key={h}
                  onClick={() => { setHours(h); setCustomHours(h.toString()); }}
                  style={{
                    flex: 1,
                    padding: '16px',
                    borderRadius: '12px',
                    border: hours === h ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: hours === h ? 'var(--accent-primary-soft)' : 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{h}h</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    TZS {(h * rate).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
            
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Or enter custom hours</label>
            <input type="number" 
              min="0.5" max="24" step="0.5"
              value={customHours}
              onChange={e => {
                setCustomHours(e.target.value);
                setHours(parseFloat(e.target.value) || 0);
              }}
              className="w-full bg-input border border-border-strong rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:border-[#0066FF] transition-colors"
            />
            
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: 'var(--bg-input)',
              textAlign: 'center',
              marginTop: '16px',
            }}>
              <p className="text-muted text-sm uppercase font-semibold">Total Cost</p>
              <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>
                TZS {(hours * rate).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

      </div>
      
      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-nav-hover border border-border-strong text-secondary text-sm font-medium hover:border-slate-500 active:scale-95 transition-all">
          <ArrowLeft size={15} />
          Cancel
        </button>
        
        <button onClick={handleStartCheckout} disabled={!canProceed()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC] active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-30 disabled:cursor-not-allowed">
          <Rocket size={15} />
          Pay & Start Session
        </button>
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
