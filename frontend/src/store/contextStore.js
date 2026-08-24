/**
 * contextStore — Phase 6 account context switching.
 *
 * "Personal Account" is the default, always-present context. Any real,
 * active UniversityAffiliation (fetched via get_active_affiliations on
 * the backend) adds a real switchable context. The store always tracks
 * an EXPLICIT current context (never "no opinion") — Workspaces/
 * Sessions/Templates fetches read `contextParam()` and pass it as
 * `?context=` on every request, so the university-vs-personal boundary
 * is enforced server-side (resolve_context_university), not just hidden
 * in the UI. Persisted so a page reload keeps the same context; a fresh
 * account with no persisted state starts on Personal.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useContextStore = create(
  persist(
    (set, get) => ({
      // { type: 'personal' } | { type: 'university', universityId, universityName, departmentName, role }
      current: { type: 'personal' },
      affiliations: [],

      setAffiliations: (affiliations) => set({ affiliations }),

      setPersonal: () => set({ current: { type: 'personal' } }),

      setUniversity: (affiliation) => set({
        current: {
          type: 'university',
          universityId: affiliation.university_id,
          universityName: affiliation.university_name,
          departmentName: affiliation.department_name,
          role: affiliation.role,
        },
      }),

      // The real query param every context-aware fetch call attaches.
      contextParam: () => {
        const current = get().current;
        return current.type === 'university' ? String(current.universityId) : 'personal';
      },
    }),
    { name: 'ospace-account-context' }
  )
);

export default useContextStore;
