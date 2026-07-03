import { create } from 'zustand'

const useUIStore = create((set) => ({
  showUpgradeModal: false,
  showCreateSessionModal: false,
  openUpgradeModal: () => set({ showUpgradeModal: true }),
  closeUpgradeModal: () => set({ showUpgradeModal: false }),
  openCreateSessionModal: () => set({ showCreateSessionModal: true }),
  closeCreateSessionModal: () => set({ showCreateSessionModal: false }),
}))

export default useUIStore
