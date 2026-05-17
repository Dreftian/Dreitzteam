import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../lib/types';

interface AuthCtx {
  admin: User | null;
  loading: boolean;
  /** Si la respuesta tiene `requiresTotp:true`, llama a `verifyTotp` antes de tener sesión válida. */
  login: (username: string, password: string) => Promise<{ requiresTotp?: true; userId?: number } | void>;
  verifyTotp: (userId: number, token: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_KEY = 'dreitz.keys.session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setAdmin(JSON.parse(raw)); } catch { /* */ }
    }
    setLoading(false);
  }, []);

  async function login(username: string, password: string) {
    const u: any = await window.api.adminLogin({ username, password });
    if (u && u.requiresTotp) {
      return { requiresTotp: true as const, userId: u.userId as number };
    }
    setAdmin(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }

  async function verifyTotp(userId: number, token: string) {
    const u: any = await window.api.adminLoginVerifyTotp({ userId, token });
    setAdmin(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }

  function logout() {
    setAdmin(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return <Ctx.Provider value={{ admin, loading, login, verifyTotp, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth inside provider');
  return c;
}
