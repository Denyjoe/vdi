import { create } from 'zustand'

const useUIStore = create((set) => ({
  showUpgradeModal: false,
  openUpgradeModal: () => set({ showUpgradeModal: true }),
  closeUpgradeModal: () => set({ showUpgradeModal: false }),
}))

export default useUIStore
