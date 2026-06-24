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
import LecturerDashboard from "./pages/lecturer/LecturerDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";

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

        {/* ── Catch-all — redirect unknown paths to login ──────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
