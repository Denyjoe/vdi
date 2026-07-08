import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUIStore = create(
  persist(
    (set) => ({
      showUpgradeModal: false,
      showCreateSessionModal: false,
      sidebarCollapsed: false,
      showBilling: false,
      openUpgradeModal: () => set({ showUpgradeModal: true }),
      closeUpgradeModal: () => set({ showUpgradeModal: false }),
      openCreateSessionModal: () => set({ showCreateSessionModal: true }),
      closeCreateSessionModal: () => set({ showCreateSessionModal: false }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      openBilling: () => set({ showBilling: true }),
      closeBilling: () => set({ showBilling: false }),
    }),
    { name: 'clouddesk-ui' }
  )
);

export default useUIStore;
