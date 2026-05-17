/**
 * Adaptador InsForge — Keys (panel admin).
 *
 * Cliente fetch puro contra la REST API de InsForge (PostgREST). No usamos
 * `@insforge/sdk` porque depende de `@insforge/shared-schemas` que solo exporta
 * ESM y Electron lo carga vía `require()` → ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * Keys es la fuente autoritativa del catálogo: cuando el admin agrega un
 * juego, cambia precio, revoca licencias o crea promoción, Keys lo escribe en
 * SQLite local Y en InsForge. Dreitz (cliente) lee por sondeo cada 5 min.
 *
 * Si las credenciales no están configuradas, las funciones de push son no-ops
 * silenciosos — Keys sigue funcionando local-only y el admin puede activar
 * la sincronización desde la pantalla "InsForge" en Ajustes.
 */

import { getDb } from './db';
import { log } from './logger';

const HOST_POR_DEFECTO = 'https://f2i554x7.us-east.insforge.app';
const CLAVE_POR_DEFECTO = '';

interface CredencialesRemotas { url: string; clave: string }

let credenciales: CredencialesRemotas | null = null;

function obtenerCredenciales(): CredencialesRemotas | null {
  const db = getDb();
  const get = (k: string) =>
    (db.prepare('SELECT value FROM app_config WHERE key = ?').get(k) as any)?.value;
  const url = get('insforge.url') || get('supabase.url') || HOST_POR_DEFECTO;
  const clave =
    get('insforge.api_key') ||
    get('supabase.service_role') ||
    get('supabase.anon_key') ||
    CLAVE_POR_DEFECTO;
  if (!url || !clave) return null;
  return { url: url.replace(/\/+$/, ''), clave };
}

export function estaHabilitado(): boolean {
  return credenciales !== null;
}

export function obtenerEstado() {
  const db = getDb();
  const get = (k: string) =>
    (db.prepare('SELECT value FROM app_config WHERE key = ?').get(k) as any)?.value;
  return {
    enabled: credenciales !== null,
    url: get('insforge.url') || get('supabase.url') || '',
    // Mantenemos los nombres "hasAnonKey" / "hasServiceRole" en la respuesta
    // por compatibilidad con la pantalla existente (sigue siendo "InsForge" en UI).
    hasAnonKey: !!get('supabase.anon_key') || !!get('insforge.api_key'),
    hasServiceRole:
      !!get('insforge.api_key') ||
      !!get('supabase.service_role') ||
      !!get('supabase.anon_key')
  };
}

// ============================== CLIENTE REST ==============================

async function llamada(
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  ruta: string,
  opciones: {
    cuerpo?: any;
    prefer?: string;
    parametros?: Record<string, string | number | undefined>;
  } = {}
): Promise<any> {
  if (!credenciales) throw new Error('InsForge no está habilitado');
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opciones.parametros ?? {})) {
    if (v !== undefined) params.set(k, String(v));
  }
  const qs = params.toString();
  const url = `${credenciales.url}${ruta}${qs ? '?' + qs : ''}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${credenciales.clave}`,
    'apikey': credenciales.clave,
    'Content-Type': 'application/json'
  };
  if (opciones.prefer) headers['Prefer'] = opciones.prefer;

  const respuesta = await fetch(url, {
    method: metodo,
    headers,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
  });

  if (respuesta.status === 204) return null;
  const texto = await respuesta.text();
  if (!respuesta.ok) {
    throw new Error(`InsForge ${metodo} ${ruta} → ${respuesta.status}: ${texto.slice(0, 200)}`);
  }
  try { return texto ? JSON.parse(texto) : null; }
  catch { return texto; }
}

// ============================== ARRANQUE ==============================

export function intentarHabilitar(): boolean {
  credenciales = obtenerCredenciales();
  if (!credenciales) {
    log.info('[insforge] sin credenciales; Keys en modo local-only');
    return false;
  }
  log.info('[insforge] Keys conectado a', credenciales.url);
  return true;
}

export function deshabilitar() {
  credenciales = null;
}

/**
 * Setters de credenciales. Cualquiera de las claves se persiste en
 * `app_config` (compartido entre Dreitz y Keys). En InsForge basta con la
 * api_key del proyecto.
 */
