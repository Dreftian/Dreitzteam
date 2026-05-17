import { getDb } from './db';

export interface SystemPrefs {
  closeToTray: boolean;
  startMinimizedToTray: boolean;
}

const PREF_KEYS = {
  closeToTray: 'system.close_to_tray',
  startMinimizedToTray: 'system.start_minimized_to_tray'
} as const;

const DEFAULTS: SystemPrefs = {
  closeToTray: true,
  startMinimizedToTray: false
};

function readBool(key: string, fallback: boolean): boolean {
  try {
    const row = getDb().prepare('SELECT value FROM app_config WHERE key = ?').get(key) as { value?: string } | undefined;
    if (!row?.value) return fallback;
    return row.value === '1' || row.value === 'true';
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean) {
  getDb().prepare(`
    INSERT INTO app_config (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value ? '1' : '0');
}

export function getSystemPrefs(): SystemPrefs {
  return {
    closeToTray: readBool(PREF_KEYS.closeToTray, DEFAULTS.closeToTray),
    startMinimizedToTray: readBool(PREF_KEYS.startMinimizedToTray, DEFAULTS.startMinimizedToTray)
  };
}

export function setSystemPref<K extends keyof SystemPrefs>(key: K, value: SystemPrefs[K]): SystemPrefs {
  writeBool(PREF_KEYS[key], Boolean(value));
  return getSystemPrefs();
}
