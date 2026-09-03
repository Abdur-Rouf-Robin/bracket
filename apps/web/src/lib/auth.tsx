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
import { api } from './api';

type User = { id: string; email: string; name: string };

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);
const TOKEN_KEY = 'bracket_token';
const USER_KEY = 'bracket_user';
const HYDRATE_TIMEOUT_MS = 5000;

export { AUTH_COOKIE };

function syncStorage(token: string, userJson: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, userJson);
  setClientAuthCookies(token, userJson);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const authVersion = useRef(0);

  const logout = useCallback(() => {
    authVersion.current += 1;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    clearClientAuthCookies();
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const persist = useCallback((accessToken: string, nextUser: User) => {
    authVersion.current += 1;
    const userJson = JSON.stringify(nextUser);
    syncStorage(accessToken, userJson);
    setToken(accessToken);
    setUser(nextUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const versionAtStart = authVersion.current;

    const finishHydration = () => {
      if (active) setLoading(false);
    };

    const safetyTimer = window.setTimeout(finishHydration, HYDRATE_TIMEOUT_MS);

    void (async () => {
      const storedToken =
        localStorage.getItem(TOKEN_KEY) ?? readClientCookie(TOKEN_COOKIE);
      const storedUser =
        localStorage.getItem(USER_KEY) ?? readClientCookie(USER_COOKIE);

      if (!storedToken || !storedUser) {
        finishHydration();
        return;
      }

      syncStorage(storedToken, storedUser);

      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        logout();
        return;
      }

      try {
        const res = await api<{ user: User }>('/auth/me', {
          token: storedToken,
          timeoutMs: HYDRATE_TIMEOUT_MS,
        });
        if (!active || authVersion.current !== versionAtStart) return;
        persist(storedToken, res.user);
      } catch {
        if (!active || authVersion.current !== versionAtStart) return;
        const current =
          localStorage.getItem(TOKEN_KEY) ?? readClientCookie(TOKEN_COOKIE);
        if (current === storedToken) {
          logout();
        }
      } finally {
        window.clearTimeout(safetyTimer);
        finishHydration();
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(safetyTimer);
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

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
