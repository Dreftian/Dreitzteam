/**
 * Adaptador InsForge — Dreitz (cliente / tienda).
 *
 * Cliente fetch puro contra la REST API de InsForge (PostgREST). No usamos
 * `@insforge/sdk` porque depende de `@insforge/shared-schemas` que solo exporta
 * ESM y Electron lo carga vía `require()` → ERR_PACKAGE_PATH_NOT_EXPORTED.
 * Esto es 10x más liviano y elimina el problema de raíz.
 *
 * Sincronización: Dreitz **lee** el catálogo desde InsForge cada arranque +
 * polling ligero cada 5 min (las escrituras viven en Keys, no acá). Cuando no
 * hay red o el backend no responde, la app sigue funcionando con la copia
 * local en SQLite — InsForge es un espejo opcional.
 *
 * Tablas sincronizadas:
 *   juegos · licencias · historial_precios · bundles · promociones · ofertas_flash · colecciones
 *
 * Tablas locales (NO se sincronizan):
 *   usuarios, carrito, deseados, biblioteca, logros, misiones, stickers,
 *   amigos, vistos, plugins, partidas guardadas
 */

import { getDb } from './db';
import log from './logger';
import { BrowserWindow } from 'electron';

// URL publica del proyecto InsForge. La api_key se guarda en `app_config` desde
// Keys/Ajustes y no se compila dentro del binario.
const HOST_POR_DEFECTO = 'https://f2i554x7.us-east.insforge.app';
const CLAVE_POR_DEFECTO = '';

interface CredencialesRemotas { url: string; clave: string }

let credenciales: CredencialesRemotas | null = null;
let temporizadorSondeo: NodeJS.Timeout | null = null;
let sondeoActivo = false;

function obtenerCredenciales(): CredencialesRemotas | null {
  const db = getDb();
  const get = (k: string) =>
    (db.prepare('SELECT value FROM app_config WHERE key = ?').get(k) as any)?.value;
  const url = get('insforge.url') || get('supabase.url') || HOST_POR_DEFECTO;
  const clave = get('insforge.api_key') || get('supabase.service_role') || get('supabase.anon_key') || CLAVE_POR_DEFECTO;
  if (!url || !clave) return null;
  return { url: url.replace(/\/+$/, ''), clave };
}

export function estaHabilitado(): boolean {
  return credenciales !== null;
}

function difundir(canal: string, payload?: any) {
  for (const ventana of BrowserWindow.getAllWindows()) {
    if (!ventana.isDestroyed()) ventana.webContents.send(canal, payload);
  }
}

// ============================== CLIENTE REST ==============================

/**
 * Llamada genérica a la REST API de InsForge. Centraliza headers, retry suave
 * y manejo de errores. Devuelve la respuesta parseada — JSON cuando aplica,
 * o `null` para 204 No Content.
 */
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

/**
 * Trae filas de una tabla. `parametros` admite filtros PostgREST nativos:
 *   { 'is_active': 'eq.true', 'order': 'id.asc', 'limit': '1000' }
 */
async function traerTabla(tabla: string, parametros: Record<string, string | number | undefined> = {}): Promise<any[]> {
  const data = await llamada('GET', `/api/database/records/${tabla}`, {
    parametros: { limit: 1000, ...parametros }
  });
  return Array.isArray(data) ? data : [];
}

// ============================== ARRANQUE / APAGADO ==============================

export async function intentarHabilitar(): Promise<boolean> {
  // Si ya había temporizador, detenerlo antes de re-habilitar — evita doble sondeo.
  detenerSondeo();

  credenciales = obtenerCredenciales();
  if (!credenciales) {
    log.info('[insforge] sin credenciales; modo local-only');
    return false;
  }

  try {
    // Verificación ligera: pedir 1 fila de games para validar que las credenciales
    // funcionan. Si falla, marcamos como deshabilitado y seguimos local.
    await llamada('GET', '/api/database/records/games', { parametros: { limit: 1 } });
    log.info('[insforge] cliente listo contra', credenciales.url);
    await sincronizarCatalogoCompleto();
    iniciarSondeo();
    difundir('supabase:status', { connected: true }); // canal legacy
    difundir('insforge:status', { connected: true });
    return true;
  } catch (e) {
    log.warn('[insforge] no se pudo conectar:', (e as Error).message);
    credenciales = null;
    return false;
  }
}

