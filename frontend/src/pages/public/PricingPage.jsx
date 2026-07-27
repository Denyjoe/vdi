import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';
import useAuthStore from '../../store/authStore';
import CheckoutModal from '../../components/shared/CheckoutModal';

export default function PricingPage() {
  const [currency, setCurrency] = useState('USD');
  const [billing, setBilling] = useState('monthly');
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const handlePlanClick = (plan) => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    
    if (plan.name === 'Free') {
      navigate('/dashboard');
      return;
    }
    
    if (plan.name === 'Institution') {
      window.location.href = 'mailto:support@clouddesk.io?subject=Institution Plan Inquiry';
      return;
    }
    
    setCheckoutPlan(plan);
    setShowCheckout(true);
  };

  const handleCheckoutSuccess = () => {
    setShowCheckout(false);
    navigate('/create-session');
  };

  const plans = [
    {
      name: 'Free',
      price: { USD: 0, TZS: 0 },
      period: '/month',
      description: 'Perfect for exploring the platform and quick edits.',
      features: [
        '5 compute hours/month',
        'Access 12+ VM templates',
        'Join public sessions',
        'Join groups with invite code',
        'Basic support'
      ],
      ctaText: 'Get Started Free',
      ctaStyle: 'border border-white/20 hover:border-white/40 bg-transparent text-primary'
    },
    {
      name: 'Starter',
      price: { USD: 9, TZS: 23000 },
      period: '/month',
      description: 'For students and professionals needing regular access.',
      badge: 'Most Popular',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      features: [
        '20 compute hours/month',
        'Create unlimited groups',
        'Share materials and assignments',
        '3 persistent workspaces',
        'Priority support'
      ],
      ctaText: 'Start Starter',
      ctaStyle: 'border border-white/20 hover:border-white/40 bg-transparent text-[var(--text-primary)]'
    },
    {
      name: 'Pro',
      price: { USD: 19, TZS: 49000 },
      period: '/month',
      description: 'For instructors and heavy users hosting sessions.',
      isPro: true,
      features: [
        '80 compute hours/month',
        'Create live sessions',
        'Up to 50 participants/session',
        'Session monitoring dashboard',
        '10 persistent workspaces',
        'Analytics and reports'
      ],
      ctaText: 'Go Pro',
      ctaStyle: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
    },
    {
      name: 'Institution',
      price: { USD: 99, TZS: 255000 },
      period: '/month',
      description: 'For schools, universities, and corporate training.',
      badge: 'Best Value',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      features: [
        'Unlimited compute hours',
        'Unlimited users',
        'Custom VM templates',
        'Bulk user management',
        'Dedicated support',
        'Full usage analytics'
      ],
      ctaText: 'Contact Us',
      ctaStyle: 'border border-white/20 hover:border-white/40 bg-transparent text-primary'
    }
  ];

  const faqs = [
    {
      q: 'What is a compute hour?',
      a: 'A compute hour is 60 minutes of active VM usage. Time is only tracked when your VM is actually running. When you stop your VM, you stop using your compute hours.'
    },
    {
      q: 'Can I carry over unused hours?',
      a: 'No, compute hours reset at the beginning of each billing cycle to keep our pricing predictable and simple.'
    },
    {
      q: 'Do I need a credit card for the free plan?',
      a: 'No! The free plan is completely free forever. We only ask for a credit card when you decide to upgrade to a paid plan.'
    },
    {
      q: 'Can I switch between USD and TZS?',
      a: 'Yes, you can choose your preferred currency at checkout. TZS pricing is specifically optimized for East African users.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#050B18]">
      <PublicNavbar />

      <div className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-6">Simple, transparent pricing</h1>
          <p className="text-lg text-[var(--text-secondary)] mb-8">
            Start free, scale as you grow. No hidden fees. Pay in USD or TZS.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <div className="inline-flex items-center p-1 bg-white/5 rounded-full border border-[var(--border-color)]">
              <button 
                onClick={() => setBilling('monthly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${billing === 'monthly' ? 'bg-indigo-600 text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setBilling('annually')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${billing === 'annually' ? 'bg-indigo-600 text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
              >
                Annually
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full border border-green-500/20">Save 20%</span>
              </button>
            </div>
            
            <div className="inline-flex items-center p-1 bg-white/5 rounded-full border border-[var(--border-color)]">
              <button 
                onClick={() => setCurrency('USD')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${currency === 'USD' ? 'bg-white/10 text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                USD
              </button>
              <button 
                onClick={() => setCurrency('TZS')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${currency === 'TZS' ? 'bg-white/10 text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                TZS
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const price = plan.price[currency];
            const displayPrice = billing === 'annually' && price > 0 ? Math.floor(price * 0.8) : price;
            const currencySymbol = currency === 'USD' ? '$' : 'TZS ';
            
            return (
              <div 
                key={plan.name} 
                className={`relative rounded-2xl p-6 ${
                  plan.isPro 
                    ? 'bg-indigo-900/20 border-2 border-indigo-500/50 glow-primary transform md:-translate-y-4' 
                    : 'glass-card'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${plan.badgeColor}`}>
                      {plan.badge}
                    </span>
                  </div>
                )}
                
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{plan.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)] h-10">{plan.description}</p>
                </div>
                
                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[var(--text-primary)]">
                      {currencySymbol}{displayPrice.toLocaleString()}
                    </span>
                    <span className="text-[var(--text-secondary)]">{plan.period}</span>
                  </div>
                  {billing === 'annually' && price > 0 && (
                    <p className="text-sm text-green-400 mt-1">Billed annually</p>
                  )}
                </div>
                
                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[var(--text-primary)]">
                      <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-auto">
                  <button 
                    onClick={() => handlePlanClick(plan)}
                    className={`block w-full text-center py-3 px-4 rounded-xl font-medium transition-all duration-300 ${plan.ctaStyle}`}
                  >
                    {plan.ctaText}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--border-color)] bg-white/[0.02] py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">Frequently asked questions</h2>
          </div>
          
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i} className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{faq.q}</h3>
                <p className="text-[var(--text-secondary)]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <CheckoutModal 
        plan={checkoutPlan}
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={handleCheckoutSuccess} 
      />
    </div>
  );
}
