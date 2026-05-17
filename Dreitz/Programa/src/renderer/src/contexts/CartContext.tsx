import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CartItem } from '../lib/types';
import { useAuth } from './AuthContext';
import { play } from '../lib/sounds';

interface CartCtx {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (gameId: number) => void;
  clear: () => void;
  total: number;
  has: (gameId: number) => boolean;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = user ? `dreitz.cart.${user.id}` : 'dreitz.cart.guest';
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(key);
    setItems(raw ? JSON.parse(raw) : []);
  }, [key]);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(items));
  }, [key, items]);

  function add(item: CartItem) {
    setItems((curr) => {
      if (curr.find((i) => i.gameId === item.gameId)) return curr;
      play('add_cart');
      return [...curr, item];
    });
  }
  function remove(gameId: number) {
    setItems((curr) => {
      if (!curr.find((i) => i.gameId === gameId)) return curr;
      play('remove_cart');
      return curr.filter((i) => i.gameId !== gameId);
    });
  }
  function clear() {
    setItems([]);
  }
  const total = items.reduce((s, i) => s + i.price, 0);
  const has = (gameId: number) => !!items.find((i) => i.gameId === gameId);

  return <Ctx.Provider value={{ items, add, remove, clear, total, has }}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be inside CartProvider');
  return c;
}
