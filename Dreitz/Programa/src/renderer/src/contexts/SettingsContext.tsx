import { createContext, useContext, useEffect, useState, type ReactNode, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { I18nContext, translate, type Lang } from '../lib/i18n';
import { setEnabled as setSoundsEnabled } from '../lib/sounds';

export type Theme = 'dark' | 'light' | 'system';
export type Accent = 'cyan' | 'magenta' | 'green' | 'orange' | 'purple' | 'gold' | 'platinum' | 'neon-pink' | 'aurora' | 'sunset' | 'lava' | 'mint';
export type Colorblind = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome';

interface UserSettings {
  theme: Theme;
  accent: Accent;
  language: Lang;
  currency: string;
  notifications: boolean;
  sounds: boolean;
  onboarding_seen: boolean;
  reduce_motion: boolean;
  newsletter: boolean;
  colorblind: Colorblind;
}

interface SettingsCtx extends UserSettings {
  effectiveTheme: 'dark' | 'light';
  systemDark: boolean;
  setSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
  loaded: boolean;
}

const DEFAULTS: UserSettings = {
  theme: 'system',
  accent: 'cyan',
  language: 'es',
  currency: 'PEN',
  notifications: true,
  sounds: true,
  onboarding_seen: false,
  reduce_motion: false,
  newsletter: true,
  colorblind: 'none'
};

const ACCENTS: Record<Accent, { color: string; hover: string }> = {
  cyan: { color: '#00d4ff', hover: '#00b8e0' },
  magenta: { color: '#ff3aa6', hover: '#e72993' },
  green: { color: '#38e07b', hover: '#26c466' },
  orange: { color: '#ffa632', hover: '#e8901c' },
  purple: { color: '#a855ff', hover: '#9237ee' },
  gold: { color: '#fde047', hover: '#facc15' },
  platinum: { color: '#a5f3fc', hover: '#67e8f9' },
  'neon-pink': { color: '#f472b6', hover: '#ec4899' },
  aurora:   { color: '#7dd3fc', hover: '#22d3ee' },  // azul-ártico
  sunset:   { color: '#fb7185', hover: '#f43f5e' },  // rosa-coral
  lava:     { color: '#f97316', hover: '#ea580c' },  // naranja brasa
  mint:     { color: '#5eead4', hover: '#2dd4bf' }   // verde menta
};

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);
  const [systemDark, setSystemDark] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      const raw = localStorage.getItem('dreitz.settings.guest');
      setSettings(raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS);
      setLoaded(true);
      return;
    }
    window.api.settingsGet(user.id).then((s: any) => {
      setSettings({ ...DEFAULTS, ...s });
      setLoaded(true);
    });
  }, [user?.id]);

  useEffect(() => {
    window.api.themeSystem().then((s: any) => setSystemDark(!!s.shouldUseDark));
    const off = window.api.onThemeChange?.((p) => setSystemDark(!!p.shouldUseDark));
    return () => off?.();
  }, []);

  useEffect(() => {
    if (!user) return;
    const off = window.api.onSettingsChanged?.((payload) => {
      if (payload.userId !== user.id || !payload.settings) return;
      setSettings({ ...DEFAULTS, ...payload.settings });
      setLoaded(true);
    });
    return () => off?.();
  }, [user?.id]);

  // Detect Win11 Mica/Acrylic and apply matching root class so globals.css can
  // ease the body opacity for the material to show through subtly.
  useEffect(() => {
    window.api.systemMaterial?.().then((m) => {
      const root = document.documentElement;
      root.classList.remove('mica', 'acrylic');
      if (m === 'mica' || m === 'acrylic') root.classList.add(m);
    }).catch(() => {});
  }, []);

  const effectiveTheme: 'dark' | 'light' = useMemo(() => {
    if (settings.theme === 'system') return systemDark ? 'dark' : 'light';
    return settings.theme;
  }, [settings.theme, systemDark]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', effectiveTheme === 'dark');
    root.classList.toggle('light', effectiveTheme === 'light');
    const a = ACCENTS[settings.accent] ?? ACCENTS.cyan;
    root.style.setProperty('--accent', a.color);
    root.style.setProperty('--accent-hover', a.hover);
    root.classList.toggle('reduce-motion', !!settings.reduce_motion);
    // Colorblind filter
    root.classList.remove('cb-protanopia', 'cb-deuteranopia', 'cb-tritanopia', 'cb-monochrome');
    if (settings.colorblind && settings.colorblind !== 'none') {
      root.classList.add(`cb-${settings.colorblind}`);
    }
  }, [effectiveTheme, settings.accent, settings.reduce_motion, settings.colorblind]);

  // Keep the sound synthesizer in sync with the user's preference so toggling
  // the setting silences the Web Audio output immediately.
  useEffect(() => {
    setSoundsEnabled(!!settings.sounds);
  }, [settings.sounds]);

  const setSetting = useCallback(
    async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((curr) => ({ ...curr, [key]: value }));
      if (user) {
        try {
          await window.api.settingsUpdate({ userId: user.id, key: key as string, value });
        } catch {
          // ignore unknown-key errors so non-DB-backed prefs still work in-memory
        }
      } else {
        const raw = localStorage.getItem('dreitz.settings.guest');
        const curr = raw ? JSON.parse(raw) : {};
        localStorage.setItem('dreitz.settings.guest', JSON.stringify({ ...curr, [key]: value }));
      }
    },
    [user?.id]
  );

  const i18nValue = useMemo(
    () => ({
      lang: settings.language,
      t: (k: string) => translate(settings.language, k),
      setLang: (l: Lang) => setSetting('language', l)
    }),
    [settings.language, setSetting]
  );

  return (
    <Ctx.Provider value={{ ...settings, effectiveTheme, systemDark, setSetting, loaded }}>
      <I18nContext.Provider value={i18nValue}>{children}</I18nContext.Provider>
    </Ctx.Provider>
  );
}

export function useSettings(): SettingsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSettings must be inside SettingsProvider');
  return c;
}

export const ACCENT_OPTIONS: { value: Accent; label: string; color: string; minLevel?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' }[] = [
  { value: 'cyan', label: 'Cian' , color: '#00d4ff' },
  { value: 'magenta', label: 'Magenta', color: '#ff3aa6' },
  { value: 'green', label: 'Verde', color: '#38e07b' },
  { value: 'orange', label: 'Naranja', color: '#ffa632' },
  { value: 'purple', label: 'Púrpura', color: '#a855ff' },
  { value: 'mint', label: 'Menta', color: '#5eead4' },
  { value: 'aurora', label: 'Aurora', color: '#7dd3fc' },
  { value: 'neon-pink', label: 'Neón rosa', color: '#f472b6', minLevel: 'Silver' },
  { value: 'sunset', label: 'Sunset', color: '#fb7185', minLevel: 'Silver' },
  { value: 'lava', label: 'Lava', color: '#f97316', minLevel: 'Gold' },
  { value: 'gold', label: 'Oro', color: '#fde047', minLevel: 'Gold' },
  { value: 'platinum', label: 'Platinum', color: '#a5f3fc', minLevel: 'Platinum' }
];
