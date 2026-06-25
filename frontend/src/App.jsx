/**
 * App — root component for the DIT VDI System frontend.
 *
 * Sets up react-router-dom routes for all pages:
 *   - /         → redirects to /login
 *   - /login    → LoginPage (no layout)
 *   - /register → RegisterPage (no layout)
 *   - /admin/*  → AdminDashboard  (wrapped in Layout + ProtectedRoute)
 *   - /lecturer/* → LecturerDashboard (wrapped in Layout + ProtectedRoute)
 *   - /student/* → StudentDashboard (wrapped in Layout + ProtectedRoute)
 *
 * @returns {JSX.Element} The routed application.
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import useAuthStore from "./store/authStore";

// Auth pages (no layout wrapper)
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";

// Dashboard pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminHardwarePage from "./pages/admin/AdminHardwarePage";
import AdminTemplatesPage from "./pages/admin/AdminTemplatesPage";
import AdminVMsPage from "./pages/admin/AdminVMsPage";
import LecturerDashboard from "./pages/lecturer/LecturerDashboard";
import LecturerMonitorPage from "./pages/lecturer/LecturerMonitorPage";
import LecturerClassesPage from "./pages/lecturer/LecturerClassesPage";
import LecturerMaterialsPage from "./pages/lecturer/LecturerMaterialsPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentVMsPage from "./pages/student/StudentVMsPage";
import SessionHistoryPage from "./pages/student/SessionHistoryPage";
import DesktopSessionPage from "./pages/student/DesktopSessionPage";
import StudentMaterialsPage from "./pages/student/StudentMaterialsPage";

// Layout & guards
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/shared/ProtectedRoute";

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes (no layout) ─────────────────────────── */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

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

        {/* ── Catch-all — redirect unknown paths to login ──────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
