/**
 * Backup automático de la DB SQLite local a InsForge Storage.
 *
 * Estrategia:
 *  - Una vez al día (cron interno, primer arranque de cada día) → comprime
 *    `dreitzteam.db` + sube al bucket privado `dreitz-backups` con nombre
 *    `<userId>-<yyyy-mm-dd>.db`.
 *  - Mantenemos los últimos 7 backups remotos; los más viejos se borran.
 *  - Si la red falla, anotamos en `app_config` la última falla y reintentamos
 *    el día siguiente. Nunca bloquea la app.
 *  - Restore: el usuario pulsa "Restaurar" en Ajustes → bajamos el .db → lo
 *    swap con el actual (la app pide reiniciar).
 *
 * Las llamadas a Storage usan fetch directo contra la REST API de InsForge —
 * mismo patrón que `insforge.ts`.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { app } from 'electron';
import { getDb } from './db';
import log from './logger';

const HOST_POR_DEFECTO = 'https://f2i554x7.us-east.insforge.app';
const CLAVE_POR_DEFECTO = '';
const BUCKET = 'dreitz-backups';
const RETENCION_DIAS = 7;

function obtenerCreds(): { url: string; clave: string } {
  const db = getDb();
  const get = (k: string) => (db.prepare('SELECT value FROM app_config WHERE key = ?').get(k) as any)?.value;
  const creds = {
    url: get('insforge.url') || HOST_POR_DEFECTO,
    clave: get('insforge.api_key') || CLAVE_POR_DEFECTO
  };
  if (!creds.url || !creds.clave) throw new Error('InsForge no esta configurado');
  return creds;
}

function rutaDb(): string {
  return path.join(app.getPath('userData'), 'dreitzteam.db');
}

function ultimaFecha(): string | null {
  return (getDb().prepare('SELECT value FROM app_config WHERE key = ?').get('backup.last_at') as any)?.value ?? null;
}

function marcarFecha() {
  getDb().prepare(
    `INSERT INTO app_config (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
  ).run('backup.last_at', new Date().toISOString());
}

/**
 * Sube un buffer al bucket `dreitz-backups`. Devuelve la `key` del objeto.
 * InsForge usa multipart/form-data en `/api/storage/<bucket>/upload`.
 */
async function subirAlBucket(nombre: string, contenido: Buffer): Promise<string> {
  const { url, clave } = obtenerCreds();
  const form = new FormData();
  const blob = new Blob([contenido as any], { type: 'application/gzip' });
  form.append('file', blob, nombre);
  form.append('key', nombre);

  const r = await fetch(`${url}/api/storage/buckets/${BUCKET}/objects`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${clave}`, 'apikey': clave },
    body: form
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Upload falló: ${r.status} ${t.slice(0, 200)}`);
  }
  const j = await r.json().catch(() => ({}));
  return (j as any).key ?? nombre;
}

async function listarBackups(): Promise<Array<{ key: string; updated_at?: string }>> {
  const { url, clave } = obtenerCreds();
  const r = await fetch(`${url}/api/storage/buckets/${BUCKET}/objects`, {
    headers: { 'Authorization': `Bearer ${clave}`, 'apikey': clave }
  });
  if (!r.ok) return [];
  const j = await r.json().catch(() => []);
  return Array.isArray(j) ? j : (j.records ?? []);
}

async function borrarBackup(key: string) {
  const { url, clave } = obtenerCreds();
  await fetch(`${url}/api/storage/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${clave}`, 'apikey': clave }
  }).catch(() => {});
}

/**
 * Comprime y sube la DB. Devuelve la key del backup o lanza si falla.
 */
export async function backupAhora(userId: number | null): Promise<{ key: string; size_kb: number }> {
  const src = rutaDb();
  if (!fs.existsSync(src)) throw new Error('DB local no existe todavía');
  const buf = fs.readFileSync(src);
  const gz = zlib.gzipSync(buf, { level: 9 });

  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `${userId ?? 'anon'}-${fecha}-${Date.now()}.db.gz`;

  const key = await subirAlBucket(nombre, gz);
  marcarFecha();

  // Limpieza: dejar solo los últimos N
  try {
    const all = (await listarBackups()).filter((b) => b.key.startsWith(`${userId ?? 'anon'}-`));
    all.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
    for (const viejo of all.slice(RETENCION_DIAS)) {
      await borrarBackup(viejo.key);
    }
  } catch (e) {
    log.warn('[backup] cleanup parcial:', (e as Error).message);
  }

  log.info(`[backup] subido ${key} (${Math.round(gz.length / 1024)} KB)`);
  return { key, size_kb: Math.round(gz.length / 1024) };
}

/**
 * Cron: corre 5 min después del arranque y luego cada 24h. Skip si ya hubo
 * backup hoy.
 */
let timer: NodeJS.Timeout | null = null;
let arranque: NodeJS.Timeout | null = null;

export function iniciarBackupAutomatico(userIdProvider: () => number | null) {
  if (timer) return;
  const intentar = async () => {
    try {
      const ultima = ultimaFecha();
      if (ultima) {
        const horas = (Date.now() - new Date(ultima).getTime()) / 36e5;
        if (horas < 23) return; // ya hay backup reciente
      }
      const uid = userIdProvider();
      if (uid === null) return; // no hay usuario logeado
      await backupAhora(uid);
    } catch (e) {
      log.warn('[backup] auto falló:', (e as Error).message);
    }
  };
  arranque = setTimeout(intentar, 5 * 60 * 1000);
  timer = setInterval(intentar, 24 * 60 * 60 * 1000);
}

export function detenerBackupAutomatico() {
  if (arranque) clearTimeout(arranque);
  if (timer) clearInterval(timer);
  arranque = null; timer = null;
}

/**
 * Restore: descarga la key especificada, descomprime sobre `dreitzteam.db`.
 * El caller debe reiniciar la app después.
 */
export async function restaurarBackup(key: string): Promise<{ ok: boolean; error?: string }> {
  const { url, clave } = obtenerCreds();
  try {
    const r = await fetch(`${url}/api/storage/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`, {
      headers: { 'Authorization': `Bearer ${clave}`, 'apikey': clave }
    });
    if (!r.ok) return { ok: false, error: `Download ${r.status}` };
    const ab = await r.arrayBuffer();
    const gz = Buffer.from(ab);
    const sql = zlib.gunzipSync(gz);
    const dst = rutaDb();
    // Backup local antes de sobreescribir, por seguridad
    if (fs.existsSync(dst)) fs.copyFileSync(dst, dst + '.before-restore');
    fs.writeFileSync(dst, sql);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function listarBackupsParaUi(userId: number) {
  try {
    const all = await listarBackups();
    return all.filter((b) => b.key.startsWith(`${userId}-`));
  } catch (e) {
    log.warn('[backup] list falló:', (e as Error).message);
    return [];
  }
}
