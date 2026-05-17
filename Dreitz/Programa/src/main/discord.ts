/**
 * Discord Rich Presence — muestra qué está haciendo el usuario en Dreitz
 * (jugando X, navegando la tienda, en biblioteca) en su perfil de Discord.
 *
 * Implementación: usa el protocolo IPC de Discord vía `discord-rpc` o un
 * cliente RPC mínimo. Como no queremos sumar dependencias pesadas, hacemos
 * la conexión manual al socket de Discord (`\\?\pipe\discord-ipc-0` en
 * Windows) y mandamos el handshake. Si Discord no está corriendo, no-op.
 *
 * Reservado: app_id de Dreitz en Discord Dev Portal. Crear uno en
 * https://discord.com/developers/applications con el icono del dragón.
 */

import net from 'node:net';
import log from './logger';

const DISCORD_APP_ID = '1234567890123456789'; // placeholder — registrar en Discord Dev
const PIPE_PATHS = [
  '\\\\?\\pipe\\discord-ipc-0',
  '\\\\?\\pipe\\discord-ipc-1',
  '\\\\?\\pipe\\discord-ipc-2'
];

let socket: net.Socket | null = null;
let nonce = 0;

interface Activity {
  details?: string;   // "Jugando Cyberpunk 2077"
  state?: string;     // "Acto 2: Phantom Liberty"
  large_image?: string;
  large_text?: string;
  small_image?: string;
  small_text?: string;
  start_timestamp?: number;
}

function frame(opCode: number, payload: any): Buffer {
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.alloc(8);
  header.writeUInt32LE(opCode, 0);
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, data]);
}

function connectToPipe(): Promise<net.Socket | null> {
  return new Promise((resolve) => {
    let attempt = 0;
    const tryNext = () => {
      if (attempt >= PIPE_PATHS.length) return resolve(null);
      const path = PIPE_PATHS[attempt++];
      const s = net.createConnection(path);
      s.once('error', () => { s.destroy(); tryNext(); });
      s.once('connect', () => resolve(s));
    };
    tryNext();
  });
}

export async function connectDiscord() {
  if (socket) return;
  if (process.platform !== 'win32') return; // primera versión solo Windows
  const s = await connectToPipe();
  if (!s) return; // Discord no está abierto
  socket = s;
  s.write(frame(0, { v: 1, client_id: DISCORD_APP_ID }));
  s.on('close', () => { socket = null; });
  s.on('error', () => { socket = null; });
  log.info('[discord] RPC conectado');
}

export function setDiscordActivity(activity: Activity | null) {
  if (!socket) return;
  try {
    if (!activity) {
      socket.write(frame(1, {
        cmd: 'SET_ACTIVITY',
        args: { pid: process.pid, activity: null },
        nonce: String(++nonce)
      }));
      return;
    }
    socket.write(frame(1, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity },
      nonce: String(++nonce)
    }));
  } catch (e) {
    log.warn('[discord] activity falló:', (e as Error).message);
    socket = null;
  }
}

export function disconnectDiscord() {
  if (socket) {
    try { socket.end(); } catch {}
    socket = null;
  }
}
