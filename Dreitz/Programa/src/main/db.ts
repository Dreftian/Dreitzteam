import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(app.getPath('appData'), 'Dreitzteam');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'dreitzteam.db');
  dbInstance = new Database(dbPath);
  // Performance pragmas — perfil de SQLite para lectura concurrente alta:
  //   - WAL: writers no bloquean readers, lecturas instantáneas
  //   - synchronous=NORMAL: 2-3x más rápido que FULL, safe para crashes (no power-loss)
  //   - cache_size negativo = KB; -8000 = 8MB de cache (default es 2MB)
  //   - temp_store=MEMORY: temp tables en RAM en vez de disco
  //   - mmap_size: usa mmap para lecturas (zero-copy)
  //   - busy_timeout: espera 5s en vez de error inmediato cuando hay lock
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('cache_size = -8000');
  dbInstance.pragma('temp_store = MEMORY');
  dbInstance.pragma('mmap_size = 268435456'); // 256 MB
  dbInstance.pragma('busy_timeout = 5000');
  dbInstance.pragma('foreign_keys = ON');

  initSchema(dbInstance);
  ensureIndices(dbInstance);
  return dbInstance;
}

/**
 * Índices críticos para consultas frecuentes. Crearlos como migración
 * idempotente (`IF NOT EXISTS`) para que no fallen en upgrades.
 * Cubren los hot paths que el profiler señaló:
 *   - `gamesList` con filtros → games.is_active, is_featured, drm_platform
 *   - `availableStock` por juego → licenses(game_id, status)
 *   - `library` por usuario → library(user_id) ya es PK compuesta
 *   - `view_history` reciente → view_history(user_id, viewed_at)
 *   - `price_history` para gráficos → price_history(game_id, recorded_at)
 */
