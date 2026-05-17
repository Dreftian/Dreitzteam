/**
 * Detects Steam installation, parses libraryfolders.vdf to find all Steam libraries,
 * then walks each library's `steamapps/appmanifest_*.acf` files to list installed games.
 *
 * Result is cached in `steam_detected` table for fast reads from renderer.
 *
 * VDF parser is hand-rolled (we only need top-level paths and appid/name from ACFs).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { getDb } from './db';
import log from './logger';

export interface DetectedGame {
  steam_app_id: number;
  title: string;
  install_dir: string;
  size_bytes: number;
}

function readRegistryValue(keyPath: string, valueName: string): string | null {
  try {
    const out = execSync(`reg query "${keyPath}" /v "${valueName}"`, { encoding: 'utf8' });
    const m = out.match(/REG_SZ\s+(.+)/);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

export function getSteamPath(): string | null {
  if (process.platform !== 'win32') {
    // Linux/macOS conventions
    if (process.platform === 'linux') {
      const candidates = [
        path.join(os.homedir(), '.local/share/Steam'),
        path.join(os.homedir(), '.steam/steam')
      ];
      return candidates.find((p) => fs.existsSync(p)) ?? null;
    }
    if (process.platform === 'darwin') {
      const p = path.join(os.homedir(), 'Library/Application Support/Steam');
      return fs.existsSync(p) ? p : null;
    }
    return null;
  }

  const fromReg = readRegistryValue('HKEY_CURRENT_USER\\Software\\Valve\\Steam', 'SteamPath')
    ?? readRegistryValue('HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath')
    ?? readRegistryValue('HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam', 'InstallPath');
  if (fromReg && fs.existsSync(fromReg)) return fromReg;

  for (const p of [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'E:\\Steam'
  ]) if (fs.existsSync(p)) return p;
  return null;
}

function readKeyValueBlock(text: string): Record<string, string> {
  // Very small VDF parser — extracts "key" "value" lines.
  const out: Record<string, string> = {};
  const re = /"([^"]+)"\s+"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out[m[1]] = m[2];
  return out;
}

export function listSteamLibraryPaths(): string[] {
  const steamPath = getSteamPath();
  if (!steamPath) return [];
  const vdf = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
  if (!fs.existsSync(vdf)) return [path.join(steamPath, 'steamapps')];
  try {
    const text = fs.readFileSync(vdf, 'utf8');
    const paths = new Set<string>([path.join(steamPath, 'steamapps')]);
    // Modern libraryfolders.vdf has "path" "C:\\..." entries
    const re = /"path"\s+"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const p = path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps');
      if (fs.existsSync(p)) paths.add(p);
    }
    return [...paths];
  } catch (e) {
    log.warn('libraryfolders.vdf parse failed:', e);
    return [path.join(steamPath, 'steamapps')];
  }
}

export function scanInstalledSteamGames(): DetectedGame[] {
  const out: DetectedGame[] = [];
  for (const libPath of listSteamLibraryPaths()) {
    let entries: string[] = [];
    try { entries = fs.readdirSync(libPath); } catch { continue; }
    for (const f of entries) {
      if (!f.startsWith('appmanifest_') || !f.endsWith('.acf')) continue;
      const acfPath = path.join(libPath, f);
      try {
        const text = fs.readFileSync(acfPath, 'utf8');
        const kv = readKeyValueBlock(text);
        const appid = parseInt(kv.appid, 10);
        if (!appid || !kv.name) continue;
        out.push({
          steam_app_id: appid,
          title: kv.name,
          install_dir: kv.installdir ? path.join(libPath, 'common', kv.installdir) : '',
          size_bytes: parseInt(kv.SizeOnDisk, 10) || 0
        });
      } catch { /* ignore broken acf */ }
    }
  }
  return out;
}

export function refreshSteamCache(): { count: number; library_paths: string[]; steam_path: string | null } {
  const games = scanInstalledSteamGames();
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM steam_detected').run();
    const ins = db.prepare(
      `INSERT INTO steam_detected (steam_app_id, title, install_dir, size_bytes) VALUES (?, ?, ?, ?)`
    );
    for (const g of games) ins.run(g.steam_app_id, g.title, g.install_dir, g.size_bytes);
  });
  tx();

  // For every detected game that exists in our games table, mark the install row for any user that owns it
  for (const g of games) {
    const owned = db.prepare(`
      SELECT lib.user_id, g.id as game_id FROM library lib
      JOIN games g ON g.id = lib.game_id
      WHERE g.steam_app_id = ?
    `).all(g.steam_app_id) as any[];
    for (const o of owned) {
      db.prepare(`
        INSERT INTO installs (user_id, game_id, status, install_path, installed_at)
        VALUES (?, ?, 'installed', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, game_id) DO UPDATE SET status='installed', install_path=excluded.install_path, installed_at=COALESCE(installs.installed_at, CURRENT_TIMESTAMP)
      `).run(o.user_id, o.game_id, g.install_dir);
    }
  }

  return {
    count: games.length,
    library_paths: listSteamLibraryPaths(),
    steam_path: getSteamPath()
  };
}

export function listDetectedFromCache() {
  return getDb().prepare('SELECT * FROM steam_detected ORDER BY title').all();
}

/**
 * Devuelve `true` si el usuario tiene instalado en Steam el juego con ese
 * `steam_app_id`. Lo usamos en GameDetail para mostrar el badge
 * "Ya lo tienes en Steam — ¿lanzar desde Dreitz?".
 */
export function isOwnedOnSteam(steamAppId: number | null | undefined): { owned: boolean; install_dir?: string; title?: string } {
  if (!steamAppId) return { owned: false };
  const row = getDb()
    .prepare('SELECT title, install_dir FROM steam_detected WHERE steam_app_id = ?')
    .get(steamAppId) as { title?: string; install_dir?: string } | undefined;
  if (!row) return { owned: false };
  return { owned: true, install_dir: row.install_dir, title: row.title };
}

/**
 * Lanza el juego instalado en Steam usando el URI `steam://rungameid/<appid>`.
 * Esto abre Steam (si no está abierto) y lanza el juego — exactamente como si
 * el usuario hubiera hecho doble-click desde su biblioteca.
 */
export function launchSteamGame(steamAppId: number): { ok: boolean; error?: string } {
  if (!steamAppId) return { ok: false, error: 'steam_app_id requerido' };
  try {
    const url = `steam://rungameid/${steamAppId}`;
    // shell.openExternal expone esta URL al SO; en Windows Steam captura el protocolo.
    require('electron').shell.openExternal(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
