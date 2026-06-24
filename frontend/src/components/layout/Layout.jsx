/**
 * Layout — wraps all dashboard pages with Navbar + Sidebar + content area.
 *
 * Every authenticated page is rendered inside this layout shell. Auth pages
 * (login, register) bypass this layout entirely.
 *
 * @param {Object} props
 * @param {JSX.Element} props.children - The page content to render in the main area.
 * @returns {JSX.Element} The full dashboard layout.
 */

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
