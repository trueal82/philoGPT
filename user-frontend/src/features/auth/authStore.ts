import { create } from 'zustand';
import type { User } from '@/shared/types';
import { getToken, setToken, clearToken } from '@/shared/utils/tokenStorage';
import * as api from '@/shared/api/endpoints';
import { connectSocket, disconnectSocket } from '@/shared/api/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<string>;
  logout: () => void;
  loadProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.login(email, password);
      setToken(res.token);
      set({ user: res.user, token: res.token, loading: false });
      connectSocket();
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  register: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.register(email, password);
      // Account is locked after registration — no token is returned
      set({ loading: false });
      return res.message ?? 'Registration successful.';
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  logout: () => {
    clearToken();
    disconnectSocket();
    set({ user: null, token: null });
  },

  loadProfile: async () => {
    set({ loading: true });
    try {
      const res = await api.getProfile();
      set({ user: res.user, loading: false });
      connectSocket();
    } catch {
      clearToken();
      set({ user: null, token: null, loading: false });
    }
  },
}));