export async function deshabilitar() {
  detenerSondeo();
  credenciales = null;
}

function iniciarSondeo() {
  // Polling cada 5 minutos por cambios en el catálogo. Reemplaza al realtime
  // (websocket) que requeriría socket.io y dependencias ESM problemáticas.
  if (temporizadorSondeo) return;
  temporizadorSondeo = setInterval(async () => {
    if (sondeoActivo) return; // evita reentrada si el anterior tarda
    sondeoActivo = true;
    try {
      await sincronizarCatalogoCompleto();
    } catch (e) {
      log.warn('[insforge] sondeo falló:', (e as Error).message);
    } finally {
      sondeoActivo = false;
    }
  }, 5 * 60 * 1000);
}

function detenerSondeo() {
  if (temporizadorSondeo) {
    clearInterval(temporizadorSondeo);
    temporizadorSondeo = null;
  }
  sondeoActivo = false;
}

// ============================== SINCRONIZACIÓN DE CATÁLOGO ==============================

interface EstadisticasSync { tabla: string; descargados: number }

export async function sincronizarCatalogoCompleto(): Promise<EstadisticasSync[]> {
  if (!credenciales) return [];
  const db = getDb();
  const resultados: EstadisticasSync[] = [];

  const tareas: Array<[string, () => Promise<number>]> = [
    ['games',          () => sincronizarJuegos()],
    ['licenses',       () => sincronizarLicencias()],
    ['price_history',  () => sincronizarHistorialPrecios()],
    ['bundles',        () => sincronizarBundles()],
    ['promotions',     () => sincronizarPromociones()],
    ['flash_sales',    () => sincronizarOfertasFlash()],
    ['collections',    () => sincronizarColecciones()]
  ];

  for (const [nombre, fn] of tareas) {
    try {
      const n = await fn();
      resultados.push({ tabla: nombre, descargados: n });
      db.prepare(
        `INSERT INTO sync_state (table_name, last_pulled_at) VALUES (?, ?)
         ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`
      ).run(nombre, new Date().toISOString());
    } catch (e) {
      log.warn(`[insforge] sync ${nombre} falló:`, (e as Error).message);
    }
  }
  log.info('[insforge] catálogo sincronizado', resultados);
  difundir('supabase:catalogChanged');   // canal legacy
  difundir('insforge:catalogChanged');
  return resultados;
}

