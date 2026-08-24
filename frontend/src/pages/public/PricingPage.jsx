import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

const FALLBACK_PRICING = {
  session_hosting_rate_tzs: 5000,
  templates: [],
};

export default function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [pricing, setPricing] = useState(FALLBACK_PRICING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let settled = false;
    api.get('/pricing/', { timeout: 6000 })
      .then(res => {
        if (res.data.success && res.data.data) {
          settled = true;
          setPricing(res.data.data);
        }
      })
      .catch(err => console.error('Failed to fetch pricing', err))
      .finally(() => {
        if (!settled) setPricing(FALLBACK_PRICING);
        setLoading(false);
      });
  }, []);

  const goToApp = () => navigate(isAuthenticated ? '/dashboard' : '/signin');

  const streams = [
    {
      name: 'Session Hosting',
      tagline: 'Pay only when you host a live session',
      price: `TZS ${Number(pricing.session_hosting_rate_tzs || 0).toLocaleString()}`,
      period: '/hour',
      features: [
        'Invite participants by code',
        'Extend anytime, pay-per-hour',
        'No subscription required',
        'Session monitoring dashboard',
      ],
      cta: 'Host a Session',
      highlight: false,
    },
    {
      name: 'Personal Workspace: Hours',
      tagline: 'Buy hours for the specific VM type you need',
      price: 'Per Hour',
      period: 'real rate set per template',
      features: [
        'Buy exactly the hours you need',
        'Usage pauses the moment you stop the VM',
        'Each VM type has its own real hourly rate',
        'Never expires, never auto-renews',
      ],
      cta: 'Launch a Workspace',
      highlight: false,
    },
    {
      name: 'Personal Workspace: Unlimited',
      tagline: 'Subscribe to one VM type for unlimited monthly access',
      price: 'Per Month',
      period: 'real rate set per template',
      features: [
        'Unlimited hours on that specific VM type',
        'Flat monthly fee, no per-hour charges',
        'Expires 30 calendar days after purchase',
        'Subscribe to multiple templates independently',
      ],
      cta: 'Go Unlimited',
      highlight: true,
    },
  ];

  const faqs = [
    {
      q: 'Do I need a subscription to host a session?',
      a: 'No. Hosting is pure pay-per-hour. Pay for exactly the hours you need, when you need them. There is no monthly plan required.'
    },
    {
      q: 'How does workspace pricing work?',
      a: 'Every VM template has its own hourly and monthly price, set by the platform. You either buy a specific number of hours (usage-metered, so time only counts while the VM is actually running) or subscribe to that specific template for unlimited monthly access.'
    },
    {
      q: 'Is the workspace price the same for every VM type?',
      a: 'No. Each VM template has its own hourly and monthly price. Heavier templates may cost more than lighter ones, and a subscription only covers the one template you subscribed to.'
    },
    {
      q: 'What happens when my purchased hours run out?',
      a: "Your workspace simply can't be launched until you buy more hours or subscribe. It is never deleted for running out of balance. It's only removed if it goes genuinely unused for 30 days, regardless of any remaining balance."
    }
  ];

  return (
    <div className="min-h-screen bg-[#050B18]">
      <PublicNavbar />

      <div className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-6">Simple, transparent pricing</h1>
          <p className="text-lg text-[var(--text-secondary)] mb-8">
            Two revenue streams, no hidden fees. Pay only for what you use, or go unlimited.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {streams.map((s) => (
              <div
                key={s.name}
                className={`relative rounded-2xl p-6 flex flex-col ${
                  s.highlight
                    ? 'bg-indigo-900/20 border-2 border-indigo-500/50 glow-primary'
                    : 'glass-card'
                }`}
              >
                {s.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                      Best Value
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{s.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)] h-10">{s.tagline}</p>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-[var(--text-primary)]">{s.price}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{s.period}</p>
                </div>

                <ul className="space-y-4 mb-8 flex-1">
                  {s.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[var(--text-primary)]">
                      <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={goToApp}
                  className={`block w-full text-center py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                    s.highlight
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                      : 'border border-white/20 hover:border-white/40 bg-transparent text-[var(--text-primary)]'
                  }`}
                >
                  {s.cta}
                </button>
              </div>
            ))}
          </div>
        )}
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
    </div>
  );
}
