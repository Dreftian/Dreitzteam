/**
 * Cron interno que refresca precios desde Steam cada 24h.
 *
 * Para cada juego activo con `steam_app_id`, consulta la API de Steam y actualiza
 * `price_final`, `discount_percent`, y añade un punto a `price_history`. Esto
 * mantiene el catálogo sincronizado sin intervención del admin.
 *
 * Si InsForge está conectado, el sondeo periódico de catálogo recoge el cambio
 * y lo replica al resto de instalaciones.
 *
 * Estrategia:
 *   - Primer run después de 30s desde startup (no bloquea el arranque).
 *   - Después cada 24h.
 *   - Procesa 1 juego cada 1.5s para no martillar la API pública de Steam.
 *   - Skip si la última sync fue hace <23h (manejo de restarts).
 */

import { getDb } from './db';
import { fetchSteamGame } from './steam';
import log from './logger';

let timer: NodeJS.Timeout | null = null;
let kickoff: NodeJS.Timeout | null = null;
let running = false;

const TICK_MS = 24 * 60 * 60 * 1000;
const KICKOFF_DELAY_MS = 30_000;
const PER_GAME_DELAY_MS = 1_500;

function getLastSync(): number {
  const r = getDb().prepare(`SELECT value FROM app_config WHERE key = ?`).get('price_sync.last_run_at') as any;
  return r?.value ? new Date(r.value).getTime() : 0;
}

function setLastSync() {
  getDb().prepare(
    `INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
  ).run('price_sync.last_run_at', new Date().toISOString());
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runSyncNow(opts?: { force?: boolean }): Promise<{ updated: number; skipped: number; failed: number }> {
  if (running) return { updated: 0, skipped: 0, failed: 0 };
  if (!opts?.force && Date.now() - getLastSync() < TICK_MS - 60 * 60 * 1000) {
    log.info('[priceSync] skipped — last run < 23h ago');
    return { updated: 0, skipped: 0, failed: 0 };
  }
  running = true;
  log.info('[priceSync] starting…');
  const db = getDb();
  const games = db.prepare(
    `SELECT id, steam_app_id, price_final, discount_percent FROM games
     WHERE is_active = 1 AND steam_app_id IS NOT NULL AND is_preorder = 0`
  ).all() as any[];

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const g of games) {
    try {
      const fresh = await fetchSteamGame(String(g.steam_app_id));
      if (!fresh) { skipped += 1; continue; }
      const same =
        Math.abs(fresh.price_final - g.price_final) < 0.01 &&
        fresh.discount_percent === g.discount_percent;
      if (same) { skipped += 1; }
      else {
        db.prepare(
          `UPDATE games SET price_initial = ?, price_final = ?, discount_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(fresh.price_initial, fresh.price_final, fresh.discount_percent, g.id);
        db.prepare(
          `INSERT INTO price_history (game_id, price, discount_percent) VALUES (?, ?, ?)`
        ).run(g.id, fresh.price_final, fresh.discount_percent);
        updated += 1;
      }
    } catch (e) {
      log.warn(`[priceSync] failed appid=${g.steam_app_id}:`, (e as Error).message);
      failed += 1;
    }
    await sleep(PER_GAME_DELAY_MS);
  }

  setLastSync();
  running = false;
  log.info(`[priceSync] done · updated=${updated} skipped=${skipped} failed=${failed}`);
  return { updated, skipped, failed };
}

export function startPriceSync() {
  if (timer || kickoff) return;
  kickoff = setTimeout(() => {
    runSyncNow().catch((e) => log.warn('[priceSync] kickoff error:', e));
    kickoff = null;
    timer = setInterval(() => {
      runSyncNow().catch((e) => log.warn('[priceSync] tick error:', e));
    }, TICK_MS);
  }, KICKOFF_DELAY_MS);
}

export function stopPriceSync() {
  if (kickoff) { clearTimeout(kickoff); kickoff = null; }
  if (timer) { clearInterval(timer); timer = null; }
}

export function status() {
  return {
    running,
    last_run_at: getLastSync() ? new Date(getLastSync()).toISOString() : null
  };
}