async function sincronizarJuegos(): Promise<number> {
  const filas = await traerTabla('games', { order: 'id.asc' });
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO games (
      id, steam_app_id, title, short_description, detailed_description,
      developer, publisher, release_date, release_at,
      header_image, capsule_image, background_image,
      screenshots, trailer_url, genres, categories, languages,
      pc_requirements_min, pc_requirements_rec,
      price_initial, price_final, discount_percent, discount_ends_at, currency,
      stock, is_featured, is_active, is_dlc, is_demo, is_preorder, parent_game_id,
      drm_platform, steam_review_score, steam_review_count, steam_recent_score, metacritic_score
    ) VALUES (
      @id, @steam_app_id, @title, @short_description, @detailed_description,
      @developer, @publisher, @release_date, @release_at,
      @header_image, @capsule_image, @background_image,
      @screenshots, @trailer_url, @genres, @categories, @languages,
      @pc_requirements_min, @pc_requirements_rec,
      @price_initial, @price_final, @discount_percent, @discount_ends_at, @currency,
      @stock, @is_featured, @is_active, @is_dlc, @is_demo, @is_preorder, @parent_game_id,
      @drm_platform, @steam_review_score, @steam_review_count, @steam_recent_score, @metacritic_score
    )
    ON CONFLICT(id) DO UPDATE SET
      steam_app_id = excluded.steam_app_id,
      title = excluded.title,
      short_description = excluded.short_description,
      detailed_description = excluded.detailed_description,
      developer = excluded.developer,
      publisher = excluded.publisher,
      release_date = excluded.release_date,
      release_at = excluded.release_at,
      header_image = excluded.header_image,
      capsule_image = excluded.capsule_image,
      background_image = excluded.background_image,
      screenshots = excluded.screenshots,
      trailer_url = excluded.trailer_url,
      genres = excluded.genres,
      categories = excluded.categories,
      languages = excluded.languages,
      pc_requirements_min = excluded.pc_requirements_min,
      pc_requirements_rec = excluded.pc_requirements_rec,
      price_initial = excluded.price_initial,
      price_final = excluded.price_final,
      discount_percent = excluded.discount_percent,
      discount_ends_at = excluded.discount_ends_at,
      currency = excluded.currency,
      stock = excluded.stock,
      is_featured = excluded.is_featured,
      is_active = excluded.is_active,
      is_dlc = excluded.is_dlc,
      is_demo = excluded.is_demo,
      is_preorder = excluded.is_preorder,
      parent_game_id = excluded.parent_game_id,
      drm_platform = excluded.drm_platform,
      steam_review_score = excluded.steam_review_score,
      steam_review_count = excluded.steam_review_count,
      steam_recent_score = excluded.steam_recent_score,
      metacritic_score = excluded.metacritic_score
  `);
  const tx = db.transaction((items: any[]) => {
    for (const r of items) {
      upsert.run({
        ...r,
        screenshots: r.screenshots ? JSON.stringify(r.screenshots) : null,
        genres: r.genres ? JSON.stringify(r.genres) : null,
        categories: r.categories ? JSON.stringify(r.categories) : null,
        is_featured: r.is_featured ? 1 : 0,
        is_active: r.is_active ? 1 : 0,
        is_dlc: r.is_dlc ? 1 : 0,
        is_demo: r.is_demo ? 1 : 0,
        is_preorder: r.is_preorder ? 1 : 0
      });
    }
  });
  tx(filas);
  return filas.length;
}

async function sincronizarLicencias(): Promise<number> {
  const filas = await traerTabla('licenses');
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO licenses (id, game_id, code, status, sold_to, sold_at, redeemed_at)
    VALUES (@id, @game_id, @code, @status, @sold_to, @sold_at, @redeemed_at)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      sold_to = excluded.sold_to,
      sold_at = excluded.sold_at,
      redeemed_at = excluded.redeemed_at
  `);
  const tx = db.transaction((items: any[]) => { for (const r of items) upsert.run(r); });
  tx(filas);
  return filas.length;
}

async function sincronizarHistorialPrecios(): Promise<number> {
  const filas = await traerTabla('price_history', { order: 'recorded_at.desc', limit: 5000 });
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO price_history (id, game_id, price, discount_percent, recorded_at)
    VALUES (@id, @game_id, @price, @discount_percent, @recorded_at)
    ON CONFLICT(id) DO NOTHING
  `);
  const tx = db.transaction((items: any[]) => { for (const r of items) upsert.run(r); });
  tx(filas);
  return filas.length;
}

async function sincronizarBundles(): Promise<number> {
  const [b, bg] = await Promise.all([traerTabla('bundles'), traerTabla('bundle_games')]);
  const db = getDb();
  const insBundle = db.prepare(`
    INSERT INTO bundles (id, title, description, hero_image, discount_percent, starts_at, ends_at, is_active)
    VALUES (@id, @title, @description, @hero_image, @discount_percent, @starts_at, @ends_at, @is_active)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, description = excluded.description, hero_image = excluded.hero_image,
      discount_percent = excluded.discount_percent, starts_at = excluded.starts_at,
      ends_at = excluded.ends_at, is_active = excluded.is_active
  `);
  const insLink = db.prepare(`INSERT OR IGNORE INTO bundle_games (bundle_id, game_id) VALUES (?, ?)`);
  const tx = db.transaction(() => {
    for (const r of b) insBundle.run({ ...r, is_active: r.is_active ? 1 : 0 });
    for (const r of bg) insLink.run(r.bundle_id, r.game_id);
  });
  tx();
  return b.length + bg.length;
}

async function sincronizarPromociones(): Promise<number> {
  const [p, pg] = await Promise.all([traerTabla('promotions'), traerTabla('promotion_games')]);
  const db = getDb();
  const insPromo = db.prepare(`
    INSERT INTO promotions (id, title, subtitle, hero_image, accent_color, cta_text, cta_target, starts_at, ends_at, priority, is_active)
    VALUES (@id, @title, @subtitle, @hero_image, @accent_color, @cta_text, @cta_target, @starts_at, @ends_at, @priority, @is_active)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, subtitle = excluded.subtitle, hero_image = excluded.hero_image,
      accent_color = excluded.accent_color, cta_text = excluded.cta_text, cta_target = excluded.cta_target,
      starts_at = excluded.starts_at, ends_at = excluded.ends_at, priority = excluded.priority,
      is_active = excluded.is_active
  `);
  const insLink = db.prepare(`INSERT OR IGNORE INTO promotion_games (promotion_id, game_id) VALUES (?, ?)`);
  const tx = db.transaction(() => {
    for (const r of p) insPromo.run({ ...r, is_active: r.is_active ? 1 : 0 });
    for (const r of pg) insLink.run(r.promotion_id, r.game_id);
  });
  tx();
  return p.length + pg.length;
}

async function sincronizarOfertasFlash(): Promise<number> {
  const filas = await traerTabla('flash_sales');
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO flash_sales (id, game_id, discount_percent, max_units, starts_at, ends_at, is_daily_deal)
    VALUES (@id, @game_id, @discount_percent, @max_units, @starts_at, @ends_at, @is_daily_deal)
    ON CONFLICT(id) DO UPDATE SET
      discount_percent = excluded.discount_percent, max_units = excluded.max_units,
      starts_at = excluded.starts_at, ends_at = excluded.ends_at,
      is_daily_deal = excluded.is_daily_deal
  `);
  const tx = db.transaction((items: any[]) => {
    for (const r of items) upsert.run({ ...r, is_daily_deal: r.is_daily_deal ? 1 : 0 });
  });
  tx(filas);
  return filas.length;
}

