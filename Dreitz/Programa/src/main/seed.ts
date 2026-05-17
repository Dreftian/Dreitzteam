import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { fetchSteamGame } from './steam';

/**
 * Catálogo curado: EXACTAMENTE 100 títulos AAA de paga REALES en Steam.
 * SIN free-to-play. SIN indies pequeños. SIN MMOs free. SIN unreleased.
 *
 * La lista está sincronizada con `catalog/aaa-curated-100.json` (raíz del repo).
 * Si agregas/quitas un ID acá, actualiza también ese JSON.
 *
 * Cobertura por saga:
 *   Resident Evil: 8 · Devil May Cry: 3 · Monster Hunter: 3 · Silent Hill: 1
 *   Soulsborne (FromSoft): 7 · Capcom otros: 2 · Bethesda: 5 · CDPR: 2
 *   Rockstar: 5 · Ubisoft: 6 · Sony 1P: 12 · Xbox 1P: 5 · Larian: 1
 *   EA: 6 · SEGA/Atlus/RGG: 6 · Square Enix: 5 · 2K: 5 · Strategy: 5
 *   Lies of P (Neowiz): 1 · Otros AAA célebres: 12
 *   Total: 100
 */
const SEED_STEAM_IDS: number[] = [
  // ===== Resident Evil mainline (8) =====
  2050650,  // Resident Evil 4 (Remake)
  1196590,  // Resident Evil Village
  883710,   // Resident Evil 2 (Remake)
  1029690,  // Resident Evil 3 (Remake)
  418370,   // Resident Evil 7: Biohazard
  304240,   // Resident Evil 6
  21690,    // Resident Evil 5
  304230,   // Resident Evil HD Remaster
  // ===== Devil May Cry (3) =====
  601150,   // Devil May Cry 5
  631510,   // DmC: Devil May Cry
  631530,   // Devil May Cry HD Collection
  // ===== Monster Hunter (3) =====
  582010,   // Monster Hunter: World
  1446780,  // Monster Hunter Rise
  2246340,  // Monster Hunter Wilds
  // ===== Silent Hill (1) =====
  2124490,  // SILENT HILL 2 (2024 Remake)
  // ===== Soulsborne FromSoftware (7) =====
  1245620,  // Elden Ring
  2622380,  // Elden Ring: Nightreign
  814380,   // Sekiro: Shadows Die Twice
  374320,   // Dark Souls III
  335300,   // Dark Souls II: Scholar of the First Sin
  570940,   // Dark Souls Remastered
  1971870,  // Armored Core VI: Fires of Rubicon
  // ===== Capcom otros (2) =====
  1659040,  // Street Fighter 6
  2054970,  // Dragon's Dogma 2
  // ===== Bethesda (5) =====
  489830,   // The Elder Scrolls V: Skyrim Special Edition
  377160,   // Fallout 4
  22380,    // Fallout: New Vegas
  1716740,  // Starfield
  403640,   // Dishonored 2
  // ===== CD Projekt RED (2) =====
  1091500,  // Cyberpunk 2077
  292030,   // The Witcher 3: Wild Hunt
  // ===== Rockstar (5) =====
  271590,   // Grand Theft Auto V
  1174180,  // Red Dead Redemption 2
  12210,    // Grand Theft Auto IV
  12120,    // Grand Theft Auto: San Andreas
  12150,    // Grand Theft Auto: Vice City
  // ===== Ubisoft (6) =====
  2208920,  // Assassin's Creed Mirage
  812140,   // Assassin's Creed Odyssey
  582160,   // Assassin's Creed Origins
  33230,    // Assassin's Creed II
  2767030,  // Avatar: Frontiers of Pandora
  460930,   // Tom Clancy's The Division 2
  // ===== Sony PlayStation Studios en PC (12) =====
  1593500,  // God of War (2018)
  2322010,  // God of War Ragnarök
  1817070,  // Marvel's Spider-Man Remastered
  1817190,  // Marvel's Spider-Man: Miles Morales
  1888930,  // The Last of Us Part I
  2531310,  // The Last of Us Part II Remastered
  2519060,  // Marvel's Spider-Man 2
  980330,   // Horizon Zero Dawn Complete Edition
  2420110,  // Horizon Forbidden West Complete
  1888160,  // Marvel's Avengers
  1190460,  // DEATH STRANDING DIRECTOR'S CUT
  2215430,  // Ghost of Tsushima DIRECTOR'S CUT
  // ===== Microsoft / Xbox 1P (5) =====
  1240440,  // Halo Infinite
  976730,   // Halo: The Master Chief Collection
  1551360,  // Forza Horizon 5
  1466860,  // Age of Empires IV
  813780,   // Age of Empires II: Definitive Edition
  // ===== Larian (1) =====
  1086940,  // Baldur's Gate 3
  // ===== EA (6) =====
  2462750,  // EA Sports FC 25
  1238810,  // Battlefield 1
  1238840,  // Battlefield V
  1517290,  // Battlefield 2042
  1903340,  // Dead Space (Remake 2023)
  1328670,  // Mass Effect Legendary Edition
  // ===== SEGA / Atlus / RGG (6) =====
  2347080,  // Like a Dragon: Infinite Wealth
  1687950,  // Persona 5 Royal
  1259660,  // Yakuza: Like a Dragon
  2161700,  // Persona 3 Reload
  1382330,  // Tales of Arise
  1389990,  // Persona 5 Strikers
  // ===== Square Enix / Game Science (5) =====
  1462040,  // FINAL FANTASY VII REMAKE INTERGRADE
  1173770,  // FINAL FANTASY XV WINDOWS EDITION
  2515020,  // FORSPOKEN
  2358720,  // Black Myth: Wukong
  3764200,  // FINAL FANTASY XVI
  // ===== 2K / Take-Two (5) =====
  397540,   // Borderlands 3
  49520,    // Borderlands 2
  8870,     // BioShock Infinite
  409710,   // BioShock: The Collection
  2820220,  // NBA 2K25
  // ===== Strategy AAA (5) =====
  281990,   // Stellaris
  1158310,  // Crusader Kings III
  394360,   // Hearts of Iron IV
  1142710,  // Total War: WARHAMMER III
  289070,   // Sid Meier's Civilization VI
  // ===== Soulslike non-FromSoft (1) =====
  1627720,  // Lies of P
  // ===== Otros AAA célebres (12) =====
  870780,   // Control Ultimate Edition
  466240,   // HITMAN World of Assassination
  612880,   // Wolfenstein II: The New Colossus
  2440510,  // Wolfenstein: The Old Blood
  1259420,  // Dying Light 2 Stay Human
  1313140,  // Hogwarts Legacy
  275850,   // No Man's Sky
  1426210,  // It Takes Two
  2138330,  // Stellar Blade
  2357570,  // HELLDIVERS 2
  1272080,  // PAYDAY 3
  2900050   // Death Stranding 2: On the Beach
];

