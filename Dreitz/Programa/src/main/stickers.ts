import type Database from 'better-sqlite3';

// Pool of meta stickers (not tied to a specific game)
const META = [
  { code: 'welcome', title: 'Bienvenido', description: 'Tu primer sticker', rarity: 'common' },
  { code: 'first_review', title: 'Crítico', description: 'Publicaste tu primera reseña', rarity: 'rare' },
  { code: 'streak_7', title: 'Racha 7 días', description: 'Iniciaste sesión 7 días seguidos', rarity: 'epic' },
  { code: 'big_spender', title: 'Coleccionista S/.500', description: 'Gastaste S/.500 acumulado', rarity: 'epic' },
  { code: 'pro_member', title: 'Pro Forever', description: 'Activaste Dreitz Pro', rarity: 'rare' },
  { code: 'wishlist_10', title: 'Cazador', description: '10 juegos en deseos', rarity: 'rare' },
  { code: 'friend_5', title: 'Social', description: '5 amigos en tu lista', rarity: 'rare' },
  { code: 'platinum_level', title: 'Platinum', description: 'Alcanzaste el nivel Platinum', rarity: 'legendary' }
];

const RARITY_BASE_COLORS: Record<string, [string, string]> = {
  common: ['#475569', '#64748b'],
  rare: ['#0284c7', '#22d3ee'],
  epic: ['#7c3aed', '#c084fc'],
  legendary: ['#f59e0b', '#fde047']
};

export function unlockGameSticker(db: Database.Database, userId: number, gameId: number) {
  // Stable per-game sticker (one per game owned)
  const game = db.prepare(`SELECT title FROM games WHERE id = ?`).get(gameId) as any;
  if (!game) return;
  const code = `g_${gameId}`;
  db.prepare(`
    INSERT OR IGNORE INTO stickers (user_id, code, game_id, title, description, rarity)
    VALUES (?, ?, ?, ?, ?, 'common')
  `).run(userId, code, gameId, game.title, `Compraste ${game.title}`);
}

export function evaluateMetaStickers(db: Database.Database, userId: number) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO stickers (user_id, code, game_id, title, description, rarity)
    VALUES (?, ?, NULL, ?, ?, ?)
  `);
  // welcome — always
  insert.run(userId, 'welcome', 'Bienvenido', 'Tu primer sticker', 'common');
  // first_review
  const reviews = (db.prepare(`SELECT COUNT(*) as c FROM reviews WHERE user_id = ?`).get(userId) as any).c;
  if (reviews >= 1) insert.run(userId, 'first_review', 'Crítico', 'Publicaste tu primera reseña', 'rare');
  // big_spender
  const spent = (db.prepare(`SELECT COALESCE(SUM(total),0) as t FROM orders WHERE user_id = ? AND status = 'paid'`).get(userId) as any).t;
  if (spent >= 500) insert.run(userId, 'big_spender', 'Coleccionista S/.500', 'Gastaste S/.500 acumulado', 'epic');
  if (spent >= 1000) insert.run(userId, 'platinum_level', 'Platinum', 'Alcanzaste el nivel Platinum', 'legendary');
  // pro_member
  const u = db.prepare(`SELECT is_pro FROM users WHERE id = ?`).get(userId) as any;
  if (u?.is_pro) insert.run(userId, 'pro_member', 'Pro Forever', 'Activaste Dreitz Pro', 'rare');
  // wishlist_10
  const wl = (db.prepare(`SELECT COUNT(*) as c FROM wishlist WHERE user_id = ?`).get(userId) as any).c;
  if (wl >= 10) insert.run(userId, 'wishlist_10', 'Cazador', '10 juegos en deseos', 'rare');
  // friend_5
  const fr = (db.prepare(`SELECT COUNT(*) as c FROM friendships WHERE user_a = ? OR user_b = ?`).get(userId, userId) as any).c;
  if (fr >= 5) insert.run(userId, 'friend_5', 'Social', '5 amigos en tu lista', 'rare');
}

export function getStickers(db: Database.Database, userId: number) {
  evaluateMetaStickers(db, userId);
  const owned = db.prepare(`
    SELECT s.*, g.capsule_image, g.header_image FROM stickers s
    LEFT JOIN games g ON g.id = s.game_id
    WHERE s.user_id = ? ORDER BY s.unlocked_at DESC
  `).all(userId) as any[];
  return {
    owned,
    palette: RARITY_BASE_COLORS,
    pool: META
  };
}
