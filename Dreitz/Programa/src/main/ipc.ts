import { ipcMain, BrowserWindow, Notification, nativeTheme, dialog, app } from 'electron';
import bcrypt from 'bcryptjs';
import os from 'node:os';
import { getDb } from './db';
import { fetchSteamGame, fetchSteamPriceUsd } from './steam';
import { evaluateAchievements, ACHIEVEMENTS } from './achievements';
import log from './logger';
import * as launcher from './launcher';
import { getTodayMissions, claimMission } from './missions';
import { getStickers, unlockGameSticker, evaluateMetaStickers } from './stickers';
import * as plugins from './plugins';
import * as steamDetect from './steamDetect';
import * as saves from './saves';
import * as payments from './payments';
import * as supabase from './supabase';
import * as yape from './yape';
import * as recovery from './recovery';
import * as twofa from './twofa';
import * as imageCache from './imageCache';
import * as priceSync from './priceSync';
import { getHltb } from './hltb';
import * as downloader from './downloader';
import * as backup from './backup';
import * as telemetry from './telemetry';
import * as family from './family';
import * as featureFlags from './featureFlags';
import * as discord from './discord';
import * as autoUpdate from './autoUpdate';
import * as recommend from './recommend';
import { getSystemPrefs, setSystemPref, type SystemPrefs } from './systemPrefs';

const POINTS_PER_PEN = 0.1; // 1pt per S/.10
const POINT_REDEEM_VALUE = 0.05; // 1 point = S/.0.05 (S/.5 / 100pts)

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
  // Strippe campos sensibles: nunca exponer hashes/secretos al renderer.
  const { password_hash, totp_secret, recovery_answer_hash, ...rest } = row;
  void password_hash; void totp_secret; void recovery_answer_hash;
  return { ...rest, is_pro: !!row.is_pro, totp_enabled: !!row.totp_enabled };
}

function logActivity(userId: number, kind: string, targetId: number | null, targetLabel: string | null, meta?: any) {
  try {
    getDb().prepare(
      `INSERT INTO activity_feed (user_id, kind, target_id, target_label, meta) VALUES (?, ?, ?, ?, ?)`
    ).run(userId, kind, targetId, targetLabel, meta ? JSON.stringify(meta) : null);
  } catch (e) { log.warn('logActivity failed:', e); }
}

function notify(title: string, body: string) {
  if (Notification.isSupported()) new Notification({ title, body, silent: false }).show();
}

function broadcast(channel: string, payload?: any) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  }
}

function userLevel(totalSpent: number): { level: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'; cashback: number; nextAt: number | null } {
  if (totalSpent >= 1000) return { level: 'Platinum', cashback: 8, nextAt: null };
  if (totalSpent >= 500) return { level: 'Gold', cashback: 5, nextAt: 1000 };
  if (totalSpent >= 200) return { level: 'Silver', cashback: 3, nextAt: 500 };
  return { level: 'Bronze', cashback: 1, nextAt: 200 };
}

function applyActiveDiscount(db: any, game: any): { effectivePrice: number; flashId: number | null; flashEndsAt: string | null; flashDiscount: number | null } {
  const now = new Date().toISOString();
  const flash = db.prepare(`
    SELECT * FROM flash_sales WHERE game_id = ? AND starts_at <= ? AND ends_at > ?
    ORDER BY discount_percent DESC LIMIT 1
  `).get(game.id, now, now) as any;
  if (!flash) return { effectivePrice: game.price_final, flashId: null, flashEndsAt: null, flashDiscount: null };
  const sold = (db.prepare(`SELECT COUNT(*) as c FROM order_items WHERE game_id = ? AND order_id IN (SELECT id FROM orders WHERE created_at >= ?)`).get(game.id, flash.starts_at) as any).c;
  if (flash.max_units && sold >= flash.max_units) {
    return { effectivePrice: game.price_final, flashId: null, flashEndsAt: null, flashDiscount: null };
  }
  return {
    effectivePrice: +(game.price_initial * (1 - flash.discount_percent / 100)).toFixed(2),
    flashId: flash.id,
    flashEndsAt: flash.ends_at,
    flashDiscount: flash.discount_percent
  };
}

