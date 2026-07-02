/**
 * App — root component for the CloudDesk frontend.
 *
 * Sets up react-router-dom routes for all pages:
 *   - /         → redirects to /login
 *   - /login    → LoginPage (no layout)
 *   - /register → RegisterPage (no layout)
 *   - /admin/*  → Admin pages (wrapped in Layout + ProtectedRoute)
 *   - /lecturer/* → Lecturer pages (wrapped in Layout + ProtectedRoute)
 *   - /student/* → Student pages (wrapped in Layout + ProtectedRoute)
 *   - *         → NotFoundPage (catch-all)
 *
 * @returns {JSX.Element} The routed application.
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import useAuthStore from "./store/authStore";

// Public pages
import LandingPage from "./pages/public/LandingPage";
import PricingPage from "./pages/public/PricingPage";
import TemplatesPage from "./pages/public/TemplatesPage";

// Auth pages (no layout wrapper)
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminHardwarePage from "./pages/admin/AdminHardwarePage";
import AdminTemplatesPage from "./pages/admin/AdminTemplatesPage";
import AdminVMsPage from "./pages/admin/AdminVMsPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminLogsPage from "./pages/admin/AdminLogsPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";

// Lecturer pages
import LecturerDashboard from "./pages/lecturer/LecturerDashboard";
import LecturerMonitorPage from "./pages/lecturer/LecturerMonitorPage";
import LecturerClassesPage from "./pages/lecturer/LecturerClassesPage";
import ProfilePage from './pages/shared/ProfilePage';
import LecturerMaterialsPage from "./pages/lecturer/LecturerMaterialsPage";
import LecturerPracticalPage from "./pages/lecturer/LecturerPracticalPage";

// Student pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentVMsPage from "./pages/student/StudentVMsPage";
import StudentClassesPage from "./pages/student/StudentClassesPage";
import SessionHistoryPage from "./pages/student/SessionHistoryPage";
import DesktopSessionPage from "./pages/student/DesktopSessionPage";
import StudentMaterialsPage from "./pages/student/StudentMaterialsPage";
import StudentPracticalPage from "./pages/student/StudentPracticalPage";
import LabWorkspacePage from "./pages/student/LabWorkspacePage";

// Layout & guards
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import NotificationsPage from './pages/shared/NotificationsPage';

// Shared pages
import NotFoundPage from "./pages/shared/NotFoundPage";

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const getDashboardRoute = () => {
    if (!user) return "/";
    if (user.role === 'admin') return "/admin/dashboard";
    if (user.role === 'instructor') return "/lecturer/dashboard";
    return "/student/dashboard";
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes (no layout) ─────────────────────────── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        
        <Route path="/login" element={user ? <Navigate to={getDashboardRoute()} replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to={getDashboardRoute()} replace /> : <RegisterPage />} />
        
        {/* Fallback dashboard redirect if navigating to /dashboard explicitly */}
        <Route path="/dashboard" element={<Navigate to={getDashboardRoute()} replace />} />

        {/* Notifications */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Layout>
                <NotificationsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Profile */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Admin routes ──────────────────────────────────────── */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/vms"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminVMsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/hardware"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminHardwarePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/templates"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminTemplatesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminAnalyticsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminUsersPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminLogsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminSettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Lecturer routes ───────────────────────────────────── */}
        <Route
          path="/lecturer/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/lecturer/monitor"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerMonitorPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/lecturer/classes"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerClassesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/lecturer/practicals"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerPracticalPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/lecturer/materials"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerMaterialsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Alias: /lecturer/assignments → LecturerMaterialsPage Tab 2 */}
        <Route
          path="/lecturer/assignments"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerMaterialsPage defaultTab="assignments" />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Student routes ────────────────────────────────────── */}
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <StudentDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/vms"
          element={
            <ProtectedRoute>
              <Layout>
                <StudentVMsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/classes"
          element={
            <ProtectedRoute>
              <Layout>
                <StudentClassesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/sessions"
          element={
            <ProtectedRoute>
              <Layout>
                <SessionHistoryPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/practicals"
          element={
            <ProtectedRoute>
              <Layout>
                <StudentPracticalPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/materials"
          element={
            <ProtectedRoute>
              <Layout>
                <StudentMaterialsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Alias: /student/assignments → StudentMaterialsPage Tab 2 */}
        <Route
          path="/student/assignments"
          element={
            <ProtectedRoute>
              <Layout>
                <StudentMaterialsPage defaultTab="assignments" />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/:sessionId"
          element={
            <ProtectedRoute>
              <DesktopSessionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lab/:sessionId"
          element={
            <ProtectedRoute>
              <LabWorkspacePage />
            </ProtectedRoute>
          }
        />

        {/* ── 404 catch-all ──────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