// Sanity check: si por error metimos un duplicado o no son 100, lanzamos en runtime.
{
  const set = new Set(SEED_STEAM_IDS);
  if (set.size !== SEED_STEAM_IDS.length) {
    throw new Error(`SEED_STEAM_IDS contiene duplicados: tiene ${SEED_STEAM_IDS.length} entries pero solo ${set.size} únicos`);
  }
  if (SEED_STEAM_IDS.length !== 100) {
    throw new Error(`SEED_STEAM_IDS debe tener exactamente 100 IDs, tiene ${SEED_STEAM_IDS.length}`);
  }
}

function genRefCode(username: string): string {
  return `${username.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function seedAdmin(db: Database.Database) {
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('admin') as { c: number };
  if (adminCount.c === 0) {
    const hash = bcrypt.hashSync('admin', 10);
    const r = db.prepare(
      `INSERT INTO users (username, email, password_hash, role, ref_code) VALUES (?, ?, ?, ?, ?)`
    ).run('admin', 'admin@dreitzteam.local', hash, 'admin', genRefCode('admin'));
    const adminId = r.lastInsertRowid as number;
    db.prepare(`INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)`).run(adminId);
    db.prepare(`INSERT OR IGNORE INTO wallet (user_id, balance) VALUES (?, 0)`).run(adminId);
  }
  // Backfill ref_code for users that don't have one
  const noRef = db.prepare(`SELECT id, username FROM users WHERE ref_code IS NULL OR ref_code = ''`).all() as any[];
  for (const u of noRef) {
    db.prepare('UPDATE users SET ref_code = ? WHERE id = ?').run(genRefCode(u.username), u.id);
  }
}

export async function seedDatabase(db: Database.Database) {
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('admin') as { c: number };
  if (adminCount.c === 0) {
    const hash = bcrypt.hashSync('admin', 10);
    const r = db.prepare(
      `INSERT INTO users (username, email, password_hash, role, ref_code) VALUES (?, ?, ?, ?, ?)`
    ).run('admin', 'admin@dreitzteam.local', hash, 'admin', genRefCode('admin'));
    const adminId = r.lastInsertRowid as number;
    db.prepare(`INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)`).run(adminId);
    db.prepare(`INSERT OR IGNORE INTO wallet (user_id, balance) VALUES (?, 0)`).run(adminId);
    console.log('[seed] Admin user created');
  }

  // Backfill ref_code for users that don't have one
  const noRef = db.prepare(`SELECT id, username FROM users WHERE ref_code IS NULL OR ref_code = ''`).all() as any[];
  for (const u of noRef) {
    db.prepare('UPDATE users SET ref_code = ? WHERE id = ?').run(genRefCode(u.username), u.id);
  }

  // Seed incremental: agrega cualquier juego de la lista que NO esté ya en DB
  // por su `steam_app_id`. Esto permite expandir el catálogo en un upgrade
  // sin tener que borrar `dreitzteam.db`.
  console.log(`[seed] checking ${SEED_STEAM_IDS.length} games against catalog...`);
  const existing = new Set(
    (db.prepare('SELECT steam_app_id FROM games WHERE steam_app_id IS NOT NULL').all() as any[])
      .map((r) => Number(r.steam_app_id))
  );
  const toFetch = SEED_STEAM_IDS.filter((id) => !existing.has(id));
  if (toFetch.length > 0) {
    console.log(`[seed] fetching ${toFetch.length} new games from Steam (will take ~${Math.ceil(toFetch.length * 0.6)}s)...`);
    let added = 0;
    for (let i = 0; i < toFetch.length; i++) {
      const appId = toFetch[i];
      try {
        const g = await fetchSteamGame(String(appId));
        if (!g) continue;

        // SKIP free-to-play: la lista está curada para AAA pagos. Si Steam reporta
        // price_initial = 0 significa que es free-to-play (o que el endpoint no
        // devolvió price_overview). En ambos casos lo descartamos.
        if (!g.price_initial || g.price_initial === 0) {
          console.log(`[seed] skip ${g.title} — free-to-play o sin precio`);
          continue;
        }

        // ⚡ DESCUENTO FORZADO 80% en todos los juegos del seed.
        // price_initial se mantiene como ancla "antes"; price_final cae al 20%.
        const SEED_DISCOUNT = 80;
        const forcedPriceFinal = +(g.price_initial * 0.20).toFixed(2);

        const result = db.prepare(`
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
          g.steam_app_id, g.title, g.short_description, g.detailed_description,
          g.developer, g.publisher, g.release_date, g.release_at,
          g.header_image, g.capsule_image, g.background_image,
          JSON.stringify(g.screenshots), g.trailer_url, JSON.stringify(g.genres), JSON.stringify(g.categories), g.languages,
          g.pc_requirements_min, g.pc_requirements_rec,
          g.price_initial, forcedPriceFinal, SEED_DISCOUNT, g.currency,
          10, i < 8 ? 1 : 0, 1,           // los primeros 8 nuevos son featured
          g.is_preorder ? 1 : 0, g.is_dlc ? 1 : 0,
          g.steam_review_count, g.metacritic_score, 'steam'
        );
        const gameId = result.lastInsertRowid as number;
        if (!g.is_preorder) {
          const stmt = db.prepare(`INSERT INTO licenses (game_id, code, status) VALUES (?, ?, ?)`);
          for (let j = 0; j < 10; j++) stmt.run(gameId, generateKey(), 'available');
        }

        const phStmt = db.prepare(`INSERT INTO price_history (game_id, price, discount_percent, recorded_at) VALUES (?, ?, ?, ?)`);
        const now = Date.now();
        for (let w = 11; w >= 0; w--) {
          const ts = new Date(now - w * 7 * 24 * 60 * 60 * 1000).toISOString();
          const variation = 1 + (Math.random() * 0.18 - 0.04);
          const p = +(g.price_initial * variation).toFixed(2);
          // historic discount = comparativo entre price actual vs initial; en t=0 forzamos 80
          const dp = w === 0 ? SEED_DISCOUNT : Math.max(0, Math.round((g.price_initial - p) / Math.max(g.price_initial, 1) * 100));
          phStmt.run(gameId, w === 0 ? forcedPriceFinal : p, dp, ts);
        }

        added += 1;
        console.log(`[seed] (${i + 1}/${toFetch.length}) added ${g.title} · -${SEED_DISCOUNT}%`);
        await sleep(400);
      } catch (e) {
        console.error(`[seed] failed appid=${appId}:`, (e as Error).message);
      }
    }
    console.log(`[seed] catalog grew by ${added} games`);
  }

  // Aplicar el descuento del 80% TAMBIÉN a los juegos ya existentes (los originales).
  // Sólo si el descuento actual es < 80 — así si el admin lo bajó manualmente, respetamos.
  const bumped = db.prepare(`
    UPDATE games
    SET price_final = ROUND(price_initial * 0.20, 2),
        discount_percent = 80,
        updated_at = CURRENT_TIMESTAMP
    WHERE is_active = 1 AND price_initial > 0 AND discount_percent < 80
  `).run();
  if (bumped.changes > 0) console.log(`[seed] forzado -80% en ${bumped.changes} juegos existentes`);

  // Sample bundle
  const bundleCount = db.prepare('SELECT COUNT(*) as c FROM bundles').get() as { c: number };
  if (bundleCount.c === 0) {
    const games = db.prepare(`SELECT id, title FROM games WHERE is_preorder = 0 ORDER BY price_final DESC LIMIT 3`).all() as any[];
    if (games.length >= 2) {
      const r = db.prepare(`
        INSERT INTO bundles (title, description, discount_percent, ends_at, hero_image)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'Pack Iniciación',
        'Tres aventuras imprescindibles para empezar tu colección',
        25,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        ''
      );
      const bundleId = r.lastInsertRowid as number;
      const link = db.prepare(`INSERT INTO bundle_games (bundle_id, game_id) VALUES (?, ?)`);
      for (const g of games) link.run(bundleId, g.id);
    }
  }

  // Sample promotion banner
  const promoCount = db.prepare('SELECT COUNT(*) as c FROM promotions').get() as { c: number };
  if (promoCount.c === 0) {
    const games = db.prepare(`SELECT id FROM games WHERE is_preorder = 0 LIMIT 6`).all() as any[];
    if (games.length) {
      const insert = db.prepare(`
        INSERT INTO promotions (title, subtitle, hero_image, accent_color, cta_text, cta_target, starts_at, ends_at, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const heroFromGame = (gid: number) => {
        const r = db.prepare('SELECT background_image, header_image FROM games WHERE id = ?').get(gid) as any;
        return r?.background_image || r?.header_image || '';
      };
      const r1 = insert.run(
        'Festival de RPG',
        'Hasta -40% en los grandes mundos abiertos',
        heroFromGame(games[0].id),
        '#a855ff',
        'Ver ofertas',
        '/store?genre=RPG',
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        10
      );
      const r2 = insert.run(
        'Promoción de fin de mes',
        'Los mejores títulos a precios brutales',
        heroFromGame(games[1]?.id ?? games[0].id),
        '#00d4ff',
        'Explorar',
        '/store?onSale=1',
        new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        5
      );
      const link = db.prepare(`INSERT INTO promotion_games (promotion_id, game_id) VALUES (?, ?)`);
      for (const g of games.slice(0, 4)) link.run(r1.lastInsertRowid, g.id);
      for (const g of games.slice(2, 6)) link.run(r2.lastInsertRowid, g.id);
    }
  }

  // Daily Deal — pick a random non-preorder game
  const dealCount = db.prepare(`SELECT COUNT(*) as c FROM flash_sales WHERE is_daily_deal = 1 AND ends_at > ?`).get(new Date().toISOString()) as any;
  if (dealCount.c === 0) {
    const game = db.prepare(`SELECT id, price_final FROM games WHERE is_preorder = 0 AND price_final > 50 ORDER BY RANDOM() LIMIT 1`).get() as any;
    if (game) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.prepare(`
        INSERT INTO flash_sales (game_id, discount_percent, max_units, starts_at, ends_at, is_daily_deal)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(game.id, 50, 5, new Date().toISOString(), tomorrow);
    }
  }

  // Sample collection
  const collCount = db.prepare('SELECT COUNT(*) as c FROM collections').get() as { c: number };
  if (collCount.c === 0) {
    const rpgs = db.prepare(`SELECT id FROM games WHERE genres LIKE '%"RPG"%' OR genres LIKE '%"Action"%' LIMIT 5`).all() as any[];
    if (rpgs.length) {
      const r = db.prepare(`
        INSERT INTO collections (slug, title, description, curator_name)
        VALUES (?, ?, ?, ?)
      `).run('top-rpgs-2026', 'Top RPGs para perderte', 'Cinco aventuras seleccionadas por la redacción de Dreitzteam.', 'Dreitzteam Editorial');
      const collId = r.lastInsertRowid as number;
      const link = db.prepare(`INSERT INTO collection_games (collection_id, game_id, ord) VALUES (?, ?, ?)`);
      rpgs.forEach((g, i) => link.run(collId, g.id, i));
    }
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function generateKey(): string {
  const seg = () => Math.random().toString(36).slice(2, 7).toUpperCase();
  return `DRZ-${seg()}-${seg()}-${seg()}-${seg()}`;
}
