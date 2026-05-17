import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Game } from '../lib/types';

/**
 * Cache global del catálogo con persistencia localStorage.
 *
 * Estrategia de carga:
 *  1. Al MONTAR: hidrata `games` desde `localStorage.dreitz.catalog.v1`
 *     INSTANTÁNEAMENTE → la tienda aparece llena sin "Cargando…".
 *  2. En background, dispara `gamesList({})` para refrescar contra SQLite.
 *     Cuando llega, actualiza state + localStorage. UI no se bloquea.
 *  3. Refresh periódico cada 60s + cuando InsForge avisa de cambio remoto.
 *
 * Resultado: arranque a tienda llena en <100ms aunque sea cold-start.
 */

const STORAGE_KEY = 'dreitz.catalog.v1';
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días — fresco si no han pasado 7 días

interface CatalogCtx {
  games: Game[];
  loaded: boolean;
  refreshing: boolean;
  getGame: (id: number) => Game | undefined;
  refresh: () => Promise<void>;
}

interface StoredPayload { ts: number; games: Game[] }

function loadFromStorage(): Game[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as StoredPayload;
    if (!p || !Array.isArray(p.games)) return [];
    if (Date.now() - p.ts > STORAGE_TTL_MS) return []; // expirado
    return p.games;
  } catch { return []; }
}

function saveToStorage(games: Game[]) {
  try {
    // Reducir tamaño: solo guardamos campos necesarios para listing,
    // no `detailed_description` ni `screenshots` que ocupan muchísimo.
    const slim = games.map((g) => ({
      ...g,
      detailed_description: undefined,
      screenshots: undefined,
      pc_requirements_min: undefined,
      pc_requirements_rec: undefined
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), games: slim }));
  } catch (e) {
    // Si excede quota, borramos el cache y seguimos
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }
}

const Ctx = createContext<CatalogCtx | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  // Hidratación SÍNCRONA desde localStorage — la tienda ya tiene data al primer render.
  const initial = loadFromStorage();
  const [games, setGames] = useState<Game[]>(initial);
  const [loaded, setLoaded] = useState(initial.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const lastFetch = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const p = (async () => {
      setRefreshing(true);
      try {
        const list = await window.api.gamesList({});
        if (Array.isArray(list)) {
          setGames(list);
          setLoaded(true);
          lastFetch.current = Date.now();
          saveToStorage(list);
        }
      } finally {
        setRefreshing(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = p;
    return p;
  }, []);

  // Refresh inicial diferido 500ms — el primer paint usa localStorage y luego
  // refrescamos en background sin competir con renders críticos.
  useEffect(() => {
    const id = setTimeout(() => { refresh(); }, 500);
    return () => clearTimeout(id);
  }, [refresh]);

  // Refresh periódico cada 60s para captar updates del admin sin recarga
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastFetch.current > 60_000) refresh();
    }, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Escuchar el push de catálogo desde InsForge (cuando Keys edita algo)
  useEffect(() => {
    const off = window.api.onSupabaseCatalogChanged?.(() => { refresh(); });
    return () => off?.();
  }, [refresh]);

  const getGame = useCallback((id: number) => games.find((g) => g.id === id), [games]);

  return (
    <Ctx.Provider value={{ games, loaded, refreshing, getGame, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCatalog(): CatalogCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCatalog requires CatalogProvider');
  return c;
}
