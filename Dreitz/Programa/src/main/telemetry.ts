/**
 * Telemetría OPT-IN.
 *
 * Por defecto, NO se envía nada. Solo cuando el usuario marca
 * "Ayudar a mejorar Dreitz" en Ajustes activamos esto. Lo que recolectamos:
 *  - app:start → versión, OS build, locale, tiempo de boot
 *  - crash    → mensaje + stack (anonimizado: paths reemplazados con %APPDATA%)
 *  - perf:slow → cuando un IPC tarda > 3s, qué canal y cuánto
 *
 * NO recolectamos: usernames, emails, IDs de usuario, IPs, contenido de búsquedas.
 *
 * Backend: InsForge `telemetry` table (creada below). Una fila por evento.
 * Sondeo cada 5 min para enviar batch acumulado.
 */

import { app } from 'electron';
import os from 'node:os';
import { getDb } from './db';
import log from './logger';

const HOST_POR_DEFECTO = 'https://f2i554x7.us-east.insforge.app';
const CLAVE_POR_DEFECTO = '';
const SESSION_ID = Math.random().toString(36).slice(2, 14); // efímero, no persiste

interface Evento {
  tipo: string;
  detalle: Record<string, unknown>;
  ts: string;
}

let cola: Evento[] = [];
let timer: NodeJS.Timeout | null = null;

function habilitado(): boolean {
  try {
    const row = getDb().prepare('SELECT value FROM app_config WHERE key = ?').get('telemetry.enabled') as any;
    return row?.value === '1';
  } catch { return false; }
}

function obtenerCreds() {
  const db = getDb();
  const get = (k: string) => (db.prepare('SELECT value FROM app_config WHERE key = ?').get(k) as any)?.value;
  const creds = {
    url: get('insforge.url') || HOST_POR_DEFECTO,
    clave: get('insforge.api_key') || CLAVE_POR_DEFECTO
  };
  if (!creds.url || !creds.clave) return null;
  return creds;
}

function anonimizar(stack: string): string {
  return stack
    .replace(/[A-Z]:\\Users\\[^\\]+/gi, '%APPDATA%')
    .replace(/\/Users\/[^\/]+/gi, '~')
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*/g, '<timestamp>');
}

export function registrarEvento(tipo: string, detalle: Record<string, unknown> = {}) {
  if (!habilitado()) return;
  cola.push({ tipo, detalle, ts: new Date().toISOString() });
  if (cola.length > 200) cola = cola.slice(-150); // cap memoria
}

export function registrarCrash(err: Error, contexto?: string) {
  registrarEvento('crash', {
    contexto: contexto ?? 'unknown',
    mensaje: err.message,
    stack: anonimizar(err.stack ?? '')
  });
}

export function registrarSlowIpc(canal: string, ms: number) {
  if (ms < 3000) return;
  registrarEvento('perf:slow', { canal, ms });
}

async function drenar() {
  if (!habilitado() || cola.length === 0) return;
  const batch = cola.splice(0, cola.length);
  const creds = obtenerCreds();
  if (!creds) {
    cola.unshift(...batch);
    return;
  }
  const { url, clave } = creds;
  try {
    await fetch(`${url}/api/database/records/telemetry`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clave}`,
        'apikey': clave,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(batch.map((e) => ({
        session_id: SESSION_ID,
        tipo: e.tipo,
        detalle: e.detalle,
        platform: process.platform,
        version: app.getVersion(),
        recorded_at: e.ts
      })))
    });
  } catch (e) {
    // Si falla la red, devolvemos los eventos a la cola y reintentamos.
    cola.unshift(...batch);
    log.warn('[telemetry] flush falló:', (e as Error).message);
  }
}

export function iniciarTelemetria() {
  registrarEvento('app:start', {
    platform: process.platform,
    os_release: os.release(),
    locale: app.getLocale(),
    arch: process.arch
  });
  if (timer) return;
  timer = setInterval(drenar, 5 * 60 * 1000);
}

export function detenerTelemetria() {
  if (timer) clearInterval(timer);
  timer = null;
  // Flush final antes de morir
  drenar().catch(() => {});
}

export function setHabilitado(enabled: boolean) {
  const db = getDb();
  db.prepare(
    `INSERT INTO app_config (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
  ).run('telemetry.enabled', enabled ? '1' : '0');
  if (!enabled) cola = []; // limpiar lo que estaba acumulado
}

export function estaHabilitado(): boolean {
  return habilitado();
}
