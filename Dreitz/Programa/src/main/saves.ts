/**
 * Local "cloud" saves — zip a folder per game, store under userData/saves/<game_id>/v<ts>.zip,
 * keep last 5 snapshots, restore unzips on top of the source folder.
 *
 * No external server. Sync manual: pulsa "Guardar" cuando quieras snapshot, "Restaurar" para volver.
 * Si quieres "cloud real", apunta saves_root a tu OneDrive / Dropbox / Google Drive sync folder
 * y la sincronización es automática (el SO se encarga de subir los .zip).
 */

import { app, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import chokidar, { type FSWatcher } from 'chokidar';
import { getDb } from './db';
import log from './logger';

const KEEP_LAST = 5;
// Debounce: si el juego escribe varias veces en ráfaga (típico al cerrar), agrupamos.
const WATCH_DEBOUNCE_MS = 15_000;

export function savesRoot(): string {
  const custom = (getDb().prepare(`SELECT value FROM app_config WHERE key = ?`).get('saves.root') as any)?.value;
  const root = custom || path.join(app.getPath('userData'), 'saves');
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

export function setSavesRoot(p: string | null) {
  const db = getDb();
  if (!p) {
    db.prepare(`DELETE FROM app_config WHERE key = ?`).run('saves.root');
  } else {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    db.prepare(
      `INSERT INTO app_config (key, value) VALUES ('saves.root', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
    ).run(p);
  }
}

export function getGameSaveFolder(gameId: number): string | null {
  const r = (getDb().prepare(`SELECT value FROM app_config WHERE key = ?`).get(`saves.game.${gameId}`) as any)?.value;
  return r ?? null;
}

export function setGameSaveFolder(gameId: number, folder: string | null) {
  const db = getDb();
  const k = `saves.game.${gameId}`;
  if (!folder) db.prepare(`DELETE FROM app_config WHERE key = ?`).run(k);
  else db.prepare(`INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(k, folder);
}

export async function pickSaveFolder(): Promise<string | null> {
  const r = await dialog.showOpenDialog({
    title: 'Selecciona la carpeta de partidas guardadas del juego',
    properties: ['openDirectory']
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
}

export function backupSave(userId: number, gameId: number, label?: string) {
  const src = getGameSaveFolder(gameId);
  if (!src) throw new Error('No hay carpeta configurada para este juego');
  if (!fs.existsSync(src)) throw new Error('La carpeta configurada ya no existe');

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(savesRoot(), String(gameId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const zipPath = path.join(dir, `v_${ts}.zip`);

  const zip = new AdmZip();
  zip.addLocalFolder(src);
  zip.writeZip(zipPath);
  const size = fs.statSync(zipPath).size;

  const db = getDb();
  db.prepare(
    `INSERT INTO save_snapshots (user_id, game_id, label, file_path, size_bytes) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, gameId, label ?? null, zipPath, size);

  // Keep only last N
  const rows = db.prepare(
    `SELECT id, file_path FROM save_snapshots WHERE user_id = ? AND game_id = ? ORDER BY created_at DESC`
  ).all(userId, gameId) as any[];
  for (let i = KEEP_LAST; i < rows.length; i++) {
    try { fs.rmSync(rows[i].file_path, { recursive: true, force: true }); } catch {}
    db.prepare(`DELETE FROM save_snapshots WHERE id = ?`).run(rows[i].id);
  }

  log.info(`Save backup: game ${gameId} → ${zipPath} (${size} bytes)`);
  return { path: zipPath, size };
}

export function listSnapshots(userId: number, gameId: number) {
  return getDb().prepare(
    `SELECT * FROM save_snapshots WHERE user_id = ? AND game_id = ? ORDER BY created_at DESC`
  ).all(userId, gameId);
}

export function restoreSnapshot(userId: number, snapshotId: number) {
  const snap = getDb().prepare(`SELECT * FROM save_snapshots WHERE id = ? AND user_id = ?`).get(snapshotId, userId) as any;
  if (!snap) throw new Error('Snapshot no encontrado');
  if (!fs.existsSync(snap.file_path)) throw new Error('El archivo del snapshot ya no existe');
  const dst = getGameSaveFolder(snap.game_id);
  if (!dst) throw new Error('No hay carpeta destino configurada');

  // Detect legacy unzipped snapshots (pre-ZIP migration): if path is a directory,
  // fall back to recursive copy so old snapshots keep working.
  const isDir = fs.statSync(snap.file_path).isDirectory();

  // Wipe destination first
  try { fs.rmSync(dst, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(dst, { recursive: true });

  if (isDir) {
    copyDirRecursive(snap.file_path, dst);
  } else {
    const zip = new AdmZip(snap.file_path);
    zip.extractAllTo(dst, /* overwrite */ true);
  }
  log.info(`Save restore: snapshot ${snapshotId} → ${dst}`);
  return { success: true };
}

export function deleteSnapshot(userId: number, snapshotId: number) {
  const snap = getDb().prepare(`SELECT * FROM save_snapshots WHERE id = ? AND user_id = ?`).get(snapshotId, userId) as any;
  if (!snap) throw new Error('Snapshot no encontrado');
  try { fs.rmSync(snap.file_path, { recursive: true, force: true }); } catch {}
  getDb().prepare(`DELETE FROM save_snapshots WHERE id = ?`).run(snapshotId);
  return { success: true };
}

// Legacy fallback for restoring pre-ZIP snapshots that were stored as folders.
function copyDirRecursive(src: string, dst: string) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, entry.name);
    const b = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirRecursive(a, b);
    else if (entry.isFile()) fs.copyFileSync(a, b);
  }
}

// ============================== AUTO-BACKUP (file watcher) ==============================

interface ActiveWatch {
  watcher: FSWatcher;
  userId: number;
  gameId: number;
  debounceTimer: NodeJS.Timeout | null;
  lastBackupAt: number;
}

const activeWatches = new Map<string, ActiveWatch>(); // key=`${userId}-${gameId}`

function watchKey(userId: number, gameId: number) {
  return `${userId}-${gameId}`;
}

/**
 * Inicia un watcher sobre la carpeta de saves del juego. Cuando detecta cambios,
 * espera 15s sin cambios nuevos (debounce) y dispara un `backupSave`. Útil para
 * juegos que se cierran y dejan los saves recién escritos en disco.
 */
export function startAutoBackup(userId: number, gameId: number) {
  const key = watchKey(userId, gameId);
  if (activeWatches.has(key)) return { success: true, alreadyWatching: true };
  const src = getGameSaveFolder(gameId);
  if (!src) throw new Error('No hay carpeta de saves configurada');
  if (!fs.existsSync(src)) throw new Error('La carpeta no existe');

  const watcher = chokidar.watch(src, {
    persistent: true,
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../, // dotfiles
    awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 300 }
  });

  const entry: ActiveWatch = { watcher, userId, gameId, debounceTimer: null, lastBackupAt: 0 };

  const triggerBackup = () => {
    if (Date.now() - entry.lastBackupAt < 60_000) return; // throttle: max 1 backup/min
    try {
      backupSave(userId, gameId, 'auto');
      entry.lastBackupAt = Date.now();
      log.info(`[saves] auto-backup game=${gameId} (file watcher)`);
    } catch (e) {
      log.warn(`[saves] auto-backup failed:`, (e as Error).message);
    }
  };

  const scheduleBackup = () => {
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.debounceTimer = setTimeout(triggerBackup, WATCH_DEBOUNCE_MS);
  };

  watcher.on('add', scheduleBackup).on('change', scheduleBackup).on('unlink', scheduleBackup);
  watcher.on('error', (err) => log.warn('[saves] watcher error:', err));

  activeWatches.set(key, entry);
  log.info(`[saves] auto-backup watching ${src}`);
  return { success: true, alreadyWatching: false };
}

export function stopAutoBackup(userId: number, gameId: number) {
  const key = watchKey(userId, gameId);
  const entry = activeWatches.get(key);
  if (!entry) return { success: true, wasWatching: false };
  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  entry.watcher.close();
  activeWatches.delete(key);
  return { success: true, wasWatching: true };
}

export function listActiveWatches(): Array<{ userId: number; gameId: number; lastBackupAt: number }> {
  return Array.from(activeWatches.values()).map((e) => ({
    userId: e.userId,
    gameId: e.gameId,
    lastBackupAt: e.lastBackupAt
  }));
}

export function stopAllWatches() {
  for (const [, entry] of activeWatches) {
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.watcher.close();
  }
  activeWatches.clear();
}
