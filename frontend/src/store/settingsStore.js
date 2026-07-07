import { create } from 'zustand';

const useSettingsStore = create((set) => ({
  isOpen: false,
  activeTab: 'profile',
  openSettings: (tab = 'profile') => set({ isOpen: true, activeTab: tab }),
  closeSettings: () => set({ isOpen: false }),
  setTab: (tab) => set({ activeTab: tab }),
}));

export default useSettingsStore;
