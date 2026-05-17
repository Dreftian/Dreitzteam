import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, nativeTheme, crashReporter, Notification, globalShortcut } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { getDb, closeDb } from './db';
import { seedDatabase, seedAdmin } from './seed';
import { startPriceWatcher, stopPriceWatcher } from './priceWatcher';
import { startLocalApi, stopLocalApi } from './localApi';
import { startPlaytimeTracker, stopPlaytimeTracker } from './playtimeTracker';
import { registerIpcHandlers } from './ipc';
import { initLogger, log } from './logger';
import { splashHtml } from './splash';
import { installGlobalSafeHandle } from './safeIpc';
import { tryEnableSupabaseSync, disableSupabaseSync } from './supabase';
import * as imageCache from './imageCache';
import * as priceSync from './priceSync';
import { initAutoUpdate } from './autoUpdate';
import * as saves from './saves';
import * as backup from './backup';
import * as telemetry from './telemetry';
import * as discord from './discord';
import { initCrashReporter, captureError } from './crashReporter';
import { openSettingsWindow, registerSettingsIpc } from './settingsWindow';
import { getSystemPrefs } from './systemPrefs';

const PROTOCOL = 'dreitz';
const isDev = !!process.env['ELECTRON_RENDERER_URL'];

// MUST run before app.ready: registra el esquema dreitzcache:// como privilegiado
// (cacheable, fetch-able, seguro). Sin esto, registerProtocol() falla en silencio.
imageCache.privilegedSchemeBootstrap();

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// ---------------- Single instance lock ----------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    handleProtocolFromArgv(argv);
  });
}

// ---------------- Protocol handler (dreitz://) ----------------
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

function handleProtocolFromArgv(argv: string[]) {
  const url = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
  if (!url || !mainWindow) return;
  const route = url.replace(`${PROTOCOL}://`, '').replace(/\/$/, '');
  log.info('Protocol opened:', url, '→ route:', route);
  if (route.startsWith('game/')) {
    const id = route.split('/')[1];
    mainWindow.webContents.send('app:command', `nav:/game/${id}`);
  } else if (route === 'library' || route === 'store' || route === 'cart') {
    mainWindow.webContents.send('app:command', `nav:/${route}`);
  }
}
app.on('open-url', (_event, url) => handleProtocolFromArgv([url]));

// ---------------- Crash reporter ----------------
try {
  crashReporter.start({
    productName: 'Dreitz',
    companyName: 'Dreitzteam',
    submitURL: '',
    uploadToServer: false,
    ignoreSystemCrashHandler: true
  });
} catch (e) {
  // Some sandbox configurations refuse crashReporter — fail soft.
}

// ---------------- Splash screen ----------------
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true }
  });

  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml(app.getVersion())));
  splashWindow.once('ready-to-show', () => splashWindow?.show());
}

function destroySplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

