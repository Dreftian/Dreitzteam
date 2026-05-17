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
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  initSchema(dbInstance);
  return dbInstance;
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
      ref_code TEXT,
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
      redeemed_at TEXT
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      license_id INTEGER,
      price REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      license_id INTEGER,
      acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      redeemed INTEGER DEFAULT 0,
      UNIQUE(user_id, game_id)
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      price REAL NOT NULL,
      discount_percent INTEGER DEFAULT 0,
      recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS view_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activity_feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      target_id INTEGER,
      target_label TEXT,
      meta TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
      newsletter INTEGER NOT NULL DEFAULT 1
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
      PRIMARY KEY (bundle_id, game_id)
    );
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, code)
    );
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, game_id)
    );
    CREATE TABLE IF NOT EXISTS admin_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
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
      PRIMARY KEY (promotion_id, game_id)
    );
    CREATE TABLE IF NOT EXISTS flash_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      discount_percent INTEGER NOT NULL,
      max_units INTEGER,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      is_daily_deal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT,
      body TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, game_id)
    );
    CREATE TABLE IF NOT EXISTS points_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      target_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
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
    CREATE TABLE IF NOT EXISTS wallet (
      user_id INTEGER PRIMARY KEY,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'PEN'
    );
    CREATE TABLE IF NOT EXISTS currency_rates (
      code TEXT PRIMARY KEY,
      rate_from_pen REAL NOT NULL,
      symbol TEXT NOT NULL,
      label TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
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
      decided_at TEXT
    );
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
      PRIMARY KEY (collection_id, game_id)
    );
    CREATE TABLE IF NOT EXISTS wishlist_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      old_price REAL,
      new_price REAL,
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS funnel_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event TEXT NOT NULL,
      target_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS steam_detected (
      steam_app_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      install_dir TEXT,
      size_bytes INTEGER,
      detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS save_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      label TEXT,
      file_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_admin_actions ON admin_actions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, ends_at);
    CREATE INDEX IF NOT EXISTS idx_flash_active ON flash_sales(ends_at);
    CREATE INDEX IF NOT EXISTS idx_reviews_game ON reviews(game_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_funnel_event ON funnel_events(event, created_at DESC);
  `);

  const cols = (table: string) => db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  const has = (table: string, name: string) => cols(table).some((c) => c.name === name);
  const newGameCols = [
    ['discount_ends_at', 'TEXT'], ['is_dlc', 'INTEGER NOT NULL DEFAULT 0'],
    ['is_demo', 'INTEGER NOT NULL DEFAULT 0'], ['is_preorder', 'INTEGER NOT NULL DEFAULT 0'],
    ['parent_game_id', 'INTEGER'], ['drm_platform', "TEXT DEFAULT 'steam'"],
    ['trailer_url', 'TEXT'], ['steam_review_score', 'INTEGER'],
    ['steam_review_count', 'INTEGER'], ['steam_recent_score', 'INTEGER'],
    ['metacritic_score', 'INTEGER'], ['languages', 'TEXT'], ['release_at', 'TEXT']
  ];
  for (const [name, type] of newGameCols) {
    if (!has('games', name)) try { db.exec(`ALTER TABLE games ADD COLUMN ${name} ${type}`); } catch {}
  }
  const newUserCols = [
    ['ref_code', 'TEXT'], ['ref_used', 'TEXT'], ['steam_id', 'TEXT'],
    ['recovery_question', 'TEXT'], ['recovery_answer_hash', 'TEXT'],
    ['totp_secret', 'TEXT'], ['totp_enabled', 'INTEGER NOT NULL DEFAULT 0']
  ];
  for (const [name, type] of newUserCols) {
    if (!has('users', name)) try { db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`); } catch {}
  }
  const newLicenseCols = [
    ['license_type', "TEXT NOT NULL DEFAULT 'purchase'"],
    ['gifted_by_user_id', 'INTEGER'],
    ['gift_message', 'TEXT']
  ];
  for (const [name, type] of newLicenseCols) {
    if (!has('licenses', name)) try { db.exec(`ALTER TABLE licenses ADD COLUMN ${name} ${type}`); } catch {}
  }
  const newOrderCols = [['points_earned', 'INTEGER DEFAULT 0'], ['points_used', 'INTEGER DEFAULT 0'], ['promo_code', 'TEXT']];
  for (const [name, type] of newOrderCols) {
    if (!has('orders', name)) try { db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${type}`); } catch {}
  }
  if (!has('user_settings', 'currency')) try { db.exec(`ALTER TABLE user_settings ADD COLUMN currency TEXT DEFAULT 'PEN'`); } catch {}
  if (!has('user_settings', 'newsletter')) try { db.exec(`ALTER TABLE user_settings ADD COLUMN newsletter INTEGER NOT NULL DEFAULT 1`); } catch {}

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
