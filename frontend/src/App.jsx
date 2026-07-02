/**
 * App — root component for the CloudDesk frontend.
 *
 * Sets up react-router-dom routes for all pages:
 *   - /         → redirects to /login
 *   - /login    → LoginPage (no layout)
 *   - /register → RegisterPage (no layout)
 *   - /admin/*  → Admin pages (wrapped in Layout + ProtectedRoute)
 *   - /instructor/* → Lecturer pages (wrapped in Layout + ProtectedRoute)
 *   - /member/* → Student pages (wrapped in Layout + ProtectedRoute)
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
import InstructorDashboard from "./pages/instructor/InstructorDashboard";
import LecturerMonitorPage from "./pages/instructor/LecturerMonitorPage";
import LecturerClassesPage from "./pages/instructor/LecturerClassesPage";
import ProfilePage from './pages/shared/ProfilePage';
import LecturerMaterialsPage from "./pages/instructor/LecturerMaterialsPage";
import LecturerPracticalPage from "./pages/instructor/LecturerPracticalPage";

// Student pages
import MemberDashboard from "./pages/member/MemberDashboard";
import MemberGroupsPage from "./pages/member/MemberGroupsPage";
import MemberSessionsPage from "./pages/member/MemberSessionsPage";
import StudentVMsPage from "./pages/member/StudentVMsPage";
import StudentClassesPage from "./pages/member/StudentClassesPage";
import SessionHistoryPage from "./pages/member/SessionHistoryPage";
import DesktopSessionPage from "./pages/member/DesktopSessionPage";
import StudentMaterialsPage from "./pages/member/StudentMaterialsPage";
import StudentPracticalPage from "./pages/member/StudentPracticalPage";
import LabWorkspacePage from "./pages/member/LabWorkspacePage";

// Layout & guards
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import NotificationsPage from './pages/shared/NotificationsPage';

// Shared pages
import NotFoundPage from "./pages/shared/NotFoundPage";
import WorkspacesPage from "./pages/member/WorkspacesPage";
import SessionsPage from "./pages/shared/SessionsPage";
import JoinSessionPage from "./pages/shared/JoinSessionPage";
import JoinGroupPage from "./pages/shared/JoinGroupPage";

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const getDashboardRoute = () => {
    if (!user) return "/";
    if (user.role === 'admin') return "/admin/dashboard";
    if (user.role === 'instructor') return "/instructor/dashboard";
    return "/member/dashboard";
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
        
        {/* ── Public / Shared ──────────────────────────────────── */}
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/join/session/:code" element={<JoinSessionPage />} />
        <Route path="/join/group/:code" element={<JoinGroupPage />} />
        
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

        {/* ── Instructor routes ───────────────────────────────────── */}
        <Route
          path="/instructor/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <InstructorDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/sessions/:sessionId/monitor"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerMonitorPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructor/groups/:groupId"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerClassesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructor/practicals"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerPracticalPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/materials"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerMaterialsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Alias: /instructor/assignments → LecturerMaterialsPage Tab 2 */}
        <Route
          path="/instructor/assignments"
          element={
            <ProtectedRoute>
              <Layout>
                <LecturerMaterialsPage defaultTab="assignments" />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Member routes ────────────────────────────────────── */}
        <Route
          path="/member/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <MemberDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/workspaces"
          element={
            <ProtectedRoute>
              <Layout>
                <WorkspacesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/vms"
          element={
            <ProtectedRoute>
              <Layout>
                <StudentVMsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/classes"
          element={
            <ProtectedRoute>
              <Layout>
                <StudentClassesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/groups"
          element={
            <ProtectedRoute>
              <Layout>
                <MemberGroupsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/sessions-history"
          element={
            <ProtectedRoute>
              <Layout>
                <SessionHistoryPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/sessions"
          element={
            <ProtectedRoute>
              <Layout>
                <MemberSessionsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/materials"
          element={
            <ProtectedRoute>
              <Layout>
                <StudentMaterialsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Alias: /member/assignments → StudentMaterialsPage Tab 2 */}
        <Route
          path="/member/assignments"
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
