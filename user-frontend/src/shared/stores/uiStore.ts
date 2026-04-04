import { create } from 'zustand';

type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('philogpt-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('philogpt-theme', theme);
}

interface UIState {
  sidebarOpen: boolean;
  activeModal: 'profile' | 'memory' | 'newChat' | 'changePassword' | 'counselingPlan' | null;
  theme: Theme;
  toggleSidebar: () => void;
  openModal: (modal: UIState['activeModal']) => void;
  closeModal: () => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>((set, get) => {
  // Apply initial theme on store creation
  const initialTheme = getInitialTheme();
  applyTheme(initialTheme);

  return {
    sidebarOpen: typeof window !== 'undefined' ? window.innerWidth > 768 : true,
    activeModal: null,
    theme: initialTheme,
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    openModal: (modal) => set({ activeModal: modal }),
    closeModal: () => set({ activeModal: null }),
    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      set({ theme: next });
    },
  };
});
