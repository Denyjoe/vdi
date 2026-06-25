/**
 * Layout — wraps all dashboard pages with Navbar + Sidebar + content area.
 *
 * Implements responsive sidebar behavior:
 *   - Desktop (md+): Sidebar is always visible in a static position.
 *   - Mobile (<md): Sidebar is hidden by default and slides in from the left
 *     when the hamburger menu is clicked. A dark overlay closes it.
 *
 * Every authenticated page is rendered inside this layout shell. Auth pages
 * (login, register) bypass this layout entirely.
 *
 * @param {Object} props
 * @param {JSX.Element} props.children - The page content to render in the main area.
 * @returns {JSX.Element} The full dashboard layout.
 */

import { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#0F172A]">
      {/* Mobile overlay — covers content when sidebar is open on small screens */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <div
        className={`
          fixed md:static inset-y-0 left-0 z-30 w-64
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
