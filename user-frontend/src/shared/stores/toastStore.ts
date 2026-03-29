import { create } from 'zustand';

export type ToastKind = 'memory' | 'info' | 'error' | 'success';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  key?: string;
  value?: string;
  message?: string;
}

interface ToastState {
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, 'id'>) => number;
  dismissToast: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = ++nextId;
    set((state) => ({ toasts: [...state.toasts, { id, ...toast }] }));
    return id;
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
  },
}));

export function showToast(toast: Omit<ToastItem, 'id'>, timeoutMs = 5000): number {
  const id = useToastStore.getState().pushToast(toast);
  if (timeoutMs > 0) {
    window.setTimeout(() => {
      useToastStore.getState().dismissToast(id);
    }, timeoutMs);
  }
  return id;
}

export function dismissToast(id: number): void {
  useToastStore.getState().dismissToast(id);
}
