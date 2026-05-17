import { BrowserWindow } from 'electron';
import { getDb } from './db';
import log from './logger';
import { notifBajadaPrecio } from './notifications';

let timer: NodeJS.Timeout | null = null;

/**
 * Periodically check if any wishlist game's price has dropped enough to fire an alert.
 * We use the in-DB game.price_final as our truth (admin updates it from Keys).
 */
export function startPriceWatcher() {
  if (timer) return;
  // First run after 30s, then every 4min
  setTimeout(checkOnce, 30_000);
  timer = setInterval(checkOnce, 4 * 60_000);
}

export function stopPriceWatcher() {
  if (timer) clearInterval(timer);
  timer = null;
}

function checkOnce() {
  try {
    const db = getDb();
    // For every (user, wishlist_game) pair, also seed a price_alert row if missing using current price as baseline
    db.prepare(`
      INSERT OR IGNORE INTO price_alerts (user_id, game_id, target_price, last_known_price)
      SELECT w.user_id, w.game_id, NULL, g.price_final
      FROM wishlist w JOIN games g ON g.id = w.game_id
    `).run();

    const rows = db.prepare(`
      SELECT pa.*, u.username, g.title, g.price_final, g.discount_percent FROM price_alerts pa
      JOIN games g ON g.id = pa.game_id
      JOIN users u ON u.id = pa.user_id
      WHERE g.is_active = 1
    `).all() as any[];

    for (const r of rows) {
      const dropped = r.last_known_price && r.price_final < r.last_known_price - 0.01;
      const targetMet = r.target_price && r.price_final <= r.target_price;
      if (dropped || targetMet) {
        // Throttle: don't notify same game more than once every 6h
        const last = r.last_notified_at ? new Date(r.last_notified_at).getTime() : 0;
        if (Date.now() - last < 6 * 60 * 60 * 1000) continue;

        // Notificación nativa de Windows (respeta el toggle del usuario)
        notifBajadaPrecio(r.user_id, { title: r.title, price: r.price_final, gameId: r.game_id });

        db.prepare(`UPDATE price_alerts SET last_known_price = ?, last_notified_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .run(r.price_final, r.id);

        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed()) w.webContents.send('priceAlert:fired', { gameId: r.game_id, title: r.title, price: r.price_final });
        }
        log.info(`Price alert fired: ${r.title} → S/.${r.price_final}`);
      } else if (r.last_known_price === null || r.price_final > r.last_known_price) {
        // Track current price as new baseline (price went up; don't alert)
        db.prepare(`UPDATE price_alerts SET last_known_price = ? WHERE id = ?`).run(r.price_final, r.id);
      }
    }
  } catch (e) {
    log.warn('priceWatcher tick failed:', e);
  }
}
