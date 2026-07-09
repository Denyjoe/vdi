import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Monitor, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import Toast from '../../components/shared/Toast';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  
  // Step 1: email, Step 2: code + new password
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  // Form State
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [devCode, setDevCode] = useState('');

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    try {
      const res = await api.post('/auth/password-reset/request/', { email });
      setToast({ show: true, message: 'Reset code sent to your email', type: 'success' });
      setStep(2);
      if (res.data.dev_code) {
        setDevCode(res.data.dev_code);
      }
    } catch (err) {
      setToast({ show: true, message: err.response?.data?.message || 'Failed to send code', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setToast({ show: true, message: 'Passwords do not match', type: 'error' });
      return;
    }
    if (newPassword.length < 8) {
      setToast({ show: true, message: 'Password must be at least 8 characters', type: 'error' });
      return;
    }
    
    setLoading(true);
    try {
      const res = await api.post('/auth/password-reset/confirm/', { 
        email, 
        code, 
        new_password: newPassword 
      });
      if (res.data.success) {
        setToast({ show: true, message: 'Password reset successfully', type: 'success' });
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setToast({ show: true, message: err.response?.data?.message || 'Invalid or expired code', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050B18] px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-md w-full space-y-8 relative z-10 glass-card p-8 rounded-2xl border border-[var(--border-color)]">
        <div>
          <div className="flex justify-center">
            <Monitor className="h-12 w-12 text-indigo-500" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {step === 1 ? 'Reset Password' : 'Enter New Password'}
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
            {step === 1 ? "Enter your email to receive a reset code." : "Enter the code sent to your email and your new password."}
          </p>
        </div>

        {devCode && step === 2 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm text-center">
            (Development mode — in production this goes to your email) <br/>
            Code: <strong>{devCode}</strong>
          </div>
        )}

        {step === 1 ? (
          <form className="mt-8 space-y-6" onSubmit={handleSendCode}>
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-secondary" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-3 pl-10 border border-[var(--border-color)] bg-[#0B1221] placeholder-muted text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all"
                  placeholder="Email address"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || !email}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Code'}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
            <div className="space-y-4">
              <div>
                <label htmlFor="code" className="sr-only">Reset Code</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="h-5 w-5 text-secondary font-bold flex items-center justify-center">#</span>
                  </div>
                  <input
                    id="code"
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-3 pl-10 border border-[var(--border-color)] bg-[#0B1221] placeholder-muted text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all"
                    placeholder="6-digit reset code"
                    maxLength={6}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="newPassword" className="sr-only">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-secondary" />
                  </div>
                  <input
                    id="newPassword"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-3 pl-10 border border-[var(--border-color)] bg-[#0B1221] placeholder-muted text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all"
                    placeholder="New Password"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-secondary" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-3 pl-10 border border-[var(--border-color)] bg-[#0B1221] placeholder-muted text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all"
                    placeholder="Confirm New Password"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || !code || !newPassword || !confirmPassword}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset Password'}
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            <ArrowLeft size={16} /> Back to Sign In
          </Link>
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
