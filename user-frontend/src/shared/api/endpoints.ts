import { apiFetch } from '@/shared/api/client';
import type {
  AuthResponse,
  RegisterResponse,
  BotsResponse,
  SessionsResponse,
  MessagesResponse,
  MemoryResponse,
  ChatSession,
  User,
} from '@/shared/types';

// --- Auth ---

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string) {
  return apiFetch<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getProfile() {
  return apiFetch<{ user: User }>('/api/auth/profile');
}

// --- Bots ---

export function listBots() {
  return apiFetch<BotsResponse>('/api/bots');
}

// --- Sessions ---

export function listSessions() {
  return apiFetch<SessionsResponse>('/api/chat/sessions');
}

export function createSession(botId: string) {
  return apiFetch<{ session: ChatSession }>('/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ botId }),
  });
}

export function deleteSession(id: string) {
  return apiFetch<{ message: string }>(`/api/chat/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// --- Messages ---

export function getMessages(sessionId: string) {
  return apiFetch<MessagesResponse>(
    `/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
  );
}

// --- Client Memory ---

export function getClientMemory(botId: string) {
  return apiFetch<MemoryResponse>(`/api/chat/memory/${encodeURIComponent(botId)}`);
}

export function getAllMemories() {
  return apiFetch<{ memories: import('@/shared/types').ClientMemory[] }>('/api/chat/memories');
}

export function deleteMemoryKey(botId: string, key: string) {
  return apiFetch<{ message: string }>(
    `/api/chat/memory/${encodeURIComponent(botId)}/${encodeURIComponent(key)}`,
    { method: 'DELETE' },
  );
}

export function deleteAllMemories() {
  return apiFetch<{ message: string }>('/api/chat/memories', { method: 'DELETE' });
}
