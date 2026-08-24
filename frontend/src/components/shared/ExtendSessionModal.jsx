import { useState, useEffect } from 'react';
import { X, Clock, Check } from 'lucide-react';
import api from '../../services/api';

export default function ExtendSessionModal({ isOpen, onClose, sessionId, onSuccess }) {
  const [step, setStep] = useState('payment');
  const [hours, setHours] = useState(1);
  const [rate, setRate] = useState(5000);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [provider, setProvider] = useState('Mpesa');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('payment');
    setError(null);
    api.get('/config/session-rate/').then(res => {
      if (res.data?.rate_tzs) setRate(res.data.rate_tzs);
    }).catch(() => {});
  }, [isOpen]);

  const handlePay = async () => {
    if (!phoneNumber) {
      setError('Please enter your mobile money number');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      const res = await api.post(`/sessions/live/${sessionId}/extend/`, {
        hours,
        phone_number: phoneNumber,
        provider,
      });

      if (res.data.success) {
        setStep('success');
        setTimeout(() => {
          onSuccess(res.data.new_scheduled_end_at);
        }, 1500);
      } else {
        setError(res.data.message || 'Extension failed');
        setStep('payment');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Extension failed. Please try again.');
      setStep('payment');
    }
  };

  if (!isOpen) return null;

  const price = hours * rate;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
    }} onClick={(e) => {
      if (e.target === e.currentTarget && step !== 'processing') onClose();
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
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} />
            Extend Session
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
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted, #94A3B8)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Add Time
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {[0.5, 1, 2, 3].map(h => (
                  <button key={h} onClick={() => setHours(h)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                      border: hours === h ? '2px solid var(--accent-primary, #0066FF)' : '1px solid var(--border-color, #334155)',
                      background: hours === h ? 'var(--accent-primary-soft, rgba(0,102,255,0.1))' : 'var(--bg-input, transparent)',
                      color: hours === h ? 'var(--accent-primary, #0066FF)' : 'var(--text-secondary, #64748B)',
                      cursor: 'pointer',
                    }}>
                    {h}hr
                  </button>
                ))}
              </div>

              <div style={{
                padding: '16px', borderRadius: '12px', background: 'var(--bg-input, rgba(15, 23, 42, 0.5))',
                marginBottom: '20px', textAlign: 'center',
              }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted, #94A3B8)' }}>You'll be charged</p>
                <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                  TZS {price.toLocaleString()}
                </p>
              </div>

              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted, #94A3B8)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Payment Method
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['Mpesa', 'Airtel', 'Tigo', 'Halopesa'].map(p => (
                  <button key={p} onClick={() => setProvider(p)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
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
                Sandbox mode. No real charge will occur.
              </p>

              {error && <p style={{ fontSize: '12px', color: 'var(--status-error, #EF4444)', marginBottom: '12px' }}>{error}</p>}

              <button onClick={handlePay}
                style={{ width: '100%', padding: '14px', borderRadius: '10px', background: 'var(--accent-primary, #0066FF)', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                Pay TZS {price.toLocaleString()}
              </button>
            </>
          )}

          {step === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: '16px' }}>
              <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border-color, #334155)', borderTopColor: 'var(--accent-primary, #0066FF)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary, #64748B)' }}>Confirm the payment on your phone...</p>
            </div>
          )}

          {step === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0', gap: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--status-online-bg, rgba(34, 197, 94, 0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={28} style={{ color: 'var(--status-online, #22C55E)' }} />
              </div>
              <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>Session Extended!</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted, #94A3B8)' }}>Added {hours}hr to your session.</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
