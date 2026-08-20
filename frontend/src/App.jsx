/**
 * App — root component for the Ospace frontend.
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
import React, { useEffect, Suspense } from "react";
import useAuthStore from "./store/authStore";
import useThemeStore from "./store/themeStore";
import LoadingSpinner from "./components/shared/LoadingSpinner";

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
import SignInPage from "./pages/auth/SignInPage";

// Admin pages
// Real performance-audit finding: these 11 admin pages (plus the
// recharts+d3 dependency chain pulled in by AdminAnalyticsPage alone)
// were eagerly imported into the single main bundle, so every regular
// member downloaded them on first load despite the admin section being
// permission-gated and unreachable to non-admins. Lazy-loading moves
// them into separate chunks fetched only when an admin actually
// navigates to /admin/*.
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));
const AdminHardwarePage = React.lazy(() => import("./pages/admin/AdminHardwarePage"));
const AdminTemplatesPage = React.lazy(() => import("./pages/admin/AdminTemplatesPage"));
const AdminTemplateWizardPage = React.lazy(() => import("./pages/admin/AdminTemplateWizardPage"));
const AdminVMsPage = React.lazy(() => import("./pages/admin/AdminVMsPage"));
const AdminAnalyticsPage = React.lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminUsersPage = React.lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminLogsPage = React.lazy(() => import("./pages/admin/AdminLogsPage"));
const AdminSettingsPage = React.lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminWorkspacesPage = React.lazy(() => import("./pages/admin/AdminWorkspacesPage"));
const AdminLiveSessionsPage = React.lazy(() => import("./pages/admin/AdminLiveSessionsPage"));
const VMPoolPage = React.lazy(() => import("./pages/admin/VMPoolPage"));

// Shared/User pages
import NotificationsPage from './pages/shared/NotificationsPage';
import SessionsPage from "./pages/shared/SessionsPage";
import JoinSessionPage from "./pages/shared/JoinSessionPage";
import NotFoundPage from "./pages/shared/NotFoundPage";
import MaintenancePage from "./pages/shared/MaintenancePage";

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
        
        <Route path="/signin" element={user ? <Navigate to={getDashboardRoute()} replace /> : <SignInPage />} />
        <Route path="/login" element={<Navigate to="/signin" replace />} />
        <Route path="/register" element={<Navigate to="/signin" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/signin" replace />} />
        <Route path="/verify-email" element={<Navigate to="/signin" replace />} />
        
        <Route path="/join/session/:code" element={<JoinSessionPage />} />
        
        {/* Fallback redirect */}
        <Route path="/member/dashboard" element={<Navigate to={getDashboardRoute()} replace />} />
        <Route path="/instructor/dashboard" element={<Navigate to={getDashboardRoute()} replace />} />

        {/* ── Protected routes (without layout) ───────────────────── */}
        <Route path="/host/session/:sessionId" element={<ProtectedRoute><ErrorBoundary><HostSessionPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/session/:id" element={<ProtectedRoute><ErrorBoundary><DesktopSessionPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/workspace/:id" element={<ProtectedRoute><ErrorBoundary><DesktopSessionPage /></ErrorBoundary></ProtectedRoute>} />

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
          {/* Each lazy admin page gets its own Suspense boundary rather
              than one wrapping the whole /admin subtree, so switching
              between already-loaded admin pages (e.g. Users -> Workspaces)
              doesn't re-show a fallback for chunks already in the browser
              cache - only a genuinely new chunk triggers the spinner. */}
          <Route path="/admin">
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Suspense fallback={<LoadingSpinner />}><AdminDashboard /></Suspense>} />
            <Route path="users" element={<Suspense fallback={<LoadingSpinner />}><AdminUsersPage /></Suspense>} />
            <Route path="vms" element={<Suspense fallback={<LoadingSpinner />}><AdminVMsPage /></Suspense>} />
            <Route path="templates" element={<Suspense fallback={<LoadingSpinner />}><AdminTemplatesPage /></Suspense>} />
            <Route path="templates/new" element={<Suspense fallback={<LoadingSpinner />}><AdminTemplateWizardPage /></Suspense>} />
            <Route path="hardware" element={<Suspense fallback={<LoadingSpinner />}><AdminHardwarePage /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<LoadingSpinner />}><AdminAnalyticsPage /></Suspense>} />
            <Route path="logs" element={<Suspense fallback={<LoadingSpinner />}><AdminLogsPage /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<LoadingSpinner />}><AdminSettingsPage /></Suspense>} />
            <Route path="workspaces" element={<Suspense fallback={<LoadingSpinner />}><AdminWorkspacesPage /></Suspense>} />
            <Route path="vm-pool" element={<Suspense fallback={<LoadingSpinner />}><VMPoolPage /></Suspense>} />
            <Route path="sessions" element={<Suspense fallback={<LoadingSpinner />}><AdminLiveSessionsPage /></Suspense>} />
          </Route>
          
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
