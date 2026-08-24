import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Landmark, CheckCircle2, XCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

export default function JoinUniversityPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') || '';
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();
  const [status, setStatus] = useState('checking'); // checking | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Wait for initializeAuth() to finish hydrating `user` from the stored
    // token before deciding this is a logged-out visitor — a direct link
    // load (the real, common case for a shareable invite URL) always
    // starts with user===null for a tick, and redirecting on that alone
    // sent even already-logged-in people to /signin, losing the code.
    if (isLoading) return;
    if (!user) {
      // Same pattern as JoinSessionPage — redirect to sign in first.
      sessionStorage.setItem('redirectAfterLogin', `/join/university?code=${code}`);
      navigate('/signin');
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('No invite code provided.');
      return;
    }
    api.post('/university-admin/invites/redeem/', { code })
      .then(res => {
        setStatus('success');
        const d = res.data.data;
        setMessage(`You've joined ${d.university}: ${d.department} as a ${d.role}${d.course ? ` (${d.course})` : ''}.`);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'This invite link is invalid or no longer active.');
      });
  }, [user, isLoading, code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
      <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
        {status === 'checking' && (
          <>
            <Landmark className="mx-auto mb-4 text-[var(--text-faint)] animate-pulse" size={40} />
            <p className="text-[var(--text-secondary)]">Joining...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto mb-4 text-emerald-400" size={40} />
            <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Welcome!</h1>
            <p className="text-[var(--text-secondary)] mb-6">{message}</p>
            <Link to="/dashboard" className="inline-block px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-white font-semibold">
              Go to Dashboard
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="mx-auto mb-4 text-red-400" size={40} />
            <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Couldn't join</h1>
            <p className="text-[var(--text-secondary)]">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
