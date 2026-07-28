import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Monitor, CheckCircle, ArrowRight, Check,
  CreditCard, Wallet, Landmark, Globe, ChevronDown,
  Layers, Video, Timer, Activity,
} from 'lucide-react';
import JoinByCodeModal from '../../components/shared/JoinByCodeModal';
import NetworkGlobe from '../../components/shared/NetworkGlobe';
import api from '../../services/api';

const TRUST_CATEGORIES = [
  'Universities', 'Design Studios', 'Dev Bootcamps', 'Enterprises', 'Exam Centers',
];

const FAQ_ITEMS = [
  {
    q: 'What is CloudDesk, and why should I choose it?',
    a: 'CloudDesk is a browser-based virtual desktop platform. Launch CAD, Data Science, or Programming environments instantly no local installs, no hardware upgrades, just a browser tab.',
  },
  {
    q: 'How does pricing work?',
    a: 'Joining sessions is free. Hosting plans are billed monthly and include a set number of workspace hours, with usage tracked transparently in your dashboard.',
  },
  {
    q: 'What is Exam Mode?',
    a: 'Exam Mode locks down internet access, disables copy-paste, and lets hosts monitor participants in real time built for assessments and proctored testing.',
  },
  {
    q: 'Can I host a workshop or class?',
    a: 'Yes. Hosting plans let you spin up a live session and invite participants by code each one gets their own isolated, pre-configured workspace.',
  },
  {
    q: 'Is my data and session secure?',
    a: 'Each workspace is isolated per user or team. Only your account and invited participants can access a given session no one else has visibility by default.',
  },
];

const FALLBACK_PLANS = [
  { id: 'free', name: 'free', display_name: 'Free', price_usd: 0, compute_hours_per_month: 5, can_host_sessions: false, max_session_participants: 0 },
  { id: 'personal_host', name: 'personal_host', display_name: 'Personal Host', price_usd: 9, compute_hours_per_month: 20, can_host_sessions: true, max_session_participants: 10 },
  { id: 'pro_host', name: 'pro_host', display_name: 'Pro Host', price_usd: 19, compute_hours_per_month: 80, can_host_sessions: true, max_session_participants: 50 },
  { id: 'institution', name: 'institution', display_name: 'Institution', price_usd: 99, compute_hours_per_month: -1, can_host_sessions: true, max_session_participants: 200 },
];

