'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AUTH_COOKIE,
  clearClientAuthCookies,
  readClientCookie,
  setClientAuthCookies,
  TOKEN_COOKIE,
  USER_COOKIE,
} from './auth-cookies';
import { ApiError, api } from './api';

export type UserRole = 'USER' | 'ADMIN';

export type User = {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  timezone?: string;
  locale?: string;
  plan?: 'FREE' | 'PREMIER';
  planExpiresAt?: string | null;
  emailVerified?: boolean;
  countryCode?: string | null;
  createdAt?: string;
};

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Re-fetch `/auth/me` and update the cached user (e.g. after profile edits). */
  refreshUser: () => Promise<User | null>;
  /** Merge a partial user into the cached user without a network round-trip. */
  updateUser: (patch: Partial<User>) => void;
};

const AuthContext = createContext<AuthState | null>(null);
const TOKEN_KEY = 'bracket_token';
const USER_KEY = 'bracket_user';
const HYDRATE_TIMEOUT_MS = 8000;

export { AUTH_COOKIE };

/** Keep the cookie payload small: only fields the middleware/header need. */
function compactUser(user: User): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    username: user.username ?? null,
    avatarUrl: user.avatarUrl ?? null,
    plan: user.plan,
    emailVerified: user.emailVerified,
    timezone: user.timezone,
  };
}

function syncStorage(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  setClientAuthCookies(token, JSON.stringify(compactUser(user)));
}

function readStoredUser(raw: string): User | null {
  try {
    const parsed = JSON.parse(raw) as User;
    if (!parsed?.id || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const authVersion = useRef(0);
  const tokenRef = useRef<string | null>(null);

  const logout = useCallback(() => {
    authVersion.current += 1;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    clearClientAuthCookies();
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const persist = useCallback((accessToken: string, nextUser: User) => {
    authVersion.current += 1;
    syncStorage(accessToken, nextUser);
    tokenRef.current = accessToken;
    setToken(accessToken);
    setUser(nextUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const versionAtStart = authVersion.current;

    const storedToken =
      localStorage.getItem(TOKEN_KEY) ?? readClientCookie(TOKEN_COOKIE);
    const storedUserRaw =
      localStorage.getItem(USER_KEY) ?? readClientCookie(USER_COOKIE);
    const storedUser = storedUserRaw ? readStoredUser(storedUserRaw) : null;

    if (!storedToken || !storedUser) {
      setLoading(false);
      return;
    }

    syncStorage(storedToken, storedUser);
    tokenRef.current = storedToken;
    setToken(storedToken);
    setUser(storedUser);
    setLoading(false);

    void (async () => {
      try {
        const res = await api<{ user: User }>('/auth/me', {
          token: storedToken,
          timeoutMs: HYDRATE_TIMEOUT_MS,
        });
        if (!active || authVersion.current !== versionAtStart) return;
        persist(storedToken, res.user);
      } catch (err) {
        if (!active || authVersion.current !== versionAtStart) return;
        const unauthorized = err instanceof ApiError && err.status === 401;
        if (!unauthorized) return;
        const current =
          localStorage.getItem(TOKEN_KEY) ?? readClientCookie(TOKEN_COOKIE);
        if (current === storedToken) {
          logout();
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [persist, logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ accessToken: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        timeoutMs: 15000,
      });
      persist(res.accessToken, res.user);
    },
    [persist],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api<{ accessToken: string; user: User }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
          timeoutMs: 15000,
        },
      );
      persist(res.accessToken, res.user);
    },
    [persist],
  );

  const refreshUser = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) return null;
    try {
      const res = await api<{ user: User }>('/auth/me', {
        token: current,
        timeoutMs: HYDRATE_TIMEOUT_MS,
      });
      if (tokenRef.current !== current) return null;
      persist(current, res.user);
      return res.user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && tokenRef.current === current) {
        logout();
      }
      return null;
    }
  }, [persist, logout]);

  const updateUser = useCallback((patch: Partial<User>) => {
    const current = tokenRef.current;
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (current) syncStorage(current, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshUser, updateUser }),
    [user, token, loading, login, register, logout, refreshUser, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