export function fijarCredenciales(payload: {
  url?: string;
  anon_key?: string;
  service_role?: string;
  api_key?: string;
}): boolean {
  const db = getDb();
  const fijar = (k: string, v: string | undefined) => {
    if (v === undefined) return;
    if (!v) db.prepare('DELETE FROM app_config WHERE key = ?').run(k);
    else db.prepare(
      `INSERT INTO app_config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
    ).run(k, v);
  };
  if (payload.url) fijar('insforge.url', payload.url);
  const clave = payload.api_key ?? payload.service_role ?? payload.anon_key;
  if (clave) fijar('insforge.api_key', clave);
  // Guardamos las legacy también para debug.
  fijar('supabase.url', payload.url);
  fijar('supabase.anon_key', payload.anon_key);
  fijar('supabase.service_role', payload.service_role);
  return intentarHabilitar();
}

// ============================== HELPERS PUSH ==============================

async function seguro<T>(etiqueta: string, fn: () => Promise<T>): Promise<T | null> {
  if (!credenciales && !intentarHabilitar()) return null;
  try { return await fn(); }
  catch (e) {
    log.warn(`[insforge] ${etiqueta} falló:`, (e as Error).message);
    return null;
  }
}

function serializarJuego(fila: any) {
  const out: any = { ...fila };
  // SQLite usa 0/1 para booleans; InsForge espera booleanos reales.
  for (const k of ['is_featured', 'is_active', 'is_dlc', 'is_demo', 'is_preorder']) {
    if (k in out) out[k] = !!out[k];
  }
  // Columnas jsonb llegan como string desde SQLite — parsearlas.
  for (const k of ['screenshots', 'genres', 'categories']) {
    if (typeof out[k] === 'string') {
      try { out[k] = JSON.parse(out[k]); } catch { out[k] = []; }
    }
  }
  return out;
}

async function upsert(tabla: string, filas: any[], onConflict = 'id') {
  if (!filas.length) return;
  await llamada('POST', `/api/database/records/${tabla}`, {
    parametros: { on_conflict: onConflict },
    prefer: 'resolution=merge-duplicates',
    cuerpo: filas
  });
}

async function borrar(tabla: string, filtros: Record<string, string>) {
  await llamada('DELETE', `/api/database/records/${tabla}`, { parametros: filtros });
}

// ============================== PUSH (Keys → InsForge) ==============================

export async function subirJuego(gameId: number) {
  return seguro('subirJuego', async () => {
    const fila = getDb().prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!fila) return;
    await upsert('games', [serializarJuego(fila)]);
  });
}

export async function borrarJuego(gameId: number) {
  return seguro('borrarJuego', async () => {
    await borrar('games', { id: `eq.${gameId}` });
  });
}

export async function subirLicencias(gameId: number) {
  return seguro('subirLicencias', async () => {
    const filas = getDb().prepare('SELECT * FROM licenses WHERE game_id = ?').all(gameId) as any[];
    if (!filas.length) return;
    await upsert('licenses', filas);
  });
}

export async function actualizarEstadoLicencia(licenseId: number, estado: string) {
  return seguro('actualizarEstadoLicencia', async () => {
    await llamada('PATCH', '/api/database/records/licenses', {
      parametros: { id: `eq.${licenseId}` },
      cuerpo: { status: estado }
    });
  });
}

export async function subirPromocion(promotionId: number) {
  return seguro('subirPromocion', async () => {
    const db = getDb();
    const fila = db.prepare('SELECT * FROM promotions WHERE id = ?').get(promotionId) as any;
    if (!fila) return;
    fila.is_active = !!fila.is_active;
    await upsert('promotions', [fila]);
    const enlaces = db.prepare('SELECT * FROM promotion_games WHERE promotion_id = ?').all(promotionId) as any[];
    await borrar('promotion_games', { promotion_id: `eq.${promotionId}` });
    if (enlaces.length) await llamada('POST', '/api/database/records/promotion_games', { cuerpo: enlaces });
  });
}

export async function subirOfertaFlash(flashId: number) {
  return seguro('subirOfertaFlash', async () => {
    const fila = getDb().prepare('SELECT * FROM flash_sales WHERE id = ?').get(flashId) as any;
    if (!fila) return;
    fila.is_daily_deal = !!fila.is_daily_deal;
    await upsert('flash_sales', [fila]);
  });
}

export async function subirBundle(bundleId: number) {
  return seguro('subirBundle', async () => {
    const db = getDb();
    const fila = db.prepare('SELECT * FROM bundles WHERE id = ?').get(bundleId) as any;
    if (!fila) return;
    fila.is_active = !!fila.is_active;
    await upsert('bundles', [fila]);
    const enlaces = db.prepare('SELECT * FROM bundle_games WHERE bundle_id = ?').all(bundleId) as any[];
    await borrar('bundle_games', { bundle_id: `eq.${bundleId}` });
    if (enlaces.length) await llamada('POST', '/api/database/records/bundle_games', { cuerpo: enlaces });
  });
}

export async function subirColeccion(collectionId: number) {
  return seguro('subirColeccion', async () => {
    const db = getDb();
    const fila = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId) as any;
    if (!fila) return;
    await upsert('collections', [fila]);
    const enlaces = db.prepare('SELECT * FROM collection_games WHERE collection_id = ?').all(collectionId) as any[];
    await borrar('collection_games', { collection_id: `eq.${collectionId}` });
    if (enlaces.length) await llamada('POST', '/api/database/records/collection_games', { cuerpo: enlaces });
  });
}

export async function subirHistorialPrecios(gameId: number) {
  return seguro('subirHistorialPrecios', async () => {
    const filas = getDb()
      .prepare('SELECT * FROM price_history WHERE game_id = ? ORDER BY recorded_at DESC LIMIT 50')
      .all(gameId) as any[];
    if (!filas.length) return;
    await upsert('price_history', filas);
  });
}

/**
 * Push masivo del catálogo entero (botón "Sincronizar todo" en Keys → InsForge).
 * Útil para el primer setup, o cuando se reemplaza el proyecto remoto.
 */
export async function subirCatalogoCompleto() {
  if (!credenciales && !intentarHabilitar()) throw new Error('InsForge no está configurado.');
  const db = getDb();
  const juegos = db.prepare('SELECT id FROM games').all() as any[];
  for (const g of juegos) {
    await subirJuego(g.id);
    await subirLicencias(g.id);
    await subirHistorialPrecios(g.id);
  }
  const promos = db.prepare('SELECT id FROM promotions').all() as any[];
  for (const p of promos) await subirPromocion(p.id);

  const flashes = db.prepare('SELECT id FROM flash_sales').all() as any[];
  for (const f of flashes) await subirOfertaFlash(f.id);

  const bundles = db.prepare('SELECT id FROM bundles').all() as any[];
  for (const b of bundles) await subirBundle(b.id);

  const colecciones = db.prepare('SELECT id FROM collections').all() as any[];
  for (const c of colecciones) await subirColeccion(c.id);

  log.info(`[insforge] catálogo subido: ${juegos.length} juegos, ${promos.length} promos, ${flashes.length} flash`);
  return {
    games: juegos.length,
    promotions: promos.length,
    flash_sales: flashes.length,
    bundles: bundles.length,
    collections: colecciones.length
  };
}
