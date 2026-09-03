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

import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import BottomDock from "./BottomDock";
import AnnouncementBanner from "./AnnouncementBanner";
import { NotificationProvider } from "../../context/NotificationContext";
import useUIStore from "../../store/uiStore";
import useSettingsStore from "../../store/settingsStore";
import SettingsPanel from "../shared/SettingsPanel";
import BillingPanel from "../shared/BillingPanel";
import NotificationsDrawer from "../shared/NotificationsDrawer";

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    showCreateSessionModal,
    closeCreateSessionModal,
    showBilling,
    closeBilling,
    showNotifications,
    closeNotifications,
    closeMobileMenu
  } = useUIStore();

  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname, closeMobileMenu]);

  return (
    <NotificationProvider>
      <div className="flex h-screen" style={{ background: 'var(--bg-canvas)' }}>
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <AnnouncementBanner />
          <Navbar />
          <main className="flex-1 overflow-auto p-4 sm:p-6 pb-[90px] md:pb-6">{children ? children : <Outlet />}</main>
        </div>
      </div>
      <BottomDock />
      {useSettingsStore(s => s.isOpen) && <SettingsPanel />}
      <BillingPanel isOpen={showBilling} onClose={closeBilling} />
      <NotificationsDrawer isOpen={showNotifications} onClose={closeNotifications} />
    </NotificationProvider>
  );
}
