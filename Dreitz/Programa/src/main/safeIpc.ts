/**
 * Thin wrapper around `ipcMain.handle` that adds two protections that the bare
 * Electron API doesn't give you:
 *
 *  - Per-channel rate limiting (token bucket). Defaults to 120 req/min/channel.
 *    Some channels (auth, payments, external fetchers) override to stricter limits.
 *
 *  - Hard timeout per request. Defaults to 30s; if the handler hangs that long
 *    the wrapper rejects so the renderer doesn't get a stuck Promise forever.
 *
 * Why: a misbehaving (or compromised) renderer could spam payments:charge,
 * auth:login, or steam:fetch; without limits the main process would happily
 * comply.
 *
 * # ⚠️ IMPORTANTE — fix de recursión
 * Antes había un bug donde `installGlobalSafeHandle` parcheaba `ipcMain.handle`
 * para que llamara a `safeHandle`, pero adentro de `safeHandle` también
 * llamábamos a `ipcMain.handle` (que ahora era safeHandle) → recursión infinita
 * con `RangeError: Maximum call stack size exceeded` al startup.
 *
 * Fix: guardamos el `handle` ORIGINAL antes de parchear, y siempre usamos esa
 * referencia interna desde `safeHandle`. El parche externo intercepta llamadas
 * de código de usuario pero internamente seguimos hablando con el método real
 * de Electron.
 */

import { ipcMain } from 'electron';

// Default 600/min ≈ 10/s — alto para UIs que disparan muchos IPC en paralelo
// (catálogo de 100+ tarjetas cada una pidiendo cache:fetch + wishlist:has +
// price-history etc). Antes era 120/min y los pages tardaban en cargar por
// rate-limit, no por la operación en sí.
const DEFAULT_RATE = { per: 60_000, max: 600 };
const DEFAULT_TIMEOUT_MS = 30_000;

interface RateConfig { per: number; max: number }
interface HandleOptions {
  rate?: RateConfig;
  timeoutMs?: number;
}

interface Bucket { tokens: number; ts: number; limit: RateConfig }
const buckets = new Map<string, Bucket>();

// Referencia al método ORIGINAL de Electron, capturada UNA VEZ al cargar este
// módulo. Inmune al parcheo posterior. Todo `safeHandle` registra contra esta.
type IpcMainHandleFn = typeof ipcMain.handle;
const ORIGINAL_HANDLE: IpcMainHandleFn = ipcMain.handle.bind(ipcMain);
const ORIGINAL_REMOVE_HANDLER = ipcMain.removeHandler.bind(ipcMain);

// Tighter limits for security-sensitive channels. These are the realistic
// brute-force / spam targets — everything else uses DEFAULT_RATE.
const CHANNEL_OVERRIDES: Record<string, Partial<HandleOptions>> = {
  'auth:login':       { rate: { per: 60_000, max: 8 },  timeoutMs: 5_000 },
  'auth:register':    { rate: { per: 60_000, max: 5 },  timeoutMs: 5_000 },
  'payments:charge':  { rate: { per: 60_000, max: 12 }, timeoutMs: 25_000 },
  'pro:subscribe':    { rate: { per: 60_000, max: 12 }, timeoutMs: 25_000 },
  'steam:fetch':      { rate: { per: 60_000, max: 30 }, timeoutMs: 15_000 },
  'steam:scan':       { rate: { per: 60_000, max: 10 }, timeoutMs: 20_000 },
  'updater:check':    { rate: { per: 60_000, max: 4 },  timeoutMs: 30_000 },
  // `cache:fetch` se llama una vez por imagen visible — un grid de 100 juegos
  // dispara 100 llamadas casi simultáneas. Permitimos 2000/min ≈ 33/s para
  // que el catálogo cargue todas las portadas sin throttling.
  'cache:fetch':      { rate: { per: 60_000, max: 2000 }, timeoutMs: 15_000 },
  // Wishlist/has y similares — se invocan por cada GameCard. Mismo razonamiento.
  'wishlist:has':     { rate: { per: 60_000, max: 1500 }, timeoutMs: 5_000 },
  'games:availableStock': { rate: { per: 60_000, max: 1500 }, timeoutMs: 5_000 }
};

function consumeToken(channel: string, limit: RateConfig): boolean {
  const now = Date.now();
  const b = buckets.get(channel);
  if (!b) {
    buckets.set(channel, { tokens: limit.max - 1, ts: now, limit });
    return true;
  }
  // Refill linearly based on elapsed time (token bucket).
  const elapsed = now - b.ts;
  const refill = (elapsed / b.limit.per) * b.limit.max;
  b.tokens = Math.min(b.limit.max, b.tokens + refill);
  b.ts = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

function withTimeout<T>(p: Promise<T>, ms: number, channel: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Tiempo de espera agotado en ${channel} (${ms}ms)`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

type IpcHandler = (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any;

export function safeHandle(channel: string, handler: IpcHandler, opts?: HandleOptions) {
  const cfg: Required<HandleOptions> = {
    rate: opts?.rate ?? CHANNEL_OVERRIDES[channel]?.rate ?? DEFAULT_RATE,
    timeoutMs: opts?.timeoutMs ?? CHANNEL_OVERRIDES[channel]?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  };

  // Usa la referencia ORIGINAL — no la patched. Esto rompe la recursión.
  ORIGINAL_REMOVE_HANDLER(channel);
  ORIGINAL_HANDLE(channel, async (event, ...args) => {
    if (!consumeToken(channel, cfg.rate)) {
      throw new Error(`Demasiadas peticiones a ${channel}. Intenta en un momento.`);
    }
    const result = handler(event, ...args);
    if (result && typeof (result as any).then === 'function') {
      return withTimeout(result as Promise<any>, cfg.timeoutMs, channel);
    }
    return result;
  });
}

/**
 * Parchea `ipcMain.handle` globalmente para que cualquier llamada subsiguiente
 * pase por `safeHandle`. Llamar UNA SOLA VEZ antes de `registerIpcHandlers()`.
 *
 * El parche redirige a `safeHandle` que internamente usa `ORIGINAL_HANDLE`,
 * así no hay recursión.
 */
export function installGlobalSafeHandle() {
  (ipcMain as any).handle = (channel: string, handler: IpcHandler) => {
    return safeHandle(channel, handler);
  };
  // El removeHandler externo también se redirige al original — sino al usar
  // `ipcMain.removeHandler(x)` luego, Electron buscaría el handler bajo el
  // wrapper en vez del registrado. Es defensa de profundidad.
  (ipcMain as any).removeHandler = (channel: string) => ORIGINAL_REMOVE_HANDLER(channel);

  return () => {
    (ipcMain as any).handle = ORIGINAL_HANDLE;
    (ipcMain as any).removeHandler = ORIGINAL_REMOVE_HANDLER;
  };
}
