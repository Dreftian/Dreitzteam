import { shell } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db';
import log from './logger';

/**
 * Steam-style install/launch helper.
 *
 * Strategy:
 *  - For DRM "steam": delegate to Steam via `steam://install/<appid>` or `steam://run/<appid>`
 *  - For DRM "standalone": user picks an .exe path (we store it) and we spawn it directly.
 *  - We track install state per user/game so the UI can show "Install" / "Play" / "Installing".
 */

export function getInstall(userId: number, gameId: number) {
  return getDb().prepare('SELECT * FROM installs WHERE user_id = ? AND game_id = ?').get(userId, gameId);
}

export function listInstalls(userId: number) {
  return getDb().prepare(`
    SELECT i.*, g.title, g.capsule_image, g.header_image, g.steam_app_id, g.drm_platform
    FROM installs i JOIN games g ON g.id = i.game_id
    WHERE i.user_id = ?
    ORDER BY i.last_played_at DESC, i.installed_at DESC
  `).all(userId);
}

export function setInstallStatus(userId: number, gameId: number, status: string, extra: Partial<{ install_path: string; launch_path: string; installed_at: string }> = {}) {
  const db = getDb();
  const existing = getInstall(userId, gameId);
  if (existing) {
    const fields: string[] = ['status = ?'];
    const values: any[] = [status];
    if (extra.install_path !== undefined) { fields.push('install_path = ?'); values.push(extra.install_path); }
    if (extra.launch_path !== undefined) { fields.push('launch_path = ?'); values.push(extra.launch_path); }
    if (extra.installed_at !== undefined) { fields.push('installed_at = ?'); values.push(extra.installed_at); }
    values.push(userId, gameId);
    db.prepare(`UPDATE installs SET ${fields.join(', ')} WHERE user_id = ? AND game_id = ?`).run(...values);
  } else {
    db.prepare(
      `INSERT INTO installs (user_id, game_id, status, install_path, launch_path, installed_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, gameId, status, extra.install_path ?? null, extra.launch_path ?? null, extra.installed_at ?? null);
  }
}

export async function startInstall(userId: number, gameId: number) {
  const db = getDb();
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as any;
  if (!game) throw new Error('Juego no encontrado');
  // Library check
  const owned = db.prepare('SELECT id FROM library WHERE user_id = ? AND game_id = ?').get(userId, gameId);
  if (!owned) throw new Error('Necesitas comprar el juego primero');

  const drm = game.drm_platform || 'steam';
  if (drm === 'steam') {
    setInstallStatus(userId, gameId, 'installing');
    const url = `steam://install/${game.steam_app_id}`;
    log.info('Opening', url);
    shell.openExternal(url);
    return { kind: 'steam', url };
  }
  // Standalone is just marking installed once user provides a path elsewhere
  setInstallStatus(userId, gameId, 'needs_path');
  return { kind: 'standalone' };
}

export function setStandalonePath(userId: number, gameId: number, exePath: string) {
  if (!fs.existsSync(exePath)) throw new Error('La ruta no existe');
  setInstallStatus(userId, gameId, 'installed', {
    install_path: path.dirname(exePath),
    launch_path: exePath,
    installed_at: new Date().toISOString()
  });
  return { success: true };
}

export function markSteamInstalled(userId: number, gameId: number) {
  setInstallStatus(userId, gameId, 'installed', { installed_at: new Date().toISOString() });
  return { success: true };
}

export function uninstall(userId: number, gameId: number) {
  setInstallStatus(userId, gameId, 'not_installed');
  return { success: true };
}

const playSessions = new Map<string, number>(); // key=userId-gameId, value=startTimestamp

export async function launch(userId: number, gameId: number) {
  const db = getDb();
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as any;
  if (!game) throw new Error('Juego no encontrado');
  const inst = getInstall(userId, gameId) as any;

  const drm = game.drm_platform || 'steam';
  if (drm === 'steam') {
    const url = `steam://run/${game.steam_app_id}`;
    log.info('Launching via Steam:', url);
    shell.openExternal(url);
  } else {
    if (!inst?.launch_path || !fs.existsSync(inst.launch_path)) {
      throw new Error('Ruta de ejecutable no configurada o no existe');
    }
    log.info('Launching standalone:', inst.launch_path);
    try {
      const child = spawn(inst.launch_path, [], {
        detached: true,
        stdio: 'ignore',
        cwd: inst.install_path || undefined
      });
      // Capture spawn-time errors emitted async (file got deleted between check and spawn, EACCES, etc.)
      child.on('error', (err) => {
        log.error('Game process error:', err.message);
        try {
          getDb()
            .prepare(`UPDATE installs SET status = 'launch_failed' WHERE user_id = ? AND game_id = ?`)
            .run(userId, gameId);
        } catch {}
      });
      child.unref();
    } catch (err) {
      // Synchronous spawn failure (rare on Windows, common on missing binary on Linux)
      log.error('Failed to spawn game:', (err as Error).message);
      throw new Error(`No se pudo iniciar el juego: ${(err as Error).message}`);
    }
  }
  // Update last played
  db.prepare(`UPDATE installs SET last_played_at = CURRENT_TIMESTAMP WHERE user_id = ? AND game_id = ?`).run(userId, gameId);
  playSessions.set(`${userId}-${gameId}`, Date.now());
  return { success: true };
}

export function recordPlayStop(userId: number, gameId: number) {
  const key = `${userId}-${gameId}`;
  const start = playSessions.get(key);
  if (!start) return { minutes: 0 };
  const minutes = Math.max(1, Math.round((Date.now() - start) / 60_000));
  playSessions.delete(key);
  getDb().prepare(`UPDATE installs SET playtime_minutes = playtime_minutes + ? WHERE user_id = ? AND game_id = ?`)
    .run(minutes, userId, gameId);
  return { minutes };
}

export function openInstallFolder(userId: number, gameId: number) {
  const inst = getInstall(userId, gameId) as any;
  if (!inst?.install_path) throw new Error('Sin carpeta de instalación');
  shell.openPath(inst.install_path);
  return { success: true };
}
