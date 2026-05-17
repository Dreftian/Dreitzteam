/**
 * Feature flags vía `app_config`. Permite activar/desactivar features sin
 * re-release. Las claves van en `app_config` con prefijo `flag.*`.
 *
 *   const enabled = isFlagOn('flag.video_reviews', false);
 *
 * Para alternar desde Keys o desde un script:
 *   db.prepare(`INSERT INTO app_config (key, value) VALUES ('flag.video_reviews', '1')
 *               ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run();
 */

import { getDb } from './db';

const CACHE = new Map<string, { value: boolean; ts: number }>();
const TTL = 30_000; // 30s — cambios se propagan a los 30s, evita pegar la DB en hot paths

export function isFlagOn(key: string, fallback = false): boolean {
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.ts < TTL) return cached.value;
  try {
    const row = getDb().prepare('SELECT value FROM app_config WHERE key = ?').get(key) as any;
    const v = row?.value === '1' || row?.value === 'true';
    CACHE.set(key, { value: v, ts: Date.now() });
    return v;
  } catch {
    return fallback;
  }
}

export function setFlag(key: string, on: boolean) {
  getDb().prepare(
    `INSERT INTO app_config (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
  ).run(key, on ? '1' : '0');
  CACHE.set(key, { value: on, ts: Date.now() });
}

export function listFlags(): Record<string, boolean> {
  const rows = getDb().prepare(`SELECT key, value FROM app_config WHERE key LIKE 'flag.%'`).all() as any[];
  const out: Record<string, boolean> = {};
  for (const r of rows) out[r.key] = r.value === '1' || r.value === 'true';
  return out;
}