async function sincronizarColecciones(): Promise<number> {
  const [c, cg] = await Promise.all([traerTabla('collections'), traerTabla('collection_games')]);
  const db = getDb();
  const insCol = db.prepare(`
    INSERT INTO collections (id, slug, title, description, curator_name, hero_image)
    VALUES (@id, @slug, @title, @description, @curator_name, @hero_image)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug, title = excluded.title, description = excluded.description,
      curator_name = excluded.curator_name, hero_image = excluded.hero_image
  `);
  const insLink = db.prepare(`INSERT OR IGNORE INTO collection_games (collection_id, game_id, ord) VALUES (?, ?, ?)`);
  const tx = db.transaction(() => {
    for (const r of c) insCol.run(r);
    for (const r of cg) insLink.run(r.collection_id, r.game_id, r.ord ?? 0);
  });
  tx();
  return c.length + cg.length;
}

// ============================== PUSH DE PEDIDOS (Dreitz → InsForge) ==============================

/**
 * Sube el pedido recién creado a InsForge para que Keys lo vea en su dashboard
 * cross-PC. No bloquea el flujo de checkout si falla — el pedido ya está
 * commiteado localmente.
 */
export async function subirPedido(pedido: {
  user_local_id: number;
  user_username: string;
  total: number;
  card_last4: string;
  card_brand: string;
  payment_provider: string;
  external_id: string;
  points_earned: number;
  points_used: number;
  promo_code: string | null;
  items: Array<{ game_id: number; license_id: number | null; price: number; title_snapshot: string }>;
}): Promise<number | null> {
  if (!credenciales) return null;
  try {
    const respuesta = await llamada('POST', '/api/database/records/orders', {
      prefer: 'return=representation',
      cuerpo: [{
        user_local_id: pedido.user_local_id,
        user_username: pedido.user_username,
        total: pedido.total,
        card_last4: pedido.card_last4,
        card_brand: pedido.card_brand,
        payment_provider: pedido.payment_provider,
        external_id: pedido.external_id,
        points_earned: pedido.points_earned,
        points_used: pedido.points_used,
        promo_code: pedido.promo_code,
        status: 'paid'
      }]
    });
    const creado = Array.isArray(respuesta) ? respuesta[0] : respuesta;
    if (!creado?.id) return null;
    const items = pedido.items.map((i) => ({ ...i, order_id: creado.id }));
    if (items.length) {
      await llamada('POST', '/api/database/records/order_items', { cuerpo: items });
    }
    return creado.id as number;
  } catch (e) {
    log.warn('[insforge] subirPedido falló:', (e as Error).message);
    return null;
  }
}