function ensureIndices(db: Database.Database) {
  const stmts = [
    'CREATE INDEX IF NOT EXISTS idx_games_active_featured ON games(is_active, is_featured)',
    'CREATE INDEX IF NOT EXISTS idx_games_drm ON games(drm_platform)',
    'CREATE INDEX IF NOT EXISTS idx_games_preorder ON games(is_preorder)',
    'CREATE INDEX IF NOT EXISTS idx_games_discount ON games(discount_percent DESC)',
    'CREATE INDEX IF NOT EXISTS idx_games_steam_app ON games(steam_app_id)',
    'CREATE INDEX IF NOT EXISTS idx_licenses_game_status ON licenses(game_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_view_history_user_time ON view_history(user_id, viewed_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_price_history_game_time ON price_history(game_id, recorded_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_funnel_user ON funnel_events(user_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_feed(user_id, created_at DESC)'
  ];
  for (const sql of stmts) {
    try { db.exec(sql); } catch { /* tabla aún no existe en esta versión */ }
  }
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_pro INTEGER NOT NULL DEFAULT 0,
      pro_plan TEXT,
      pro_expires_at TEXT,
      avatar TEXT,
      country TEXT DEFAULT 'PE',
      ref_code TEXT UNIQUE,
      ref_used TEXT,
      steam_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      steam_app_id INTEGER UNIQUE,
      title TEXT NOT NULL,
      short_description TEXT,
      detailed_description TEXT,
      developer TEXT,
      publisher TEXT,
      release_date TEXT,
      release_at TEXT,
      header_image TEXT,
      capsule_image TEXT,
      background_image TEXT,
      screenshots TEXT,
      genres TEXT,
      categories TEXT,
      tags TEXT,
      pc_requirements_min TEXT,
      pc_requirements_rec TEXT,
      price_initial REAL,
      price_final REAL,
      discount_percent INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'PEN',
      stock INTEGER NOT NULL DEFAULT 10,
      is_featured INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_dlc INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      is_preorder INTEGER NOT NULL DEFAULT 0,
      parent_game_id INTEGER,
      drm_platform TEXT DEFAULT 'steam',
      trailer_url TEXT,
      steam_review_score INTEGER,
      steam_review_count INTEGER,
      steam_recent_score INTEGER,
      metacritic_score INTEGER,
      languages TEXT,
      discount_ends_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      user_id INTEGER,
      order_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sold_at TEXT,
      redeemed_at TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      currency TEXT DEFAULT 'PEN',
      payment_method TEXT NOT NULL,
      card_last4 TEXT,
      card_brand TEXT,
      status TEXT NOT NULL DEFAULT 'paid',
      points_earned INTEGER DEFAULT 0,
      points_used INTEGER DEFAULT 0,
      promo_code TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      license_id INTEGER,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id),
      FOREIGN KEY (license_id) REFERENCES licenses(id)
    );

    CREATE TABLE IF NOT EXISTS library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      license_id INTEGER,
      acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      redeemed INTEGER DEFAULT 0,
      UNIQUE(user_id, game_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      starts_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      price REAL NOT NULL,
      discount_percent INTEGER DEFAULT 0,
      recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS view_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      target_id INTEGER,
      target_label TEXT,
      meta TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      theme TEXT DEFAULT 'system',
      accent TEXT DEFAULT 'cyan',
      language TEXT DEFAULT 'es',
      currency TEXT DEFAULT 'PEN',
      notifications INTEGER NOT NULL DEFAULT 1,
      sounds INTEGER NOT NULL DEFAULT 1,
      onboarding_seen INTEGER NOT NULL DEFAULT 0,
      reduce_motion INTEGER NOT NULL DEFAULT 0,
      newsletter INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      discount_percent INTEGER NOT NULL DEFAULT 20,
      ends_at TEXT,
      hero_image TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bundle_games (
      bundle_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      PRIMARY KEY (bundle_id, game_id),
      FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, code),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, game_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Promotional banners with custom artwork
    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT,
      hero_image TEXT,
      accent_color TEXT DEFAULT '#00d4ff',
      cta_text TEXT,
      cta_target TEXT,
      starts_at TEXT,
      ends_at TEXT,
      priority INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS promotion_games (
      promotion_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      PRIMARY KEY (promotion_id, game_id),
      FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- Daily Deal / Flash Sale
    CREATE TABLE IF NOT EXISTS flash_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      discount_percent INTEGER NOT NULL,
      max_units INTEGER,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      is_daily_deal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- Reviews
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT,
      body TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, game_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- Points / Loyalty
    CREATE TABLE IF NOT EXISTS points_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      target_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Gift cards
    CREATE TABLE IF NOT EXISTS gift_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'PEN',
      buyer_id INTEGER,
      redeemer_id INTEGER,
      status TEXT NOT NULL DEFAULT 'unsold',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sold_at TEXT,
      redeemed_at TEXT
    );

    -- User wallet balance (filled by gift cards / refunds)
    CREATE TABLE IF NOT EXISTS wallet (
      user_id INTEGER PRIMARY KEY,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'PEN',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Currency rates editable from Keys
    CREATE TABLE IF NOT EXISTS currency_rates (
      code TEXT PRIMARY KEY,
      rate_from_pen REAL NOT NULL,
      symbol TEXT NOT NULL,
      label TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Refunds
    CREATE TABLE IF NOT EXISTS refund_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      decision TEXT,
      decided_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      decided_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
    );

    -- Curated collections (Top RPGs 2025, etc.)
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      hero_image TEXT,
      curator_name TEXT,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS collection_games (
      collection_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      ord INTEGER DEFAULT 0,
      PRIMARY KEY (collection_id, game_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- Wishlist alert log so we don't double-notify
    CREATE TABLE IF NOT EXISTS wishlist_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      old_price REAL,
      new_price REAL,
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- Funnel events for analytics
    CREATE TABLE IF NOT EXISTS funnel_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event TEXT NOT NULL,
      target_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Friend system
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER NOT NULL,
      to_id INTEGER NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      decided_at TEXT,
      UNIQUE(from_id, to_id),
      FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS friendships (
      user_a INTEGER NOT NULL,
      user_b INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_a, user_b),
      FOREIGN KEY (user_a) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user_b) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Local install state of owned games
    CREATE TABLE IF NOT EXISTS installs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_installed',
      install_path TEXT,
      launch_path TEXT,
      installed_at TEXT,
      last_played_at TEXT,
      playtime_minutes INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, game_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- Daily missions
    CREATE TABLE IF NOT EXISTS daily_missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      target INTEGER NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      reward_points INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      assigned_date TEXT NOT NULL,
      UNIQUE(user_id, code, assigned_date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Stickers
    CREATE TABLE IF NOT EXISTS stickers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      game_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      rarity TEXT DEFAULT 'common',
      unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, code),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
    );

    -- Price alerts (when wishlisted game drops to or below threshold)
    CREATE TABLE IF NOT EXISTS price_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      target_price REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_notified_at TEXT,
      last_known_price REAL,
      UNIQUE(user_id, game_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- App-wide config (payment provider keys, payout account, etc.) — admin-only
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Steam-detected installations from libraryfolders.vdf
    CREATE TABLE IF NOT EXISTS steam_detected (
      steam_app_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      install_dir TEXT,
      size_bytes INTEGER,
      detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Cloud save snapshots (zip blobs in userData/saves/<game>/v<ts>.zip)
    CREATE TABLE IF NOT EXISTS save_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      label TEXT,
      file_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- Plugins registry
    CREATE TABLE IF NOT EXISTS plugins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      version TEXT,
      author TEXT,
      enabled INTEGER NOT NULL DEFAULT 0,
      installed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_friends_a ON friendships(user_a);
    CREATE INDEX IF NOT EXISTS idx_friends_b ON friendships(user_b);
    CREATE INDEX IF NOT EXISTS idx_friend_req_to ON friend_requests(to_id, status);
    CREATE INDEX IF NOT EXISTS idx_installs_user ON installs(user_id);
    CREATE INDEX IF NOT EXISTS idx_missions_user_date ON daily_missions(user_id, assigned_date);
    CREATE INDEX IF NOT EXISTS idx_stickers_user ON stickers(user_id);

    CREATE INDEX IF NOT EXISTS idx_games_active ON games(is_active);
    CREATE INDEX IF NOT EXISTS idx_games_dlc ON games(parent_game_id);
    CREATE INDEX IF NOT EXISTS idx_games_preorder ON games(is_preorder);
    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_library_user ON library(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_view_history_user ON view_history(user_id, viewed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_feed(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_global ON activity_feed(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_price_history_game ON price_history(game_id, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_actions ON admin_actions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, ends_at);
    CREATE INDEX IF NOT EXISTS idx_flash_active ON flash_sales(ends_at);
    CREATE INDEX IF NOT EXISTS idx_reviews_game ON reviews(game_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_funnel_event ON funnel_events(event, created_at DESC);
  `);

  // Migration tracking table (forward-compatible: new migration files keyed by id)
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const cols = (table: string) => db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  const has = (table: string, name: string) => cols(table).some((c) => c.name === name);
  const migrationApplied = (id: string) =>
    !!db.prepare('SELECT 1 FROM _migrations WHERE id = ?').get(id);

  // Each migration runs atomically: either all its ALTERs apply, or none do.
  // Avoids leaving the DB in a partial state when a migration fails mid-way.
  const migrate = (id: string, fn: () => void) => {
    if (migrationApplied(id)) return;
    const tx = db.transaction(() => {
      fn();
      db.prepare('INSERT OR IGNORE INTO _migrations (id) VALUES (?)').run(id);
    });
    try { tx(); }
    catch (e) { console.error(`[migration ${id}] failed:`, (e as Error).message); }
  };

  migrate('2026.01.games_extra_cols', () => {
    const newGameCols: [string, string][] = [
      ['discount_ends_at', 'TEXT'],
      ['is_dlc', 'INTEGER NOT NULL DEFAULT 0'],
      ['is_demo', 'INTEGER NOT NULL DEFAULT 0'],
      ['is_preorder', 'INTEGER NOT NULL DEFAULT 0'],
      ['parent_game_id', 'INTEGER'],
      ['drm_platform', "TEXT DEFAULT 'steam'"],
      ['trailer_url', 'TEXT'],
      ['steam_review_score', 'INTEGER'],
      ['steam_review_count', 'INTEGER'],
      ['steam_recent_score', 'INTEGER'],
      ['metacritic_score', 'INTEGER'],
      ['languages', 'TEXT'],
      ['release_at', 'TEXT'],
      // CDN — InsForge Storage URL del .zip + checksum sha256 + tamaño
      ['download_url', 'TEXT'],
      ['download_checksum', 'TEXT'],
      ['download_size_bytes', 'INTEGER']
    ];
    for (const [name, type] of newGameCols) {
      if (!has('games', name)) db.exec(`ALTER TABLE games ADD COLUMN ${name} ${type}`);
    }
  });

  migrate('2026.01.users_extra_cols', () => {
    const newUserCols: [string, string][] = [['ref_code', 'TEXT'], ['ref_used', 'TEXT'], ['steam_id', 'TEXT'], ['family_id', 'TEXT']];
    for (const [name, type] of newUserCols) {
      if (!has('users', name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
    }
  });

  migrate('2026.01.orders_extra_cols', () => {
    const newOrderCols: [string, string][] = [['points_earned', 'INTEGER DEFAULT 0'], ['points_used', 'INTEGER DEFAULT 0'], ['promo_code', 'TEXT']];
    for (const [name, type] of newOrderCols) {
      if (!has('orders', name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${type}`);
    }
  });

  migrate('2026.01.user_settings_extra_cols', () => {
    if (!has('user_settings', 'currency')) db.exec(`ALTER TABLE user_settings ADD COLUMN currency TEXT DEFAULT 'PEN'`);
    if (!has('user_settings', 'newsletter')) db.exec(`ALTER TABLE user_settings ADD COLUMN newsletter INTEGER NOT NULL DEFAULT 1`);
  });

  migrate('2026.05.user_settings_colorblind', () => {
    if (!has('user_settings', 'colorblind')) db.exec(`ALTER TABLE user_settings ADD COLUMN colorblind TEXT DEFAULT 'none'`);
  });

  migrate('2026.05.sync_metadata', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        table_name TEXT PRIMARY KEY,
        last_pulled_at TEXT,
        last_pushed_at TEXT
      );
    `);
  });

  migrate('2026.05.security_cols', () => {
    if (!has('users', 'recovery_question'))  db.exec(`ALTER TABLE users ADD COLUMN recovery_question TEXT`);
    if (!has('users', 'recovery_answer_hash')) db.exec(`ALTER TABLE users ADD COLUMN recovery_answer_hash TEXT`);
    if (!has('users', 'totp_secret'))         db.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`);
    if (!has('users', 'totp_enabled'))        db.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`);
  });

  migrate('2026.05.licenses_gift_type', () => {
    if (!has('licenses', 'license_type')) {
      db.exec(`ALTER TABLE licenses ADD COLUMN license_type TEXT NOT NULL DEFAULT 'purchase'`);
    }
    if (!has('licenses', 'gifted_by_user_id')) {
      db.exec(`ALTER TABLE licenses ADD COLUMN gifted_by_user_id INTEGER`);
    }
    if (!has('licenses', 'gift_message')) {
      db.exec(`ALTER TABLE licenses ADD COLUMN gift_message TEXT`);
    }
  });

  migrate('2026.05.pro_tier_and_presence', () => {
    // PRO Family tier — el usuario puede tener "free" | "pro" | "pro_family".
    // pro_family cubre hasta 5 cuentas linkeadas con el mismo family_id.
    if (!has('users', 'pro_tier')) db.exec(`ALTER TABLE users ADD COLUMN pro_tier TEXT NOT NULL DEFAULT 'free'`);
    if (!has('users', 'pro_expires_at')) db.exec(`ALTER TABLE users ADD COLUMN pro_expires_at TEXT`);

    // Presence: rastrea quién está online y qué está jugando ahora mismo.
    // Heartbeat cada 30s desde renderer → si no hay heartbeat en 90s, offline.
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_presence (
        user_id INTEGER PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'offline',
        currently_playing_game_id INTEGER,
        last_heartbeat_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (currently_playing_game_id) REFERENCES games(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_presence_status ON user_presence(status);
    `);

    // Cross-store prices: cache de precios de Steam/Epic/GOG/Humble por juego.
    db.exec(`
      CREATE TABLE IF NOT EXISTS cross_store_prices (
        game_id INTEGER NOT NULL,
        store TEXT NOT NULL,
        price_usd REAL NOT NULL,
        discount_percent INTEGER DEFAULT 0,
        url TEXT,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (game_id, store),
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );
    `);
  });

  // Default currency rates
  const ratesCount = db.prepare('SELECT COUNT(*) as c FROM currency_rates').get() as any;
  if (ratesCount.c === 0) {
    const insert = db.prepare(`INSERT INTO currency_rates (code, rate_from_pen, symbol, label) VALUES (?, ?, ?, ?)`);
    insert.run('PEN', 1.0, 'S/.', 'Sol peruano');
    insert.run('USD', 0.27, '$', 'Dólar estadounidense');
    insert.run('BRL', 1.45, 'R$', 'Real brasileño');
    insert.run('ARS', 280.0, '$', 'Peso argentino');
    insert.run('MXN', 4.95, '$', 'Peso mexicano');
    insert.run('EUR', 0.24, '€', 'Euro');
  }
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