// ---------- small animation helpers ----------

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        obs.unobserve(el);
      }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function Reveal({ children, className = '', delay = 0 }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`h-full transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}

function useCycle(length, intervalMs = 2200) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(v => (v + 1) % length), intervalMs);
    return () => clearInterval(id);
  }, [length, intervalMs]);
  return i;
}

function useJitterCounter(base, amplitude, intervalMs = 2000) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setV(prev => {
        const delta = Math.random() < 0.5 ? -1 : 1;
        return Math.min(base + amplitude, Math.max(base - amplitude, prev + delta));
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [base, amplitude, intervalMs]);
  return v;
}

function useLiveMeter(max, step = 1, intervalMs = 1400) {
  const [v, setV] = useState(1);
  useEffect(() => {
    const id = setInterval(() => {
      setV(prev => (prev + step > max ? 1 : prev + step));
    }, intervalMs);
    return () => clearInterval(id);
  }, [max, step, intervalMs]);
  return v;
}

function useLiveSparkline(points = 16) {
  const [data, setData] = useState(() => Array.from({ length: points }, () => 30 + Math.random() * 20));
  useEffect(() => {
    const id = setInterval(() => {
      setData(prev => {
        const last = prev[prev.length - 1];
        const next = Math.min(85, Math.max(15, last + (Math.random() * 24 - 12)));
        return [...prev.slice(1), next];
      });
    }, 900);
    return () => clearInterval(id);
  }, []);
  return data;
}

const HERO_WORDS = ['CAD Workstations', 'Data Science Rigs', 'Dev Environments', 'Exam Sessions'];

function useTypewriter(words, typeSpeed = 70, deleteSpeed = 40, pause = 1600) {
  const [text, setText] = useState('');
  const indexRef = useRef(0);
  const charRef = useRef(0);
  const deletingRef = useRef(false);

  useEffect(() => {
    let timeoutId;
    const tick = () => {
      const word = words[indexRef.current];
      if (!deletingRef.current) {
        charRef.current += 1;
        setText(word.slice(0, charRef.current));
        if (charRef.current === word.length) {
          deletingRef.current = true;
          return pause;
        }
        return typeSpeed;
      } else {
        charRef.current -= 1;
        setText(word.slice(0, charRef.current));
        if (charRef.current === 0) {
          deletingRef.current = false;
          indexRef.current = (indexRef.current + 1) % words.length;
        }
        return deleteSpeed;
      }
    };
    const loop = () => {
      const delay = tick();
      timeoutId = setTimeout(loop, delay);
    };
    timeoutId = setTimeout(loop, typeSpeed);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return text;
}

// ---------- illustrated value-prop cards ----------

function GlobeCard() {
  return (
    <div className="h-full flex flex-col p-8 rounded-lg bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-slate-800 hover:border-[#6C63FF]/40 hover:-translate-y-1 transition-all duration-300">
      <h3 className="text-lg font-bold text-[#0F172A] dark:text-white mb-3">Instant Provisioning</h3>
      <p className="text-[#475569] dark:text-slate-300 text-sm leading-relaxed mb-4">
        Launch a cloud desktop in seconds from anywhere. No complex setup — just click and start working.
      </p>
      <div className="flex-1 min-h-40 flex items-center justify-center">
        <NetworkGlobe size={160} />
      </div>
    </div>
  );
}

function AffordableCard() {
  const icons = [CreditCard, Wallet, Landmark];
  return (
    <div className="h-full flex flex-col p-8 rounded-lg bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-slate-800 hover:border-[#6C63FF]/40 hover:-translate-y-1 transition-all duration-300">
      <h3 className="text-lg font-bold text-[#0F172A] dark:text-white mb-3">Affordable</h3>
      <p className="text-[#475569] dark:text-slate-300 text-sm leading-relaxed mb-2">
        Join sessions for free, or upgrade for a fair, transparent monthly price.
      </p>
      <span className="inline-block mb-2 text-[10px] font-mono tracking-wider px-2 py-1 rounded bg-[#6C63FF]/10 text-[#6C63FF] font-semibold">
        FREE TO JOIN
      </span>
      <div className="relative flex-1 min-h-40 flex items-center justify-center">
        <div className="relative w-36 h-36">
          <div className="absolute inset-0 rounded-full border border-dashed border-[#6C63FF]/25" />
          <div className="absolute inset-0 orbit-ring">
            {icons.map((Icon, i) => {
              const deg = i * 120;
              return (
                <div
                  key={deg}
                  className="absolute top-1/2 left-1/2 w-9 h-9 -ml-[18px] -mt-[18px]"
                  style={{ transform: `rotate(${deg}deg) translate(64px) rotate(${-deg}deg)` }}
                >
                  <div className="orbit-icon w-9 h-9 rounded-full bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-slate-700 shadow flex items-center justify-center">
                    <Icon size={16} className="text-[#6C63FF]" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-[#6C63FF] flex items-center justify-center shadow-lg shadow-[#6C63FF]/30">
              <span className="text-white font-bold text-lg">$</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserFriendlyCard() {
  const activeTemplate = useCycle(3, 2200);
  const internetOn = useCycle(2, 2400) === 1;
  return (
    <div className="h-full flex flex-col p-8 rounded-lg bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-slate-800 hover:border-[#6C63FF]/40 hover:-translate-y-1 transition-all duration-300">
      <h3 className="text-lg font-bold text-[#0F172A] dark:text-white mb-3">User-Friendly</h3>
      <p className="text-[#475569] dark:text-slate-300 text-sm leading-relaxed mb-4">
        Spin up a session in a few clicks, with fast support on hand whenever you need it.
      </p>
      <div className="flex-1 flex flex-col justify-center rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#1E293B]/40 p-4">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] mb-2">Participant Environment</p>
        <div className="space-y-1.5 mb-3">
          {['CAD Workstation', 'Data Science Lab', 'Dev Sandbox'].map((t, i) => (
            <div
              key={t}
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs border transition-colors duration-500 ${i === activeTemplate ? 'bg-[#6C63FF]/10 border-[#6C63FF]/30 text-[#6C63FF] font-semibold' : 'border-transparent text-[#64748B] dark:text-slate-400'}`}
            >
              <span>{t}</span>
              {i === activeTemplate && <Check size={13} />}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-slate-400 border-t border-[#E2E8F0] dark:border-slate-700 pt-2">
          <span className="flex items-center gap-1"><Globe size={12} /> Internet Access</span>
          <span className={`w-7 h-4 rounded-full relative transition-colors duration-500 ${internetOn ? 'bg-emerald-400/70' : 'bg-[#E2E8F0] dark:bg-slate-700'}`}>
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-500 ${internetOn ? 'left-3.5' : 'left-0.5'}`} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- illustrated advanced-feature cards ----------

function TemplatesFeature() {
  const activeTemplate = useCycle(3, 2200);
  return (
    <div className="h-full flex flex-col p-8 rounded-lg bg-[#F8FAFC] dark:bg-[#0A1124] border border-[#E2E8F0] dark:border-slate-800 hover:-translate-y-1 transition-all duration-300">
      <div className="rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-[#0F172A] p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] mb-2">Choose your environment</p>
        <div className="space-y-1.5">
          {['CAD Workstation', 'Data Science Lab', 'Dev Sandbox'].map((t, i) => (
            <div
              key={t}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors duration-500 ${i === activeTemplate ? 'bg-[#6C63FF]/10 border-[#6C63FF]/30 text-[#6C63FF] font-semibold' : 'border-transparent text-[#64748B] dark:text-slate-400'}`}
            >
              <span>{t}</span>
              {i === activeTemplate && <Check size={14} />}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 shrink-0 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center border border-[#6C63FF]/20">
          <Layers className="text-[#6C63FF]" size={22} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#0F172A] dark:text-white mb-2">CAD, Data Science & Dev Templates</h3>
          <p className="text-[#475569] dark:text-slate-300 text-sm leading-relaxed">
            Pre-configured environments for the tools your team already uses — spin one up in a click.
          </p>
        </div>
      </div>
    </div>
  );
}

