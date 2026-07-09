/**
 * App — root component for the CloudDesk frontend.
 *
 * Sets up react-router-dom routes for all pages:
 *   - /         → LandingPage
 *   - /login    → LoginPage
 *   - /register → RegisterPage
 *   - /dashboard → DashboardPage (Protected)
 *   - /admin/*  → Admin pages (Protected)
 *   - *         → NotFoundPage (catch-all)
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { useEffect } from "react";
import useAuthStore from "./store/authStore";
import useThemeStore from "./store/themeStore";

// Error Boundary for Dashboard
class ErrorBoundary extends React.Component {
  state = { error: null }
  
  componentDidCatch(error) {
    this.setState({ error })
    console.error('Page error:', error)
  }
  
  render() {
    if (this.state.error) {
      return (
        <div style={{
          color: 'white', 
          padding: '40px',
          background: '#0d1526',
          minHeight: '100vh'
        }}>
          <h2 style={{color: '#ef4444'}}>
            Page Error
          </h2>
          <pre style={{
            color: 'var(--text-secondary)',
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            {this.state.error.toString()}
            {'\n'}
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

// Public pages
import LandingPage from "./pages/public/LandingPage";
import PricingPage from "./pages/public/PricingPage";
import TemplatesPage from "./pages/public/TemplatesPage";
import TermsPage from "./pages/public/TermsPage";
import PrivacyPage from "./pages/public/PrivacyPage";

// Auth pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminHardwarePage from "./pages/admin/AdminHardwarePage";
import AdminTemplatesPage from "./pages/admin/AdminTemplatesPage";
import AdminVMsPage from "./pages/admin/AdminVMsPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminLogsPage from "./pages/admin/AdminLogsPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminWorkspacesPage from "./pages/admin/AdminWorkspacesPage";
import AdminLiveSessionsPage from "./pages/admin/AdminLiveSessionsPage";
import VMPoolPage from "./pages/admin/VMPoolPage";

// Shared/User pages
import NotificationsPage from './pages/shared/NotificationsPage';
import SessionsPage from "./pages/shared/SessionsPage";
import JoinSessionPage from "./pages/shared/JoinSessionPage";
import NotFoundPage from "./pages/shared/NotFoundPage";

// User specific
import DashboardPage from "./pages/DashboardPage";
import WorkspacesPage from "./pages/member/WorkspacesPage";
import MemberSessionsPage from "./pages/member/MemberSessionsPage";
import SessionHistoryPage from "./pages/member/SessionHistoryPage";
import DesktopSessionPage from "./pages/member/DesktopSessionPage";
import HostSessionPage from "./pages/HostSessionPage";
import HostAnalyticsPage from "./pages/HostAnalyticsPage";
import CreateSessionPage from "./pages/member/CreateSessionPage";

// Layout & guards
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/shared/ProtectedRoute";

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const user = useAuthStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const getDashboardRoute = () => {
    if (!user) return "/";
    if (user.role === 'admin') return "/admin/dashboard";
    return "/dashboard";
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes (no layout) ─────────────────────────── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        
        <Route path="/login" element={user ? <Navigate to={getDashboardRoute()} replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to={getDashboardRoute()} replace /> : <RegisterPage />} />
        <Route path="/forgot-password" element={user ? <Navigate to={getDashboardRoute()} replace /> : <ForgotPasswordPage />} />
        <Route path="/verify-email" element={user ? <Navigate to={getDashboardRoute()} replace /> : <VerifyEmailPage />} />
        
        <Route path="/join/session/:code" element={<JoinSessionPage />} />
        
        {/* Fallback redirect */}
        <Route path="/member/dashboard" element={<Navigate to={getDashboardRoute()} replace />} />
        <Route path="/instructor/dashboard" element={<Navigate to={getDashboardRoute()} replace />} />

        {/* ── Protected routes (without layout) ───────────────────── */}
        <Route path="/host/session/:sessionId" element={<ProtectedRoute><ErrorBoundary><HostSessionPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/session/:id" element={<ProtectedRoute><ErrorBoundary><DesktopSessionPage /></ErrorBoundary></ProtectedRoute>} />

        {/* ── Protected routes (with layout) ──────────────────────── */}
        <Route element={<ProtectedRoute><ErrorBoundary><Layout /></ErrorBoundary></ProtectedRoute>}>
          
          <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/sessions/my" element={<MemberSessionsPage />} />
          <Route path="/sessions/history" element={<SessionHistoryPage />} />
          <Route path="/create-session" element={<CreateSessionPage />} />
          
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
          <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
          <Route path="/account" element={<Navigate to="/dashboard" replace />} />
          <Route path="/notifications" element={<Navigate to="/dashboard" replace />} />

          {/* ── Admin Area ────────────────────────────────────────── */}
          <Route path="/admin">
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="vms" element={<AdminVMsPage />} />
            <Route path="templates" element={<AdminTemplatesPage />} />
            <Route path="hardware" element={<AdminHardwarePage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="workspaces" element={<AdminWorkspacesPage />} />
            <Route path="vm-pool" element={<VMPoolPage />} />
            <Route path="sessions" element={<AdminLiveSessionsPage />} />
          </Route>
          
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
