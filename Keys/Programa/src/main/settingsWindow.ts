/**
 * Settings window — BrowserWindow separada (estilo Steam Settings).
 *
 * El admin abre las opciones en una ventana modal independiente que no bloquea
 * el panel principal. Cargamos el mismo bundle del renderer pero con hash
 * inicial `/settings-window` que App.tsx detecta para mostrar solo ese panel.
 */
import { BrowserWindow, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

let settingsWindow: BrowserWindow | null = null;

export function getSettingsWindow() {
  return settingsWindow;
}

export function openSettingsWindow(parent: BrowserWindow | null) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
    return settingsWindow;
  }

  const iconPath = [
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, 'build', 'icon.ico'),
    path.join(__dirname, '..', '..', 'build', 'icon.ico')
  ].find((p) => fs.existsSync(p));

  settingsWindow = new BrowserWindow({
    width: 1160,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    parent: parent ?? undefined,
    modal: false,
    show: false,
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    title: 'Dreitz Keys · Opciones',
    backgroundColor: '#0a0612',
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    settingsWindow.loadURL(`${devUrl}#/settings-window`);
  } else {
    settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), {
      hash: '/settings-window'
    });
  }

  settingsWindow.once('ready-to-show', () => settingsWindow?.show());
  settingsWindow.on('closed', () => { settingsWindow = null; });

  return settingsWindow;
}

export function registerSettingsIpc() {
  ipcMain.removeHandler('settings:open');
  ipcMain.handle('settings:open', (e) => {
    const parent = BrowserWindow.fromWebContents(e.sender);
    openSettingsWindow(parent);
    return { success: true };
  });
  ipcMain.removeAllListeners('settings:close');
  ipcMain.on('settings:close', () => settingsWindow?.close());
}
