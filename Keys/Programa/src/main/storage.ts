/**
 * Helpers para subir .zips de juegos al bucket `dreitz-games` de InsForge.
 *
 * Se invoca desde Keys/admin via IPC. Acepta una ruta local de archivo y la
 * sube como multipart/form-data al endpoint REST de Storage. Tras subir,
 * setea `games.download_url` apuntando al objeto público.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb } from './db';
import { log } from './logger';

const HOST = 'https://f2i554x7.us-east.insforge.app';
const KEY = '';

function obtenerCreds() {
  const db = getDb();
  const get = (k: string) => (db.prepare('SELECT value FROM app_config WHERE key = ?').get(k) as any)?.value;
  const creds = { url: get('insforge.url') || HOST, clave: get('insforge.api_key') || KEY };
  if (!creds.url || !creds.clave) return null;
  return creds;
}

function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export interface UploadResultado {
  ok: boolean;
  url?: string;
  checksum?: string;
  size_bytes?: number;
  error?: string;
}

/**
 * Sube `filePath` al bucket `dreitz-games` con clave `<gameId>-<filename>` y
 * actualiza el registro del juego con la URL pública + checksum + tamaño.
 */
export async function subirZipJuego(payload: { gameId: number; filePath: string }): Promise<UploadResultado> {
  const { gameId, filePath } = payload;
  if (!fs.existsSync(filePath)) return { ok: false, error: 'Archivo no existe' };
  const stat = fs.statSync(filePath);
  if (stat.size === 0) return { ok: false, error: 'Archivo vacío' };

  const checksum = await sha256(filePath);
  const filename = path.basename(filePath);
  const key = `${gameId}-${filename}`;

  const creds = obtenerCreds();
  if (!creds) return { ok: false, error: 'InsForge no esta configurado' };
  const { url, clave } = creds;
  try {
    const buf = fs.readFileSync(filePath);
    const form = new FormData();
    const blob = new Blob([buf as any], { type: 'application/zip' });
    form.append('file', blob, filename);
    form.append('key', key);

    const r = await fetch(`${url}/api/storage/buckets/dreitz-games/objects`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${clave}`, 'apikey': clave },
      body: form
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { ok: false, error: `Upload ${r.status}: ${t.slice(0, 200)}` };
    }

    const publicUrl = `${url}/storage/dreitz-games/${encodeURIComponent(key)}`;

    // Actualizar el juego local en SQLite con los metadatos de descarga
    const db = getDb();
    db.prepare(`
      UPDATE games SET download_url = ?, download_checksum = ?, download_size_bytes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(publicUrl, checksum, stat.size, gameId);

    // Espejar a InsForge
    await fetch(`${url}/api/database/records/games?id=eq.${gameId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${clave}`, 'apikey': clave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ download_url: publicUrl, download_checksum: checksum, download_size_bytes: stat.size })
    }).catch(() => {});

    log.info(`[storage] subido juego ${gameId} → ${publicUrl} (${Math.round(stat.size / 1024 / 1024)} MB)`);
    return { ok: true, url: publicUrl, checksum, size_bytes: stat.size };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function borrarZipJuego(gameId: number): Promise<{ ok: boolean; error?: string }> {
  const creds = obtenerCreds();
  if (!creds) return { ok: false, error: 'InsForge no esta configurado' };
  const { url, clave } = creds;
  const row = getDb().prepare('SELECT download_url FROM games WHERE id = ?').get(gameId) as any;
  const u = row?.download_url as string | undefined;
  if (!u) return { ok: false, error: 'Este juego no tiene URL' };
  // Extraer la key del URL
  const m = /\/storage\/dreitz-games\/([^/?#]+)/.exec(u);
  const key = m ? decodeURIComponent(m[1]) : null;
  if (!key) return { ok: false, error: 'No se pudo parsear la URL' };

  try {
    await fetch(`${url}/api/storage/buckets/dreitz-games/objects/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${clave}`, 'apikey': clave }
    });
    getDb().prepare(`UPDATE games SET download_url=NULL, download_checksum=NULL, download_size_bytes=NULL WHERE id=?`).run(gameId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