function LiveSessionsFeature() {
  const count = useJitterCounter(12, 3, 1800);
  const activeAvatar = useCycle(4, 1200);
  const avatars = ['A', 'M', 'S', 'K'];
  return (
    <div className="h-full flex flex-col p-8 rounded-lg bg-[#F8FAFC] dark:bg-[#0A1124] border border-[#E2E8F0] dark:border-slate-800 hover:-translate-y-1 transition-all duration-300">
      <div className="rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-[#0F172A] p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Session Roster
          </span>
          <span className="text-xs font-mono text-emerald-500 font-semibold tabular-nums">{count} joined</span>
        </div>
        <div className="flex -space-x-2">
          {avatars.map((a, i) => (
            <div
              key={a}
              className={`w-8 h-8 rounded-full ring-2 dark:ring-[#0F172A] bg-gradient-to-br from-[#6C63FF] to-[#8B85FF] flex items-center justify-center text-[10px] text-white font-semibold transition-all duration-500 ${activeAvatar === i ? 'ring-emerald-400 scale-110' : 'ring-white'}`}
            >
              {a}
            </div>
          ))}
          <div className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#0F172A] bg-[#F1F5F9] dark:bg-slate-800 flex items-center justify-center text-[10px] text-[#64748B] dark:text-slate-400 font-semibold">
            +8
          </div>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 shrink-0 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center border border-[#6C63FF]/20">
          <Video className="text-[#6C63FF]" size={22} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#0F172A] dark:text-white mb-2">Live Hosted Sessions</h3>
          <p className="text-[#475569] dark:text-slate-300 text-sm leading-relaxed">
            Host interactive workshops where every participant gets their own pre-configured environment.
          </p>
        </div>
      </div>
    </div>
  );
}

function PayAsYouGoFeature() {
  const maxHours = 72;
  const hours = useLiveMeter(maxHours, 1, 900);
  const cost = (hours * 0.5).toFixed(2);
  const pct = (hours / maxHours) * 100;
  return (
    <div className="h-full flex flex-col p-8 rounded-lg bg-[#F8FAFC] dark:bg-[#0A1124] border border-[#E2E8F0] dark:border-slate-800 hover:-translate-y-1 transition-all duration-300">
      <div className="rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-[#0F172A] p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-mono uppercase tracking-wider text-[#94A3B8]">Session Hours</span>
          <span className="font-mono text-[#0F172A] dark:text-white font-semibold tabular-nums">{hours}h</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#F1F5F9] dark:bg-slate-800 overflow-hidden mb-4">
          <div className="h-full bg-[#6C63FF] transition-all duration-700 ease-linear" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono uppercase tracking-wider text-[#94A3B8]">Est. Cost</span>
          <span className="font-mono text-emerald-500 font-semibold tabular-nums">${cost}</span>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 shrink-0 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center border border-[#6C63FF]/20">
          <Timer className="text-[#6C63FF]" size={22} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#0F172A] dark:text-white mb-2">Pay as You Go</h3>
          <p className="text-[#475569] dark:text-slate-300 text-sm leading-relaxed">
            Flexible hourly billing that fits your usage and budget. No monthly commitments, no surprises.
          </p>
        </div>
      </div>
    </div>
  );
}

function MonitoringFeature() {
  const data = useLiveSparkline();
  const max = 100;
  const w = 220;
  const h = 60;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  const current = Math.round(data[data.length - 1]);
  return (
    <div className="h-full flex flex-col p-8 rounded-lg bg-[#F8FAFC] dark:bg-[#0A1124] border border-[#E2E8F0] dark:border-slate-800 hover:-translate-y-1 transition-all duration-300">
      <div className="rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-[#0F172A] p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8]">CPU Usage</span>
          <span className="text-xs font-mono text-[#6C63FF] font-semibold">{current}%</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16 overflow-visible">
          <polyline
            points={points}
            fill="none"
            stroke="#6C63FF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 shrink-0 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center border border-[#6C63FF]/20">
          <Activity className="text-[#6C63FF]" size={22} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#0F172A] dark:text-white mb-2">Real-Time Resource Monitoring</h3>
          <p className="text-[#475569] dark:text-slate-300 text-sm leading-relaxed">
            Keep an eye on CPU and memory for every workspace, right from your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div className="border-b border-[#E2E8F0] dark:border-slate-800">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-6 text-left"
      >
        <span className="text-base sm:text-lg font-semibold text-[#0F172A] dark:text-white">{item.q}</span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-[#6C63FF] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 pb-6' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <p className="text-[#475569] dark:text-slate-300 leading-relaxed pr-8">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [plans, setPlans] = useState([]);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [activeSection, setActiveSection] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const typed = useTypewriter(HERO_WORDS);

  useEffect(() => {
    let settled = false;
    const fetchPricing = async () => {
      try {
        const res = await api.get('/pricing/', { timeout: 6000 });
        if (res.data.success && res.data.data.plans?.length) {
          settled = true;
          setPlans(res.data.data.plans);
        }
      } catch (err) {
        console.error('Failed to fetch pricing, using fallback plans', err);
      } finally {
        if (!settled) setPlans(FALLBACK_PLANS);
        setLoadingPricing(false);
      }
    };
    fetchPricing();

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, { threshold: 0.5 });

    const hero = document.getElementById('hero');
    const features = document.getElementById('features');
    const pricing = document.getElementById('pricing');

    if (hero) observer.observe(hero);
    if (features) observer.observe(features);
    if (pricing) observer.observe(pricing);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#050B18] overflow-x-hidden selection:bg-[#6C63FF]/30 selection:text-indigo-200 font-sans">

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${isScrolled ? 'bg-[#17132B]/90 backdrop-blur-md border-b border-white/10 py-0' : 'bg-transparent border-b border-transparent py-2'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" onClick={(e) => scrollToSection(e, 'hero')} className="flex items-center gap-2">
            <Monitor className="w-7 h-7 text-[#8B85FF]" />
            <span className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>CloudDesk</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className={`text-sm font-medium transition-colors duration-200 pb-1 border-b-2 ${activeSection === 'features' ? 'text-[#8B85FF] border-[#8B85FF]' : 'text-slate-200 border-transparent hover:text-white'}`}
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={(e) => scrollToSection(e, 'pricing')}
              className={`text-sm font-medium transition-colors duration-200 pb-1 border-b-2 ${activeSection === 'pricing' ? 'text-[#8B85FF] border-[#8B85FF]' : 'text-slate-200 border-transparent hover:text-white'}`}
            >
              Pricing
            </a>
            <div className="flex items-center gap-3 ml-4">
              <Link
                to="/signin"
                className="font-mono uppercase tracking-wider text-xs font-medium px-4 py-2.5 rounded text-white/80 hover:text-white transition-colors"
              >
                Log in
              </Link>
              <button
                onClick={() => setShowJoinModal(true)}
                className="font-mono uppercase tracking-wider text-xs font-medium px-4 py-2.5 rounded bg-white text-black hover:bg-white/90 transition-colors"
              >
                Join Session
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section — dark */}
      <div id="hero" className="relative pt-40 pb-24 lg:pt-48 lg:pb-32 overflow-hidden bg-[#17132B]">
        {/* grid backdrop */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, black 40%, transparent 100%)',
          }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(closest-side, rgba(108,99,255,0.35), transparent)' }}
        />

        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#B4AEFF] text-xs font-mono uppercase tracking-wider mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B85FF] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8B85FF]"></span>
            </span>
            The modern virtual desktop platform
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-normal text-white tracking-tight mb-8 leading-[1.15]"
            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
          >
            What if you could launch <br className="hidden sm:block" />
            <span className="text-[#8B85FF]">{typed}</span>
            <span className="inline-block w-[2px] h-[0.9em] bg-[#8B85FF] ml-1 align-middle animate-pulse" />
            <br className="hidden sm:block" />
            {' '}from any browser?
          </h1>

          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            CloudDesk is a browser-based virtual desktop platform launch powerful environments instantly,
            join live sessions for free, or upgrade to host your own.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signin"
              className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-white/90 text-[#17132B] rounded font-mono text-xs uppercase tracking-wider font-semibold transition-all flex items-center justify-center gap-2 hover:scale-105"
            >
              Get Started <ArrowRight size={16} />
            </Link>
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full sm:w-auto px-7 py-3.5 bg-transparent hover:bg-white/5 text-white border border-white/20 rounded font-mono text-xs uppercase tracking-wider font-semibold transition-all"
            >
              Join with Code
            </button>
          </div>
        </div>

        {/* dashboard mock */}
        <Reveal className="max-w-3xl mx-auto px-6 mt-16 relative z-10">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <span className="text-xs font-mono uppercase tracking-wider text-white/50">My Workspaces</span>
              <span className="text-xs font-mono text-emerald-400">● 3 running</span>
            </div>
            <div className="space-y-2">
              {[
                { name: 'cad-workstation-01', spec: '8 vCPU / 16 GB / RTX A4000', time: '42m' },
                { name: 'data-science-lab', spec: '4 vCPU / 32 GB / Ubuntu', time: '1h 12m' },
                { name: 'dev-sandbox-03', spec: '2 vCPU / 8 GB / Windows 11', time: '5m' },
              ].map(row => (
                <div key={row.name} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-3 min-w-0">
                    <Monitor size={16} className="text-[#8B85FF] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{row.name}</div>
                      <div className="text-xs text-slate-400 truncate">{row.spec}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-slate-500">{row.time}</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Running</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* Trusted by */}
      <div className="py-10 bg-[#17132B] border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-xs font-mono uppercase tracking-widest text-slate-500 mb-6">Trusted by teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {TRUST_CATEGORIES.map(cat => (
              <span key={cat} className="text-sm font-medium text-slate-400">{cat}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Why you'll love it */}
      <div className="py-24 bg-[#F8FAFC] dark:bg-[#0A1124] border-b border-[#E2E8F0] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal className="text-center mb-16 max-w-2xl mx-auto">
            <p className="text-xs font-mono uppercase tracking-widest text-[#6C63FF] font-semibold mb-4">Why you'll love it</p>
            <h2 className="text-3xl lg:text-4xl font-normal text-[#0F172A] dark:text-white mb-4" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Simple. Fast. Built for you.
            </h2>
            <p className="text-[#475569] dark:text-slate-300">
              CloudDesk gives you the workspace infrastructure you need, without the complexity you don't.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            <Reveal delay={0}><GlobeCard /></Reveal>
            <Reveal delay={100}><AffordableCard /></Reveal>
            <Reveal delay={200}><UserFriendlyCard /></Reveal>
          </div>
        </div>
      </div>

      {/* Advanced features */}
      <div id="features" className="py-24 bg-white dark:bg-[#050B18]">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-normal text-[#0F172A] dark:text-white mb-4" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Everything you need to teach, host, and build
            </h2>
            <p className="text-[#475569] dark:text-slate-300">
              From instant templates to live proctored sessions CloudDesk gives you the building blocks, with a clean experience.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6">
            <Reveal delay={0}><TemplatesFeature /></Reveal>
            <Reveal delay={100}><LiveSessionsFeature /></Reveal>
            <Reveal delay={0}><PayAsYouGoFeature /></Reveal>
            <Reveal delay={100}><MonitoringFeature /></Reveal>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" className="py-24 bg-[#F8FAFC] dark:bg-[#0A1124] border-y border-[#E2E8F0] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal className="text-center mb-16 max-w-2xl mx-auto">
            <p className="text-xs font-mono uppercase tracking-widest text-[#6C63FF] font-semibold mb-4">Pricing</p>
            <h2 className="text-3xl lg:text-4xl font-normal text-[#0F172A] dark:text-white mb-4" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Transparent, affordable pricing
            </h2>
            <p className="text-[#475569] dark:text-slate-300">Join for free. Upgrade whenever you're ready to host.</p>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {loadingPricing ? (
              <div className="col-span-full flex justify-center py-12"><div className="w-8 h-8 rounded-full border-4 border-[#6C63FF] border-t-transparent animate-spin"></div></div>
            ) : (
              plans.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 80}>
                  <div className="p-8 rounded-lg bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-slate-800 hover:border-[#6C63FF]/40 hover:-translate-y-1 transition-all duration-300 relative flex flex-col h-full">
                    {plan.name === 'pro_host' && (
                      <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-[#6C63FF] text-white text-[10px] font-mono font-bold rounded uppercase tracking-wider">
                        Most Popular
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-[#0F172A] dark:text-white mb-1">{plan.display_name}</h3>
                    <p className="text-[#475569] dark:text-slate-300 mb-6 capitalize text-sm">{plan.name.replace('_', ' ')} plan</p>
                    <div className="mb-8">
                      <span className="text-4xl font-bold text-[#0F172A] dark:text-white">${plan.price_usd}</span>
                      <span className="text-sm text-[#475569] dark:text-slate-400 font-mono ml-1">/mo</span>
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-3 text-sm text-[#0F172A] dark:text-white">
                        <CheckCircle size={18} className="text-[#6C63FF] shrink-0" /> {plan.can_host_sessions ? `Host up to ${plan.max_session_participants} users` : 'Join unlimited sessions'}
                      </li>
                      <li className="flex items-center gap-3 text-sm text-[#0F172A] dark:text-white">
                        <CheckCircle size={18} className="text-[#6C63FF] shrink-0" /> {plan.compute_hours_per_month === -1 ? 'Unlimited' : plan.compute_hours_per_month} workspace hours/mo
                      </li>
                      <li className="flex items-center gap-3 text-sm text-[#0F172A] dark:text-white">
                        <CheckCircle size={18} className="text-[#6C63FF] shrink-0" /> Access to VM templates
                      </li>
                    </ul>

                    <Link
                      to="/signin"
                      className={`block w-full py-3 text-center rounded font-mono text-xs uppercase tracking-wider font-semibold transition-all ${plan.name === 'pro_host' ? 'bg-[#6C63FF] hover:bg-[#5b53e6] text-white' : 'bg-transparent hover:bg-[#F8FAFC] dark:hover:bg-[#050B18] text-[#0F172A] dark:text-white border border-[#E2E8F0] dark:border-slate-800'}`}
                    >
                      Get Started
                    </Link>
                  </div>
                </Reveal>
              ))
            )}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="py-24 bg-white dark:bg-[#050B18]">
        <div className="max-w-3xl mx-auto px-6">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-normal text-[#0F172A] dark:text-white mb-4" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Frequently asked questions
            </h2>
            <p className="text-[#475569] dark:text-slate-300">Common questions about plans, sessions, and security.</p>
          </Reveal>

          <Reveal>
            <div>
              {FAQ_ITEMS.map((item, i) => (
                <FaqItem key={item.q} item={item} isOpen={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* Final CTA */}
      <div className="relative py-24 bg-[#17132B] overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(closest-side, rgba(108,99,255,0.3), transparent)' }}
        />
        <Reveal className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl lg:text-4xl font-normal text-white mb-4" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            You've scrolled enough. Time to build.
          </h2>
          <p className="text-slate-300 mb-10">Start something real on a workspace made for builders like you.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signin"
              className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-white/90 text-[#17132B] rounded font-mono text-xs uppercase tracking-wider font-semibold transition-all flex items-center justify-center gap-2 hover:scale-105"
            >
              Get Started <ArrowRight size={16} />
            </Link>
            <a
              href="mailto:support@clouddesk.io"
              className="w-full sm:w-auto px-7 py-3.5 bg-transparent hover:bg-white/5 text-white border border-white/20 rounded font-mono text-xs uppercase tracking-wider font-semibold transition-all"
            >
              Contact Sales
            </a>
          </div>
        </Reveal>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-[#F8FAFC] dark:bg-[#050B18] border-t border-[#E2E8F0] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Monitor className="w-6 h-6 text-[#6C63FF]" />
            <span className="text-lg font-bold text-[#0F172A] dark:text-white" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>CloudDesk</span>
          </div>
          <div className="flex gap-6 font-mono text-xs uppercase tracking-wider">
            <Link to="/terms" className="text-[#475569] dark:text-slate-300 hover:text-[#6C63FF] transition-colors">Terms</Link>
            <Link to="/privacy" className="text-[#475569] dark:text-slate-300 hover:text-[#6C63FF] transition-colors">Privacy</Link>
            <a href="mailto:support@clouddesk.io" className="text-[#475569] dark:text-slate-300 hover:text-[#6C63FF] transition-colors">Contact</a>
          </div>
          <p className="text-xs text-[#94A3B8] dark:text-slate-500 font-mono">CloudDesk © {new Date().getFullYear()}</p>
        </div>
      </footer>

      {showJoinModal && (
        <JoinByCodeModal onClose={() => setShowJoinModal(false)} />
      )}
    </div>
  );
}
