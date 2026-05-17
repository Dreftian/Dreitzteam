/**
 * Notificaciones de Windows nativas usando la API `Notification` de Electron.
 *
 * Suscribe a los mismos eventos que el toast in-app: bajada de precio, regalo
 * recibido, flash sale, achievement. Si el usuario tiene `settings.notifications=false`
 * en su perfil, hacemos no-op. Si el SO no soporta notificaciones, también.
 *
 * Las notificaciones son click-throughable: al hacer click llaman a un handler
 * que enfoca la ventana principal y navega al destino apropiado.
 */

import { Notification, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { getDb } from './db';
import log from './logger';

let iconPath: string | null = null;

function resolverIcono(): string {
  if (iconPath) return iconPath;
  const candidatos = [
    path.join(process.resourcesPath, 'build', 'icon.ico'),
    path.join(app.getAppPath(), 'build', 'icon.ico'),
    path.join(__dirname, '..', '..', 'build', 'icon.ico')
  ];
  iconPath = candidatos.find((p) => fs.existsSync(p)) ?? '';
  return iconPath;
}

function notificacionesHabilitadasPara(userId: number | null): boolean {
  if (!Notification.isSupported()) return false;
  if (!userId) return false;
  try {
    const row = getDb().prepare('SELECT notifications FROM user_settings WHERE user_id = ?').get(userId) as any;
    return row?.notifications === 1;
  } catch {
    return true; // si no hay settings aún, default = sí
  }
}

function navegar(ruta: string) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue;
    if (w.isMinimized()) w.restore();
    w.show();
    w.focus();
    w.webContents.send('app:command', `nav:${ruta}`);
    break;
  }
}

interface OpcionesNotif {
  userId: number | null;
  titulo: string;
  cuerpo: string;
  destino?: string; // ruta react-router al hacer click
  silencioso?: boolean;
}

export function notificar(opts: OpcionesNotif) {
  if (!notificacionesHabilitadasPara(opts.userId)) return;
  try {
    const n = new Notification({
      title: opts.titulo,
      body: opts.cuerpo,
      icon: resolverIcono() || undefined,
      silent: !!opts.silencioso
    });
    if (opts.destino) {
      n.on('click', () => navegar(opts.destino!));
    }
    n.show();
  } catch (e) {
    log.warn('[notif] falló:', (e as Error).message);
  }
}

// ============================== HELPERS ESPECÍFICOS ==============================

export function notifBajadaPrecio(userId: number, payload: { title: string; price: number; gameId: number }) {
  notificar({
    userId,
    titulo: '💰 Bajada de precio',
    cuerpo: `${payload.title} está ahora a S/. ${payload.price.toFixed(2)}`,
    destino: `/game/${payload.gameId}`
  });
}

export function notifRegaloRecibido(userId: number, payload: { fromUser: string; title: string; gameId: number }) {
  notificar({
    userId,
    titulo: '🎁 Regalo recibido',
    cuerpo: `${payload.fromUser} te regaló ${payload.title}`,
    destino: `/library`
  });
}

export function notifFlashSale(userId: number, payload: { title: string; discount: number; gameId: number }) {
  notificar({
    userId,
    titulo: `🔥 Flash Sale -${payload.discount}%`,
    cuerpo: `${payload.title} en oferta relámpago`,
    destino: `/game/${payload.gameId}`
  });
}

export function notifLogro(userId: number, payload: { title: string; description: string }) {
  notificar({
    userId,
    titulo: `🏆 ${payload.title}`,
    cuerpo: payload.description,
    destino: `/profile`,
    silencioso: false
  });
}

export function notifJuegoListo(userId: number, payload: { title: string; gameId: number }) {
  notificar({
    userId,
    titulo: '✅ Listo para jugar',
    cuerpo: `${payload.title} terminó de descargarse`,
    destino: `/library`
  });
}
