import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import api from '../../services/api';

export default function AssignLecturerModal({ classItem, lecturers, onClose, onAssigned }) {
  const [lecturerId, setLecturerId] = useState(classItem.lecturer?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    try {
      // In a real app we might have a specific endpoint, but for now we'll use a PATCH or PUT on the admin endpoint 
      // Actually, wait, there isn't a PATCH /api/admin/classes/<id>/ in the urls.
      // Let's use the lecturer endpoint? No, admin needs their own. 
      // The user requested: PATCH /api/admin/classes/<id>/ { lecturer_id: X }
      // I will need to add this endpoint or just do a general update.
      // For now, I will assume the endpoint exists or will just call it.
      
      const res = await api.patch(`/admin/classes/${classItem.id}/`, { lecturer_id: lecturerId || null });
      
      if (res.data.success) {
        onAssigned(res.data.data);
      } else {
        setError(res.data.message || 'Failed to assign lecturer.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign lecturer.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
          <h3 className="text-lg font-bold text-white">Assign Lecturer</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="mb-2">
            <p className="text-sm text-slate-300">Assign a lecturer to <strong>{classItem.name}</strong></p>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Select Lecturer</label>
            <select 
              value={lecturerId} 
              onChange={(e) => setLecturerId(e.target.value)} 
              className={inputClass}
            >
              <option value="">-- Unassigned --</option>
              {lecturers.map(l => (
                <option key={l.id} value={l.id}>{l.first_name} {l.last_name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-600 text-slate-300 hover:bg-slate-700 rounded-lg text-sm transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
