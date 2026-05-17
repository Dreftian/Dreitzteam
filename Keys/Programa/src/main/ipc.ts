import { ipcMain, dialog } from 'electron';
import * as storage from './storage';
import bcrypt from 'bcryptjs';
import { getDb } from './db';
import { fetchSteamGame } from './steam';
import { generateKey } from './keygen';
import { log } from './logger';
import * as supabase from './supabase';
import * as twofa from './twofa';

function parseGame(row: any) {
  if (!row) return null;
  return {
    ...row,
    screenshots: row.screenshots ? JSON.parse(row.screenshots) : [],
    genres: row.genres ? JSON.parse(row.genres) : [],
    categories: row.categories ? JSON.parse(row.categories) : [],
    is_featured: !!row.is_featured,
    is_active: !!row.is_active,
    is_dlc: !!row.is_dlc,
    is_demo: !!row.is_demo,
    is_preorder: !!row.is_preorder
  };
}

function parseUser(row: any) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return { ...rest, is_pro: !!row.is_pro };
}

function logAction(adminId: number, action: string, targetType?: string, targetId?: number | null, detail?: string) {
  try {
    getDb().prepare(
      `INSERT INTO admin_actions (admin_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)`
    ).run(adminId, action, targetType ?? null, targetId ?? null, detail ?? null);
  } catch (e) {
    log.warn('Failed to log admin action:', e);
  }
}