function resolveIconPath(fileName = 'icon.ico'): string | null {
  const candidates = [
    path.join(process.resourcesPath, fileName),
    path.join(process.resourcesPath, 'build', fileName),
    path.join(__dirname, '..', '..', 'build', fileName),
    path.join(app.getAppPath(), 'build', fileName)
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function resolveTrayIconPath(): string | null {
  return resolveIconPath('tray.ico') ?? resolveIconPath();
}

// ---------------- Tray ----------------
function createTray() {
  try {
    const iconPath = resolveTrayIconPath();
    const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();

    tray = new Tray(icon);
    tray.setToolTip('Dreitz · Dreitzteam');
    const menu = Menu.buildFromTemplate([
      { label: 'Abrir Dreitz', click: () => showMain() },
      { type: 'separator' },
      { label: 'Tienda', click: () => mainWindow?.webContents.send('app:command', 'nav:/store') },
      { label: 'Biblioteca', click: () => mainWindow?.webContents.send('app:command', 'nav:/library') },
      { label: 'Carrito', click: () => mainWindow?.webContents.send('app:command', 'nav:/cart') },
      { label: 'Ajustes', click: () => openSettingsWindow(mainWindow) },
      { type: 'separator' },
      { label: 'Salir', click: () => { isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => showMain());
  } catch (e) {
    log.warn('Tray could not be created:', e);
  }
}

function showMain() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function shouldStartHiddenToTray() {
  return process.argv.includes('--minimized') || process.argv.includes('--hidden') || getSystemPrefs().startMinimizedToTray;
}

// ---------------- Main window ----------------

/**
 * Windows 11 22H2+ supports Mica (a frosted system-tinted material) directly on
 * BrowserWindow. Below 22H2 we fall back to the solid background color.
 * `os.release()` returns "10.0.<build>" — Mica needs build 22621+ for a stable
 * experience; older builds may render acrylic-ish or just ignore the flag.
 */
function pickWindowsMaterial(): 'mica' | 'acrylic' | 'none' {
  if (process.platform !== 'win32') return 'none';
  const m = /^10\.0\.(\d+)/.exec(os.release());
  const build = m ? parseInt(m[1], 10) : 0;
  if (build >= 22621) return 'mica';      // Win 11 22H2+
  if (build >= 22000) return 'acrylic';   // Win 11 21H2 — acrylic is more reliable here
  return 'none';
}

async function createWindow() {
  const material = pickWindowsMaterial();
  const iconPath = resolveIconPath();
  const startHiddenToTray = shouldStartHiddenToTray();
  log.info('[createWindow] material=' + material + ' isDev=' + isDev);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 1200,
    minHeight: 720,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    // FIX: SIEMPRE usar un backgroundColor opaco (solid dark). El truco de
    // `#00000000` combinado con Electron 33's compositor causa ventanas
    // invisibles tras `ready-to-show` en ciertos drivers/builds de Windows.
    // El material Mica/Acrylic lo aplicamos DESPUÉS de mostrar la ventana, vía
    // `setBackgroundMaterial`. Eso evita la pelea entre transparencia inicial
    // y composición OS.
    backgroundColor: '#0a0e1a',
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    autoHideMenuBar: true,
    title: 'Dreitz',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  } as Electron.BrowserWindowConstructorOptions);

  let shown = false;
  const showOnce = (source: string) => {
    if (shown || !mainWindow) return;
    log.info('[showOnce] triggered by ' + source);
    shown = true;
    if (startHiddenToTray) {
      log.info('[showOnce] start hidden to tray');
      mainWindow.hide();
      destroySplash();
      return;
    }
    try {
      mainWindow.show();
      mainWindow.focus();
      if (material !== 'none' && process.platform === 'win32') {
        try {
          (mainWindow as any).setBackgroundMaterial?.(material);
        } catch (e) {
          log.warn('setBackgroundMaterial failed:', (e as Error).message);
        }
      }
    } catch (e) {
      log.error('show()/focus() error:', e);
    }
    destroySplash();
  };

  // Estrategia de splash: mostrar la ventana SOLO cuando el renderer envía
  // `app:ready` (React montó y AuthContext resolvió). Esto evita ver el
  // background dark vacío durante 1-2s mientras la app se hidrata.
  ipcMain.removeHandler('app:ready');
  ipcMain.handle('app:ready', () => {
    showOnce('app:ready');
    return true;
  });
  // Safety nets: si por algún motivo el renderer nunca envía `app:ready`,
  // mostramos igual la ventana cuando dispare ready-to-show + un grace period.
  mainWindow.on('ready-to-show', () => setTimeout(() => showOnce('ready-to-show-fallback'), 2500));
  mainWindow.webContents.on('did-finish-load', () => setTimeout(() => showOnce('did-finish-load'), 3000));
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    log.error('did-fail-load', code, desc);
    showOnce('did-fail-load');
  });

  // FIX pantalla negra: capturamos los console del renderer en el log de main
  // y los errores no atrapados para diagnosticar crashes sin DevTools en producción.
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const lvl = (['debug', 'info', 'warning', 'error'] as const)[level] ?? 'info';
    if (lvl === 'error' || lvl === 'warning') {
      log.warn(`[renderer:${lvl}] ${message} (${sourceId}:${line})`);
    } else if (process.env.DREITZ_LOG_RENDERER) {
      log.info(`[renderer:${lvl}] ${message}`);
    }
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log.error('[renderer] process gone:', details.reason, details.exitCode);
  });
  mainWindow.webContents.on('preload-error', (_e, preload, error) => {
    log.error('[renderer] preload error in', preload, '→', error);
  });
  // Hard safety net en 4s, después en 8s (por si algo se cuelga muy raro).
  setTimeout(() => {
    if (!shown) {
      log.warn('Force-showing main window after 4s timeout (ready-to-show never fired)');
      showOnce('4s-timeout');
    }
  }, 4000);
  setTimeout(() => {
    if (!shown) {
      log.error('Window STILL not shown after 8s — force show as last resort');
      showOnce('8s-fallback');
    }
  }, 8000);

  // Minimize-to-tray al cerrar (estilo Steam). Es configurable desde
  // Ajustes > Sistema; para salir de verdad: tray -> "Salir" o Ctrl+Shift+Q.
  mainWindow.on('close', (event) => {
    if (!isQuitting && getSystemPrefs().closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
      // Toast una vez por sesión para que el usuario sepa dónde fue la ventana
      if (!(global as any).__trayHintShown) {
        (global as any).__trayHintShown = true;
        try {
          new Notification({
            title: 'Dreitz sigue ejecutándose',
            body: 'Se minimizó a la bandeja del sistema. Click derecho para salir.',
            silent: true,
            icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined
          }).show();
        } catch {}
      }
    }
  });

  // Ctrl+Shift+Q = salir realmente (no a tray)
  ipcMain.on('window:quit', () => { isQuitting = true; app.quit(); });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  ipcMain.removeAllListeners('window:minimize');
  ipcMain.removeAllListeners('window:maximize');
  ipcMain.removeAllListeners('window:close');
  ipcMain.removeHandler('window:isMaximized');

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // Settings window separada (estilo Steam)
  registerSettingsIpc();

  // Expose the system material so the renderer can adjust its body opacity for
  // Mica/Acrylic. Returns 'none' on non-Windows and pre-Win11 builds.
  ipcMain.removeHandler('system:material');
  ipcMain.handle('system:material', () => material);

  try {
    if (isDev) {
      log.info('[createWindow] loading dev URL:', process.env['ELECTRON_RENDERER_URL']);
      await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      const indexPath = path.join(__dirname, '../renderer/index.html');
      log.info('[createWindow] loading file:', indexPath, 'exists=', fs.existsSync(indexPath));
      await mainWindow.loadFile(indexPath);
      log.info('[createWindow] loadFile resolved');
      // DevTools opcional via env var para diagnosticar producción.
      if (process.env.DREITZ_DEVTOOLS) {
        setTimeout(() => mainWindow?.webContents.openDevTools({ mode: 'right' }), 500);
      }
    }
  } catch (e) {
    log.error('loadFile/loadURL failed:', e);
    showOnce('load-error'); // show anyway so user can see what happened instead of stuck splash
  }
  // Belt and suspenders: even after load completes, always make sure we're shown
  setTimeout(() => showOnce('post-load'), 600);

  // Forward native theme changes to renderer
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme:changed', { shouldUseDark: nativeTheme.shouldUseDarkColors });
  });
}

