import type Database from 'better-sqlite3';

interface MissionDef {
  code: string;
  title: string;
  target: number;
  reward: number;
  measure: (db: Database.Database, userId: number, dayStart: string) => number;
}

const POOL: MissionDef[] = [
  {
    code: 'view_3',
    title: 'Visita 3 fichas de juego',
    target: 3,
    reward: 15,
    // `funnel_events` usa `target_id` para el ID del juego visitado.
    measure: (db, uid, day) => (db.prepare(
      `SELECT COUNT(DISTINCT target_id) as c FROM funnel_events WHERE user_id = ? AND event = 'view_game' AND created_at >= ?`
    ).get(uid, day) as any).c
  },
  {
    code: 'wishlist_1',
    title: 'Añade un juego a tus deseos',
    target: 1,
    reward: 20,
    measure: (db, uid, day) => (db.prepare(
      `SELECT COUNT(*) as c FROM activity_feed WHERE user_id = ? AND kind = 'wishlist_add' AND created_at >= ?`
    ).get(uid, day) as any).c
  },
  {
    code: 'cart_1',
    title: 'Agrega un juego al carrito',
    target: 1,
    reward: 15,
    measure: (db, uid, day) => (db.prepare(
      `SELECT COUNT(*) as c FROM funnel_events WHERE user_id = ? AND event = 'add_to_cart' AND created_at >= ?`
    ).get(uid, day) as any).c
  },
  {
    code: 'review_1',
    title: 'Reseña un juego que tengas',
    target: 1,
    reward: 30,
    measure: (db, uid, day) => (db.prepare(
      `SELECT COUNT(*) as c FROM reviews WHERE user_id = ? AND created_at >= ?`
    ).get(uid, day) as any).c
  },
  {
    code: 'redeem_1',
    title: 'Marca una clave como canjeada',
    target: 1,
    reward: 25,
    measure: (db, uid, day) => (db.prepare(
      `SELECT COUNT(*) as c FROM library WHERE user_id = ? AND redeemed = 1 AND acquired_at >= ?`
    ).get(uid, day) as any).c
  },
  {
    code: 'browse_promos',
    title: 'Visita la sección de ofertas',
    target: 1,
    reward: 10,
    measure: (db, uid, day) => (db.prepare(
      `SELECT COUNT(*) as c FROM funnel_events WHERE user_id = ? AND event = 'view_promotions' AND created_at >= ?`
    ).get(uid, day) as any).c
  },
  {
    code: 'search_1',
    title: 'Busca un juego por nombre',
    target: 1,
    reward: 10,
    measure: (db, uid, day) => (db.prepare(
      `SELECT COUNT(*) as c FROM funnel_events WHERE user_id = ? AND event = 'search' AND created_at >= ?`
    ).get(uid, day) as any).c
  },
  {
    code: 'social_visit',
    title: 'Visita el perfil de un amigo',
    target: 1,
    reward: 15,
    measure: (db, uid, day) => (db.prepare(
      `SELECT COUNT(*) as c FROM funnel_events WHERE user_id = ? AND event = 'view_friend' AND created_at >= ?`
    ).get(uid, day) as any).c
  }
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function todayStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function ensureTodayMissions(db: Database.Database, userId: number): void {
  const day = todayKey();
  const have = (db.prepare(`SELECT COUNT(*) as c FROM daily_missions WHERE user_id = ? AND assigned_date = ?`).get(userId, day) as any).c;
  if (have >= 3) return;
  // Pick 3 unique by deterministic seed (so it's stable through the day)
  const seed = userId + Number(day.replace(/-/g, ''));
  const shuffled = [...POOL].sort((a, b) => {
    const va = ((seed * 9301 + a.code.length * 49297) % 233280) / 233280;
    const vb = ((seed * 9301 + b.code.length * 49297) % 233280) / 233280;
    return va - vb;
  });
  const picks = shuffled.slice(0, 3);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO daily_missions (user_id, code, title, target, reward_points, assigned_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const m of picks) insert.run(userId, m.code, m.title, m.target, m.reward, day);
}

export function getTodayMissions(db: Database.Database, userId: number) {
  ensureTodayMissions(db, userId);
  const day = todayKey();
  const dayStart = todayStart();
  const rows = db.prepare(`SELECT * FROM daily_missions WHERE user_id = ? AND assigned_date = ?`).all(userId, day) as any[];
  return rows.map((r) => {
    const def = POOL.find((p) => p.code === r.code);
    let progress = r.progress;
    if (def && !r.completed) {
      const now = def.measure(db, userId, dayStart);
      progress = Math.min(now, r.target);
      if (progress !== r.progress) {
        db.prepare(`UPDATE daily_missions SET progress = ?, completed = ? WHERE id = ?`).run(progress, progress >= r.target ? 1 : 0, r.id);
      }
    }
    return { ...r, progress, completed: progress >= r.target ? 1 : 0 };
  });
}

export function claimMission(db: Database.Database, userId: number, missionId: number) {
  const m = db.prepare(`SELECT * FROM daily_missions WHERE id = ? AND user_id = ?`).get(missionId, userId) as any;
  if (!m) throw new Error('Misión no encontrada');
  if (!m.completed) throw new Error('Misión no completada todavía');
  if (m.claimed) throw new Error('Ya reclamaste esta misión');
  db.prepare(`UPDATE daily_missions SET claimed = 1 WHERE id = ?`).run(missionId);
  db.prepare(`INSERT INTO points_ledger (user_id, delta, reason, target_id) VALUES (?, ?, 'mission', ?)`)
    .run(userId, m.reward_points, missionId);
  return { reward: m.reward_points };
}
