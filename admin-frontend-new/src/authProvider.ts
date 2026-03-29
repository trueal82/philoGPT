import { AuthProvider } from 'react-admin';

const AUTH_KEY = 'auth';

interface StoredAuth {
  token: string;
  user: { id: string; email: string; role?: string; provider?: string };
}

function getAuth(): StoredAuth | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return getAuth()?.token ?? null;
}

export const createAuthProvider = (apiUrl: string): AuthProvider => ({
  async login({ username, password }: { username: string; password: string }) {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });
    const body = await res.json();

    if (!res.ok) {
      if (body.error === 'account_locked') {
        throw new Error('Account is locked. Contact an administrator.');
      }
      throw new Error(body.message || 'Login failed');
    }

    const profileRes = await fetch(`${apiUrl}/api/auth/profile`, {
      headers: {
        Authorization: `Bearer ${body.token}`,
      },
    });
    const profileBody = await profileRes.json();

    if (!profileRes.ok) {
      throw new Error(profileBody.message || 'Failed to load profile');
    }

    if (profileBody.user?.role !== 'admin') {
      throw new Error('Access restricted to administrators');
    }

    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: body.token, user: profileBody.user }));
  },

  async logout() {
    localStorage.removeItem(AUTH_KEY);
  },

  async checkAuth() {
    if (!getAuth()) {
      throw new Error('Not authenticated');
    }
  },

  async checkError(error: { status?: number }) {
    if (error.status === 401 || error.status === 403) {
      localStorage.removeItem(AUTH_KEY);
      throw new Error('Session expired');
    }
  },

  async getIdentity() {
    const auth = getAuth();
    if (!auth) throw new Error('Not authenticated');
    return { id: auth.user.id, fullName: auth.user.email };
  },

  async getPermissions() {
    return null;
  },
});
