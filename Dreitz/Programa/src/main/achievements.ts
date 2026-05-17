import type Database from 'better-sqlite3';

export interface AchievementDef {
  code: string;
  title: string;
  description: string;
  check: (db: Database.Database, userId: number) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    code: 'first_purchase',
    title: 'Primer juego',
    description: 'Compraste tu primer juego en Dreitz',
    check: (db, uid) => {
      const r = db.prepare('SELECT COUNT(*) as c FROM library WHERE user_id = ?').get(uid) as any;
      return r.c >= 1;
    }
  },
  {
    code: 'collector_5',
    title: 'Coleccionista',
    description: '5 juegos en tu biblioteca',
    check: (db, uid) => {
      const r = db.prepare('SELECT COUNT(*) as c FROM library WHERE user_id = ?').get(uid) as any;
      return r.c >= 5;
    }
  },
  {
    code: 'collector_15',
    title: 'Aficionado serio',
    description: '15 juegos adquiridos',
    check: (db, uid) => {
      const r = db.prepare('SELECT COUNT(*) as c FROM library WHERE user_id = ?').get(uid) as any;
      return r.c >= 15;
    }
  },
  {
    code: 'big_spender',
    title: 'Gasto fuerte',
    description: 'Gastaste más de S/ 300 en total',
    check: (db, uid) => {
      const r = db.prepare(`SELECT COALESCE(SUM(total),0) as t FROM orders WHERE user_id = ? AND status='paid'`).get(uid) as any;
      return r.t >= 300;
    }
  },
  {
    code: 'pro_member',
    title: 'Suscriptor Pro',
    description: 'Activaste tu suscripción Pro',
    check: (db, uid) => {
      const r = db.prepare('SELECT is_pro FROM users WHERE id = ?').get(uid) as any;
      return !!r?.is_pro;
    }
  },
  {
    code: 'redeemer',
    title: 'Activador',
    description: 'Marcaste tu primera clave como canjeada',
    check: (db, uid) => {
      const r = db.prepare(`SELECT COUNT(*) as c FROM library WHERE user_id = ? AND redeemed = 1`).get(uid) as any;
      return r.c >= 1;
    }
  },
  {
    code: 'wishful',
    title: 'Lista de deseos',
    description: 'Añadiste tu primer juego a deseados',
    check: (db, uid) => {
      const r = db.prepare(`SELECT COUNT(*) as c FROM wishlist WHERE user_id = ?`).get(uid) as any;
      return r.c >= 1;
    }
  },
  {
    code: 'explorer',
    title: 'Explorador',
    description: 'Viste 10 juegos diferentes en la tienda',
    check: (db, uid) => {
      const r = db.prepare(
        `SELECT COUNT(DISTINCT game_id) as c FROM view_history WHERE user_id = ?`
      ).get(uid) as any;
      return r.c >= 10;
    }
  }
];

export function evaluateAchievements(db: Database.Database, userId: number): string[] {
  const unlocked: string[] = [];
  const insert = db.prepare(
    `INSERT OR IGNORE INTO achievements (user_id, code, title, description) VALUES (?, ?, ?, ?)`
  );
  for (const a of ACHIEVEMENTS) {
    try {
      if (a.check(db, userId)) {
        const result = insert.run(userId, a.code, a.title, a.description);
        if (result.changes > 0) unlocked.push(a.code);
      }
    } catch {}
  }
  return unlocked;
}