export function registerIpcHandlers() {
  const db = getDb();

  // ---------- AUTH ----------
  ipcMain.handle('auth:register', (_e, payload: { username: string; email: string; password: string; refCode?: string }) => {
    const { username, email, password, refCode } = payload;
    if (!username || !password) throw new Error('Usuario y contraseña requeridos');
    if (password.length < 4) throw new Error('Contraseña muy corta (mínimo 4)');
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ?)').get(username, email);
    if (existing) throw new Error('Ese usuario o email ya existe');
    const hash = bcrypt.hashSync(password, 10);
    const myRef = `${username.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    let referrerId: number | null = null;
    if (refCode) {
      const ref = db.prepare('SELECT id FROM users WHERE ref_code = ?').get(refCode.trim().toUpperCase()) as any;
      if (ref) referrerId = ref.id;
    }

    const r = db.prepare(
      `INSERT INTO users (username, email, password_hash, role, ref_code, ref_used) VALUES (?, ?, ?, 'user', ?, ?)`
    ).run(username, email || null, hash, myRef, refCode || null);
    const userId = r.lastInsertRowid as number;
    db.prepare(`INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)`).run(userId);
    db.prepare(`INSERT OR IGNORE INTO wallet (user_id, balance) VALUES (?, 0)`).run(userId);

    if (referrerId) {
      // Referrer earns 50 points
      db.prepare(`INSERT INTO points_ledger (user_id, delta, reason, target_id) VALUES (?, ?, 'referral_bonus', ?)`)
        .run(referrerId, 50, userId);
    }
    log.info('User registered:', username, refCode ? `(ref by ${refCode})` : '');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    return parseUser(user);
  });

  ipcMain.handle('auth:login', (_e, payload: { username: string; password: string }) => {
    const { username, password } = payload;
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!row) throw new Error('Usuario no encontrado');
    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) throw new Error('Contraseña incorrecta');
    db.prepare(`INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)`).run(row.id);
    db.prepare(`INSERT OR IGNORE INTO wallet (user_id, balance) VALUES (?, 0)`).run(row.id);
    if (row.totp_enabled) {
      // Bloquear hasta que el cliente verifique 2FA — no devolvemos el user completo todavía.
      return { requiresTotp: true, userId: row.id, username: row.username };
    }
    return parseUser(row);
  });

  ipcMain.handle('auth:loginVerifyTotp', (_e, payload: { userId: number; token: string }) => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as any;
    if (!row) throw new Error('Usuario no encontrado');
    const ok = twofa.verifyToken(payload.userId, payload.token);
    if (!ok) throw new Error('Código 2FA incorrecto');
    return parseUser(row);
  });

  ipcMain.handle('auth:me', (_e, userId: number) => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    return parseUser(row);
  });

  // ---------- GAMES ----------
  ipcMain.handle('games:list', (_e, opts?: any) => {
    let q = 'SELECT * FROM games WHERE is_active = 1 AND is_dlc = 0';
    const params: any[] = [];
    if (opts?.search) {
      q += ' AND (title LIKE ? OR developer LIKE ? OR publisher LIKE ?)';
      const s = `%${opts.search}%`;
      params.push(s, s, s);
    }
    if (opts?.featuredOnly) q += ' AND is_featured = 1';
    if (opts?.onSaleOnly) q += ' AND discount_percent > 0';
    if (opts?.preorderOnly) q += ' AND is_preorder = 1';
    if (opts?.demoOnly) q += ' AND is_demo = 1';
    if (opts?.freeOnly) q += ' AND price_final = 0 AND is_preorder = 0';
    if (opts?.publisher) { q += ' AND publisher = ?'; params.push(opts.publisher); }
    if (opts?.developer) { q += ' AND developer = ?'; params.push(opts.developer); }
    if (opts?.drm) { q += ' AND drm_platform = ?'; params.push(opts.drm); }
    if (typeof opts?.minPrice === 'number') { q += ' AND price_final >= ?'; params.push(opts.minPrice); }
    if (typeof opts?.maxPrice === 'number') { q += ' AND price_final <= ?'; params.push(opts.maxPrice); }
    let order = 'is_featured DESC, created_at DESC';
    switch (opts?.sort) {
      case 'price_asc': order = 'price_final ASC'; break;
      case 'price_desc': order = 'price_final DESC'; break;
      case 'newest': order = 'created_at DESC'; break;
      case 'discount': order = 'discount_percent DESC, price_final ASC'; break;
      case 'name': order = 'title COLLATE NOCASE ASC'; break;
      case 'release_soon': order = 'release_at ASC'; break;
    }
    q += ` ORDER BY ${order}`;
    let rows = db.prepare(q).all(...params).map(parseGame);
    if (opts?.genres && opts.genres.length) {
      const set = new Set(opts.genres.map((g: string) => g.toLowerCase()));
      rows = rows.filter((g: any) => g.genres.some((x: string) => set.has(x.toLowerCase())));
    }
    return rows;
  });

  ipcMain.handle('games:get', (_e, id: number) => {
    return parseGame(db.prepare('SELECT * FROM games WHERE id = ?').get(id));
  });

  ipcMain.handle('games:availableStock', (_e, gameId: number) => {
    const r = db.prepare(`SELECT COUNT(*) as c FROM licenses WHERE game_id = ? AND status = 'available'`).get(gameId) as { c: number };
    return r.c;
  });

  ipcMain.handle('games:related', (_e, payload: { gameId: number; limit?: number }) => {
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(payload.gameId) as any;
    if (!game) return [];
    const genres = game.genres ? JSON.parse(game.genres) : [];
    const all = db.prepare('SELECT * FROM games WHERE is_active = 1 AND is_dlc = 0 AND id != ?').all(payload.gameId).map(parseGame);
    const scored = all.map((g: any) => {
      const gset = new Set(g.genres);
      const overlap = genres.filter((x: string) => gset.has(x)).length;
      return { game: g, score: overlap };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, payload.limit ?? 6).filter((s) => s.score > 0).map((s) => s.game);
  });

  ipcMain.handle('games:trackView', (_e, payload: { userId: number; gameId: number }) => {
    if (!payload.userId) return;
    db.prepare(`INSERT INTO view_history (user_id, game_id) VALUES (?, ?)`).run(payload.userId, payload.gameId);
    db.prepare(`INSERT INTO funnel_events (user_id, event, target_id) VALUES (?, 'view_game', ?)`).run(payload.userId, payload.gameId);
    return { success: true };
  });

  ipcMain.handle('games:recentlyViewed', (_e, payload: { userId: number; limit?: number }) => {
    if (!payload.userId) return [];
    return db.prepare(`
      SELECT g.* FROM view_history vh
      JOIN games g ON g.id = vh.game_id
      WHERE vh.user_id = ? AND g.is_active = 1
      GROUP BY g.id
      ORDER BY MAX(vh.viewed_at) DESC
      LIMIT ?
    `).all(payload.userId, payload.limit ?? 8).map(parseGame);
  });

  ipcMain.handle('games:priceHistory', (_e, gameId: number) => {
    return db.prepare(
      `SELECT price, discount_percent, recorded_at FROM price_history WHERE game_id = ? ORDER BY recorded_at ASC LIMIT 60`
    ).all(gameId);
  });

  ipcMain.handle('games:dlcs', (_e, parentGameId: number) => {
    const parent = db.prepare('SELECT steam_app_id FROM games WHERE id = ?').get(parentGameId) as any;
    if (!parent) return [];
    return db.prepare(`SELECT * FROM games WHERE parent_game_id = ? OR (is_dlc = 1 AND steam_app_id != ? AND title LIKE '%' || (SELECT title FROM games WHERE id = ?) || '%')`).all(parentGameId, parent.steam_app_id, parentGameId).map(parseGame);
  });

  ipcMain.handle('games:flashSale', (_e, gameId: number) => {
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) return null;
    const fs = applyActiveDiscount(db, game);
    if (!fs.flashId) return null;
    return { discount_percent: fs.flashDiscount, ends_at: fs.flashEndsAt, effective_price: fs.effectivePrice };
  });

  ipcMain.handle('games:byPublisher', (_e, publisher: string) => {
    return db.prepare(`SELECT * FROM games WHERE publisher = ? AND is_active = 1 AND is_dlc = 0 ORDER BY created_at DESC`).all(publisher).map(parseGame);
  });

  ipcMain.handle('games:byDeveloper', (_e, developer: string) => {
    return db.prepare(`SELECT * FROM games WHERE developer = ? AND is_active = 1 AND is_dlc = 0 ORDER BY created_at DESC`).all(developer).map(parseGame);
  });

  ipcMain.handle('games:comparePrice', async (_e, payload: { gameId: number }) => {
    const g = db.prepare('SELECT * FROM games WHERE id = ?').get(payload.gameId) as any;
    if (!g) return null;
    const ours = g.price_final;
    const steam = await fetchSteamPriceUsd(g.steam_app_id);
    if (!steam.priceUsd) return null;
    const usdToPen = (db.prepare(`SELECT rate_from_pen FROM currency_rates WHERE code = 'USD'`).get() as any)?.rate_from_pen ?? 0.27;
    const steamPen = +(steam.priceUsd / usdToPen).toFixed(2);
    const savings = +(((steamPen - ours) / steamPen) * 100).toFixed(1);
    return { dreitz_pen: ours, steam_pen: steamPen, steam_usd: steam.priceUsd, savings_pct: savings };
  });

  // ---------- WISHLIST ----------
  ipcMain.handle('wishlist:list', (_e, userId: number) => {
    return db.prepare(`
      SELECT g.*, w.added_at FROM wishlist w
      JOIN games g ON g.id = w.game_id
      WHERE w.user_id = ? AND g.is_active = 1
      ORDER BY w.added_at DESC
    `).all(userId).map(parseGame);
  });

  ipcMain.handle('wishlist:toggle', (_e, payload: { userId: number; gameId: number }) => {
    const existing = db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND game_id = ?').get(payload.userId, payload.gameId);
    if (existing) {
      db.prepare('DELETE FROM wishlist WHERE user_id = ? AND game_id = ?').run(payload.userId, payload.gameId);
      return { added: false };
    }
    db.prepare('INSERT INTO wishlist (user_id, game_id) VALUES (?, ?)').run(payload.userId, payload.gameId);
    const game = db.prepare('SELECT title FROM games WHERE id = ?').get(payload.gameId) as any;
    logActivity(payload.userId, 'wishlist_add', payload.gameId, game?.title ?? null);
    evaluateAchievements(db, payload.userId);
    return { added: true };
  });

  ipcMain.handle('wishlist:has', (_e, payload: { userId: number; gameId: number }) => {
    return !!db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND game_id = ?').get(payload.userId, payload.gameId);
  });

  // ---------- CART / CHECKOUT ----------
  ipcMain.handle('checkout:purchase', (_e, payload: { userId: number; items: { gameId: number }[]; cardLast4: string; cardBrand: string; pointsToUse?: number; useWallet?: boolean }) => {
    const { userId, items, cardLast4, cardBrand, pointsToUse = 0, useWallet = false } = payload;
    if (!userId) throw new Error('Sesión inválida');
    if (!items?.length) throw new Error('Carrito vacío');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) throw new Error('Usuario no encontrado');
    const wallet = db.prepare('SELECT * FROM wallet WHERE user_id = ?').get(userId) as any;
    const totalSpent = (db.prepare(`SELECT COALESCE(SUM(total),0) as t FROM orders WHERE user_id = ? AND status = 'paid'`).get(userId) as any).t;
    const lvl = userLevel(totalSpent);

    const tx = db.transaction(() => {
      let subtotal = 0;
      const lineItems: { game: any; license: any; price: number; flashId: number | null }[] = [];

      for (const it of items) {
        const game = db.prepare('SELECT * FROM games WHERE id = ?').get(it.gameId) as any;
        if (!game) throw new Error(`Juego ${it.gameId} no existe`);
        if (game.is_preorder) throw new Error(`${game.title} es pre-orden — usa Reservar`);
        const license = db.prepare(
          `SELECT * FROM licenses WHERE game_id = ? AND status = 'available' LIMIT 1`
        ).get(it.gameId) as any;
        if (!license) throw new Error(`${game.title} sin stock`);
        const already = db.prepare(`SELECT id FROM library WHERE user_id = ? AND game_id = ?`).get(userId, it.gameId);
        if (already) throw new Error(`Ya tienes ${game.title} en tu biblioteca`);

        const flash = applyActiveDiscount(db, game);
        let price = flash.flashId ? flash.effectivePrice : game.price_final;
        if (user.is_pro) price = +(price * 0.85).toFixed(2);
        // Loyalty cashback (we'll convert to points later)
        subtotal += price;
        lineItems.push({ game, license, price, flashId: flash.flashId });
      }

      // Apply points discount
      const pointsBalance = (db.prepare(`SELECT COALESCE(SUM(delta),0) as t FROM points_ledger WHERE user_id = ?`).get(userId) as any).t as number;
      const ptsApplied = Math.max(0, Math.min(pointsToUse, pointsBalance));
      const ptsDiscount = +(ptsApplied * POINT_REDEEM_VALUE).toFixed(2);

      // Apply wallet
      const walletApplied = useWallet ? Math.min(wallet?.balance ?? 0, subtotal - ptsDiscount) : 0;

      const total = +Math.max(0, subtotal - ptsDiscount - walletApplied).toFixed(2);

      const orderRes = db.prepare(
        `INSERT INTO orders (user_id, total, currency, payment_method, card_last4, card_brand, status, points_earned, points_used)
         VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?)`
      ).run(userId, total, 'PEN', total > 0 ? 'card' : 'wallet', cardLast4, cardBrand, 0, ptsApplied);
      const orderId = orderRes.lastInsertRowid as number;

      // Earn points: subtotal * loyalty cashback% gives bonus on top of base earn
      const basePts = Math.floor(subtotal * POINTS_PER_PEN);
      const bonusPts = Math.floor(subtotal * (lvl.cashback / 100) * POINTS_PER_PEN);
      const earned = basePts + bonusPts;
      db.prepare('UPDATE orders SET points_earned = ? WHERE id = ?').run(earned, orderId);

      for (const { game, license, price } of lineItems) {
        db.prepare(`INSERT INTO order_items (order_id, game_id, license_id, price) VALUES (?, ?, ?, ?)`)
          .run(orderId, game.id, license.id, price);
        db.prepare(
          `UPDATE licenses SET status = 'sold', user_id = ?, order_id = ?, sold_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(userId, orderId, license.id);
        db.prepare(`UPDATE games SET stock = MAX(stock - 1, 0) WHERE id = ?`).run(game.id);
        db.prepare(`INSERT INTO library (user_id, game_id, license_id) VALUES (?, ?, ?)`)
          .run(userId, game.id, license.id);
        db.prepare(`DELETE FROM wishlist WHERE user_id = ? AND game_id = ?`).run(userId, game.id);
        db.prepare(`INSERT INTO funnel_events (user_id, event, target_id) VALUES (?, 'purchase', ?)`).run(userId, game.id);
        logActivity(userId, 'purchase', game.id, game.title, { price });
      }

      // Spend points
      if (ptsApplied > 0) {
        db.prepare(`INSERT INTO points_ledger (user_id, delta, reason, target_id) VALUES (?, ?, 'redeemed', ?)`)
          .run(userId, -ptsApplied, orderId);
      }
      // Earn points
      if (earned > 0) {
        db.prepare(`INSERT INTO points_ledger (user_id, delta, reason, target_id) VALUES (?, ?, 'purchase', ?)`)
          .run(userId, earned, orderId);
      }
      // Apply wallet
      if (walletApplied > 0) {
        db.prepare(`UPDATE wallet SET balance = balance - ? WHERE user_id = ?`).run(walletApplied, userId);
      }

      return { orderId, earned, ptsApplied, walletApplied, total };
    });

    const { orderId, earned, ptsApplied, walletApplied, total } = tx();
    log.info(`Order ${orderId} placed by user ${userId}, total=${total}, earned=${earned}pts, used=${ptsApplied}pts, wallet=${walletApplied}`);
    const unlocked = evaluateAchievements(db, userId);
    notify('Compra exitosa en Dreitz', `Pedido #${orderId} confirmado · ${items.length} juego${items.length === 1 ? '' : 's'} · +${earned}pts`);
    broadcast('user:changed', { userId });

    // Mirror la orden a Supabase para que Keys vea ventas cross-PC. No bloquea
    // — si falla, la orden local ya está commiteada.
    if (supabase.isEnabled()) {
      const items_rows = db.prepare(`
        SELECT oi.game_id, oi.license_id, oi.price, g.title as title_snapshot
        FROM order_items oi JOIN games g ON g.id = oi.game_id
        WHERE oi.order_id = ?
      `).all(orderId) as any[];
      supabase.pushOrder({
        user_local_id: userId,
        user_username: user.username,
        total,
        card_last4: cardLast4,
        card_brand: cardBrand,
        payment_provider: cardBrand?.includes('culqi') ? 'culqi' : (cardBrand?.includes('stripe') ? 'stripe' : 'card'),
        external_id: '',
        points_earned: earned,
        points_used: ptsApplied,
        promo_code: null,
        items: items_rows
      }).catch(() => {});
    }

    return { orderId, success: true, earned, ptsApplied, walletApplied, unlockedAchievements: unlocked };
  });

  // ---------- LIBRARY ----------
  ipcMain.handle('library:list', (_e, userId: number) => {
    const rows = db.prepare(`
      SELECT g.*, l.code as license_code, l.id as license_id, lib.acquired_at, lib.redeemed,
        oi.id as order_item_id, oi.order_id as order_id
      FROM library lib
      JOIN games g ON g.id = lib.game_id
      LEFT JOIN licenses l ON l.id = lib.license_id
      LEFT JOIN order_items oi ON oi.license_id = lib.license_id
      WHERE lib.user_id = ?
      ORDER BY lib.acquired_at DESC
    `).all(userId);
    return rows.map((r: any) => ({
      ...parseGame(r),
      license_code: r.license_code,
      license_id: r.license_id,
      acquired_at: r.acquired_at,
      redeemed: !!r.redeemed,
      order_id: r.order_id,
      order_item_id: r.order_item_id
    }));
  });

  ipcMain.handle('library:redeem', (_e, payload: { userId: number; licenseId: number }) => {
    const { userId, licenseId } = payload;
    db.prepare(
      `UPDATE licenses SET status = 'redeemed', redeemed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`
    ).run(licenseId, userId);
    db.prepare(
      `UPDATE library SET redeemed = 1 WHERE user_id = ? AND license_id = ?`
    ).run(userId, licenseId);
    evaluateAchievements(db, userId);
    return { success: true };
  });

  // ---------- ORDERS ----------
  ipcMain.handle('orders:list', (_e, userId: number) => {
    return db.prepare(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`
    ).all(userId);
  });

  // ---------- PRO ----------
  ipcMain.handle('pro:subscribe', (_e, payload: { userId: number; plan: 'monthly' | 'annual'; cardLast4: string; cardBrand: string }) => {
    const { userId, plan } = payload;
    const amount = plan === 'monthly' ? 15.0 : 120.0;
    const days = plan === 'monthly' ? 30 : 365;
    const starts = new Date();
    const expires = new Date(starts.getTime() + days * 24 * 60 * 60 * 1000);

    db.prepare(
      `INSERT INTO subscriptions (user_id, plan, amount, currency, starts_at, expires_at, status)
       VALUES (?, ?, ?, 'USD', ?, ?, 'active')`
    ).run(userId, plan, amount, starts.toISOString(), expires.toISOString());

    db.prepare(
      `UPDATE users SET is_pro = 1, pro_plan = ?, pro_expires_at = ? WHERE id = ?`
    ).run(plan, expires.toISOString(), userId);

    logActivity(userId, 'pro_subscribe', null, plan, { amount });
    evaluateAchievements(db, userId);
    notify('Bienvenido a Dreitz Pro', `Plan ${plan === 'monthly' ? 'mensual' : 'anual'} activado.`);
    broadcast('user:changed', { userId });
    return parseUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId));
  });

  ipcMain.handle('pro:cancel', (_e, userId: number) => {
    db.prepare(`UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'`).run(userId);
    db.prepare(`UPDATE users SET is_pro = 0, pro_plan = NULL, pro_expires_at = NULL WHERE id = ?`).run(userId);
    broadcast('user:changed', { userId });
    return parseUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId));
  });

  // ---------- SETTINGS ----------
  ipcMain.handle('settings:get', (_e, userId: number) => {
    let row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as any;
    if (!row) {
      db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(userId);
      row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as any;
    }
    return {
      theme: row.theme,
      accent: row.accent,
      language: row.language,
      currency: row.currency || 'PEN',
      notifications: !!row.notifications,
      sounds: !!row.sounds,
      onboarding_seen: !!row.onboarding_seen,
      reduce_motion: !!row.reduce_motion,
      newsletter: !!row.newsletter,
      colorblind: row.colorblind || 'none'
    };
  });

  ipcMain.handle('settings:update', (_e, payload: { userId: number; key: string; value: any }) => {
    const allowed = ['theme', 'accent', 'language', 'currency', 'notifications', 'sounds', 'onboarding_seen', 'reduce_motion', 'newsletter', 'colorblind'];
    if (!allowed.includes(payload.key)) throw new Error('Setting no permitido');
    let v = payload.value;
    if (['notifications', 'sounds', 'onboarding_seen', 'reduce_motion', 'newsletter'].includes(payload.key)) v = v ? 1 : 0;
    db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(payload.userId);
    db.prepare(`UPDATE user_settings SET ${payload.key} = ? WHERE user_id = ?`).run(v, payload.userId);
    const row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(payload.userId) as any;
    const settings = {
      theme: row.theme,
      accent: row.accent,
      language: row.language,
      currency: row.currency || 'PEN',
      notifications: !!row.notifications,
      sounds: !!row.sounds,
      onboarding_seen: !!row.onboarding_seen,
      reduce_motion: !!row.reduce_motion,
      newsletter: !!row.newsletter,
      colorblind: row.colorblind || 'none'
    };
    broadcast('settings:changed', { userId: payload.userId, key: payload.key, settings });
    return { success: true, settings };
  });

  // ---------- ACHIEVEMENTS ----------
  ipcMain.handle('achievements:list', (_e, userId: number) => {
    const unlocked = db.prepare('SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC').all(userId) as any[];
    const unlockedSet = new Set(unlocked.map((a: any) => a.code));
    return ACHIEVEMENTS.map((a) => ({
      code: a.code,
      title: a.title,
      description: a.description,
      unlocked: unlockedSet.has(a.code),
      unlocked_at: unlocked.find((u) => u.code === a.code)?.unlocked_at ?? null
    }));
  });

  ipcMain.handle('achievements:profileStats', (_e, userId: number) => {
    const totalSpent = (db.prepare(`SELECT COALESCE(SUM(total),0) as t FROM orders WHERE user_id = ? AND status='paid'`).get(userId) as any).t;
    const games = (db.prepare('SELECT COUNT(*) as c FROM library WHERE user_id = ?').get(userId) as any).c;
    const redeemed = (db.prepare('SELECT COUNT(*) as c FROM library WHERE user_id = ? AND redeemed=1').get(userId) as any).c;
    const unlocked = (db.prepare('SELECT COUNT(*) as c FROM achievements WHERE user_id = ?').get(userId) as any).c;
    const wishlist = (db.prepare('SELECT COUNT(*) as c FROM wishlist WHERE user_id = ?').get(userId) as any).c;
    const points = (db.prepare(`SELECT COALESCE(SUM(delta),0) as t FROM points_ledger WHERE user_id = ?`).get(userId) as any).t;
    const lvl = userLevel(totalSpent);
    return { total_spent: totalSpent, games, redeemed, unlocked, total_achievements: ACHIEVEMENTS.length, wishlist, points, level: lvl };
  });

  // ---------- ACTIVITY FEED ----------
  ipcMain.handle('activity:list', (_e, payload: { userId?: number; limit?: number; global?: boolean }) => {
    const limit = payload.limit ?? 20;
    if (payload.global) {
      return db.prepare(`
        SELECT a.*, u.username FROM activity_feed a
        JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT ?
      `).all(limit);
    }
    if (!payload.userId) return [];
    return db.prepare(`
      SELECT a.*, u.username FROM activity_feed a
      JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC LIMIT ?
    `).all(payload.userId, limit);
  });

  // ---------- BUNDLES ----------
  ipcMain.handle('bundles:list', () => {
    const bundles = db.prepare('SELECT * FROM bundles ORDER BY created_at DESC').all() as any[];
    return bundles.map((b) => ({
      ...b,
      games: db.prepare(`
        SELECT g.* FROM bundle_games bg JOIN games g ON g.id = bg.game_id
        WHERE bg.bundle_id = ? AND g.is_active = 1
      `).all(b.id).map(parseGame)
    }));
  });

  // ---------- PROMOTIONS ----------
  ipcMain.handle('promotions:active', () => {
    const now = new Date().toISOString();
    const rows = db.prepare(`
      SELECT * FROM promotions
      WHERE is_active = 1
        AND (starts_at IS NULL OR starts_at <= ?)
        AND (ends_at IS NULL OR ends_at > ?)
      ORDER BY priority DESC, created_at DESC
    `).all(now, now) as any[];
    return rows.map((p) => ({
      ...p,
      games: db.prepare(`
        SELECT g.* FROM promotion_games pg JOIN games g ON g.id = pg.game_id
        WHERE pg.promotion_id = ? AND g.is_active = 1 LIMIT 12
      `).all(p.id).map(parseGame)
    }));
  });

  ipcMain.handle('flashSales:dailyDeal', () => {
    const now = new Date().toISOString();
    const row = db.prepare(`
      SELECT fs.*, g.* FROM flash_sales fs
      JOIN games g ON g.id = fs.game_id
      WHERE fs.is_daily_deal = 1 AND fs.ends_at > ? AND fs.starts_at <= ?
      ORDER BY fs.created_at DESC LIMIT 1
    `).get(now, now) as any;
    if (!row) return null;
    const sold = (db.prepare(`SELECT COUNT(*) as c FROM order_items WHERE game_id = ? AND order_id IN (SELECT id FROM orders WHERE created_at >= ?)`).get(row.game_id, row.starts_at) as any).c;
    const game = parseGame(row);
    const effective = +(game.price_initial * (1 - row.discount_percent / 100)).toFixed(2);
    return {
      flash_id: row.id,
      discount_percent: row.discount_percent,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      max_units: row.max_units,
      units_left: row.max_units ? Math.max(0, row.max_units - sold) : null,
      effective_price: effective,
      game
    };
  });

  ipcMain.handle('flashSales:active', () => {
    const now = new Date().toISOString();
    const rows = db.prepare(`
      SELECT fs.*, g.id as game_id_alias, g.title FROM flash_sales fs
      JOIN games g ON g.id = fs.game_id
      WHERE fs.ends_at > ? AND fs.starts_at <= ?
      ORDER BY fs.ends_at ASC
    `).all(now, now);
    return rows;
  });

  // ---------- REVIEWS ----------
  ipcMain.handle('reviews:list', (_e, gameId: number) => {
    return db.prepare(`
      SELECT r.*, u.username FROM reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.game_id = ?
      ORDER BY r.created_at DESC LIMIT 50
    `).all(gameId);
  });

  ipcMain.handle('reviews:summary', (_e, gameId: number) => {
    const r = db.prepare(`SELECT COUNT(*) as c, AVG(rating) as avg FROM reviews WHERE game_id = ?`).get(gameId) as any;
    return { count: r.c, average: r.avg ? +r.avg.toFixed(2) : null };
  });

  ipcMain.handle('reviews:create', (_e, payload: { userId: number; gameId: number; rating: number; title?: string; body?: string }) => {
    if (payload.rating < 1 || payload.rating > 5) throw new Error('Rating debe estar entre 1 y 5');
    const owns = db.prepare(`SELECT id FROM library WHERE user_id = ? AND game_id = ?`).get(payload.userId, payload.gameId);
    if (!owns) throw new Error('Solo puedes reseñar juegos que has comprado');
    db.prepare(`
      INSERT INTO reviews (user_id, game_id, rating, title, body) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, game_id) DO UPDATE SET rating=excluded.rating, title=excluded.title, body=excluded.body, created_at=CURRENT_TIMESTAMP
    `).run(payload.userId, payload.gameId, payload.rating, payload.title || null, payload.body || null);
    return { success: true };
  });

  ipcMain.handle('reviews:mine', (_e, payload: { userId: number; gameId: number }) => {
    return db.prepare('SELECT * FROM reviews WHERE user_id = ? AND game_id = ?').get(payload.userId, payload.gameId) ?? null;
  });

  // ---------- POINTS ----------
  ipcMain.handle('points:balance', (_e, userId: number) => {
    const r = db.prepare(`SELECT COALESCE(SUM(delta),0) as t FROM points_ledger WHERE user_id = ?`).get(userId) as any;
    return { balance: r.t, redeem_value: POINT_REDEEM_VALUE };
  });

  ipcMain.handle('points:ledger', (_e, payload: { userId: number; limit?: number }) => {
    return db.prepare(`SELECT * FROM points_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
      .all(payload.userId, payload.limit ?? 30);
  });

  // ---------- WALLET ----------
  ipcMain.handle('wallet:get', (_e, userId: number) => {
    const w = db.prepare('SELECT * FROM wallet WHERE user_id = ?').get(userId) as any;
    return w ?? { user_id: userId, balance: 0, currency: 'PEN' };
  });

  // Recargar wallet con Yape — se valida con la misma IA que checkout (yape.ts).
  // Después acredita el balance. Frictionless porque ya no pasa por carrito.
  ipcMain.handle('wallet:recharge', async (_e, payload: { userId: number; amount: number; receiptDataUrl: string }) => {
    if (!payload.amount || payload.amount <= 0) throw new Error('Monto inválido');
    if (!payload.receiptDataUrl) throw new Error('Sube el screenshot del Yape');
    // Reusamos `verifyYapeReceipt` que la pantalla de checkout también usa
    const verified = await yape.verifyYapeReceipt({
      receiptDataUrl: payload.receiptDataUrl,
      expectedAmount: payload.amount,
      currency: 'PEN'
    });
    if (!verified.ok) throw new Error(verified.reason ?? 'Yape no validado');
    db.prepare(`INSERT OR IGNORE INTO wallet (user_id, balance) VALUES (?, 0)`).run(payload.userId);
    db.prepare(`UPDATE wallet SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(payload.amount, payload.userId);
    const w = db.prepare('SELECT * FROM wallet WHERE user_id = ?').get(payload.userId) as any;
    return { ok: true, balance: w.balance };
  });

  // Referidos: cuando un usuario nuevo usa el ref_code de otro al registrarse,
  // ambos reciben S/. 10 en wallet — pero SOLO cuando el nuevo hace su primera
  // compra (anti-abuso). Esta llamada se dispara en `checkout:purchase`.
  ipcMain.handle('referrals:claimFirstPurchase', (_e, userId: number) => {
    const u = db.prepare('SELECT id, ref_used FROM users WHERE id = ?').get(userId) as any;
    if (!u?.ref_used) return { ok: false, reason: 'no-ref' };
    const inviter = db.prepare('SELECT id FROM users WHERE ref_code = ?').get(u.ref_used) as any;
    if (!inviter) return { ok: false, reason: 'invalid-ref' };
    // Verificar que no se haya canjeado antes
    const already = db.prepare(`
      SELECT id FROM activity_feed WHERE user_id = ? AND kind = 'referral_bonus_claimed'
    `).get(userId) as any;
    if (already) return { ok: false, reason: 'already-claimed' };
    const tx = db.transaction(() => {
      for (const uid of [userId, inviter.id]) {
        db.prepare(`INSERT OR IGNORE INTO wallet (user_id, balance) VALUES (?, 0)`).run(uid);
        db.prepare(`UPDATE wallet SET balance = balance + 10 WHERE user_id = ?`).run(uid);
        db.prepare(`INSERT INTO activity_feed (user_id, kind, target_label) VALUES (?, 'referral_bonus_claimed', 'S/. 10')`).run(uid);
      }
    });
    tx();
    return { ok: true, amount: 10 };
  });

  // Ranking semanal por familia — horas jugadas en los últimos 7 días por
  // cada miembro de la misma `family_id`. Lo consume FamilyCompetition.tsx.
  ipcMain.handle('family:weeklyRanking', (_e, userId: number) => {
    const u = db.prepare('SELECT family_id FROM users WHERE id = ?').get(userId) as any;
    if (!u?.family_id) return [];
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return db.prepare(`
      SELECT u.id AS user_id, u.username, COALESCE(SUM(p.minutes), 0) AS minutes
      FROM users u
      LEFT JOIN playtime p ON p.user_id = u.id AND p.started_at >= ?
      WHERE u.family_id = ?
      GROUP BY u.id, u.username
      ORDER BY minutes DESC
      LIMIT 20
    `).all(since, u.family_id);
  });

  // Feature flags — admin puede toggle features sin re-release
  ipcMain.handle('flags:list', () => featureFlags.listFlags());
  ipcMain.handle('flags:get', (_e, key: string) => featureFlags.isFlagOn(key, false));
  ipcMain.handle('flags:set', (_e, payload: { key: string; on: boolean }) => {
    featureFlags.setFlag(payload.key, payload.on);
    return { ok: true };
  });

  // Discord Rich Presence — opcional, no-op si Discord no está abierto
  ipcMain.handle('discord:setActivity', (_e, activity: any) => {
    try { discord.setDiscordActivity(activity); } catch {}
    return { ok: true };
  });

  // ---------- GIFT CARDS ----------
  ipcMain.handle('giftCards:catalog', () => {
    return [
      { amount: 50, label: 'Tarjeta S/. 50', accent: '#00d4ff' },
      { amount: 100, label: 'Tarjeta S/. 100', accent: '#a855ff' },
      { amount: 200, label: 'Tarjeta S/. 200', accent: '#ffa632' },
      { amount: 500, label: 'Tarjeta S/. 500', accent: '#38e07b' }
    ];
  });

  ipcMain.handle('giftCards:purchase', (_e, payload: { userId: number; amount: number; cardLast4: string; cardBrand: string }) => {
    const allowed = [50, 100, 200, 500];
    if (!allowed.includes(payload.amount)) throw new Error('Monto no permitido');
    const code = `GC-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    db.prepare(`INSERT INTO gift_cards (code, amount, currency, buyer_id, status, sold_at) VALUES (?, ?, 'PEN', ?, 'sold', CURRENT_TIMESTAMP)`)
      .run(code, payload.amount, payload.userId);
    db.prepare(`INSERT INTO orders (user_id, total, currency, payment_method, card_last4, card_brand, status, points_earned)
      VALUES (?, ?, 'PEN', 'card', ?, ?, 'paid', 0)`).run(payload.userId, payload.amount, payload.cardLast4, payload.cardBrand);
    logActivity(payload.userId, 'gift_card_purchase', null, `Tarjeta S/. ${payload.amount}`);
    notify('Tarjeta de regalo comprada', `Código: ${code}`);
    return { code, amount: payload.amount };
  });

  ipcMain.handle('giftCards:redeem', (_e, payload: { userId: number; code: string }) => {
    const code = payload.code.trim().toUpperCase();
    const card = db.prepare(`SELECT * FROM gift_cards WHERE code = ?`).get(code) as any;
    if (!card) throw new Error('Código no válido');
    if (card.status === 'redeemed') throw new Error('Esta tarjeta ya fue canjeada');
    if (card.buyer_id === payload.userId && card.status !== 'sold') throw new Error('No puedes canjear una tarjeta que no se ha comprado');
    db.prepare(`UPDATE gift_cards SET status = 'redeemed', redeemer_id = ?, redeemed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(payload.userId, card.id);
    db.prepare(`INSERT OR IGNORE INTO wallet (user_id, balance) VALUES (?, 0)`).run(payload.userId);
    db.prepare(`UPDATE wallet SET balance = balance + ? WHERE user_id = ?`).run(card.amount, payload.userId);
    notify('Tarjeta canjeada', `+S/. ${card.amount} a tu billetera`);
    logActivity(payload.userId, 'gift_card_redeem', null, `+S/. ${card.amount}`);
    broadcast('user:changed', { userId: payload.userId });
    return { amount: card.amount };
  });

  ipcMain.handle('giftCards:mine', (_e, userId: number) => {
    return db.prepare(`SELECT * FROM gift_cards WHERE buyer_id = ? OR redeemer_id = ? ORDER BY created_at DESC`).all(userId, userId);
  });

  // ---------- CURRENCY ----------
  ipcMain.handle('currency:rates', () => {
    return db.prepare(`SELECT * FROM currency_rates ORDER BY code`).all();
  });

  // ---------- COLLECTIONS ----------
  ipcMain.handle('collections:list', () => {
    const cols = db.prepare(`SELECT * FROM collections WHERE is_published = 1 ORDER BY created_at DESC`).all() as any[];
    return cols.map((c) => ({
      ...c,
      games: db.prepare(`
        SELECT g.* FROM collection_games cg JOIN games g ON g.id = cg.game_id
        WHERE cg.collection_id = ? AND g.is_active = 1
        ORDER BY cg.ord ASC
      `).all(c.id).map(parseGame)
    }));
  });

  ipcMain.handle('collections:get', (_e, slug: string) => {
    const coll = db.prepare(`SELECT * FROM collections WHERE slug = ? AND is_published = 1`).get(slug) as any;
    if (!coll) return null;
    coll.games = db.prepare(`
      SELECT g.* FROM collection_games cg JOIN games g ON g.id = cg.game_id
      WHERE cg.collection_id = ? AND g.is_active = 1
      ORDER BY cg.ord ASC
    `).all(coll.id).map(parseGame);
    return coll;
  });

  // ---------- REFERRALS ----------
  ipcMain.handle('referrals:summary', (_e, userId: number) => {
    const u = db.prepare('SELECT ref_code FROM users WHERE id = ?').get(userId) as any;
    const referredCount = (db.prepare(`SELECT COUNT(*) as c FROM users WHERE ref_used = ?`).get(u?.ref_code) as any).c;
    const ptsFromReferrals = (db.prepare(`SELECT COALESCE(SUM(delta),0) as t FROM points_ledger WHERE user_id = ? AND reason = 'referral_bonus'`).get(userId) as any).t;
    return { code: u?.ref_code ?? null, referred: referredCount, points_earned: ptsFromReferrals };
  });

  // ---------- REFUNDS ----------
  // Política automática estilo Steam:
  //   - Compra <14 días atrás Y playtime <120 minutos → AUTO-APPROVED
  //   - Compra >14 días o playtime >120 min → manual review (pending)
  // Esto da confianza al usuario (refund instantáneo en casos claros) sin
  // abrir la puerta a abusos.
  const REFUND_POLICY = { maxDaysSincePurchase: 14, maxPlaytimeMinutes: 120 };

  function evaluateRefundEligibility(userId: number, orderItemId: number): {
    eligible: boolean;
    autoApprove: boolean;
    daysSincePurchase: number;
    playtimeMinutes: number;
    reason: string;
  } {
    const item = db.prepare(`
      SELECT oi.*, o.created_at as purchased_at, oi.game_id FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = ? AND o.user_id = ?
    `).get(orderItemId, userId) as any;
    if (!item) return { eligible: false, autoApprove: false, daysSincePurchase: 0, playtimeMinutes: 0, reason: 'Pedido no encontrado' };

    const days = Math.floor((Date.now() - new Date(item.purchased_at).getTime()) / 86400000);
    const playtime = (db.prepare(`SELECT COALESCE(SUM(minutes_played), 0) as t FROM playtime_sessions WHERE user_id = ? AND game_id = ?`).get(userId, item.game_id) as any)?.t ?? 0;

    if (days <= REFUND_POLICY.maxDaysSincePurchase && playtime <= REFUND_POLICY.maxPlaytimeMinutes) {
      return { eligible: true, autoApprove: true, daysSincePurchase: days, playtimeMinutes: playtime, reason: 'Cumple política — reembolso automático' };
    }
    if (days > REFUND_POLICY.maxDaysSincePurchase) {
      return { eligible: true, autoApprove: false, daysSincePurchase: days, playtimeMinutes: playtime, reason: `Compra hace ${days} días (>14) — review manual` };
    }
    return { eligible: true, autoApprove: false, daysSincePurchase: days, playtimeMinutes: playtime, reason: `Playtime ${playtime} min (>120) — review manual` };
  }

  ipcMain.handle('refunds:checkEligibility', (_e, payload: { userId: number; orderItemId: number }) => {
    return { ...evaluateRefundEligibility(payload.userId, payload.orderItemId), policy: REFUND_POLICY };
  });

  ipcMain.handle('refunds:request', (_e, payload: { userId: number; orderId: number; orderItemId: number; reason: string }) => {
    const item = db.prepare(`
      SELECT oi.* FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = ? AND o.user_id = ?
    `).get(payload.orderItemId, payload.userId) as any;
    if (!item) throw new Error('Pedido no encontrado');
    const exists = db.prepare(`SELECT id FROM refund_requests WHERE order_item_id = ? AND status != 'rejected'`).get(payload.orderItemId);
    if (exists) throw new Error('Ya existe una solicitud para este pedido');

    const eligibility = evaluateRefundEligibility(payload.userId, payload.orderItemId);
    const initialStatus = eligibility.autoApprove ? 'approved' : 'pending';

    db.prepare(`INSERT INTO refund_requests (user_id, order_id, order_item_id, reason, status) VALUES (?, ?, ?, ?, ?)`)
      .run(payload.userId, payload.orderId, payload.orderItemId, payload.reason, initialStatus);

    // Si auto-aprobado: devolver el dinero al wallet y remover de la biblioteca
    if (eligibility.autoApprove) {
      // Reembolsar al wallet
      db.prepare(`UPDATE wallets SET balance = balance + ? WHERE user_id = ?`).run(item.price, payload.userId);
      // Remover de la biblioteca (si existe)
      db.prepare(`DELETE FROM library WHERE user_id = ? AND game_id = ?`).run(payload.userId, item.game_id);
      // Liberar la key (volver a 'available')
      db.prepare(`UPDATE licenses SET status = 'available', user_id = NULL WHERE game_id = ? AND user_id = ?`).run(item.game_id, payload.userId);
    }

    return { success: true, autoApproved: eligibility.autoApprove, reason: eligibility.reason };
  });

  ipcMain.handle('refunds:mine', (_e, userId: number) => {
    return db.prepare(`
      SELECT r.*, oi.price, g.title as game_title FROM refund_requests r
      JOIN order_items oi ON oi.id = r.order_item_id
      JOIN games g ON g.id = oi.game_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(userId);
  });

  // ---------- THEME ----------
  ipcMain.handle('theme:system', () => ({
    shouldUseDark: nativeTheme.shouldUseDarkColors
  }));

  // ---------- NOTIFICATIONS ----------
  ipcMain.handle('notify:show', (_e, payload: { title: string; body: string }) => {
    notify(payload.title, payload.body);
    return { success: true };
  });

  // ---------- AUTO-UPDATER ----------
  ipcMain.handle('updater:check', async () => {
    return autoUpdate.checkNow();
  });

  // ---------- STEAM ----------
  ipcMain.handle('steam:fetch', async (_e, urlOrId: string) => {
    return await fetchSteamGame(urlOrId);
  });

  // ---------- FUNNEL EVENT (renderer-emitted) ----------
  ipcMain.handle('funnel:emit', (_e, payload: { userId?: number; event: string; targetId?: number }) => {
    db.prepare(`INSERT INTO funnel_events (user_id, event, target_id) VALUES (?, ?, ?)`).run(payload.userId ?? null, payload.event, payload.targetId ?? null);
    return { success: true };
  });

  // ============================================================================
  // INSTALL / LAUNCH (Steam-style)
  // ============================================================================
  ipcMain.handle('install:list', (_e, userId: number) => launcher.listInstalls(userId));
  ipcMain.handle('install:status', (_e, payload: { userId: number; gameId: number }) => launcher.getInstall(payload.userId, payload.gameId));
  ipcMain.handle('install:start', async (_e, payload: { userId: number; gameId: number }) => launcher.startInstall(payload.userId, payload.gameId));
  ipcMain.handle('install:markSteamInstalled', (_e, payload: { userId: number; gameId: number }) => launcher.markSteamInstalled(payload.userId, payload.gameId));
  ipcMain.handle('install:setStandalonePath', async (_e, payload: { userId: number; gameId: number }) => {
    const r = await dialog.showOpenDialog({ title: 'Selecciona el ejecutable', filters: [{ name: 'Ejecutable', extensions: ['exe'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return { success: false };
    return launcher.setStandalonePath(payload.userId, payload.gameId, r.filePaths[0]);
  });
  ipcMain.handle('install:uninstall', (_e, payload: { userId: number; gameId: number }) => launcher.uninstall(payload.userId, payload.gameId));
  ipcMain.handle('install:openFolder', (_e, payload: { userId: number; gameId: number }) => launcher.openInstallFolder(payload.userId, payload.gameId));
  ipcMain.handle('launch:run', async (_e, payload: { userId: number; gameId: number }) => launcher.launch(payload.userId, payload.gameId));
  ipcMain.handle('launch:stop', (_e, payload: { userId: number; gameId: number }) => launcher.recordPlayStop(payload.userId, payload.gameId));

  // ============================================================================
  // PC COMPATIBILITY CHECK
  // ============================================================================
  ipcMain.handle('pc:specs', () => {
    const cpus = os.cpus();
    return {
      cpu: cpus[0]?.model ?? 'Unknown CPU',
      cores: cpus.length,
      cpu_speed_mhz: cpus[0]?.speed ?? 0,
      ram_gb: +(os.totalmem() / 1024 ** 3).toFixed(1),
      free_ram_gb: +(os.freemem() / 1024 ** 3).toFixed(1),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release()
    };
  });

  ipcMain.handle('pc:checkGame', (_e, gameId: number) => {
    const g = db.prepare('SELECT pc_requirements_min FROM games WHERE id = ?').get(gameId) as any;
    if (!g?.pc_requirements_min) return null;
    const text = (g.pc_requirements_min as string).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').toLowerCase();
    // Very simple parser
    const ramMatch = text.match(/(\d+)\s*gb\s*(?:de\s*)?ram/) || text.match(/ram[:\s-]+(\d+)\s*gb/);
    const minRam = ramMatch ? parseInt(ramMatch[1]) : 0;

    const ramOk = os.totalmem() / 1024 ** 3 >= minRam;
    const cpus = os.cpus();
    const cpuSpeedGhz = (cpus[0]?.speed ?? 0) / 1000;
    const cpuSpeedOk = cpuSpeedGhz >= 2.0;

    return {
      min_ram_gb: minRam,
      your_ram_gb: +(os.totalmem() / 1024 ** 3).toFixed(1),
      ram_ok: ramOk,
      cpu_speed_ghz: cpuSpeedGhz,
      cpu_ok: cpuSpeedOk,
      cores: cpus.length,
      verdict: ramOk && cpuSpeedOk ? 'ok' : ramOk || cpuSpeedOk ? 'partial' : 'low',
      cpu_name: cpus[0]?.model ?? ''
    };
  });

  // ============================================================================
  // FRIENDS
  // ============================================================================
  ipcMain.handle('friends:findByCode', (_e, refCode: string) => {
    const u = db.prepare(`SELECT id, username, ref_code, avatar, is_pro, country FROM users WHERE ref_code = ?`).get(refCode.trim().toUpperCase()) as any;
    return u ? { id: u.id, username: u.username, ref_code: u.ref_code, avatar: u.avatar, is_pro: !!u.is_pro, country: u.country } : null;
  });

  ipcMain.handle('friends:request', (_e, payload: { fromId: number; toRefCode: string; message?: string }) => {
    const target = db.prepare(`SELECT id, username FROM users WHERE ref_code = ?`).get(payload.toRefCode.trim().toUpperCase()) as any;
    if (!target) throw new Error('Código de amigo no encontrado');
    if (target.id === payload.fromId) throw new Error('No puedes auto-agregarte');
    const already = db.prepare(`
      SELECT 1 FROM friendships WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)
    `).get(Math.min(payload.fromId, target.id), Math.max(payload.fromId, target.id), Math.min(payload.fromId, target.id), Math.max(payload.fromId, target.id));
    if (already) throw new Error('Ya son amigos');
    db.prepare(`INSERT OR REPLACE INTO friend_requests (from_id, to_id, message, status) VALUES (?, ?, ?, 'pending')`)
      .run(payload.fromId, target.id, payload.message ?? null);
    return { success: true, target_username: target.username };
  });

  ipcMain.handle('friends:incoming', (_e, userId: number) => {
    return db.prepare(`
      SELECT fr.*, u.username, u.ref_code FROM friend_requests fr
      JOIN users u ON u.id = fr.from_id
      WHERE fr.to_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `).all(userId);
  });

  ipcMain.handle('friends:respond', (_e, payload: { userId: number; requestId: number; accept: boolean }) => {
    const fr = db.prepare(`SELECT * FROM friend_requests WHERE id = ? AND to_id = ?`).get(payload.requestId, payload.userId) as any;
    if (!fr) throw new Error('Solicitud no encontrada');
    db.prepare(`UPDATE friend_requests SET status = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(payload.accept ? 'accepted' : 'rejected', payload.requestId);
    if (payload.accept) {
      const a = Math.min(fr.from_id, fr.to_id);
      const b = Math.max(fr.from_id, fr.to_id);
      db.prepare(`INSERT OR IGNORE INTO friendships (user_a, user_b) VALUES (?, ?)`).run(a, b);
    }
    return { success: true };
  });

  ipcMain.handle('friends:list', (_e, userId: number) => {
    return db.prepare(`
      SELECT u.id, u.username, u.ref_code, u.avatar, u.is_pro, u.country, f.created_at
      FROM friendships f
      JOIN users u ON (u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END)
      WHERE f.user_a = ? OR f.user_b = ?
      ORDER BY u.username
    `).all(userId, userId, userId).map((u: any) => ({ ...u, is_pro: !!u.is_pro }));
  });

  ipcMain.handle('friends:remove', (_e, payload: { userId: number; friendId: number }) => {
    const a = Math.min(payload.userId, payload.friendId);
    const b = Math.max(payload.userId, payload.friendId);
    db.prepare(`DELETE FROM friendships WHERE user_a = ? AND user_b = ?`).run(a, b);
    db.prepare(`DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)`)
      .run(payload.userId, payload.friendId, payload.friendId, payload.userId);
    return { success: true };
  });

  ipcMain.handle('friends:library', (_e, payload: { userId: number; friendId: number }) => {
    const a = Math.min(payload.userId, payload.friendId);
    const b = Math.max(payload.userId, payload.friendId);
    const ok = db.prepare(`SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?`).get(a, b);
    if (!ok) throw new Error('No son amigos');
    return db.prepare(`
      SELECT g.*, lib.acquired_at FROM library lib
      JOIN games g ON g.id = lib.game_id
      WHERE lib.user_id = ? AND g.is_active = 1
      ORDER BY lib.acquired_at DESC
    `).all(payload.friendId).map(parseGame);
  });

  ipcMain.handle('friends:profile', (_e, payload: { userId: number; friendId: number }) => {
    const a = Math.min(payload.userId, payload.friendId);
    const b = Math.max(payload.userId, payload.friendId);
    const ok = db.prepare(`SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?`).get(a, b);
    if (!ok) throw new Error('No son amigos');
    const u = db.prepare(`SELECT id, username, country, is_pro, created_at, ref_code, avatar FROM users WHERE id = ?`).get(payload.friendId) as any;
    if (!u) throw new Error('Usuario no encontrado');
    const games = (db.prepare(`SELECT COUNT(*) as c FROM library WHERE user_id = ?`).get(payload.friendId) as any).c;
    const ach = (db.prepare(`SELECT COUNT(*) as c FROM achievements WHERE user_id = ?`).get(payload.friendId) as any).c;
    const stickers = (db.prepare(`SELECT COUNT(*) as c FROM stickers WHERE user_id = ?`).get(payload.friendId) as any).c;
    return { ...u, is_pro: !!u.is_pro, games, achievements: ach, stickers };
  });

  // ============================================================================
  // DAILY MISSIONS
  // ============================================================================
  ipcMain.handle('missions:today', (_e, userId: number) => getTodayMissions(db, userId));
  ipcMain.handle('missions:claim', (_e, payload: { userId: number; missionId: number }) => claimMission(db, payload.userId, payload.missionId));

  // ============================================================================
  // STICKERS
  // ============================================================================
  ipcMain.handle('stickers:mine', (_e, userId: number) => getStickers(db, userId));

  // ============================================================================
  // YEAR WRAPPED
  // ============================================================================
  ipcMain.handle('wrapped:get', (_e, payload: { userId: number; year?: number }) => {
    const year = payload.year ?? new Date().getFullYear();
    const start = `${year}-01-01T00:00:00.000Z`;
    const end = `${year + 1}-01-01T00:00:00.000Z`;
    const totalSpent = (db.prepare(`SELECT COALESCE(SUM(total),0) as t FROM orders WHERE user_id = ? AND status = 'paid' AND created_at >= ? AND created_at < ?`).get(payload.userId, start, end) as any).t;
    const games = (db.prepare(`SELECT COUNT(*) as c FROM library WHERE user_id = ? AND acquired_at >= ? AND acquired_at < ?`).get(payload.userId, start, end) as any).c;
    const reviews = (db.prepare(`SELECT COUNT(*) as c FROM reviews WHERE user_id = ? AND created_at >= ? AND created_at < ?`).get(payload.userId, start, end) as any).c;
    const wishlistAdded = (db.prepare(`SELECT COUNT(*) as c FROM activity_feed WHERE user_id = ? AND kind = 'wishlist_add' AND created_at >= ? AND created_at < ?`).get(payload.userId, start, end) as any).c;

    const topGenres = db.prepare(`
      SELECT g.genres FROM library lib JOIN games g ON g.id = lib.game_id
      WHERE lib.user_id = ? AND lib.acquired_at >= ? AND lib.acquired_at < ?
    `).all(payload.userId, start, end) as any[];
    const genreCount = new Map<string, number>();
    for (const r of topGenres) {
      try {
        const arr = JSON.parse(r.genres || '[]');
        for (const g of arr) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
      } catch {}
    }
    const top3Genres = Array.from(genreCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g, c]) => ({ genre: g, count: c }));

    const mostExpensive = db.prepare(`
      SELECT g.title, oi.price FROM order_items oi
      JOIN orders o ON o.id = oi.order_id AND o.user_id = ?
      JOIN games g ON g.id = oi.game_id
      WHERE o.created_at >= ? AND o.created_at < ?
      ORDER BY oi.price DESC LIMIT 1
    `).get(payload.userId, start, end) as any;

    const monthly = [];
    for (let m = 0; m < 12; m++) {
      const ms = new Date(Date.UTC(year, m, 1)).toISOString();
      const me = new Date(Date.UTC(year, m + 1, 1)).toISOString();
      const r = db.prepare(`SELECT COALESCE(SUM(total),0) as t, COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'paid' AND created_at >= ? AND created_at < ?`).get(payload.userId, ms, me) as any;
      monthly.push({ month: m + 1, revenue: r.t, orders: r.c });
    }

    return {
      year, total_spent: totalSpent, games_acquired: games, reviews_written: reviews,
      wishlist_added: wishlistAdded, top_genres: top3Genres,
      most_expensive: mostExpensive ? { title: mostExpensive.title, price: mostExpensive.price } : null,
      monthly
    };
  });

  // ============================================================================
  // PRICE ALERTS
  // ============================================================================
  ipcMain.handle('priceAlerts:list', (_e, userId: number) => {
    return db.prepare(`
      SELECT pa.*, g.title, g.capsule_image, g.price_final FROM price_alerts pa
      JOIN games g ON g.id = pa.game_id
      WHERE pa.user_id = ? ORDER BY pa.created_at DESC
    `).all(userId);
  });
  ipcMain.handle('priceAlerts:set', (_e, payload: { userId: number; gameId: number; targetPrice: number | null }) => {
    db.prepare(`
      INSERT INTO price_alerts (user_id, game_id, target_price, last_known_price)
      VALUES (?, ?, ?, (SELECT price_final FROM games WHERE id = ?))
      ON CONFLICT(user_id, game_id) DO UPDATE SET target_price = excluded.target_price
    `).run(payload.userId, payload.gameId, payload.targetPrice, payload.gameId);
    return { success: true };
  });
  ipcMain.handle('priceAlerts:remove', (_e, payload: { userId: number; gameId: number }) => {
    db.prepare(`DELETE FROM price_alerts WHERE user_id = ? AND game_id = ?`).run(payload.userId, payload.gameId);
    return { success: true };
  });

  // ============================================================================
  // PLUGINS
  // ============================================================================
  ipcMain.handle('plugins:list', () => plugins.listPlugins());
  ipcMain.handle('plugins:setEnabled', (_e, payload: { slug: string; enabled: boolean }) => plugins.setEnabled(payload.slug, payload.enabled));
  ipcMain.handle('plugins:enabledCss', () => plugins.getEnabledCss());
  ipcMain.handle('plugins:openFolder', () => {
    require('electron').shell.openPath(plugins.getPluginsDir());
    return { success: true };
  });

  // Trigger sticker eval after purchases happen via existing checkout handler — we override it via wrapper hook here:
  // Simpler: expose explicit endpoint
  ipcMain.handle('stickers:evaluate', (_e, userId: number) => {
    evaluateMetaStickers(db, userId);
    // Also unlock per-game stickers for everything in the user's library
    const libGames = db.prepare(`SELECT game_id FROM library WHERE user_id = ?`).all(userId) as any[];
    for (const g of libGames) unlockGameSticker(db, userId, g.game_id);
    return { success: true };
  });

  // ============================================================================
  // AVATAR (custom upload OR pick from owned game capsule)
  // ============================================================================
  ipcMain.handle('avatar:set', (_e, payload: { userId: number; value: string | null }) => {
    // value is one of:
    //   null              → clear (use initial fallback)
    //   "data:image/..."  → custom uploaded (base64)
    //   "game:<id>"       → resolved here to the capsule_image URL of that owned game
    //   any URL           → stored as-is
    let stored: string | null = payload.value ?? null;
    if (stored && stored.startsWith('game:')) {
      const gid = parseInt(stored.slice(5), 10);
      const owns = db.prepare('SELECT id FROM library WHERE user_id = ? AND game_id = ?').get(payload.userId, gid);
      if (!owns) throw new Error('Solo puedes usar avatar de un juego que tengas en biblioteca');
      const game = db.prepare('SELECT capsule_image, header_image FROM games WHERE id = ?').get(gid) as any;
      stored = game?.capsule_image || game?.header_image || null;
    }
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(stored, payload.userId);
    broadcast('user:changed', { userId: payload.userId });
    return { success: true, stored };
  });

  // ============================================================================
  // STEAM AUTO-DETECT
  // ============================================================================
  ipcMain.handle('steam:scan', () => steamDetect.refreshSteamCache());
  ipcMain.handle('steam:list', () => steamDetect.listDetectedFromCache());
  ipcMain.handle('steam:isOwned', (_e, steamAppId: number) => steamDetect.isOwnedOnSteam(steamAppId));
  ipcMain.handle('steam:launch', (_e, steamAppId: number) => steamDetect.launchSteamGame(steamAppId));

  // ============================================================================
  // DOWNLOADS — CDN via InsForge Storage
  // ============================================================================
  // Refactor 2026-05: usábamos `require('./modulo')` dentro de cada handler para
  // lazy-load. Eso rompe en producción porque Vite bundlea estos archivos en
  // `out/main/index.js` y los require() dinámicos NO se resuelven en tiempo de
  // ejecución → "Cannot find module './telemetry'". Ahora importamos estático
  // al inicio del archivo y referenciamos por namespace.
  ipcMain.handle('downloads:start', (_e, payload: { userId: number; gameId: number; licenseId: number }) =>
    downloader.descargarJuego(payload));
  ipcMain.handle('downloads:installPath', (_e, payload: { userId: number; gameId: number }) =>
    downloader.rutaInstalacion(payload.userId, payload.gameId));

  // ============================================================================
  // BACKUP — DB local → InsForge Storage
  // ============================================================================
  ipcMain.handle('backup:now', (_e, userId: number | null) => backup.backupAhora(userId));
  ipcMain.handle('backup:list', (_e, userId: number) => backup.listarBackupsParaUi(userId));
  ipcMain.handle('backup:restore', (_e, key: string) => backup.restaurarBackup(key));

  // ============================================================================
  // TELEMETRÍA — opt-in
  // ============================================================================
  ipcMain.handle('telemetry:get', () => ({ enabled: telemetry.estaHabilitado() }));
  ipcMain.handle('telemetry:set', (_e, enabled: boolean) => {
    telemetry.setHabilitado(enabled);
    return { enabled };
  });

  // ============================================================================
  // FAMILIA — modo multi-PC
  // ============================================================================
  ipcMain.handle('family:get', (_e, userId: number) => ({
    family_id: family.obtenerFamilyId(userId)
  }));
  ipcMain.handle('family:create', (_e, userId: number) => family.crearFamilia(userId));
  ipcMain.handle('family:join', (_e, payload: { userId: number; family_id: string }) =>
    family.unirseAFamilia(payload));
  ipcMain.handle('family:leave', (_e, userId: number) => {
    family.salirDeFamilia(userId);
    return { ok: true };
  });
  ipcMain.handle('family:list', (_e, userId: number) => family.listarFamilia(userId));
  ipcMain.handle('family:ping', (_e, payload: { userId: number }) =>
    family.pingPresencia(payload));

  // ============================================================================
  // CLOUD SAVES
  // ============================================================================
  ipcMain.handle('saves:pickFolder', () => saves.pickSaveFolder());
  ipcMain.handle('saves:setFolder', (_e, payload: { gameId: number; folder: string | null }) =>
    saves.setGameSaveFolder(payload.gameId, payload.folder));
  ipcMain.handle('saves:getFolder', (_e, gameId: number) => saves.getGameSaveFolder(gameId));
  ipcMain.handle('saves:backup', (_e, payload: { userId: number; gameId: number; label?: string }) =>
    saves.backupSave(payload.userId, payload.gameId, payload.label));
  ipcMain.handle('saves:list', (_e, payload: { userId: number; gameId: number }) =>
    saves.listSnapshots(payload.userId, payload.gameId));
  ipcMain.handle('saves:restore', (_e, payload: { userId: number; snapshotId: number }) =>
    saves.restoreSnapshot(payload.userId, payload.snapshotId));
  ipcMain.handle('saves:delete', (_e, payload: { userId: number; snapshotId: number }) =>
    saves.deleteSnapshot(payload.userId, payload.snapshotId));
  ipcMain.handle('saves:setRoot', (_e, p: string | null) => saves.setSavesRoot(p));

  // ============================================================================
  // PAYMENTS (multi-provider)
  // ============================================================================
  ipcMain.handle('payments:config', () => payments.getProviderConfig());
  ipcMain.handle('payments:setKey', (_e, payload: { key: string; value: string | null }) => {
    payments.setKey(payload.key, payload.value);
    return { success: true };
  });
  ipcMain.handle('payments:charge', (_e, payload: { provider: payments.Provider; amount: number; currency: string; description: string }) =>
    payments.charge(payload.provider, payload));

  // ============================================================================
  // BIG PICTURE / WINDOW
  // ============================================================================
  ipcMain.on('window:fullscreen', (_e, on: boolean) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.setFullScreen(on);
    }
  });

  // ============================================================================
  // AUTO-LAUNCH WITH WINDOWS
  // ============================================================================
  ipcMain.handle('autolaunch:get', () => app.getLoginItemSettings({}));
  ipcMain.handle('autolaunch:set', (_e, on: boolean) => {
    const prefs = getSystemPrefs();
    app.setLoginItemSettings({
      openAtLogin: on,
      args: prefs.startMinimizedToTray ? ['--minimized'] : []
    });
    return { success: true };
  });

  // ============================================================================
  // SYSTEM TRAY PREFERENCES
  // ============================================================================
  ipcMain.handle('systemPrefs:get', () => getSystemPrefs());
  ipcMain.handle('systemPrefs:set', (_e, payload: { key: keyof SystemPrefs; value: boolean }) => {
    const prefs = setSystemPref(payload.key, payload.value);
    const login = app.getLoginItemSettings({});
    if (login.openAtLogin) {
      app.setLoginItemSettings({
        openAtLogin: true,
        args: prefs.startMinimizedToTray ? ['--minimized'] : []
      });
    }
    return prefs;
  });

  ipcMain.handle('avatar:pickFile', async () => {
    const r = await dialog.showOpenDialog({
      title: 'Selecciona una imagen para tu avatar',
      filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      properties: ['openFile']
    });
    if (r.canceled || !r.filePaths[0]) return { dataUrl: null };
    const fs = require('node:fs');
    const buf = fs.readFileSync(r.filePaths[0]);
    if (buf.length > 1.5 * 1024 * 1024) throw new Error('Imagen muy grande (máx 1.5 MB)');
    const ext = r.filePaths[0].toLowerCase().endsWith('.png') ? 'png'
      : r.filePaths[0].toLowerCase().endsWith('.gif') ? 'gif'
      : r.filePaths[0].toLowerCase().endsWith('.webp') ? 'webp'
      : 'jpeg';
    return { dataUrl: `data:image/${ext};base64,${buf.toString('base64')}` };
  });

  // ---------- SUPABASE ----------
  ipcMain.handle('supabase:status', () => ({
    enabled: supabase.isEnabled(),
    url: (db.prepare('SELECT value FROM app_config WHERE key = ?').get('supabase.url') as any)?.value ?? '',
    hasAnonKey: !!(db.prepare('SELECT value FROM app_config WHERE key = ?').get('supabase.anon_key') as any)?.value
  }));

  ipcMain.handle('supabase:setCreds', async (_e, payload: { url?: string; anon_key?: string }) => {
    const set = (k: string, v: string | undefined) => {
      if (v === undefined) return;
      if (!v) db.prepare('DELETE FROM app_config WHERE key = ?').run(k);
      else db.prepare(
        `INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
      ).run(k, v);
    };
    set('supabase.url', payload.url);
    set('supabase.anon_key', payload.anon_key);
    const ok = await supabase.tryEnableSupabaseSync();
    return { enabled: ok };
  });

  ipcMain.handle('supabase:pullNow', async () => {
    if (!supabase.isEnabled()) {
      const ok = await supabase.tryEnableSupabaseSync();
      if (!ok) throw new Error('Supabase no está configurado (falta URL o anon_key).');
    }
    return supabase.pullAllCatalog();
  });

  ipcMain.handle('supabase:disable', async () => {
    await supabase.disableSupabaseSync();
    return { enabled: false };
  });

  // ---------- YAPE ----------
  // Dreitz lo usa para mostrar el QR en checkout; Keys para subirlo.
  ipcMain.handle('yape:getConfig', () => {
    const cfg = yape.getYapeConfig();
    // No exponemos la API key de Anthropic al renderer.
    return {
      qr_image_data: cfg.qr_image_data,
      recipient_name: cfg.recipient_name,
      recipient_phone: cfg.recipient_phone,
      enabled: !!(cfg.qr_image_data && cfg.recipient_name)
    };
  });

  ipcMain.handle('yape:verifyReceipt', async (_e, payload: {
    userId: number;
    expectedAmount: number;
    imageDataUrl: string; // "data:image/jpeg;base64,..."
  }) => {
    // Parsear data URL para extraer media type + base64.
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(payload.imageDataUrl);
    if (!m) throw new Error('Formato de imagen inválido (debe ser JPEG, PNG o WebP en base64)');
    const mediaType = m[1].toLowerCase() as 'image/jpeg' | 'image/png' | 'image/webp';
    const base64 = m[2];

    // Sanity: tamaño base64. Más de 5 MB es sospechoso para un screenshot.
    if (base64.length > 7_000_000) throw new Error('La imagen excede 5 MB');

    const result = await yape.verifyYapeReceipt({
      imageBase64: base64,
      imageMediaType: mediaType,
      expectedAmountPen: payload.expectedAmount
    });

    const receiptId = yape.recordReceipt({
      userId: payload.userId,
      orderId: null,
      amount: payload.expectedAmount,
      imageDataUrl: payload.imageDataUrl,
      result
    });

    return { ...result, receiptId };
  });

  // ---------- REDEEM-FROM-CODE ----------
  // Flujo "Activar producto" tipo Steam: el usuario pega DRZ-XXXXX-... y el juego
  // entra en su biblioteca sin pasar por checkout.
  ipcMain.handle('redeem:fromCode', (_e, payload: { userId: number; code: string }) => {
    if (!payload.userId) throw new Error('Sesión inválida');
    const normalized = (payload.code || '').toUpperCase().trim().replace(/\s+/g, '');
    if (!normalized) throw new Error('Falta el código');
    // Acepta DRZ-XXXXX-XXXXX-XXXXX-XXXXX y también el formato compacto sin guiones.
    if (!/^(DRZ-)?[A-Z0-9-]{12,40}$/.test(normalized)) {
      throw new Error('Formato de clave inválido. Debe verse como DRZ-XXXXX-XXXXX-XXXXX-XXXXX.');
    }

    const license = db
      .prepare('SELECT * FROM licenses WHERE code = ?')
      .get(normalized) as any;
    if (!license) throw new Error('Esa clave no existe.');

    if (license.status === 'revoked') throw new Error('Esta clave fue revocada por el administrador.');
    if (license.status === 'redeemed' || license.status === 'sold') {
      // Si ya fue redimida por ESTE mismo usuario, no es error — solo informativo.
      if (license.user_id === payload.userId) {
        const game = parseGame(db.prepare('SELECT * FROM games WHERE id = ?').get(license.game_id));
        return { success: true, alreadyOwned: true, game };
      }
      throw new Error('Esta clave ya fue canjeada por otro usuario.');
    }

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(license.game_id) as any;
    if (!game) throw new Error('El juego asociado no existe en el catálogo.');
    if (!game.is_active) throw new Error('Ese juego está deshabilitado.');

    // Si ya tiene el juego en la biblioteca, no añadir doble.
    const owned = db
      .prepare('SELECT id FROM library WHERE user_id = ? AND game_id = ?')
      .get(payload.userId, license.game_id);

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE licenses SET status = 'sold', user_id = ?, sold_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(payload.userId, license.id);
      if (!owned) {
        db.prepare(
          `INSERT INTO library (user_id, game_id, license_id) VALUES (?, ?, ?)`
        ).run(payload.userId, license.game_id, license.id);
      }
      db.prepare(`UPDATE games SET stock = MAX(stock - 1, 0) WHERE id = ?`).run(license.game_id);
      db.prepare(
        `INSERT INTO funnel_events (user_id, event, target_id) VALUES (?, 'redeem_code', ?)`
      ).run(payload.userId, license.game_id);
    });
    tx();
    logActivity(payload.userId, 'redeem_code', license.game_id, game.title, { license_id: license.id });

    notify('Clave activada', `${game.title} se añadió a tu biblioteca.`);
    broadcast('user:changed', { userId: payload.userId });

    return { success: true, alreadyOwned: false, game: parseGame(game), license_id: license.id };
  });

  // ---------- RECOVERY (pregunta de seguridad) ----------
  ipcMain.handle('recovery:set', (_e, payload: { userId: number; question: string; answer: string }) =>
    recovery.setRecoveryQuestion(payload.userId, payload.question, payload.answer)
  );
  ipcMain.handle('recovery:getQuestion', (_e, username: string) => recovery.getRecoveryQuestion(username));
  ipcMain.handle('recovery:reset', (_e, payload: { username: string; answer: string; newPassword: string }) =>
    recovery.resetPasswordWithAnswer(payload)
  );

  // ---------- 2FA TOTP ----------
  ipcMain.handle('twofa:generate', (_e, userId: number) => twofa.generateSecret(userId));
  ipcMain.handle('twofa:verifyAndEnable', (_e, payload: { userId: number; token: string }) =>
    ({ enabled: twofa.verifyAndEnable(payload.userId, payload.token) })
  );
  ipcMain.handle('twofa:verify', (_e, payload: { userId: number; token: string }) =>
    ({ ok: twofa.verifyToken(payload.userId, payload.token) })
  );
  ipcMain.handle('twofa:status', (_e, userId: number) => ({ enabled: twofa.isEnabled(userId) }));
  ipcMain.handle('twofa:disable', (_e, userId: number) => twofa.disable(userId));

  // ---------- IMAGE CACHE ----------
  ipcMain.handle('cache:fetch', (_e, url: string) => imageCache.fetchAndCache(url));
  ipcMain.handle('cache:stats', () => imageCache.getStats());
  ipcMain.handle('cache:clear', () => { imageCache.clearCache(); return { success: true }; });

  // ---------- AUTO-UPDATE ----------
  ipcMain.handle('updater:checkNow', () => autoUpdate.checkNow());
  ipcMain.handle('updater:installAndRestart', () => { autoUpdate.installAndRestart(); return { success: true }; });

  // ---------- PRICE SYNC ----------
  ipcMain.handle('priceSync:status', () => priceSync.status());
  ipcMain.handle('priceSync:runNow', () => priceSync.runSyncNow({ force: true }));

  // ---------- SAVE AUTO-BACKUP ----------
  ipcMain.handle('saves:startAutoBackup', (_e, payload: { userId: number; gameId: number }) =>
    saves.startAutoBackup(payload.userId, payload.gameId)
  );
  ipcMain.handle('saves:stopAutoBackup', (_e, payload: { userId: number; gameId: number }) =>
    saves.stopAutoBackup(payload.userId, payload.gameId)
  );
  ipcMain.handle('saves:listActiveWatches', () => saves.listActiveWatches());

  // ---------- GIFT CODES (P2P) ----------
  // Permite a un usuario "regalar" un juego de su biblioteca a otro usuario,
  // generando un código DRZ que el destinatario puede activar en /redeem.
  ipcMain.handle('gift:create', (_e, payload: { fromUserId: number; gameId: number; message?: string }) => {
    const lib = db
      .prepare('SELECT lib.id, lib.license_id FROM library lib WHERE lib.user_id = ? AND lib.game_id = ?')
      .get(payload.fromUserId, payload.gameId) as any;
    if (!lib) throw new Error('No tienes este juego en tu biblioteca');
    // Generar una nueva licencia tipo gift sobre el mismo game_id.
    const segCode = () =>
      Math.random().toString(36).slice(2, 7).toUpperCase();
    const code = `DRZ-${segCode()}-${segCode()}-${segCode()}-${segCode()}`;
    const r = db.prepare(
      `INSERT INTO licenses (game_id, code, status, license_type, gifted_by_user_id, gift_message)
       VALUES (?, ?, 'available', 'gift', ?, ?)`
    ).run(payload.gameId, code, payload.fromUserId, payload.message ?? null);
    log.info(`Gift created: license ${r.lastInsertRowid} from user ${payload.fromUserId} game ${payload.gameId}`);
    return { code, license_id: r.lastInsertRowid };
  });

  ipcMain.handle('gift:listMine', (_e, userId: number) => {
    return db.prepare(`
      SELECT l.id, l.code, l.status, l.gift_message, l.created_at, g.title, g.header_image
      FROM licenses l JOIN games g ON g.id = l.game_id
      WHERE l.gifted_by_user_id = ? AND l.license_type = 'gift'
      ORDER BY l.created_at DESC
    `).all(userId);
  });

  // ---------- REVIEWS (create/update) ----------
  // El backend handler `reviews:create` ya existe; agrego edit + delete.
  ipcMain.handle('reviews:update', (_e, payload: { userId: number; reviewId: number; rating: number; title?: string; body?: string }) => {
    db.prepare(
      `UPDATE reviews SET rating = ?, title = ?, body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`
    ).run(payload.rating, payload.title ?? null, payload.body ?? null, payload.reviewId, payload.userId);
    return { success: true };
  });
  ipcMain.handle('reviews:delete', (_e, payload: { userId: number; reviewId: number }) => {
    db.prepare('DELETE FROM reviews WHERE id = ? AND user_id = ?').run(payload.reviewId, payload.userId);
    return { success: true };
  });

  // ---------- REVIEWS HELPFUL VOTING (Tier 4) ----------
  // Migración perezosa: tabla `review_votes (review_id, user_id, helpful 1/0)`
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_votes (
      review_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      helpful INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (review_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_review_votes_r ON review_votes(review_id);
  `);
  ipcMain.handle('reviews:vote', (_e, payload: { userId: number; reviewId: number; helpful: boolean }) => {
    db.prepare(
      `INSERT INTO review_votes (review_id, user_id, helpful) VALUES (?, ?, ?)
       ON CONFLICT(review_id, user_id) DO UPDATE SET helpful = excluded.helpful`
    ).run(payload.reviewId, payload.userId, payload.helpful ? 1 : 0);
    const counts = db.prepare(`
      SELECT
        SUM(CASE WHEN helpful = 1 THEN 1 ELSE 0 END) as helpful,
        SUM(CASE WHEN helpful = 0 THEN 1 ELSE 0 END) as not_helpful
      FROM review_votes WHERE review_id = ?
    `).get(payload.reviewId) as any;
    return { helpful: counts.helpful ?? 0, not_helpful: counts.not_helpful ?? 0 };
  });
  ipcMain.handle('reviews:voteCount', (_e, reviewId: number) => {
    const counts = db.prepare(`
      SELECT
        SUM(CASE WHEN helpful = 1 THEN 1 ELSE 0 END) as helpful,
        SUM(CASE WHEN helpful = 0 THEN 1 ELSE 0 END) as not_helpful
      FROM review_votes WHERE review_id = ?
    `).get(reviewId) as any;
    return { helpful: counts.helpful ?? 0, not_helpful: counts.not_helpful ?? 0 };
  });

  // ---------- RECOMMENDATIONS (Tier 2 AI) ----------
  ipcMain.handle('recommend:forUser', async (_e, payload: { userId: number; force?: boolean }) => {
    const recs = await recommend.getRecommendations(payload.userId, { force: payload.force });
    // Hidratamos con metadata completa del juego para que el renderer las muestre directo.
    if (!recs.length) return [];
    const ids = recs.map((r) => r.game_id);
    const placeholders = ids.map(() => '?').join(',');
    const games = db.prepare(`SELECT * FROM games WHERE id IN (${placeholders})`).all(...ids).map(parseGame);
    return recs.map((r) => {
      const g = games.find((x: any) => x.id === r.game_id);
      return g ? { game: g, reason: r.reason } : null;
    }).filter(Boolean);
  });

  // ---------- NOW PLAYING (Tier 3) ----------
  // Devuelve los juegos actualmente abiertos del user (detectados por playtimeTracker).
  ipcMain.handle('library:nowPlaying', (_e, userId: number) => {
    // `last_played_at` se actualiza cada tick del watcher mientras el .exe corre.
    // Si fue hace <60s, asumimos que sigue jugando.
    const rows = db.prepare(`
      SELECT i.game_id, i.last_played_at, i.playtime_minutes, g.title, g.header_image, g.capsule_image
      FROM installs i JOIN games g ON g.id = i.game_id
      WHERE i.user_id = ?
        AND i.last_played_at IS NOT NULL
        AND datetime(i.last_played_at) > datetime('now', '-90 seconds')
      ORDER BY i.last_played_at DESC LIMIT 1
    `).all(userId);
    return rows;
  });

  // ---------- CUSTOM SHELVES (Tier 3) ----------
  // Tabla `shelves (id, user_id, name, ord)` + `shelf_games (shelf_id, game_id, ord)`
  db.exec(`
    CREATE TABLE IF NOT EXISTS shelves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      ord INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS shelf_games (
      shelf_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      ord INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (shelf_id, game_id)
    );
    CREATE INDEX IF NOT EXISTS idx_shelves_user ON shelves(user_id, ord);
  `);
  ipcMain.handle('shelves:list', (_e, userId: number) => {
    const shelves = db.prepare('SELECT * FROM shelves WHERE user_id = ? ORDER BY ord, id').all(userId) as any[];
    return shelves.map((s) => ({
      ...s,
      games: db.prepare(`
        SELECT g.* FROM shelf_games sg JOIN games g ON g.id = sg.game_id
        WHERE sg.shelf_id = ? ORDER BY sg.ord
      `).all(s.id).map(parseGame)
    }));
  });
  ipcMain.handle('shelves:create', (_e, payload: { userId: number; name: string }) => {
    const max = db.prepare('SELECT MAX(ord) as m FROM shelves WHERE user_id = ?').get(payload.userId) as any;
    const r = db.prepare('INSERT INTO shelves (user_id, name, ord) VALUES (?, ?, ?)')
      .run(payload.userId, payload.name, (max?.m ?? 0) + 1);
    return { id: r.lastInsertRowid, name: payload.name };
  });
  ipcMain.handle('shelves:rename', (_e, payload: { userId: number; shelfId: number; name: string }) => {
    db.prepare('UPDATE shelves SET name = ? WHERE id = ? AND user_id = ?')
      .run(payload.name, payload.shelfId, payload.userId);
    return { success: true };
  });
  ipcMain.handle('shelves:delete', (_e, payload: { userId: number; shelfId: number }) => {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM shelf_games WHERE shelf_id = ?').run(payload.shelfId);
      db.prepare('DELETE FROM shelves WHERE id = ? AND user_id = ?').run(payload.shelfId, payload.userId);
    });
    tx();
    return { success: true };
  });
  ipcMain.handle('shelves:addGame', (_e, payload: { userId: number; shelfId: number; gameId: number }) => {
    // Validar ownership: solo se agregan juegos de la biblioteca propia.
    const owns = db.prepare('SELECT 1 FROM library WHERE user_id = ? AND game_id = ?').get(payload.userId, payload.gameId);
    if (!owns) throw new Error('No tienes ese juego en tu biblioteca');
    const max = db.prepare('SELECT MAX(ord) as m FROM shelf_games WHERE shelf_id = ?').get(payload.shelfId) as any;
    db.prepare('INSERT OR IGNORE INTO shelf_games (shelf_id, game_id, ord) VALUES (?, ?, ?)')
      .run(payload.shelfId, payload.gameId, (max?.m ?? 0) + 1);
    return { success: true };
  });
  ipcMain.handle('shelves:removeGame', (_e, payload: { shelfId: number; gameId: number }) => {
    db.prepare('DELETE FROM shelf_games WHERE shelf_id = ? AND game_id = ?')
      .run(payload.shelfId, payload.gameId);
    return { success: true };
  });

  // ---------- FRIEND PRESENCE (Tier 4) ----------
  // Devuelve qué amigos están "online" (vistos en últimos 5 min vía any IPC call).
  // Tabla perezosa: `presence (user_id, last_seen_at)`.
  db.exec(`
    CREATE TABLE IF NOT EXISTS presence (
      user_id INTEGER PRIMARY KEY,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      playing_game_id INTEGER
    );
  `);
  ipcMain.handle('presence:ping', (_e, payload: { userId: number; playingGameId?: number | null }) => {
    db.prepare(`
      INSERT INTO presence (user_id, last_seen_at, playing_game_id) VALUES (?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        last_seen_at = CURRENT_TIMESTAMP,
        playing_game_id = excluded.playing_game_id
    `).run(payload.userId, payload.playingGameId ?? null);
    return { ok: true };
  });
  ipcMain.handle('presence:friendsStatus', (_e, userId: number) => {
    // Considera "online" si fue visto en últimos 5 min.
    return db.prepare(`
      SELECT u.id, u.username, p.last_seen_at, p.playing_game_id, g.title as playing_title
      FROM friendships f
      JOIN users u ON (u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END)
      LEFT JOIN presence p ON p.user_id = u.id
      LEFT JOIN games g ON g.id = p.playing_game_id
      WHERE f.user_a = ? OR f.user_b = ?
    `).all(userId, userId, userId).map((r: any) => ({
      ...r,
      online: r.last_seen_at && (Date.now() - new Date(r.last_seen_at).getTime()) < 5 * 60 * 1000
    }));
  });

  // ---------- FREE GAME WEEKLY (Tier 6 — admin sets, all users get) ----------
  // Reusamos app_config con key `free_game.current` que apunta a game_id + expires_at.
  ipcMain.handle('freeGame:current', () => {
    const r = db.prepare(`SELECT value FROM app_config WHERE key = 'free_game.current'`).get() as any;
    if (!r?.value) return null;
    try {
      const data = JSON.parse(r.value);
      if (new Date(data.expires_at).getTime() < Date.now()) return null;
      const game = parseGame(db.prepare('SELECT * FROM games WHERE id = ?').get(data.game_id));
      return game ? { game, expires_at: data.expires_at } : null;
    } catch { return null; }
  });
  ipcMain.handle('freeGame:claim', (_e, payload: { userId: number }) => {
    const cur = db.prepare(`SELECT value FROM app_config WHERE key = 'free_game.current'`).get() as any;
    if (!cur?.value) throw new Error('No hay juego gratis activo');
    const data = JSON.parse(cur.value);
    if (new Date(data.expires_at).getTime() < Date.now()) throw new Error('La promoción ya expiró');
    const game = db.prepare('SELECT * FROM games WHERE id = ? AND is_active = 1').get(data.game_id) as any;
    if (!game) throw new Error('Juego no disponible');
    const already = db.prepare('SELECT 1 FROM library WHERE user_id = ? AND game_id = ?').get(payload.userId, data.game_id);
    if (already) return { success: true, alreadyOwned: true, game: parseGame(game) };

    // Crear "compra gratuita" simulada
    const license = db.prepare(`SELECT * FROM licenses WHERE game_id = ? AND status = 'available' LIMIT 1`).get(data.game_id) as any;
    if (!license) throw new Error('No quedan licencias disponibles para este juego gratis');
    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE licenses SET status = 'sold', user_id = ?, sold_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(payload.userId, license.id);
      db.prepare(`INSERT INTO library (user_id, game_id, license_id) VALUES (?, ?, ?)`)
        .run(payload.userId, data.game_id, license.id);
      db.prepare(`UPDATE games SET stock = MAX(stock - 1, 0) WHERE id = ?`).run(data.game_id);
      db.prepare(`INSERT INTO funnel_events (user_id, event, target_id) VALUES (?, 'free_claim', ?)`).run(payload.userId, data.game_id);
    });
    tx();
    logActivity(payload.userId, 'free_game_claim', data.game_id, game.title, {});
    notify('¡Juego gratis reclamado!', `${game.title} se añadió a tu biblioteca.`);
    return { success: true, alreadyOwned: false, game: parseGame(game), license_id: license.id };
  });

  // ---------- PROFILE CUSTOMIZATION (Tier 6) ----------
  // Banner + frame del avatar. Se guarda en user_settings columnas nuevas.
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_customization (
      user_id INTEGER PRIMARY KEY,
      banner TEXT,
      avatar_frame TEXT,
      bio TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ipcMain.handle('profile:get', (_e, userId: number) => {
    return db.prepare('SELECT * FROM profile_customization WHERE user_id = ?').get(userId)
      ?? { user_id: userId, banner: null, avatar_frame: null, bio: null };
  });
  ipcMain.handle('profile:set', (_e, payload: { userId: number; banner?: string; avatar_frame?: string; bio?: string }) => {
    db.prepare(`
      INSERT INTO profile_customization (user_id, banner, avatar_frame, bio) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        banner = COALESCE(excluded.banner, profile_customization.banner),
        avatar_frame = COALESCE(excluded.avatar_frame, profile_customization.avatar_frame),
        bio = COALESCE(excluded.bio, profile_customization.bio),
        updated_at = CURRENT_TIMESTAMP
    `).run(payload.userId, payload.banner ?? null, payload.avatar_frame ?? null, payload.bio ?? null);
    return { success: true };
  });

  // ---------- PRESENCE (online status — quién está conectado / jugando) ----------
  // Heartbeat desde el renderer cada 30s. Si pasan >90s sin heartbeat, el usuario
  // se considera offline. Usado en Friends list para "está en línea / jugando X".
  ipcMain.handle('presence:heartbeat', (_e, payload: { userId: number; gameId?: number | null }) => {
    db.prepare(`
      INSERT INTO user_presence (user_id, status, currently_playing_game_id, last_heartbeat_at)
      VALUES (?, 'online', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        status = 'online',
        currently_playing_game_id = excluded.currently_playing_game_id,
        last_heartbeat_at = CURRENT_TIMESTAMP
    `).run(payload.userId, payload.gameId ?? null);
    // Marcar offline a los users con heartbeat >90s
    db.prepare(`UPDATE user_presence SET status = 'offline' WHERE last_heartbeat_at < datetime('now', '-90 seconds')`).run();
    return { success: true };
  });

  ipcMain.handle('presence:friendStatuses', (_e, userId: number) => {
    // Devuelve estado de cada amigo: online/offline + qué está jugando.
    return db.prepare(`
      SELECT
        u.id as user_id, u.username, u.avatar,
        COALESCE(p.status, 'offline') as status,
        p.currently_playing_game_id,
        g.title as currently_playing_title,
        g.capsule_image as currently_playing_image,
        p.last_heartbeat_at
      FROM friendships f
      JOIN users u ON u.id = (CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END)
      LEFT JOIN user_presence p ON p.user_id = u.id
      LEFT JOIN games g ON g.id = p.currently_playing_game_id
      WHERE f.user_a = ? OR f.user_b = ?
      ORDER BY (p.status = 'online') DESC, u.username
    `).all(userId, userId, userId);
  });

  // ---------- CROSS-STORE PRICE COMPARISON ----------
  // Cache de precios de Steam/Epic/GOG/Humble. Se llena via priceSync.ts o
  // manualmente con un seed. UI muestra "este juego está a $X en Epic, ahorrarías $Y".
  ipcMain.handle('crossStore:getPrices', (_e, gameId: number) => {
    return db.prepare(`
      SELECT store, price_usd, discount_percent, url, fetched_at
      FROM cross_store_prices WHERE game_id = ?
      ORDER BY price_usd ASC
    `).all(gameId);
  });

  ipcMain.handle('crossStore:setPrice', (_e, payload: { gameId: number; store: string; priceUsd: number; discountPercent?: number; url?: string }) => {
    db.prepare(`
      INSERT INTO cross_store_prices (game_id, store, price_usd, discount_percent, url)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(game_id, store) DO UPDATE SET
        price_usd = excluded.price_usd,
        discount_percent = excluded.discount_percent,
        url = excluded.url,
        fetched_at = CURRENT_TIMESTAMP
    `).run(payload.gameId, payload.store, payload.priceUsd, payload.discountPercent ?? 0, payload.url ?? null);
    return { success: true };
  });

  // ---------- PRO FAMILY ----------
  // Upgrade a pro_family: linkea hasta 5 cuentas con el mismo family_id.
  // Todas las cuentas comparten beneficios PRO + cashback + biblioteca.
  ipcMain.handle('pro:upgradeFamily', (_e, payload: { userId: number; familyId: string; tier: 'pro' | 'pro_family' }) => {
    const expiresAt = new Date(Date.now() + 365 * 86400 * 1000).toISOString(); // +1 año
    db.prepare(`UPDATE users SET pro_tier = ?, is_pro = 1, pro_expires_at = ?, family_id = ? WHERE id = ?`)
      .run(payload.tier, expiresAt, payload.familyId, payload.userId);
    return { success: true, tier: payload.tier, expiresAt };
  });

  ipcMain.handle('pro:familyMembers', (_e, familyId: string) => {
    if (!familyId) return [];
    return db.prepare(`SELECT id, username, avatar, pro_tier, pro_expires_at FROM users WHERE family_id = ?`).all(familyId);
  });

  ipcMain.handle('pro:status', (_e, userId: number) => {
    const u = db.prepare(`SELECT pro_tier, pro_expires_at, family_id, is_pro FROM users WHERE id = ?`).get(userId) as any;
    if (!u) return null;
    // Si expiró, downgrade automático
    if (u.pro_expires_at && new Date(u.pro_expires_at).getTime() < Date.now()) {
      db.prepare(`UPDATE users SET pro_tier = 'free', is_pro = 0 WHERE id = ?`).run(userId);
      return { tier: 'free', expired: true, family_id: null };
    }
    return { tier: u.pro_tier, family_id: u.family_id, expires_at: u.pro_expires_at, is_pro: !!u.is_pro };
  });

  // ---------- SURPRISE ME (Tier 3 — combate parálisis de decisión) ----------
  /**
   * Pickea un juego "random" para el usuario:
   *   1. Si tiene biblioteca con juegos no-jugados (playtime < 60min) → uno de esos.
   *   2. Si toda su biblioteca ya está jugada → uno random de la biblioteca.
   *   3. Si no tiene biblioteca → uno random de la wishlist.
   *   4. Si no tiene nada → un featured del catálogo.
   * Devuelve { game, reason } o null si la DB está vacía.
   */
  ipcMain.handle('surprise:pick', (_e, payload: { userId: number }) => {
    const userId = payload?.userId;
    if (!userId) return null;

    // Tier 1: biblioteca con poco playtime
    const unplayed = db.prepare(`
      SELECT g.* FROM games g
      JOIN installs i ON i.game_id = g.id
      WHERE i.user_id = ? AND COALESCE(i.playtime_minutes, 0) < 60 AND g.is_active = 1
      ORDER BY RANDOM() LIMIT 1
    `).get(userId) as any;
    if (unplayed) return { game: parseGame(unplayed), reason: 'Lo tienes pero apenas lo has tocado — hoy es el día.' };

    // Tier 2: biblioteca completa, pickea random
    const owned = db.prepare(`
      SELECT g.* FROM games g
      JOIN installs i ON i.game_id = g.id
      WHERE i.user_id = ? AND g.is_active = 1
      ORDER BY RANDOM() LIMIT 1
    `).get(userId) as any;
    if (owned) return { game: parseGame(owned), reason: 'Vuelve a uno de tus favoritos.' };

    // Tier 3: wishlist
    const wished = db.prepare(`
      SELECT g.* FROM games g
      JOIN wishlist w ON w.game_id = g.id
      WHERE w.user_id = ? AND g.is_active = 1
      ORDER BY RANDOM() LIMIT 1
    `).get(userId) as any;
    if (wished) return { game: parseGame(wished), reason: 'En tu wishlist hace rato — ¿hoy te lo regalas?' };

    // Tier 4: catálogo featured
    const featured = db.prepare(`
      SELECT * FROM games WHERE is_active = 1 AND is_featured = 1 AND price_initial > 0
      ORDER BY RANDOM() LIMIT 1
    `).get() as any;
    if (featured) return { game: parseGame(featured), reason: 'Recomendación de la casa.' };

    return null;
  });

  // ---------- HOWLONGTOBEAT (estimación de horas de juego) ----------
  /**
   * Devuelve { mainStory, mainPlusSides, completionist, source } o null.
   * Lee de cache estática por steam_app_id; fallback a estimación por género.
   */
  ipcMain.handle('hltb:get', (_e, payload: { gameId: number }) => {
    const gameId = payload?.gameId;
    if (!gameId) return null;
    const game = db.prepare(`SELECT steam_app_id, genres FROM games WHERE id = ?`).get(gameId) as any;
    if (!game) return null;
    let genres: string[] = [];
    try { genres = game.genres ? JSON.parse(game.genres) : []; } catch {}
    return getHltb(game.steam_app_id, genres);
  });
}
