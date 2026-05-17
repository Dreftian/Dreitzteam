/**
 * Modo familia — varios usuarios bajo un mismo `family_id` ven en tiempo real
 * quién está jugando qué. Sin amigos externos, solo lo que comparte la familia.
 *
 * Storage en InsForge: tabla `family_presence` con (user_id, family_id, username,
 * playing_game_id, playing_title, last_ping). Cada cliente hace upsert cada 60s.
 * El renderer hace polling cada 60s para refrescar la rail "Familia".
 *
 * `family_id` se genera la primera vez que un usuario activa el modo familia y
 * comparte el código (6 chars) con sus parientes. Quien lo pegue queda
 * vinculado al mismo grupo.
 */

import { getDb } from './db';
import log from './logger';

const HOST = 'https://f2i554x7.us-east.insforge.app';
const KEY = '';

function obtenerCreds() {
  const db = getDb();
  const get = (k: string) => (db.prepare('SELECT value FROM app_config WHERE key = ?').get(k) as any)?.value;
  const creds = { url: get('insforge.url') || HOST, clave: get('insforge.api_key') || KEY };
  if (!creds.url || !creds.clave) return null;
  return creds;
}

function nuevoCodigo(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function obtenerFamilyId(userId: number): string | null {
  const row = getDb().prepare('SELECT family_id FROM users WHERE id = ?').get(userId) as any;
  return row?.family_id ?? null;
}

export function crearFamilia(userId: number): { family_id: string } {
  const codigo = nuevoCodigo();
  getDb().prepare('UPDATE users SET family_id = ? WHERE id = ?').run(codigo, userId);
  return { family_id: codigo };
}

export function unirseAFamilia(payload: { userId: number; family_id: string }): { ok: boolean; error?: string } {
  const f = payload.family_id.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(f)) return { ok: false, error: 'Código inválido (4-8 caracteres)' };
  getDb().prepare('UPDATE users SET family_id = ? WHERE id = ?').run(f, payload.userId);
  return { ok: true };
}

export function salirDeFamilia(userId: number) {
  getDb().prepare('UPDATE users SET family_id = NULL WHERE id = ?').run(userId);
}

/**
 * Reporta al backend que este usuario sigue activo + qué juega ahora.
 */
export async function pingPresencia(payload: { userId: number }) {
  try {
    const db = getDb();
    const u = db.prepare('SELECT id, username, family_id FROM users WHERE id = ?').get(payload.userId) as any;
    if (!u?.family_id) return; // no participa en ninguna familia
    const ahora = db.prepare(`
      SELECT g.id, g.title FROM playtime p
      JOIN games g ON g.id = p.game_id
      WHERE p.user_id = ? AND p.ended_at IS NULL
      ORDER BY p.started_at DESC LIMIT 1
    `).get(payload.userId) as any;
    const creds = obtenerCreds();
    if (!creds) return;
    const { url, clave } = creds;
    await fetch(`${url}/api/database/records/family_presence`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clave}`,
        'apikey': clave,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify([{
        user_id: u.id,
        family_id: u.family_id,
        username: u.username,
        playing_game_id: ahora?.id ?? null,
        playing_title: ahora?.title ?? null,
        last_ping: new Date().toISOString()
      }])
    });
  } catch (e) {
    log.warn('[family] ping falló:', (e as Error).message);
  }
}

/**
 * Devuelve los miembros activos (ping < 5 min) de la familia del usuario,
 * EXCEPTO él mismo.
 */
export async function listarFamilia(userId: number): Promise<any[]> {
  try {
    const db = getDb();
    const u = db.prepare('SELECT family_id FROM users WHERE id = ?').get(userId) as any;
    if (!u?.family_id) return [];
    const creds = obtenerCreds();
    if (!creds) return [];
    const { url, clave } = creds;
    const params = new URLSearchParams({
      family_id: `eq.${u.family_id}`,
      'user_id': `neq.${userId}`,
      order: 'last_ping.desc',
      limit: '20'
    });
    const r = await fetch(`${url}/api/database/records/family_presence?${params}`, {
      headers: { 'Authorization': `Bearer ${clave}`, 'apikey': clave }
    });
    if (!r.ok) return [];
    const j = await r.json().catch(() => []);
    // Filtrar inactivos (ping > 5 min)
    const lim = Date.now() - 5 * 60 * 1000;
    return (Array.isArray(j) ? j : []).filter((x: any) =>
      x.last_ping && new Date(x.last_ping).getTime() > lim
    );
  } catch (e) {
    log.warn('[family] list falló:', (e as Error).message);
    return [];
  }
}
