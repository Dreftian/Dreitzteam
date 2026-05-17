/**
 * Image pre-cache para imágenes de Steam.
 *
 * Las URLs de Steam (header_image, capsule_image, screenshots, etc.) funcionan
 * online pero el catálogo se siente "vacío" mientras cargan. Cacheamos los
 * archivos en `app.getPath('userData')/cache/images/<sha1>.<ext>` y exponemos
 * un protocolo `dreitzcache://...` que el renderer puede usar como src.
 *
 * Flujo:
 *   - El renderer pide `cache:fetch(url)`.
 *   - Si ya existe el archivo en disco, devolvemos la ruta + dataUrl.
 *   - Si no, descargamos en background, guardamos, devolvemos.
 *   - Cuando el renderer hace `<img src={cachedUrl}>`, carga desde disco
 *     (instantáneo, sin red).
 *
 * Strategy LRU: limitamos a 500 MB total; cuando se excede, borramos las más
 * viejas primero (mtime).
 */

import { app, protocol, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import log from './logger';

const MAX_CACHE_BYTES = 500 * 1024 * 1024;
const SCHEME = 'dreitzcache';

function cacheDir(): string {
  const dir = path.join(app.getPath('userData'), 'cache', 'images');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function urlToCacheKey(url: string): { key: string; ext: string } {
  const hash = crypto.createHash('sha1').update(url).digest('hex');
  const m = /\.([a-z0-9]{3,4})(\?|$)/i.exec(url);
  const ext = m ? m[1].toLowerCase() : 'jpg';
  return { key: hash, ext };
}

function localPath(url: string): string {
  const { key, ext } = urlToCacheKey(url);
  return path.join(cacheDir(), `${key}.${ext}`);
}

export function registerProtocol() {
  // Custom protocol que sirve los archivos cacheados al renderer.
  // dreitzcache://<sha1>.<ext>  → fs read del archivo
  protocol.handle(SCHEME, async (request) => {
    try {
      const u = new URL(request.url);
      const filename = u.hostname + (u.pathname.length > 1 ? u.pathname : '');
      const file = path.join(cacheDir(), filename);
      if (!fs.existsSync(file)) return new Response('Not cached', { status: 404 });
      // Stream el archivo de vuelta
      const data = fs.readFileSync(file);
      const ext = path.extname(file).slice(1).toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return new Response(data, { headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' } });
    } catch (e) {
      return new Response((e as Error).message, { status: 500 });
    }
  });
}

/**
 * Cachea una URL remota a disco. Si ya está cacheada, no-op.
 * Devuelve la URL `dreitzcache://...` que el renderer puede usar.
 */
export async function fetchAndCache(url: string): Promise<string> {
  if (!url || !url.startsWith('http')) return url; // not cacheable
  const { key, ext } = urlToCacheKey(url);
  const filename = `${key}.${ext}`;
  const file = path.join(cacheDir(), filename);

  if (fs.existsSync(file)) {
    // Toca el mtime para LRU
    try { fs.utimesSync(file, new Date(), new Date()); } catch {}
    return `${SCHEME}://${filename}`;
  }

  try {
    const res = await net.fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(file, buf);
    await maybePrune();
    return `${SCHEME}://${filename}`;
  } catch (e) {
    log.warn(`[imageCache] failed to cache ${url}:`, (e as Error).message);
    return url; // fallback al URL original
  }
}

/**
 * Si el cache excede el tope, borra archivos más viejos hasta volver bajo el límite.
 * Corre poco frecuente — sólo después de cada fetch nuevo (cheap).
 */
async function maybePrune() {
  const dir = cacheDir();
  let total = 0;
  const entries = fs.readdirSync(dir).map((name) => {
    const p = path.join(dir, name);
    const s = fs.statSync(p);
    total += s.size;
    return { path: p, mtime: s.mtimeMs, size: s.size };
  });
  if (total <= MAX_CACHE_BYTES) return;
  entries.sort((a, b) => a.mtime - b.mtime); // oldest first
  let removed = 0;
  for (const e of entries) {
    if (total <= MAX_CACHE_BYTES * 0.85) break; // target 85% del max después de purgar
    try { fs.unlinkSync(e.path); total -= e.size; removed += 1; } catch {}
  }
  if (removed) log.info(`[imageCache] pruned ${removed} files, total now ${total} bytes`);
}

export function getStats() {
  const dir = cacheDir();
  let total = 0;
  let count = 0;
  for (const name of fs.readdirSync(dir)) {
    try { total += fs.statSync(path.join(dir, name)).size; count += 1; } catch {}
  }
  return { count, totalBytes: total, maxBytes: MAX_CACHE_BYTES };
}

export function clearCache() {
  const dir = cacheDir();
  for (const name of fs.readdirSync(dir)) {
    try { fs.unlinkSync(path.join(dir, name)); } catch {}
  }
  log.info('[imageCache] cleared');
}

// Permitir que el renderer/main importe estos antes de app.ready
export function privilegedSchemeBootstrap() {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: false } }
  ]);
}
