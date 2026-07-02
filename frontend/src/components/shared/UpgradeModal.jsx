import React, { useState, useEffect } from 'react';
import { X, CheckCircle, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function UpgradeModal({ onClose }) {
    const { user, setUser } = useAuthStore();
    const [plans, setPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await api.get('/subscriptions/plans/');
                if (res.data?.success) {
                    setPlans(res.data.data.filter(p => p.name !== 'institution')); // Hide institution plan
                }
            } catch (err) {
                setError('Failed to load plans');
            } finally {
                setIsLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const handleUpgrade = async (planId) => {
        setIsUpgrading(true);
        setError('');
        try {
            const res = await api.post('/subscriptions/change/', { plan_id: planId });
            if (res.data?.success) {
                // Update user subscription in store if possible
                if (res.data.data?.subscription) {
                    const updatedUser = { ...user, subscription: res.data.data.subscription };
                    setUser(updatedUser);
                }
                alert('Successfully upgraded plan!');
                onClose();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upgrade plan');
        } finally {
            setIsUpgrading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative bg-[#0D1526] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-[fadeIn_0.2s_ease-out]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#0D1526]/90 backdrop-blur-md z-10">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <ShieldAlert className="w-6 h-6 text-indigo-400" />
                            Upgrade Your Plan
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">Unlock more compute hours and premium features.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-center">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {plans.map(plan => {
                                const isCurrent = user?.subscription?.plan_name === plan.name;
                                return (
                                    <div key={plan.id} className={`glass-card p-6 rounded-2xl flex flex-col relative ${isCurrent ? 'border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'border-white/5'}`}>
                                        {plan.name === 'pro' && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                                Most Popular
                                            </div>
                                        )}
                                        
                                        <h4 className="text-xl font-bold text-white mb-2">{plan.display_name}</h4>
                                        <div className="flex items-baseline gap-1 mb-6">
                                            <span className="text-3xl font-bold text-white">${plan.price_usd}</span>
                                            <span className="text-slate-400">/mo</span>
                                        </div>

                                        <div className="flex-1 space-y-4 mb-8">
                                            <div className="flex items-start gap-3">
                                                <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                                                <span className="text-sm text-slate-300">
                                                    {plan.compute_hours_per_month === -1 ? 'Unlimited' : plan.compute_hours_per_month} Compute Hours
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                                                <span className="text-sm text-slate-300">
                                                    {plan.max_workspaces === -1 ? 'Unlimited' : plan.max_workspaces} Workspaces
                                                </span>
                                            </div>
                                            {plan.name !== 'free' && (
                                                <div className="flex items-start gap-3">
                                                    <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                                                    <span className="text-sm text-slate-300">Create Live Sessions</span>
                                                </div>
                                            )}
                                        </div>

                                        <button 
                                            onClick={() => handleUpgrade(plan.id)}
                                            disabled={isCurrent || isUpgrading}
                                            className={`w-full py-3 rounded-xl font-medium transition-all ${
                                                isCurrent ? 'bg-white/5 text-slate-500 cursor-not-allowed' :
                                                plan.name === 'pro' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' :
                                                'bg-white/10 hover:bg-white/20 text-white'
                                            }`}
                                        >
                                            {isCurrent ? 'Current Plan' : isUpgrading ? 'Upgrading...' : 'Select Plan'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