export function registerIpcHandlers() {
  const db = getDb();

  // ---------- ADMIN AUTH ----------
  ipcMain.handle('admin:login', (_e, payload: { username: string; password: string }) => {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(payload.username) as any;
    if (!row) throw new Error('Usuario no encontrado');
    if (row.role !== 'admin') throw new Error('No tienes permisos de administrador');
    const ok = bcrypt.compareSync(payload.password, row.password_hash);
    if (!ok) throw new Error('Contraseña incorrecta');
    if (row.totp_enabled) {
      // No registramos la sesión todavía — el cliente debe llamar a admin:loginVerifyTotp.
      return { requiresTotp: true, userId: row.id };
    }
    logAction(row.id, 'login', 'session');
    return parseUser(row);
  });

  ipcMain.handle('admin:loginVerifyTotp', (_e, payload: { userId: number; token: string }) => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as any;
    if (!row) throw new Error('Usuario no encontrado');
    if (row.role !== 'admin') throw new Error('No tienes permisos de administrador');
    const ok = twofa.verifyToken(payload.userId, payload.token);
    if (!ok) throw new Error('Código 2FA incorrecto');
    logAction(row.id, 'login', 'session', null, '2fa-ok');
    return parseUser(row);
  });

  // ---------- 2FA ADMIN ----------
  ipcMain.handle('admin:twofaGenerate', (_e, userId: number) => twofa.generateSecret(userId));
  ipcMain.handle('admin:twofaVerifyAndEnable', (_e, payload: { userId: number; token: string }) =>
    ({ enabled: twofa.verifyAndEnable(payload.userId, payload.token) })
  );
  ipcMain.handle('admin:twofaStatus', (_e, userId: number) => ({ enabled: twofa.isEnabled(userId) }));
  ipcMain.handle('admin:twofaDisable', (_e, payload: { userId: number; password: string }) => {
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(payload.userId) as any;
    if (!row) throw new Error('Usuario no encontrado');
    if (!bcrypt.compareSync(payload.password, row.password_hash)) throw new Error('Contraseña incorrecta');
    return twofa.disable(payload.userId);
  });

  // ---------- STATS ----------
  ipcMain.handle('stats:summary', () => {
    return {
      users: (db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('user') as any).c,
      games: (db.prepare('SELECT COUNT(*) as c FROM games WHERE is_dlc = 0').get() as any).c,
      licenses: {
        total: (db.prepare('SELECT COUNT(*) as c FROM licenses').get() as any).c,
        available: (db.prepare(`SELECT COUNT(*) as c FROM licenses WHERE status = 'available'`).get() as any).c,
        sold: (db.prepare(`SELECT COUNT(*) as c FROM licenses WHERE status IN ('sold','redeemed')`).get() as any).c,
        revoked: (db.prepare(`SELECT COUNT(*) as c FROM licenses WHERE status = 'revoked'`).get() as any).c
      },
      orders: (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c,
      revenue: (db.prepare(`SELECT COALESCE(SUM(total),0) as t FROM orders WHERE status = 'paid'`).get() as any).t,
      pro: (db.prepare('SELECT COUNT(*) as c FROM users WHERE is_pro = 1').get() as any).c,
      gift_cards_sold: (db.prepare(`SELECT COUNT(*) as c FROM gift_cards WHERE status IN ('sold','redeemed')`).get() as any).c,
      promotions_active: (db.prepare(`SELECT COUNT(*) as c FROM promotions WHERE is_active = 1 AND (ends_at IS NULL OR ends_at > ?)`).get(new Date().toISOString()) as any).c,
      refunds_pending: (db.prepare(`SELECT COUNT(*) as c FROM refund_requests WHERE status = 'pending'`).get() as any).c
    };
  });

  ipcMain.handle('stats:revenueByDay', (_e, days = 14) => {
    const buckets: { date: string; revenue: number; orders: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - i);
      const start = d.toISOString();
      const next = new Date(d.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const r = db.prepare(
        `SELECT COALESCE(SUM(total),0) as t, COUNT(*) as c FROM orders WHERE created_at >= ? AND created_at < ? AND status = 'paid'`
      ).get(start, next) as any;
      buckets.push({ date: start.slice(0, 10), revenue: r.t || 0, orders: r.c || 0 });
    }
    return buckets;
  });

  ipcMain.handle('stats:topGames', (_e, limit = 6) => {
    return db.prepare(`
      SELECT g.id, g.title, g.capsule_image, g.header_image,
        COUNT(oi.id) as units,
        COALESCE(SUM(oi.price),0) as revenue
      FROM order_items oi
      JOIN games g ON g.id = oi.game_id
      JOIN orders o ON o.id = oi.order_id AND o.status = 'paid'
      GROUP BY g.id
      ORDER BY units DESC, revenue DESC
      LIMIT ?
    `).all(limit);
  });

  ipcMain.handle('stats:userBreakdown', () => {
    const total = (db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('user') as any).c;
    const pro = (db.prepare('SELECT COUNT(*) as c FROM users WHERE is_pro = 1 AND role = ?').get('user') as any).c;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const active = (db.prepare(`SELECT COUNT(DISTINCT user_id) as c FROM activity_feed WHERE created_at >= ?`).get(dayAgo) as any).c;
    return { total, pro, free: Math.max(0, total - pro), active };
  });

  ipcMain.handle('stats:licenseStatusBreakdown', () => {
    return db.prepare(`SELECT status, COUNT(*) as c FROM licenses GROUP BY status`).all();
  });

  ipcMain.handle('stats:wishlistHeatmap', () => {
    return db.prepare(`
      SELECT g.id, g.title, g.capsule_image, g.header_image, g.price_final, g.discount_percent,
        COUNT(w.id) as wishes,
        (SELECT COUNT(*) FROM licenses WHERE game_id = g.id AND status = 'available') as available_stock
      FROM wishlist w
      JOIN games g ON g.id = w.game_id
      GROUP BY g.id
      ORDER BY wishes DESC LIMIT 20
    `).all();
  });

  ipcMain.handle('stats:funnel', () => {
    const dayAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const views = (db.prepare(`SELECT COUNT(*) as c FROM funnel_events WHERE event = 'view_game' AND created_at >= ?`).get(dayAgo) as any).c;
    const cart = (db.prepare(`SELECT COUNT(*) as c FROM funnel_events WHERE event = 'add_to_cart' AND created_at >= ?`).get(dayAgo) as any).c;
    const checkouts = (db.prepare(`SELECT COUNT(*) as c FROM funnel_events WHERE event = 'checkout_view' AND created_at >= ?`).get(dayAgo) as any).c;
    const purchases = (db.prepare(`SELECT COUNT(*) as c FROM funnel_events WHERE event = 'purchase' AND created_at >= ?`).get(dayAgo) as any).c;
    return { views, cart, checkouts, purchases };
  });

  // ---------- USERS ----------
  ipcMain.handle('users:list', () => {
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return rows.map(parseUser);
  });

  ipcMain.handle('users:update', (_e, payload: any) => {
    const fields: string[] = [];
    const values: any[] = [];
    if (payload.email !== undefined) { fields.push('email = ?'); values.push(payload.email); }
    if (payload.role !== undefined) { fields.push('role = ?'); values.push(payload.role); }
    if (payload.is_pro !== undefined) { fields.push('is_pro = ?'); values.push(payload.is_pro ? 1 : 0); }
    if (!fields.length) return parseUser(db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id));
    values.push(payload.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    if (payload.adminId) logAction(payload.adminId, 'user_update', 'user', payload.id, JSON.stringify({ email: payload.email, role: payload.role, is_pro: payload.is_pro }));
    return parseUser(db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id));
  });

  ipcMain.handle('users:resetPassword', (_e, payload: any) => {
    const hash = bcrypt.hashSync(payload.password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, payload.id);
    if (payload.adminId) logAction(payload.adminId, 'user_reset_password', 'user', payload.id);
    return { success: true };
  });

  ipcMain.handle('users:delete', (_e, payload: any) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(payload.id);
    if (payload.adminId) logAction(payload.adminId, 'user_delete', 'user', payload.id);
    return { success: true };
  });

  ipcMain.handle('users:bulkUpdate', (_e, payload: any) => {
    const fields: string[] = [];
    const values: any[] = [];
    if (payload.is_pro !== undefined) { fields.push('is_pro = ?'); values.push(payload.is_pro ? 1 : 0); }
    if (payload.role !== undefined) { fields.push('role = ?'); values.push(payload.role); }
    if (!fields.length || !payload.ids?.length) return { changed: 0 };
    const tx = db.transaction(() => {
      const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
      let changed = 0;
      for (const id of payload.ids) changed += stmt.run(...values, id).changes;
      return changed;
    });
    const changed = tx();
    if (payload.adminId) logAction(payload.adminId, 'user_bulk_update', 'user', null, JSON.stringify(payload));
    return { changed };
  });

  ipcMain.handle('users:bulkDelete', (_e, payload: any) => {
    if (!payload.ids?.length) return { deleted: 0 };
    const tx = db.transaction(() => {
      const stmt = db.prepare('DELETE FROM users WHERE id = ?');
      let deleted = 0;
      for (const id of payload.ids) deleted += stmt.run(id).changes;
      return deleted;
    });
    const deleted = tx();
    if (payload.adminId) logAction(payload.adminId, 'user_bulk_delete', 'user', null, JSON.stringify({ ids: payload.ids }));
    return { deleted };
  });

  // ---------- GAMES ----------
  ipcMain.handle('games:list', () => {
    return db.prepare('SELECT * FROM games ORDER BY created_at DESC').all().map(parseGame);
  });

  ipcMain.handle('games:get', (_e, id: number) => {
    return parseGame(db.prepare('SELECT * FROM games WHERE id = ?').get(id));
  });

  ipcMain.handle('games:addBySteam', async (_e, payload: any) => {
    const data = await fetchSteamGame(payload.url);
    if (!data) throw new Error('No se pudo obtener datos del juego');
    const exists = db.prepare('SELECT id FROM games WHERE steam_app_id = ?').get(data.steam_app_id);
    if (exists) throw new Error('Este juego ya está en el catálogo');
    const r = db.prepare(`
      INSERT INTO games (
        steam_app_id, title, short_description, detailed_description,
        developer, publisher, release_date, release_at,
        header_image, capsule_image, background_image,
        screenshots, trailer_url, genres, categories, languages,
        pc_requirements_min, pc_requirements_rec,
        price_initial, price_final, discount_percent, currency,
        stock, is_featured, is_active, is_preorder, is_dlc,
        steam_review_count, metacritic_score, drm_platform
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.steam_app_id, data.title, data.short_description, data.detailed_description,
      data.developer, data.publisher, data.release_date, data.release_at,
      data.header_image, data.capsule_image, data.background_image,
      JSON.stringify(data.screenshots), data.trailer_url, JSON.stringify(data.genres), JSON.stringify(data.categories), data.languages,
      data.pc_requirements_min, data.pc_requirements_rec,
      data.price_initial, data.price_final, data.discount_percent, data.currency,
      payload.stock, payload.featured ? 1 : 0, 1,
      data.is_preorder ? 1 : 0, data.is_dlc ? 1 : 0,
      data.steam_review_count, data.metacritic_score, payload.drm_platform || 'steam'
    );
    const gameId = r.lastInsertRowid as number;
    if (!data.is_preorder) {
      const stmt = db.prepare(`INSERT INTO licenses (game_id, code, status) VALUES (?, ?, 'available')`);
      for (let i = 0; i < payload.stock; i++) stmt.run(gameId, generateKey());
    }
    if (payload.adminId) logAction(payload.adminId, 'game_add', 'game', gameId, data.title);
    // Spread to Supabase (no-op if not configured) — fire-and-forget para no bloquear el UI.
    supabase.pushGame(gameId).then(() => supabase.pushLicenses(gameId));
    return parseGame(db.prepare('SELECT * FROM games WHERE id = ?').get(gameId));
  });

  ipcMain.handle('games:update', (_e, payload: any) => {
    const fields: string[] = [];
    const values: any[] = [];
    const setIf = (k: string, v: any) => { if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); } };
    setIf('price_final', payload.price_final);
    setIf('discount_percent', payload.discount_percent);
    setIf('stock', payload.stock);
    if (payload.is_active !== undefined) { fields.push('is_active = ?'); values.push(payload.is_active ? 1 : 0); }
    if (payload.is_featured !== undefined) { fields.push('is_featured = ?'); values.push(payload.is_featured ? 1 : 0); }
    if (payload.is_demo !== undefined) { fields.push('is_demo = ?'); values.push(payload.is_demo ? 1 : 0); }
    setIf('discount_ends_at', payload.discount_ends_at || null);
    setIf('drm_platform', payload.drm_platform);
    if (!fields.length) return parseGame(db.prepare('SELECT * FROM games WHERE id = ?').get(payload.id));
    values.push(payload.id);
    db.prepare(`UPDATE games SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
    if (payload.price_final !== undefined) {
      db.prepare(`INSERT INTO price_history (game_id, price, discount_percent) VALUES (?, ?, ?)`)
        .run(payload.id, payload.price_final, payload.discount_percent ?? 0);
    }
    if (payload.adminId) logAction(payload.adminId, 'game_update', 'game', payload.id, JSON.stringify(payload));
    supabase.pushGame(payload.id).then(() => {
      if (payload.price_final !== undefined) supabase.pushPriceHistory(payload.id);
    });
    return parseGame(db.prepare('SELECT * FROM games WHERE id = ?').get(payload.id));
  });

  ipcMain.handle('games:delete', (_e, payload: any) => {
    const id = payload.id ?? payload;
    const game = db.prepare('SELECT title FROM games WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM games WHERE id = ?').run(id);
    if (payload.adminId) logAction(payload.adminId, 'game_delete', 'game', id, game?.title);
    supabase.pushGameDelete(id);
    return { success: true };
  });

  // ---------- LICENSES ----------
  ipcMain.handle('licenses:list', (_e, gameId?: number) => {
    if (gameId) {
      return db.prepare(`
        SELECT l.*, g.title as game_title, u.username as buyer
        FROM licenses l JOIN games g ON g.id = l.game_id
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.game_id = ? ORDER BY l.created_at DESC
      `).all(gameId);
    }
    return db.prepare(`
      SELECT l.*, g.title as game_title, u.username as buyer
      FROM licenses l JOIN games g ON g.id = l.game_id
      LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC LIMIT 1000
    `).all();
  });

  ipcMain.handle('licenses:generate', (_e, payload: any) => {
    const stmt = db.prepare(`INSERT INTO licenses (game_id, code, status) VALUES (?, ?, 'available')`);
    const tx = db.transaction(() => {
      for (let i = 0; i < payload.quantity; i++) stmt.run(payload.gameId, generateKey());
      db.prepare(`UPDATE games SET stock = stock + ? WHERE id = ?`).run(payload.quantity, payload.gameId);
    });
    tx();
    if (payload.adminId) logAction(payload.adminId, 'license_generate', 'game', payload.gameId, `+${payload.quantity}`);
    supabase.pushLicenses(payload.gameId).then(() => supabase.pushGame(payload.gameId));
    return { success: true, generated: payload.quantity };
  });

  ipcMain.handle('licenses:revoke', (_e, payload: any) => {
    const id = payload.id ?? payload;
    db.prepare(`UPDATE licenses SET status = 'revoked' WHERE id = ?`).run(id);
    if (payload.adminId) logAction(payload.adminId, 'license_revoke', 'license', id);
    supabase.pushLicenseStatus(id, 'revoked');
    return { success: true };
  });

  ipcMain.handle('licenses:bulkRevoke', (_e, payload: any) => {
    if (!payload.ids?.length) return { revoked: 0 };
    const tx = db.transaction(() => {
      const stmt = db.prepare(`UPDATE licenses SET status = 'revoked' WHERE id = ? AND status = 'available'`);
      let revoked = 0;
      for (const id of payload.ids) revoked += stmt.run(id).changes;
      return revoked;
    });
    const revoked = tx();
    if (payload.adminId) logAction(payload.adminId, 'license_bulk_revoke', 'license', null, JSON.stringify({ ids: payload.ids }));
    return { revoked };
  });

  // ---------- ORDERS / SALES ----------
  ipcMain.handle('orders:list', () => {
    return db.prepare(`
      SELECT o.*, u.username FROM orders o
      JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC LIMIT 1000
    `).all();
  });

  ipcMain.handle('orders:items', (_e, orderId: number) => {
    return db.prepare(`
      SELECT oi.*, g.title, l.code as license_code
      FROM order_items oi
      JOIN games g ON g.id = oi.game_id
      LEFT JOIN licenses l ON l.id = oi.license_id
      WHERE oi.order_id = ?
    `).all(orderId);
  });

  // ---------- AUDIT LOG ----------
  ipcMain.handle('audit:list', (_e, limit = 200) => {
    return db.prepare(`
      SELECT a.*, u.username FROM admin_actions a
      JOIN users u ON u.id = a.admin_id
      ORDER BY a.created_at DESC LIMIT ?
    `).all(limit);
  });

  // ---------- BUNDLES ----------
  ipcMain.handle('bundles:list', () => {
    const bundles = db.prepare('SELECT * FROM bundles ORDER BY created_at DESC').all() as any[];
    return bundles.map((b) => ({
      ...b,
      games: db.prepare(`
        SELECT g.* FROM bundle_games bg JOIN games g ON g.id = bg.game_id
        WHERE bg.bundle_id = ?
      `).all(b.id).map(parseGame)
    }));
  });

  ipcMain.handle('bundles:create', (_e, payload: any) => {
    const r = db.prepare(`
      INSERT INTO bundles (title, description, discount_percent, ends_at) VALUES (?, ?, ?, ?)
    `).run(payload.title, payload.description, payload.discount_percent, payload.ends_at || null);
    const bundleId = r.lastInsertRowid as number;
    const link = db.prepare(`INSERT INTO bundle_games (bundle_id, game_id) VALUES (?, ?)`);
    for (const gid of payload.gameIds) link.run(bundleId, gid);
    if (payload.adminId) logAction(payload.adminId, 'bundle_create', 'bundle', bundleId, payload.title);
    return { id: bundleId };
  });

  ipcMain.handle('bundles:delete', (_e, payload: any) => {
    db.prepare('DELETE FROM bundles WHERE id = ?').run(payload.id);
    if (payload.adminId) logAction(payload.adminId, 'bundle_delete', 'bundle', payload.id);
    return { success: true };
  });

  // ---------- PROMOTIONS ----------
  ipcMain.handle('promotions:list', () => {
    const rows = db.prepare(`SELECT * FROM promotions ORDER BY priority DESC, created_at DESC`).all() as any[];
    return rows.map((p) => ({
      ...p,
      games: db.prepare(`
        SELECT g.id, g.title, g.capsule_image, g.header_image FROM promotion_games pg
        JOIN games g ON g.id = pg.game_id WHERE pg.promotion_id = ?
      `).all(p.id)
    }));
  });

  ipcMain.handle('promotions:create', (_e, payload: any) => {
    const r = db.prepare(`
      INSERT INTO promotions (title, subtitle, hero_image, accent_color, cta_text, cta_target, starts_at, ends_at, priority, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.title, payload.subtitle ?? null, payload.hero_image ?? null,
      payload.accent_color ?? '#00d4ff', payload.cta_text ?? 'Ver ofertas',
      payload.cta_target ?? '/store', payload.starts_at ?? new Date().toISOString(),
      payload.ends_at ?? null, payload.priority ?? 0, payload.is_active ? 1 : 0
    );
    const promoId = r.lastInsertRowid as number;
    if (payload.gameIds?.length) {
      const link = db.prepare(`INSERT INTO promotion_games (promotion_id, game_id) VALUES (?, ?)`);
      for (const gid of payload.gameIds) link.run(promoId, gid);
    }
    if (payload.adminId) logAction(payload.adminId, 'promotion_create', 'promotion', promoId, payload.title);
    return { id: promoId };
  });

  ipcMain.handle('promotions:update', (_e, payload: any) => {
    const fields: string[] = [];
    const values: any[] = [];
    const set = (k: string, v: any) => { if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); } };
    set('title', payload.title);
    set('subtitle', payload.subtitle);
    set('hero_image', payload.hero_image);
    set('accent_color', payload.accent_color);
    set('cta_text', payload.cta_text);
    set('cta_target', payload.cta_target);
    set('starts_at', payload.starts_at);
    set('ends_at', payload.ends_at);
    set('priority', payload.priority);
    if (payload.is_active !== undefined) { fields.push('is_active = ?'); values.push(payload.is_active ? 1 : 0); }
    if (!fields.length) return { success: true };
    values.push(payload.id);
    db.prepare(`UPDATE promotions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    if (payload.adminId) logAction(payload.adminId, 'promotion_update', 'promotion', payload.id);
    return { success: true };
  });

  ipcMain.handle('promotions:delete', (_e, payload: any) => {
    db.prepare('DELETE FROM promotions WHERE id = ?').run(payload.id);
    if (payload.adminId) logAction(payload.adminId, 'promotion_delete', 'promotion', payload.id);
    return { success: true };
  });

  // ---------- FLASH SALES ----------
  ipcMain.handle('flashSales:list', () => {
    return db.prepare(`
      SELECT fs.*, g.title FROM flash_sales fs
      JOIN games g ON g.id = fs.game_id
      ORDER BY fs.ends_at DESC LIMIT 100
    `).all();
  });

  ipcMain.handle('flashSales:create', (_e, payload: any) => {
    const starts = payload.starts_at ?? new Date().toISOString();
    const ends = payload.ends_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const r = db.prepare(`
      INSERT INTO flash_sales (game_id, discount_percent, max_units, starts_at, ends_at, is_daily_deal)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(payload.gameId, payload.discount_percent, payload.max_units ?? null, starts, ends, payload.is_daily_deal ? 1 : 0);
    const id = r.lastInsertRowid as number;
    if (payload.adminId) logAction(payload.adminId, 'flash_sale_create', 'flash_sale', id, JSON.stringify(payload));
    return { id };
  });

  ipcMain.handle('flashSales:delete', (_e, payload: any) => {
    db.prepare('DELETE FROM flash_sales WHERE id = ?').run(payload.id);
    if (payload.adminId) logAction(payload.adminId, 'flash_sale_delete', 'flash_sale', payload.id);
    return { success: true };
  });

  // ---------- GIFT CARDS ----------
  ipcMain.handle('giftCards:list', () => {
    return db.prepare(`
      SELECT gc.*, b.username as buyer_name, r.username as redeemer_name FROM gift_cards gc
      LEFT JOIN users b ON b.id = gc.buyer_id
      LEFT JOIN users r ON r.id = gc.redeemer_id
      ORDER BY gc.created_at DESC LIMIT 500
    `).all();
  });

  ipcMain.handle('giftCards:generate', (_e, payload: any) => {
    const codes: string[] = [];
    const tx = db.transaction(() => {
      for (let i = 0; i < payload.quantity; i++) {
        const code = `GC-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        db.prepare(`INSERT INTO gift_cards (code, amount, currency, status) VALUES (?, ?, 'PEN', 'unsold')`).run(code, payload.amount);
        codes.push(code);
      }
    });
    tx();
    if (payload.adminId) logAction(payload.adminId, 'gift_card_generate', 'gift_card', null, `${payload.quantity} × S/.${payload.amount}`);
    return { codes };
  });

  // ---------- CURRENCY RATES ----------
  ipcMain.handle('currency:list', () => db.prepare(`SELECT * FROM currency_rates ORDER BY code`).all());

  ipcMain.handle('currency:update', (_e, payload: any) => {
    db.prepare(`UPDATE currency_rates SET rate_from_pen = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?`)
      .run(payload.rate_from_pen, payload.code);
    if (payload.adminId) logAction(payload.adminId, 'currency_update', 'currency', null, `${payload.code} → ${payload.rate_from_pen}`);
    return { success: true };
  });

  // ---------- COLLECTIONS ----------
  ipcMain.handle('collections:list', () => {
    const rows = db.prepare(`SELECT * FROM collections ORDER BY created_at DESC`).all() as any[];
    return rows.map((c) => ({
      ...c,
      games: db.prepare(`
        SELECT g.id, g.title, g.capsule_image, g.header_image FROM collection_games cg
        JOIN games g ON g.id = cg.game_id WHERE cg.collection_id = ?
        ORDER BY cg.ord ASC
      `).all(c.id)
    }));
  });

  ipcMain.handle('collections:create', (_e, payload: any) => {
    const r = db.prepare(`
      INSERT INTO collections (slug, title, description, hero_image, curator_name, is_published)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(payload.slug, payload.title, payload.description ?? '', payload.hero_image ?? '', payload.curator_name ?? '', payload.is_published ? 1 : 0);
    const id = r.lastInsertRowid as number;
    if (payload.gameIds?.length) {
      const link = db.prepare(`INSERT INTO collection_games (collection_id, game_id, ord) VALUES (?, ?, ?)`);
      payload.gameIds.forEach((gid: number, i: number) => link.run(id, gid, i));
    }
    if (payload.adminId) logAction(payload.adminId, 'collection_create', 'collection', id, payload.title);
    return { id };
  });

  ipcMain.handle('collections:delete', (_e, payload: any) => {
    db.prepare('DELETE FROM collections WHERE id = ?').run(payload.id);
    if (payload.adminId) logAction(payload.adminId, 'collection_delete', 'collection', payload.id);
    return { success: true };
  });

  // ---------- REFUNDS ----------
  ipcMain.handle('refunds:list', () => {
    return db.prepare(`
      SELECT r.*, u.username, oi.price, g.title as game_title
      FROM refund_requests r
      JOIN users u ON u.id = r.user_id
      JOIN order_items oi ON oi.id = r.order_item_id
      JOIN games g ON g.id = oi.game_id
      ORDER BY r.created_at DESC
    `).all();
  });

  ipcMain.handle('refunds:decide', (_e, payload: any) => {
    const r = db.prepare(`SELECT * FROM refund_requests WHERE id = ?`).get(payload.id) as any;
    if (!r) throw new Error('Solicitud no encontrada');
    if (r.status !== 'pending') throw new Error('Ya fue decidida');

    const tx = db.transaction(() => {
      db.prepare(`UPDATE refund_requests SET status = ?, decision = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(payload.approved ? 'approved' : 'rejected', payload.decision ?? null, payload.adminId ?? null, payload.id);
      if (payload.approved) {
        const item = db.prepare(`SELECT * FROM order_items WHERE id = ?`).get(r.order_item_id) as any;
        if (item) {
          db.prepare(`INSERT OR IGNORE INTO wallet (user_id, balance) VALUES (?, 0)`).run(r.user_id);
          db.prepare(`UPDATE wallet SET balance = balance + ? WHERE user_id = ?`).run(item.price, r.user_id);
          if (item.license_id) {
            db.prepare(`UPDATE licenses SET status = 'available', user_id = NULL, sold_at = NULL WHERE id = ?`).run(item.license_id);
          }
          db.prepare(`DELETE FROM library WHERE user_id = ? AND game_id = ?`).run(r.user_id, item.game_id);
        }
      }
    });
    tx();
    if (payload.adminId) logAction(payload.adminId, payload.approved ? 'refund_approve' : 'refund_reject', 'refund', payload.id);
    return { success: true };
  });

  // ---------- STEAM ----------
  ipcMain.handle('steam:fetch', async (_e, urlOrId: string) => fetchSteamGame(urlOrId));

  // ---------- FREE GAME WEEKLY (Tier 6 admin) ----------
  ipcMain.handle('freeGame:get', () => {
    const r = db.prepare(`SELECT value FROM app_config WHERE key = 'free_game.current'`).get() as any;
    if (!r?.value) return null;
    try {
      const data = JSON.parse(r.value);
      const game = parseGame(db.prepare('SELECT * FROM games WHERE id = ?').get(data.game_id));
      return { ...data, game };
    } catch { return null; }
  });

  ipcMain.handle('freeGame:set', (_e, payload: { adminId?: number; gameId: number; daysActive: number }) => {
    const expires = new Date(Date.now() + payload.daysActive * 24 * 60 * 60 * 1000).toISOString();
    const value = JSON.stringify({ game_id: payload.gameId, expires_at: expires });
    db.prepare(`
      INSERT INTO app_config (key, value) VALUES ('free_game.current', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(value);
    if (payload.adminId) logAction(payload.adminId, 'free_game_set', 'game', payload.gameId, `${payload.daysActive}d`);
    return { success: true, expires_at: expires };
  });

  ipcMain.handle('freeGame:clear', (_e, payload: { adminId?: number }) => {
    db.prepare(`DELETE FROM app_config WHERE key = 'free_game.current'`).run();
    if (payload?.adminId) logAction(payload.adminId, 'free_game_clear', 'system', null);
    return { success: true };
  });

  // ---------- PAYMENTS CONFIG (admin) ----------
  // Lee/escribe credenciales de pasarelas y Yape en app_config compartido.
  ipcMain.handle('paymentsAdmin:get', () => {
    const get = (k: string) =>
      (db.prepare('SELECT value FROM app_config WHERE key = ?').get(k) as any)?.value ?? '';
    return {
      culqi: {
        public_key: get('payments.culqi.public_key'),
        private_key_set: !!get('payments.culqi.private_key')
      },
      paypal: {
        client_id: get('payments.paypal.client_id'),
        client_secret_set: !!get('payments.paypal.client_secret'),
        env: get('payments.paypal.env') || 'sandbox'
      },
      yape: {
        qr_image_data: get('yape.qr_image_data'),
        recipient_name: get('yape.recipient_name'),
        recipient_phone: get('yape.recipient_phone')
      },
      anthropic: {
        api_key_set: !!get('anthropic.api_key')
      }
    };
  });

  ipcMain.handle('paymentsAdmin:set', (_e, payload: Record<string, string | null>) => {
    // Whitelist de claves para no permitir escribir cualquier cosa.
    const allowed = new Set([
      'payments.culqi.public_key',
      'payments.culqi.private_key',
      'payments.paypal.client_id',
      'payments.paypal.client_secret',
      'payments.paypal.env',
      'yape.qr_image_data',
      'yape.recipient_name',
      'yape.recipient_phone',
      'anthropic.api_key'
    ]);
    for (const [k, v] of Object.entries(payload)) {
      if (!allowed.has(k)) continue;
      if (v === null || v === '') {
        db.prepare('DELETE FROM app_config WHERE key = ?').run(k);
      } else {
        db.prepare(
          `INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
        ).run(k, v);
      }
    }
    return { success: true };
  });

  // ---------- YAPE RECEIPTS REVIEW ----------
  // Lista los comprobantes para revisión manual del admin.
  ipcMain.handle('yapeReceipts:list', (_e, opts?: { status?: string; limit?: number }) => {
    // Crear tabla si Dreitz aún no la creó (perezosa).
    db.exec(`
      CREATE TABLE IF NOT EXISTS yape_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        order_id INTEGER,
        amount NUMERIC NOT NULL,
        image_data TEXT NOT NULL,
        verify_status TEXT NOT NULL,
        verify_confidence TEXT NOT NULL,
        verify_amount_seen NUMERIC,
        verify_recipient_seen TEXT,
        verify_date_seen TEXT,
        verify_issues TEXT,
        verify_explanation TEXT,
        admin_decision TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    let q = `
      SELECT r.*, u.username FROM yape_receipts r
      LEFT JOIN users u ON u.id = r.user_id
    `;
    const params: any[] = [];
    if (opts?.status) {
      q += ' WHERE r.verify_status = ?';
      params.push(opts.status);
    }
    q += ' ORDER BY r.created_at DESC LIMIT ?';
    params.push(opts?.limit ?? 200);
    return db.prepare(q).all(...params);
  });

  ipcMain.handle('yapeReceipts:decide', (_e, payload: { id: number; approve: boolean; adminId?: number; note?: string }) => {
    db.prepare(`UPDATE yape_receipts SET admin_decision = ? WHERE id = ?`)
      .run(payload.approve ? `approved${payload.note ? ': ' + payload.note : ''}` : `rejected${payload.note ? ': ' + payload.note : ''}`, payload.id);
    if (payload.adminId) {
      logAction(payload.adminId, payload.approve ? 'yape_approve' : 'yape_reject', 'yape_receipt', payload.id, payload.note);
    }
    return { success: true };
  });

  // ---------- SUPABASE (admin) ----------
  ipcMain.handle('supabase:status', () => supabase.getStatus());

  ipcMain.handle('supabase:setCreds', (_e, payload: { url?: string; anon_key?: string; service_role?: string }) => {
    const ok = supabase.setCreds(payload);
    return { enabled: ok, ...supabase.getStatus() };
  });

  ipcMain.handle('supabase:pushAll', async (_e, payload?: { adminId?: number }) => {
    const stats = await supabase.pushFullCatalog();
    if (payload?.adminId) logAction(payload.adminId, 'supabase_push_all', 'system', null, JSON.stringify(stats));
    return stats;
  });

  ipcMain.handle('supabase:disable', () => {
    supabase.disable();
    return supabase.getStatus();
  });

  // ---------- ADMIN PASSWORD RESET (sin pregunta de seguridad) ----------
  // Para cuando un usuario no tenga recovery_question — el admin lo resetea desde Keys.
  ipcMain.handle('admin:resetUserPassword', (_e, payload: { adminId: number; userId: number; newPassword: string }) => {
    if (!payload.newPassword || payload.newPassword.length < 4) {
      throw new Error('La contraseña debe tener al menos 4 caracteres');
    }
    const hash = bcrypt.hashSync(payload.newPassword, 10);
    const r = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, payload.userId);
    if (r.changes === 0) throw new Error('Usuario no encontrado');
    logAction(payload.adminId, 'reset_user_password', 'user', payload.userId);
    return { success: true };
  });

  // ---------- AUDIT LOG con filtros ----------
  ipcMain.handle('audit:filter', (_e, opts: {
    action?: string;
    adminId?: number;
    targetType?: string;
    since?: string;
    until?: string;
    limit?: number;
  }) => {
    let q = `
      SELECT a.*, u.username as admin_username
      FROM admin_actions a
      LEFT JOIN users u ON u.id = a.admin_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (opts.action)      { q += ' AND a.action LIKE ?';      params.push(`%${opts.action}%`); }
    if (opts.adminId)     { q += ' AND a.admin_id = ?';       params.push(opts.adminId); }
    if (opts.targetType)  { q += ' AND a.target_type = ?';    params.push(opts.targetType); }
    if (opts.since)       { q += ' AND a.created_at >= ?';    params.push(opts.since); }
    if (opts.until)       { q += ' AND a.created_at <= ?';    params.push(opts.until); }
    q += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(Math.min(opts.limit ?? 500, 5000));
    return db.prepare(q).all(...params);
  });

  // ---------- TEMPLATES de mensajes (WhatsApp/email) ----------
  // Guarda plantillas reutilizables para enviar claves a los compradores.
  ipcMain.handle('templates:list', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Si está vacía, sembrar 2 templates de ejemplo.
    const cnt = (db.prepare('SELECT COUNT(*) as c FROM message_templates').get() as any).c;
    if (cnt === 0) {
      const seed = db.prepare('INSERT INTO message_templates (slug, title, body) VALUES (?, ?, ?)');
      seed.run('whatsapp_default', 'WhatsApp · entrega de clave',
        '¡Hola {{nombre}}! 🎮\n\nTu copia de *{{juego}}* está lista.\n\nActiva tu clave en Dreitz:\n*{{clave}}*\n\n📥 Descarga el launcher: https://dreitzteam.com/download\n\n¿Dudas? Responde aquí o llámame.');
      seed.run('whatsapp_giftcard', 'WhatsApp · gift card',
        '¡Sorpresa! 🎁\n\nTe regalé *{{juego}}* en Dreitz.\n\nTu código: *{{clave}}*\n\nActívalo en el launcher > Activar clave.');
    }
    return db.prepare('SELECT * FROM message_templates ORDER BY title').all();
  });

  ipcMain.handle('templates:upsert', (_e, payload: { id?: number; slug: string; title: string; body: string }) => {
    if (payload.id) {
      db.prepare('UPDATE message_templates SET slug = ?, title = ?, body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(payload.slug, payload.title, payload.body, payload.id);
    } else {
      db.prepare('INSERT INTO message_templates (slug, title, body) VALUES (?, ?, ?)')
        .run(payload.slug, payload.title, payload.body);
    }
    return { success: true };
  });

  ipcMain.handle('templates:delete', (_e, id: number) => {
    db.prepare('DELETE FROM message_templates WHERE id = ?').run(id);
    return { success: true };
  });

  // Render una plantilla rellenando {{vars}} con los valores dados.
  ipcMain.handle('templates:render', (_e, payload: { templateId: number; vars: Record<string, string> }) => {
    const tpl = db.prepare('SELECT body FROM message_templates WHERE id = ?').get(payload.templateId) as any;
    if (!tpl) throw new Error('Template no encontrada');
    let body: string = tpl.body;
    for (const [k, v] of Object.entries(payload.vars)) {
      body = body.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), v);
    }
    return { body };
  });

  // ============================================================================
  // STORAGE — subir .zip del juego a InsForge
  // ============================================================================
  ipcMain.handle('storage:pickZip', async () => {
    const r = await dialog.showOpenDialog({
      title: 'Selecciona el .zip del juego',
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
      properties: ['openFile']
    });
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
  });
  ipcMain.handle('storage:uploadGameZip', (_e, payload: { gameId: number; filePath: string }) =>
    storage.subirZipJuego(payload));
  ipcMain.handle('storage:deleteGameZip', (_e, gameId: number) =>
    storage.borrarZipJuego(gameId));
}
