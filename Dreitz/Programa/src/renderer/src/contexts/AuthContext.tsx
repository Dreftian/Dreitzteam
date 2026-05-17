import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../lib/types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  /** Devuelve `{requiresTotp:true, userId}` si el usuario tiene 2FA habilitado. En ese caso debes llamar a `verifyTotp`. */
  login: (username: string, password: string) => Promise<{ requiresTotp?: true; userId?: number } | void>;
  verifyTotp: (userId: number, token: string) => Promise<void>;
  register: (username: string, email: string, password: string, refCode?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const STORAGE_KEY = 'dreitz.userId';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id) {
      window.api.authMe(parseInt(id, 10))
        .then((u) => setUser(u))
        .catch(() => localStorage.removeItem(STORAGE_KEY))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username: string, password: string) {
    const u: any = await window.api.authLogin({ username, password });
    if (u && u.requiresTotp) {
      return { requiresTotp: true as const, userId: u.userId as number };
    }
    setUser(u);
    localStorage.setItem(STORAGE_KEY, String(u.id));
  }

  async function verifyTotp(userId: number, token: string) {
    const u = await window.api.authLoginVerifyTotp({ userId, token });
    setUser(u as User);
    localStorage.setItem(STORAGE_KEY, String((u as User).id));
  }

  async function register(username: string, email: string, password: string, refCode?: string) {
    const u = await window.api.authRegister({ username, email, password, refCode });
    setUser(u);
    localStorage.setItem(STORAGE_KEY, String(u.id));
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  async function refresh() {
    if (!user) return;
    const u = await window.api.authMe(user.id);
    setUser(u);
  }

  return <Ctx.Provider value={{ user, loading, login, verifyTotp, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be inside AuthProvider');
  return c;
}
