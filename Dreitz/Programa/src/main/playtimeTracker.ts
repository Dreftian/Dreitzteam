/**
 * Background tracker that polls running processes (Windows: `tasklist`) and credits
 * play time to any install row whose `launch_path` exe is currently running.
 *
 * Tick = every 30s. Resolution is ~30s; close enough for casual stats.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { getDb } from './db';
import log from './logger';

let timer: NodeJS.Timeout | null = null;
const lastSeen = new Map<string, number>(); // exeName.lower → timestamp

const TICK_MS = 30_000;

function listRunningExecutables(): Set<string> {
  const out = new Set<string>();
  try {
    if (process.platform === 'win32') {
      const buf = execSync('tasklist /FO CSV /NH', { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      for (const line of buf.split('\n')) {
        const m = line.match(/^"([^"]+\.exe)"/i);
        if (m) out.add(m[1].toLowerCase());
      }
    } else {
      // macOS + Linux: `ps -A -o comm=` prints the executable name per row
      const buf = execSync('ps -A -o comm=', { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      for (const line of buf.split('\n')) {
        const name = line.trim();
        if (!name) continue;
        // Take the basename so paths like /Applications/Foo.app/Contents/MacOS/Foo become "foo"
        const base = name.split(/[\\/]/).pop()!.toLowerCase();
        if (base) out.add(base);
      }
    }
  } catch (e) {
    log.warn('listRunningExecutables failed:', (e as Error).message);
  }
  return out;
}

function exeKey(launchPath: string): string {
  const base = path.basename(launchPath).toLowerCase();
  // On Windows we keep ".exe" — `tasklist` includes the extension. On unix we strip it.
  return process.platform === 'win32' ? base : base.replace(/\.(exe|app)$/i, '');
}

export function startPlaytimeTracker() {
  if (timer) return;
  setTimeout(tick, 8_000); // first run after 8s
  timer = setInterval(tick, TICK_MS);
}

export function stopPlaytimeTracker() {
  if (timer) clearInterval(timer);
  timer = null;
}

function tick() {
  try {
    const db = getDb();
    const installs = db.prepare(`
      SELECT i.*, g.title FROM installs i JOIN games g ON g.id = i.game_id
      WHERE i.status = 'installed' AND i.launch_path IS NOT NULL AND i.launch_path != ''
    `).all() as any[];
    if (!installs.length) return;

    const running = listRunningExecutables();
    const now = Date.now();

    for (const inst of installs) {
      const exe = exeKey(inst.launch_path);
      if (!running.has(exe)) continue;
      const key = `${inst.user_id}-${inst.game_id}`;
      const prev = lastSeen.get(key);
      lastSeen.set(key, now);
      if (prev) {
        // Elapsed since last tick — at most TICK_MS+5s, otherwise it just resumed
        const elapsedMs = Math.min(now - prev, TICK_MS + 5_000);
        const minutes = Math.round(elapsedMs / 60_000);
        if (minutes > 0) {
          db.prepare(
            `UPDATE installs SET playtime_minutes = playtime_minutes + ?, last_played_at = CURRENT_TIMESTAMP
             WHERE user_id = ? AND game_id = ?`
          ).run(minutes, inst.user_id, inst.game_id);
        }
      } else {
        db.prepare(`UPDATE installs SET last_played_at = CURRENT_TIMESTAMP WHERE user_id = ? AND game_id = ?`)
          .run(inst.user_id, inst.game_id);
      }
    }

    // Clean up stale entries (game closed)
    for (const [key, ts] of lastSeen) {
      if (now - ts > TICK_MS * 2.5) lastSeen.delete(key);
    }
  } catch (e) {
    log.warn('playtime tick failed:', e);
  }
}
