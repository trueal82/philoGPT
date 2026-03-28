import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  activeModal: 'profile' | 'memory' | 'newChat' | null;
  toggleSidebar: () => void;
  openModal: (modal: UIState['activeModal']) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeModal: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));
