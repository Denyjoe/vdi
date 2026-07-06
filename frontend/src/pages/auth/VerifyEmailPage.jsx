import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Monitor, Mail, ArrowRight, Loader2 } from 'lucide-react';
import api from '../../services/api';
import Toast from '../../components/shared/Toast';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const navigate = useNavigate();
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [devCode, setDevCode] = useState(''); // Only for dev purposes

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-email/', { email, code });
      if (res.data.success) {
        setToast({ show: true, message: 'Email verified successfully! You can now log in.', type: 'success' });
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setToast({ show: true, message: err.response?.data?.message || 'Invalid verification code', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await api.post('/auth/resend-verification/', { email });
      if (res.data.success) {
        setToast({ show: true, message: 'Verification code resent!', type: 'success' });
        if (res.data.dev_code) {
          setDevCode(res.data.dev_code);
        }
      }
    } catch (err) {
      setToast({ show: true, message: err.response?.data?.message || 'Failed to resend code', type: 'error' });
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050B18]">
        <div className="text-center">
          <p className="text-[var(--text-secondary)] mb-4">Invalid request. Missing email.</p>
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300">Go to Registration</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050B18] px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-md w-full space-y-8 relative z-10 glass-card p-8 rounded-2xl border border-[var(--border-color)]">
        <div>
          <div className="flex justify-center">
            <Monitor className="h-12 w-12 text-indigo-500" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            Verify your email
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
            We sent a 6-digit code to <span className="text-indigo-400 font-medium">{email}</span>
          </p>
        </div>

        {devCode && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm text-center">
            Development Mode - Code is: <strong>{devCode}</strong>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleVerify}>
          <div>
            <label htmlFor="code" className="sr-only">Verification Code</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="code"
                name="code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="appearance-none relative block w-full px-3 py-3 pl-10 border border-[var(--border-color)] bg-[#0B1221] placeholder-slate-500 text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all"
                placeholder="6-digit code"
                maxLength={6}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !code}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Account'}
            </button>
          </div>
        </form>

        <div className="text-center mt-6">
          <p className="text-sm text-[var(--text-secondary)]">
            Didn't receive the code?{' '}
            <button 
              onClick={handleResend}
              disabled={resending}
              className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
            >
              {resending ? 'Sending...' : 'Resend Code'}
            </button>
          </p>
        </div>
      </div>

      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: '' })}
        />
      )}
    </div>
  );
}
