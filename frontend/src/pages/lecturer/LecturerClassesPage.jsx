import { useState, useEffect } from 'react';
import { GraduationCap, Users, BookOpen } from 'lucide-react';
import { classService } from '../../services/classService';

/**
 * LecturerClassesPage — lists the lecturer's classes.
 *
 * Currently a functional read-only view; full CRUD (materials,
 * assignments, submissions) arrives in Phase 5.
 *
 * @returns {JSX.Element}
 */
export default function LecturerClassesPage() {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await classService.getMyClasses();
        setClasses(res.data?.data || []);
      } catch (err) {
        console.error('Failed to load classes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClasses();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-white">My Classes</h1>
        <p className="text-slate-400 mt-1">
          Manage your classes and track student progress
        </p>
      </div>

      {/* Content */}
      {classes.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col items-center justify-center py-20 px-6">
          <GraduationCap className="w-14 h-14 text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white">No Classes Assigned</h3>
          <p className="text-slate-400 mt-2 text-sm text-center max-w-md">
            You don't have any classes yet. Contact an administrator to get classes assigned to your account.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-slate-800 rounded-xl border border-slate-700 hover:border-blue-500/40 transition-colors p-6 flex flex-col gap-4"
            >
              {/* Icon + Title */}
              <div className="flex items-start gap-4">
                <div className="bg-purple-500/10 p-3 rounded-xl shrink-0">
                  <GraduationCap className="w-6 h-6 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white truncate">{cls.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{cls.department}</p>
                </div>
              </div>

              {/* Description */}
              {cls.description && (
                <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
                  {cls.description}
                </p>
              )}

              {/* Meta chips */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full">
                  {cls.academic_year}
                </span>
                <span className="bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full">
                  Sem {cls.semester}
                </span>
                {cls.stream && (
                  <span className="bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full">
                    {cls.stream}
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between border-t border-slate-700 pt-4">
                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Users className="w-4 h-4" />
                  <span>{cls.enrolled_count ?? 0} students</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                  <BookOpen className="w-4 h-4" />
                  <span>Phase 5 →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Phase 5 notice */}
      <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-4">
        <p className="text-sm text-blue-300 text-center">
          📚 Full class management — materials, assignments, and submissions — arrives in <strong>Phase 5</strong>.
        </p>
      </div>
    </div>
  );
}
