import React, { useState } from 'react';
import { Landmark, CheckCircle2 } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const EMPTY_FORM = {
  name: '', contact_name: '', contact_email: '', description: '',
  requested_vcpu_cores: '', requested_ram_gb: '', requested_storage_gb: '',
};

export default function RequestUniversityAccessPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contact_name.trim() || !form.contact_email.trim()) {
      toast.error('Institution name, contact name, and contact email are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/university/request-access/', form);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <PublicNavbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] flex items-center justify-center mx-auto mb-5">
            <Landmark size={28} />
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-3">Bring Ospace to your university</h1>
          <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
            Give every department, course, and lecturer real, isolated virtual desktops.
            on top of the same platform your students may already use individually.
            Submit your details and our team will follow up to set up your institution.
          </p>
        </div>

        {submitted ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 text-emerald-400" size={40} />
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Request received</h2>
            <p className="text-[var(--text-secondary)]">
              Thanks. We've logged your request and our team will reach out at{' '}
              <span className="text-[var(--text-primary)] font-medium">{form.contact_email}</span> shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Institution name</label>
              <input
                type="text" required value={form.name} onChange={update('name')}
                placeholder="e.g. University of Dodoma"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Your name</label>
                <input
                  type="text" required value={form.contact_name} onChange={update('contact_name')}
                  placeholder="Jane Registrar"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Contact email</label>
                <input
                  type="email" required value={form.contact_email} onChange={update('contact_email')}
                  placeholder="you@university.ac.tz"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Tell us a bit about your needs (optional)</label>
              <textarea
                rows={4} value={form.description} onChange={update('description')}
                placeholder="Approximate number of students, departments, planned use (labs, exams, etc.)"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Anticipated hardware needs (optional)</label>
              <p className="text-xs text-[var(--text-faint)] mb-3">
                A rough estimate for your labs/courses. Our team will confirm the real, approved capacity with you directly.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">vCPU cores</label>
                  <input
                    type="number" min="1" value={form.requested_vcpu_cores} onChange={update('requested_vcpu_cores')}
                    placeholder="e.g. 64"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">RAM (GB)</label>
                  <input
                    type="number" min="1" value={form.requested_ram_gb} onChange={update('requested_ram_gb')}
                    placeholder="e.g. 256"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Storage (GB)</label>
                  <input
                    type="number" min="1" value={form.requested_storage_gb} onChange={update('requested_storage_gb')}
                    placeholder="e.g. 2000"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit" disabled={submitting}
              className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--accent-primary)]/20"
            >
              {submitting ? 'Submitting...' : 'Request Access'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
