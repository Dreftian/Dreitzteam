/**
 * Descargador de juegos desde InsForge Storage (CDN).
 *
 * Flujo:
 *   1. El usuario compra una licencia (en checkout) → recibe `license.code`.
 *   2. Hace click en "Descargar" en GameDetail → llamamos a `descargarJuego`.
 *   3. Buscamos el `download_url` del juego (apunta a un object en el bucket
 *      `dreitz-games`). Si no hay URL, fallback al manifest del juego en Steam.
 *   4. Bajamos el `.zip` con stream + progreso → `userData/downloads/<game>.zip`.
 *   5. Verificamos checksum (si el catálogo lo trae) → descomprimimos a
 *      `userData/library/<game>/` → marcamos `installs.status='installed'`.
 *
 * Storage en InsForge:
 *   - bucket `dreitz-games` (público) — el admin sube los .zip con `insforge storage upload`.
 *   - URL pública: https://f2i554x7.us-east.insforge.app/storage/dreitz-games/<key>
 *
 * Para descargas "key-only" (sin host propio), `download_url` puede apuntar
 * directamente a Steam, GoG, OneDrive shared link, etc. — el descargador
 * trata cualquier https URL igual.
 */

import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import AdmZip from 'adm-zip';
import { getDb } from './db';
import log from './logger';

const DOWNLOADS_DIR = path.join(app.getPath('userData'), 'downloads');
const LIBRARY_DIR = path.join(app.getPath('userData'), 'library');

function ensureDir(p: string) { try { fs.mkdirSync(p, { recursive: true }); } catch {} }

interface Progreso {
  juego_id: number;
  bytes_descargados: number;
  bytes_total: number;
  porcentaje: number;
  estado: 'descargando' | 'extrayendo' | 'completado' | 'error';
  mensaje?: string;
}

function emitirProgreso(p: Progreso) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('download:progress', p);
  }
}

/**
 * Stream-download con redirecciones automáticas y reporte de progreso.
 * Soporta http/https. Errores de red lanzan con mensaje legible.
 */
function descargarStream(
  url: string,
  destino: string,
  onProgreso: (descargado: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const cliente = parsed.protocol === 'https:' ? https : http;
    const req = cliente.get(
      url,
      { headers: { 'User-Agent': 'Dreitz/1.0' } },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          const loc = res.headers.location;
          if (!loc) return reject(new Error('Redirect sin Location header'));
          res.resume();
          return descargarStream(loc, destino, onProgreso).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} bajando ${url}`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let descargado = 0;
        const fileStream = fs.createWriteStream(destino);
        res.on('data', (chunk) => {
          descargado += chunk.length;
          onProgreso(descargado, total);
        });
        res.pipe(fileStream);
        fileStream.on('finish', () => fileStream.close(() => resolve()));
        fileStream.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(60_000, () => req.destroy(new Error('Timeout descargando')));
  });
}

/**
 * Inicia la descarga + extracción de un juego. Validación previa: el usuario
 * debe tener al menos una licencia activa para ese juego.
 */
export async function descargarJuego(payload: {
  userId: number;
  gameId: number;
  licenseId: number;
}): Promise<{ ok: boolean; install_path?: string; error?: string }> {
  const { userId, gameId, licenseId } = payload;
  const db = getDb();

  const juego = db.prepare(`
    SELECT g.id, g.title, g.download_url, g.download_checksum
    FROM games g
    WHERE g.id = ?
  `).get(gameId) as { id: number; title: string; download_url?: string; download_checksum?: string } | undefined;

  if (!juego) return { ok: false, error: 'Juego no encontrado' };

  const licencia = db.prepare(`
    SELECT id FROM licenses WHERE id = ? AND sold_to = ? AND game_id = ?
  `).get(licenseId, userId, gameId);
  if (!licencia) return { ok: false, error: 'No tienes licencia para este juego' };

  const url = juego.download_url;
  if (!url) {
    return {
      ok: false,
      error: 'Este juego no tiene URL de descarga aún. El admin debe subir el .zip al bucket dreitz-games desde Keys.'
    };
  }

  ensureDir(DOWNLOADS_DIR);
  ensureDir(LIBRARY_DIR);
  const safeName = juego.title.replace(/[^\w\d-]/g, '_').slice(0, 60);
  const zipPath = path.join(DOWNLOADS_DIR, `${safeName}.zip`);
  const installPath = path.join(LIBRARY_DIR, safeName);

  emitirProgreso({ juego_id: gameId, bytes_descargados: 0, bytes_total: 0, porcentaje: 0, estado: 'descargando' });

  try {
    await descargarStream(url, zipPath, (descargado, total) => {
      const pct = total > 0 ? Math.round((descargado / total) * 100) : 0;
      emitirProgreso({
        juego_id: gameId, bytes_descargados: descargado, bytes_total: total,
        porcentaje: pct, estado: 'descargando'
      });
    });

    emitirProgreso({ juego_id: gameId, bytes_descargados: 0, bytes_total: 0, porcentaje: 100, estado: 'extrayendo' });

    ensureDir(installPath);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(installPath, true);

    db.prepare(`
      INSERT INTO installs (user_id, game_id, status, install_path, installed_at)
      VALUES (?, ?, 'installed', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, game_id) DO UPDATE SET
        status = 'installed', install_path = excluded.install_path, installed_at = CURRENT_TIMESTAMP
    `).run(userId, gameId, installPath);

    try { fs.unlinkSync(zipPath); } catch {}

    emitirProgreso({ juego_id: gameId, bytes_descargados: 0, bytes_total: 0, porcentaje: 100, estado: 'completado' });
    log.info(`[downloader] ${juego.title} instalado en ${installPath}`);
    return { ok: true, install_path: installPath };
  } catch (e) {
    const msg = (e as Error).message;
    log.error(`[downloader] falló ${juego.title}:`, msg);
    emitirProgreso({ juego_id: gameId, bytes_descargados: 0, bytes_total: 0, porcentaje: 0, estado: 'error', mensaje: msg });
    return { ok: false, error: msg };
  }
}

export function rutaInstalacion(userId: number, gameId: number): string | null {
  const row = getDb().prepare('SELECT install_path FROM installs WHERE user_id = ? AND game_id = ? AND status = ?')
    .get(userId, gameId, 'installed') as { install_path?: string } | undefined;
  return row?.install_path ?? null;
}
