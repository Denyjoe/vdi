import { GraduationCap } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';

/**
 * LecturerClassesPage — placeholder for Phase 5 (File Sharing & Assignments).
 * Will list all lecturer's classes with enrolled students and materials.
 */
export default function LecturerClassesPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">My Classes</h1>
        <p className="text-slate-400 mt-1">Manage your classes and track student progress</p>
      </div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-12">
        <EmptyState
          icon={GraduationCap}
          title="Classes Coming in Phase 5"
          description="Full class management — materials, assignments, and submissions — will be available in the next phase."
        />
      </div>
    </div>
  );
}
