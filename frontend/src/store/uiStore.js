import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUIStore = create(
  persist(
    (set) => ({
      showCreateSessionModal: false,
      sidebarCollapsed: false,
      showBilling: false,
      showNotifications: false,
      mobileMenuOpen: false,
      openCreateSessionModal: () => set({ showCreateSessionModal: true }),
      closeCreateSessionModal: () => set({ showCreateSessionModal: false }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      openBilling: () => set({ showBilling: true }),
      closeBilling: () => set({ showBilling: false }),
      openNotifications: () => set({ showNotifications: true }),
      closeNotifications: () => set({ showNotifications: false }),
      toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
      closeMobileMenu: () => set({ mobileMenuOpen: false }),
    }),
    { name: 'clouddesk-ui' }
  )
);

export default useUIStore;
