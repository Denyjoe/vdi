import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldAlert, Smartphone, CheckCircle, XCircle, Loader, Zap } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function UpgradeModal({ onClose }) {
    const { user, setUser, login } = useAuthStore();
    const [step, setStep] = useState('plans'); // 'plans', 'payment', 'waiting', 'success', 'failed'
    const [plans, setPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState(null);
    
    // Payment state
    const [phone, setPhone] = useState('');
    const [provider, setProvider] = useState('Mpesa');
    const [txnId, setTxnId] = useState('');
    const [paymentError, setPaymentError] = useState('');
    
    const pollInterval = useRef(null);
    const pollCount = useRef(0);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await api.get('/subscriptions/plans/');
                if (res.data?.success) {
                    setPlans(res.data.data.filter(p => p.name !== 'free'));
                }
            } catch (err) {
                console.error('Failed to load plans');
            } finally {
                setIsLoading(false);
            }
        };
        fetchPlans();
        
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, []);

    const formatPhone = (val) => {
        const cleaned = ('' + val).replace(/\D/g, '');
        let formatted = cleaned;
        if (cleaned.length > 4) {
            formatted = cleaned.slice(0, 4) + ' ' + cleaned.slice(4);
        }
        if (cleaned.length > 7) {
            formatted = formatted.slice(0, 8) + ' ' + formatted.slice(8, 11);
        }
        return formatted.slice(0, 13);
    };

    const handlePhoneChange = (e) => {
        setPhone(formatPhone(e.target.value));
    };

    const cleanPhoneForApi = (val) => {
        let p = val.replace(/\s/g, '');
        if (p.startsWith('0')) {
            p = '255' + p.substring(1);
        }
        return p;
    };

    const handlePayNow = async () => {
        if (!phone.replace(/\s/g, '')) return;
        setStep('waiting');
        setPaymentError('');
        pollCount.current = 0;
        
        try {
            const res = await api.post('/payments/initiate/', {
                plan_name: selectedPlan.name,
                phone_number: cleanPhoneForApi(phone),
                provider: provider
            });
            
            if (res.data?.success) {
                const newTxnId = res.data.data.transaction_id;
                setTxnId(newTxnId);
                startPolling(newTxnId);
            } else {
                setPaymentError(res.data?.message || 'Payment initiation failed');
                setStep('failed');
            }
        } catch (err) {
            setPaymentError(err.response?.data?.message || 'Payment initiation failed');
            setStep('failed');
        }
    };

    const startPolling = (id) => {
        if (pollInterval.current) clearInterval(pollInterval.current);
        pollInterval.current = setInterval(async () => {
            if (pollCount.current >= 100) {
                clearInterval(pollInterval.current);
                setPaymentError('Payment confirmation timed out.');
                setStep('failed');
                return;
            }
            pollCount.current++;
            
            const onPaymentSuccess = async () => {
                try {
                    const meRes = await api.get('/auth/me/');
                    const updatedUser = meRes.data.data;
                    const accessToken = localStorage.getItem('dit_access_token');
                    const refreshToken = localStorage.getItem('dit_refresh_token');
                    if (login && accessToken && refreshToken) {
                        login(updatedUser, accessToken, refreshToken);
                    } else {
                        setUser(updatedUser);
                    }
                } catch (err) {
                    console.error('Failed to refresh user profile', err);
                }
                setStep('success');
            };

            try {
                const res = await api.get(`/payments/status/${id}/`);
                if (res.data?.success) {
                    const status = res.data.data.status;
                    if (status === 'completed') {
                        clearInterval(pollInterval.current);
                        onPaymentSuccess();
                    } else if (status === 'failed' || status === 'cancelled') {
                        clearInterval(pollInterval.current);
                        setPaymentError('Payment was not successful. Please try again.');
                        setStep('failed');
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }, 3000);
    };

    const getInstruction = () => {
        switch(provider) {
            case 'Mpesa': return 'Enter your M-Pesa PIN when prompted';
            case 'Airtel': return 'Approve the Airtel Money request';
            case 'Tigo': return 'Confirm on your Tigo Pesa app';
            case 'Halopesa': return 'Confirm on your Halopesa menu';
            default: return 'Confirm on your phone';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative bg-[#0D1526] border border-[#1e293b] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-[fadeIn_0.2s_ease-out]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] sticky top-0 bg-[#0D1526]/90 backdrop-blur-md z-10">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                            {step === 'plans' ? (
                                <><ShieldAlert className="w-6 h-6 text-indigo-400" /> Upgrade Your Plan</>
                            ) : (
                                <><Zap className="w-6 h-6 text-indigo-400" /> Complete Your Upgrade</>
                            )}
                        </h3>
                        <p className="text-[var(--text-secondary)] text-sm mt-1">
                            {step === 'plans' ? 'Unlock more compute hours and premium features.' : 
                             selectedPlan ? `${selectedPlan.display_name} — TZS ${Number(selectedPlan.price_tzs).toLocaleString()}/month` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    {isLoading && step === 'plans' ? (
                        <div className="flex justify-center py-12"><Loader className="w-8 h-8 text-indigo-500 animate-spin" /></div>
                    ) : step === 'plans' ? (
                        /* STEP 1: PLANS */
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {plans.map(plan => {
                                const isCurrent = user?.subscription?.plan_name === plan.name;
                                return (
                                    <div key={plan.id} className={`glass-card p-6 rounded-2xl flex flex-col relative ${isCurrent ? 'border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'border-[var(--border-color)]'}`}>
                                        {plan.name === 'pro_host' && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                                Most Popular
                                            </div>
                                        )}
                                        
                                        <h4 className="text-xl font-bold text-[var(--text-primary)] mb-2">{plan.display_name}</h4>
                                        <div className="flex items-baseline gap-1 mb-6">
                                            <span className="text-3xl font-bold text-[var(--text-primary)]">TZS {Number(plan.price_tzs).toLocaleString()}</span>
                                            <span className="text-[var(--text-secondary)]">/mo</span>
                                        </div>

                                        <div className="flex-1 space-y-4 mb-8">
                                            <div className="flex items-start gap-3">
                                                <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                                                <span className="text-sm text-[var(--text-primary)]">
                                                    {plan.compute_hours_per_month === -1 ? 'Unlimited' : plan.compute_hours_per_month} Compute Hours
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                                                <span className="text-sm text-[var(--text-primary)]">
                                                    Create Live Sessions
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                                                <span className="text-sm text-[var(--text-primary)]">
                                                    Up to {plan.max_session_participants === -1 ? 'Unlimited' : plan.max_session_participants} participants
                                                </span>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => {
                                                setSelectedPlan(plan);
                                                setStep('payment');
                                            }}
                                            disabled={isCurrent}
                                            className={`w-full py-3 rounded-xl font-medium transition-all ${
                                                isCurrent ? 'bg-white/5 text-muted cursor-not-allowed' :
                                                plan.name === 'pro_host' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' :
                                                'bg-white/10 hover:bg-white/20 text-primary'
                                            }`}
                                        >
                                            {isCurrent ? 'Current Plan' : 'Select Plan'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : step === 'payment' ? (
                        /* STEP 2: PAYMENT DETAILS */
                        <div className="max-w-md mx-auto animate-[fadeIn_0.3s_ease-out]">
                            <div className="bg-[#111827] p-6 rounded-2xl border border-[#1e293b] mb-6">
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Mobile Money Number</label>
                                <input 
                                    type="text" 
                                    value={phone}
                                    onChange={handlePhoneChange}
                                    placeholder="0712 345 678"
                                    className="w-full bg-[#0d1526] border border-[#1e293b] rounded-xl px-4 py-3 text-[var(--text-primary)] text-lg focus:outline-none focus:border-indigo-500 transition-colors mb-2"
                                />
                                <p className="text-xs text-muted mb-6">Enter your M-Pesa, Airtel, Tigo or Halopesa number</p>

                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Provider</label>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {['Mpesa', 'Airtel', 'Tigo', 'Halopesa'].map(prov => (
                                        <button 
                                            key={prov}
                                            onClick={() => setProvider(prov)}
                                            className={`py-2 px-3 rounded-xl border text-sm font-medium transition-colors ${
                                                provider === prov 
                                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' 
                                                : 'bg-[#0d1526] border-[#1e293b] text-[var(--text-secondary)] hover:border-[var(--border-color)]'
                                            }`}
                                        >
                                            {prov}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="text-center mb-6">
                                <p className="text-3xl font-bold text-[var(--text-primary)] mb-1">TZS {Number(selectedPlan?.price_tzs || 0).toLocaleString()}</p>
                                <p className="text-sm text-muted">≈ ${selectedPlan?.price_usd}/month</p>
                            </div>

                            <button 
                                onClick={handlePayNow}
                                disabled={!phone.replace(/\s/g, '')}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-all shadow-[0_4px_15px_rgba(99,102,241,0.3)] disabled:shadow-none mb-4"
                            >
                                Pay Now
                            </button>
                            
                            <p className="text-xs text-muted text-center px-4">
                                By paying you agree to our Terms of Service. Subscription renews monthly. Cancel anytime.
                            </p>
                        </div>
                    ) : step === 'waiting' ? (
                        /* STEP 3: WAITING FOR CONFIRMATION */
                        <div className="max-w-md mx-auto text-center py-8 animate-[fadeIn_0.3s_ease-out]">
                            <div className="relative inline-flex mb-6">
                                <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
                                <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center justify-center relative z-10">
                                    <Smartphone className="w-10 h-10 text-indigo-400" />
                                </div>
                            </div>
                            
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Check your phone</h2>
                            <p className="text-[var(--text-secondary)] mb-6">
                                A payment request has been sent to <span className="text-[var(--text-primary)] font-medium">{phone}</span>. Confirm it on your phone to complete the upgrade.
                            </p>
                            
                            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 mb-8">
                                <p className="text-indigo-400 font-medium">{getInstruction()}</p>
                            </div>
                            
                            <div className="flex items-center justify-center gap-2 text-[var(--text-secondary)]">
                                <Loader className="w-4 h-4 animate-spin" />
                                <span>Waiting for confirmation<span className="tracking-widest">...</span></span>
                            </div>
                            
                            {/* Sandbox test button - remove in production */}
                            {import.meta.env.DEV && (
                                <div style={{
                                    marginTop: '24px',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    background: 'rgba(245,158,11,0.08)',
                                    border: '1px solid rgba(245,158,11,0.2)'
                                }}>
                                    <p style={{
                                        color: '#fcd34d',
                                        fontSize: '12px',
                                        margin: '0 0 10px',
                                        textAlign: 'center'
                                    }}>
                                        🧪 Sandbox Mode — Simulate payment confirmation
                                    </p>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.post('/payments/callback/', {
                                                    externalId: txnId,
                                                    transactionStatus: 'success',
                                                    responseCode: '000'
                                                });
                                                
                                                if (pollInterval.current) clearInterval(pollInterval.current);
                                                
                                                try {
                                                    const meRes = await api.get('/auth/me/');
                                                    const updatedUser = meRes.data.data;
                                                    const accessToken = localStorage.getItem('dit_access_token');
                                                    const refreshToken = localStorage.getItem('dit_refresh_token');
                                                    if (login && accessToken && refreshToken) {
                                                        login(updatedUser, accessToken, refreshToken);
                                                    } else {
                                                        setUser(updatedUser);
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                }
                                                
                                                setStep('success');
                                            } catch(e) {
                                                console.error(e);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            background: 'rgba(245,158,11,0.2)',
                                            border: '1px solid rgba(245,158,11,0.3)',
                                            color: '#fcd34d',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}>
                                        ✓ Simulate Payment Confirmed
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : step === 'success' ? (
                        /* STEP 4a: SUCCESS */
                        <div className="max-w-md mx-auto text-center py-8 animate-[fadeIn_0.3s_ease-out]">
                            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="w-10 h-10 text-emerald-400" />
                            </div>
                            
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Payment Successful! 🎉</h2>
                            <p className="text-emerald-400 mb-8 font-medium">You are now on {selectedPlan?.display_name}</p>
                            
                            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-6 text-left mb-8">
                                <h4 className="text-[var(--text-primary)] font-medium mb-4">New features unlocked:</h4>
                                <ul className="space-y-3">
                                    <li className="flex gap-3 text-[var(--text-primary)]">
                                        <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" /> Host live sessions
                                    </li>
                                    <li className="flex gap-3 text-[var(--text-primary)]">
                                        <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" /> Up to {selectedPlan?.max_session_participants === -1 ? 'Unlimited' : selectedPlan?.max_session_participants} participants
                                    </li>
                                    <li className="flex gap-3 text-[var(--text-primary)]">
                                        <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" /> {selectedPlan?.compute_hours_per_month === -1 ? 'Unlimited' : selectedPlan?.compute_hours_per_month} hours/month
                                    </li>
                                </ul>
                            </div>
                            
                            <button 
                                onClick={() => {
                                    onClose();
                                    window.location.reload();
                                }}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-primary rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-500/20"
                            >
                                Start Hosting Now &rarr;
                            </button>
                        </div>
                    ) : (
                        /* STEP 4b: FAILED */
                        <div className="max-w-md mx-auto text-center py-8 animate-[fadeIn_0.3s_ease-out]">
                            <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <XCircle className="w-10 h-10 text-rose-400" />
                            </div>
                            
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Payment Failed</h2>
                            <p className="text-[var(--text-secondary)] mb-8">
                                {paymentError || "The payment was not confirmed. Please try again."}
                            </p>
                            
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setStep('payment')}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
                                >
                                    Try Again
                                </button>
                                <button 
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-[#111827] border border-[#1e293b] hover:bg-[#1e293b] text-[var(--text-primary)] rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
