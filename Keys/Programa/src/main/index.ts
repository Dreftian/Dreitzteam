import { app, BrowserWindow, shell, ipcMain, crashReporter, Tray, Menu, nativeImage, Notification, globalShortcut } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { getDb, closeDb } from './db';
import { registerIpcHandlers } from './ipc';
import { initLogger, log } from './logger';
import * as supabase from './supabase';
import { openSettingsWindow, registerSettingsIpc } from './settingsWindow';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const isDev = !!process.env['ELECTRON_RENDERER_URL'];

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

try {
  crashReporter.start({
    productName: 'Dreitz Keys',
    companyName: 'Dreitzteam',
    submitURL: '',
    uploadToServer: false,
    ignoreSystemCrashHandler: true
  });
} catch {}

function ensureAdmin() {
  const db = getDb();
  const r = db.prepare('SELECT id FROM users WHERE username = ?').get('admin') as any;
  if (!r) {
    const hash = bcrypt.hashSync('admin', 10);
    db.prepare(
      `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`
    ).run('admin', 'admin@dreitzteam.local', hash, 'admin');
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

function createTray() {
  try {
    const iconPath = resolveTrayIconPath();
    const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
    tray = new Tray(icon);
    tray.setToolTip('Dreitz Keys · Dreitzteam');
    const menu = Menu.buildFromTemplate([
      { label: 'Abrir Dreitz Keys', click: () => showMain() },
      { type: 'separator' },
      { label: 'Opciones', click: () => openSettingsWindow(mainWindow) },
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

async function createWindow() {
  const iconPath = resolveIconPath();
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 820,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0612',
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    autoHideMenuBar: true,
    title: 'Dreitz Keys',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  // Minimize-to-tray al cerrar (estilo Discord/Steam). El user puede salir
  // de verdad con click derecho tray → Salir, o con Ctrl+Shift+Q.
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      if (!(global as any).__keysTrayHintShown) {
        (global as any).__keysTrayHintShown = true;
        try {
          new Notification({
            title: 'Dreitz Keys sigue ejecutándose',
            body: 'Se minimizó a la bandeja del sistema. Click derecho para salir.',
            silent: true,
            icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined
          }).show();
        } catch {}
      }
    }
  });

  ipcMain.on('window:quit', () => { isQuitting = true; app.quit(); });

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

  // Settings window separada (estilo Steam Settings)
  registerSettingsIpc();

  if (isDev) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  initLogger();
  log.info('Keys app start');
  getDb();
  ensureAdmin();
  registerIpcHandlers();
  try { supabase.tryEnable(); } catch (e) { log.warn('Supabase enable:', e); }
  await createWindow();
  createTray();

  try {
    globalShortcut.register('CommandOrControl+Shift+Q', () => {
      isQuitting = true;
      app.quit();
    });
  } catch (e) { log.warn('globalShortcut Ctrl+Shift+Q:', e); }

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
  closeDb();
});

process.on('uncaughtException', (err) => log.error('uncaughtException:', err));
process.on('unhandledRejection', (r) => log.error('unhandledRejection:', r));
