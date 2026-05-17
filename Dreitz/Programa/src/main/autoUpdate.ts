/**
 * Auto-update con `electron-updater`.
 *
 * Política:
 *   - Al arrancar (15s después de createWindow), revisa GitHub Releases.
 *   - Si hay versión nueva, descarga en background.
 *   - Cuando termina, muestra notificación al renderer; el usuario decide cuándo reiniciar.
 *   - Si el repo `publish` está vacío en electron-builder.yml, autoUpdater no hace nada
 *     (no falla, sólo loguea).
 *
 * Para que esto funcione end-to-end necesitas:
 *   1. Crear un repo en GitHub (público o privado con token).
 *   2. En `electron-builder.yml` setear:
 *        publish:
 *          provider: github
 *          owner: Dreftian
 *          repo: Dreitzteam
 *   3. Después de cada `npm run build:win`, subir el .exe + latest.yml a un Release.
 *   4. Los usuarios que ya tengan Dreitz instalado recibirán el update automáticamente.
 */

import { app, BrowserWindow } from 'electron';
import pkg from 'electron-updater';
import log from './logger';

const { autoUpdater } = pkg;

let mainWin: BrowserWindow | null = null;

function broadcast(channel: string, payload?: any) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, payload);
}

export function initAutoUpdate(win: BrowserWindow) {
  mainWin = win;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (msg: any) => log.info('[updater]', msg),
    warn: (msg: any) => log.warn('[updater]', msg),
    error: (msg: any) => log.error('[updater]', msg),
    debug: () => {}
  } as any;

  autoUpdater.on('checking-for-update', () => broadcast('updater:checking'));
  autoUpdater.on('update-available', (info) => {
    log.info('[updater] update available:', info.version);
    broadcast('updater:available', { version: info.version, releaseDate: info.releaseDate });
  });
  autoUpdater.on('update-not-available', () => broadcast('updater:upToDate'));
  autoUpdater.on('download-progress', (p) => {
    broadcast('updater:progress', { percent: Math.round(p.percent), bytesPerSecond: p.bytesPerSecond });
  });
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[updater] downloaded:', info.version);
    broadcast('updater:downloaded', { version: info.version });
  });
  autoUpdater.on('error', (err) => {
    log.warn('[updater] error:', err.message);
    broadcast('updater:error', { message: err.message });
  });

  // Empezar a buscar updates 15s después de mostrar la ventana — no bloquea el arranque.
  setTimeout(() => {
    if (!app.isPackaged) {
      log.info('[updater] skipping in dev mode');
      return;
    }
    autoUpdater.checkForUpdatesAndNotify().catch((e) => log.warn('[updater] check failed:', e.message));
  }, 15_000);
}

export async function checkNow() {
  if (!app.isPackaged) return { skipped: 'dev mode' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, version: result?.updateInfo?.version ?? null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function installAndRestart() {
  autoUpdater.quitAndInstall();
}