// ---------------- App lifecycle ----------------
app.whenReady().then(async () => {
  initLogger();
  log.info('App start, locale=' + app.getLocale());

  if (!isDev) createSplash();
  // Hard cap so splash can never live longer than 12s no matter what
  setTimeout(() => destroySplash(), 12_000);

  const db = getDb();
  // Pre-seed only essentials synchronously: admin user. Heavy Steam fetching runs after window opens.
  seedAdmin(db);
  // Wrap all subsequent ipcMain.handle calls with rate-limit + timeout. Must be
  // installed before registerIpcHandlers() so every channel gets protection.
  installGlobalSafeHandle();
  registerIpcHandlers();
  await createWindow();
  createTray();
  handleProtocolFromArgv(process.argv);

  // Now seed in the background so window appears immediately
  seedDatabase(db)
    .then(() => {
      log.info('Seed complete');
      mainWindow?.webContents.send('seed:done');
    })
    .catch((e) => log.error('Seed error:', e));

  // CRITICAL inmediatos — necesarios para que la app funcione bien.
  try { imageCache.registerProtocol(); } catch (e) { log.warn('imageCache.registerProtocol:', e); }
  try { startLocalApi(); } catch (e) { log.warn('localApi:', e); }
  try { startPlaytimeTracker(); } catch (e) { log.warn('playtimeTracker:', e); }

  // Ctrl+Shift+Q = salir definitivamente (saltar el minimize-to-tray)
  try {
    globalShortcut.register('CommandOrControl+Shift+Q', () => {
      isQuitting = true;
      app.quit();
    });
  } catch (e) { log.warn('globalShortcut Ctrl+Shift+Q:', e); }

  // DIFERIDOS por 8s — la UI siente la app más fluida si estos no compiten con
  // el primer paint del renderer. InsForge sync, priceWatcher, priceSync,
  // autoUpdate, backup y telemetría arrancan después de que el usuario ya
  // está interactuando con la tienda.
  setTimeout(() => {
    try {
      tryEnableSupabaseSync().catch((e) => log.warn('insforge enable error:', e));
    } catch (e) { log.warn('insforge sync:', e); }
    try { startPriceWatcher(); } catch (e) { log.warn('priceWatcher:', e); }
    try { priceSync.startPriceSync(); } catch (e) { log.warn('priceSync:', e); }
    try { if (mainWindow) initAutoUpdate(mainWindow); } catch (e) { log.warn('autoUpdate init:', e); }
    try {
      backup.iniciarBackupAutomatico(() => {
        const r = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get() as any;
        return r?.id ?? null;
      });
    } catch (e) { log.warn('backup init:', e); }
    try { telemetry.iniciarTelemetria(); } catch (e) { log.warn('telemetry init:', e); }
    // Discord Rich Presence — opcional, falla silenciosamente si Discord no está abierto
    try { discord.connectDiscord(); } catch (e) { log.warn('discord init:', e); }
    // Sentry crash reporter — opt-in vía env SENTRY_DSN
    try { initCrashReporter().catch((e) => log.warn('crashReporter init:', e)); } catch (e) { log.warn('crashReporter:', e); }
  }, 8_000);

  // Hook global de errores no manejados — captura todo lo que se escape.
  process.on('uncaughtException', (err) => captureError(err, { kind: 'uncaughtException' }));
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    captureError(err, { kind: 'unhandledRejection' });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  stopPriceWatcher();
  stopLocalApi();
  stopPlaytimeTracker();
  priceSync.stopPriceSync();
  saves.stopAllWatches();
  backup.detenerBackupAutomatico();
  telemetry.detenerTelemetria();
  discord.disconnectDiscord();
  disableSupabaseSync().catch(() => {});
  closeDb();
});

process.on('uncaughtException', (err) => {
  log.error('uncaughtException:', err);
  telemetry.registrarCrash(err, 'uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection:', reason);
  telemetry.registrarCrash(reason instanceof Error ? reason : new Error(String(reason)), 'unhandledRejection');
});
