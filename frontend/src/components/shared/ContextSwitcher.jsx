import { useState, useEffect, useRef } from 'react';
import { ChevronDown, User, Landmark, Check } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import useContextStore from '../../store/contextStore';

/**
 * ContextSwitcher — Phase 6. Shows "Personal Account" plus any real,
 * active university affiliation this account holds (reusing
 * get_active_affiliations via /university-admin/my-contexts/). Only
 * rendered at all once real affiliations exist — a purely personal
 * account never sees a switcher with nothing to switch to.
 */
export default function ContextSwitcher() {
  const { user } = useAuthStore();
  const { current, affiliations, setAffiliations, setPersonal, setUniversity } = useContextStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;
    api.get('/university-admin/my-contexts/').then(res => {
      const affs = res.data?.data?.affiliations || [];
      setAffiliations(affs);
      // Safety: if the currently-selected university context was
      // revoked since last visit, fall back to Personal rather than
      // silently keep sending a now-invalid context param.
      if (current.type === 'university' && !affs.some(a => a.university_id === current.universityId)) {
        setPersonal();
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (affiliations.length === 0) return null; // nothing to switch to

  const label = current.type === 'university'
    ? `${current.universityName} — ${current.departmentName || current.role}`
    : 'Personal Account';

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-nav-hover)] transition-colors max-w-[220px]">
        {current.type === 'university' ? <Landmark size={14} className="text-[var(--accent-primary)] flex-shrink-0" /> : <User size={14} className="text-[var(--text-secondary)] flex-shrink-0" />}
        <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{label}</span>
        <ChevronDown size={12} className="text-[var(--text-secondary)] flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-[260px] bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50"
          style={{ animation: 'fadeInDown 0.2s ease-out' }}>
          <div className="px-4 py-2.5 border-b border-border-subtle">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">Switch Context</p>
          </div>
          <div className="py-1">
            <button onClick={() => { setPersonal(); setOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
              <span className="flex items-center gap-2"><User size={14} /> Personal Account</span>
              {current.type === 'personal' && <Check size={14} className="text-[var(--accent-primary)]" />}
            </button>
            {affiliations.map(a => (
              <button key={`${a.university_id}-${a.department_id || ''}`}
                onClick={() => { setUniversity(a); setOpen(false); }}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs text-secondary hover:bg-nav-hover transition-colors">
                <span className="flex items-center gap-2 text-left">
                  <Landmark size={14} className="flex-shrink-0" />
                  <span className="truncate">{a.university_name} — {a.department_name || a.role}</span>
                </span>
                {current.type === 'university' && current.universityId === a.university_id && (
                  <Check size={14} className="text-[var(--accent-primary)] flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
