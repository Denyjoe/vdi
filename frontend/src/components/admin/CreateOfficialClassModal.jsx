import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import api from '../../services/api';

export default function CreateOfficialClassModal({ onClose, onCreated }) {
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  
  const [form, setForm] = useState({
    name: '',
    department: '',
    programme: '',
    academic_year: '2025/2026',
    year_of_study: 1,
    semester: 1,
    lecturer_id: '',
    max_students: 60,
    description: ''
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, lectRes] = await Promise.all([
          api.get('/classes/departments/'),
          api.get('/admin/users/') // We'll filter for lecturers
        ]);
        
        if (deptRes.data.success) {
          setDepartments(deptRes.data.data);
        }
        
        if (lectRes.data.success) {
          setLecturers(lectRes.data.data.filter(u => u.role === 'lecturer'));
        }
      } catch (err) {
        console.error('Failed to load form data', err);
      }
    };
    fetchData();
  }, []);

  // Fetch programmes when department changes
  useEffect(() => {
    if (!form.department) {
      setProgrammes([]);
      return;
    }
    
    const fetchProgrammes = async () => {
      try {
        const deptCode = departments.find(d => d.id == form.department)?.code || '';
        const res = await api.get(`/classes/programmes/?department_code=${deptCode}`);
        if (res.data.success) {
          setProgrammes(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load programmes', err);
      }
    };
    fetchProgrammes();
  }, [form.department, departments]);
  
  // Auto-suggest class name
  useEffect(() => {
    if (form.programme && form.year_of_study) {
      const prog = programmes.find(p => p.id == form.programme);
      if (prog) {
        setForm(prev => ({
          ...prev,
          name: `${prog.name} Year ${form.year_of_study} Lab`
        }));
      }
    }
  }, [form.programme, form.year_of_study, programmes]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Class name is required.'); return; }
    if (!form.department || !form.programme) { setError('Department and Programme are required.'); return; }
    
    setSaving(true);
    setError('');
    
    try {
      const payload = {
        name: form.name,
        description: form.description,
        department_id: form.department,
        programme_id: form.programme,
        academic_year: form.academic_year,
        year_of_study: parseInt(form.year_of_study, 10),
        semester: parseInt(form.semester, 10),
        max_students: parseInt(form.max_students, 10),
        class_type: 'official'
      };
      
      if (form.lecturer_id) {
        payload.lecturer_id = form.lecturer_id;
      }
      
      const res = await api.post('/admin/classes/create/', payload);
      
      if (res.data.success) { 
        onCreated(res.data.data); 
      } else { 
        setError(res.data.message || 'Failed to create class.'); 
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create class.');
    } finally { 
      setSaving(false); 
    }
  };

  const inputClass = 'w-full bg-[var(--bg-primary)]/50 border border-slate-600 rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-color)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Create Official Class</h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Department *</label>
              <select name="department" value={form.department} onChange={handleChange} className={inputClass} required>
                <option value="">Select Department...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Programme *</label>
              <select name="programme" value={form.programme} onChange={handleChange} className={inputClass} disabled={!form.department} required>
                <option value="">Select Programme...</option>
                {programmes.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Class Name *</label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Computer Engineering Year 4 Lab" className={inputClass} required />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Academic Year</label>
              <select name="academic_year" value={form.academic_year} onChange={handleChange} className={inputClass}>
                <option value="2024/2025">2024/2025</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Year of Study</label>
              <select name="year_of_study" value={form.year_of_study} onChange={handleChange} className={inputClass}>
                <option value={1}>Year 1</option>
                <option value={2}>Year 2</option>
                <option value={3}>Year 3</option>
                <option value={4}>Year 4</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Semester</label>
              <select name="semester" value={form.semester} onChange={handleChange} className={inputClass}>
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Assign Lecturer (Optional)</label>
              <select name="lecturer_id" value={form.lecturer_id} onChange={handleChange} className={inputClass}>
                <option value="">Unassigned</option>
                {lecturers.map(l => (
                  <option key={l.id} value={l.id}>{l.first_name} {l.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Max Students</label>
              <input type="number" name="max_students" value={form.max_students} onChange={handleChange} min={1} className={inputClass} />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} className={`${inputClass} resize-none`} rows="2" placeholder="Optional description..." />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-600 text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg text-sm transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-[var(--text-primary)] rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Creating...' : 'Create Official Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
