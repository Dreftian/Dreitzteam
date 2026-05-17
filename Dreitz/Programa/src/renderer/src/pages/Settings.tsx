import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSettings, ACCENT_OPTIONS, type Accent, type Colorblind } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Sun,
  Moon,
  Monitor,
  MessageCircle,
  Bell,
  Volume2,
  Sparkles,
  Globe2,
  Check,
  Lock,
  Eye,
  Puzzle,
  FolderOpen,
  DollarSign,
  Zap,
  Tv,
  CreditCard,
  Banknote,
  ShieldCheck,
  Gamepad2,
  Wallet,
  Users2,
  Database,
  BarChart3,
  UserCircle,
  HelpCircle,
  Palette,
  Minimize2
} from 'lucide-react';
import { useI18n, type Lang } from '../lib/i18n';
import { useCurrency } from '../contexts/CurrencyContext';
import { useUi } from '../contexts/UiContext';
import SteamSyncCard from '../components/SteamSyncCard';
import SecurityCard from '../components/SecurityCard';
import BackupCard from '../components/BackupCard';
import TelemetryCard from '../components/TelemetryCard';
import FamilyCard from '../components/FamilyCard';
import WalletCard from '../components/WalletCard';
import ReferralCard from '../components/ReferralCard';
import { toast } from 'sonner';

const WHATSAPP = '+51 904 957 354';
const WHATSAPP_NUM = '51904957354';
const LEVEL_ORDER = ['Bronze', 'Silver', 'Gold', 'Platinum'];

const COLORBLIND_OPTIONS: { value: Colorblind; label: string; tip: string }[] = [
  { value: 'none', label: 'Sin filtro', tip: 'Colores normales de Dreitz.' },
  { value: 'protanopia', label: 'Protanopia', tip: 'Reduce dependencia del rojo.' },
  { value: 'deuteranopia', label: 'Deuteranopia', tip: 'Reduce dependencia del verde.' },
  { value: 'tritanopia', label: 'Tritanopia', tip: 'Reduce dependencia del azul.' },
  { value: 'monochrome', label: 'Monocromatico', tip: 'Convierte la interfaz a escala de grises.' }
];

interface Plugin {
  slug: string;
  name: string;
  version: string | null;
  author: string | null;
  enabled: boolean;
  hasCss: boolean;
}

interface SettingsTab {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  content: ReactNode;
}

export default function Settings() {
  const settings = useSettings();
  const { user } = useAuth();
  const { t } = useI18n();
  const [level, setLevel] = useState<string>('Bronze');
  const [activeId, setActiveId] = useState('appearance');

  useEffect(() => {
    if (!user) return;
    window.api.achievementsProfileStats(user.id).then((s: any) => setLevel(s.level?.level ?? 'Bronze'));
  }, [user?.id]);

  async function testNotification() {
    await window.api.notifyShow({ title: 'Dreitz', body: 'Las notificaciones funcionan.' });
    toast.success('Notificacion enviada al sistema');
  }

  function isAccentUnlocked(min?: string) {
    if (!min) return true;
    return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min);
  }

  const tabs = useMemo<SettingsTab[]>(() => ([
    {
      id: 'appearance',
      title: t('settings.appearance'),
      description: 'Tema, modo claro/oscuro y colores de acento.',
      icon: <Palette size={18} />,
      content: <AppearancePanel settings={settings} level={level} isAccentUnlocked={isAccentUnlocked} />
    },
    {
      id: 'accessibility',
      title: 'Accesibilidad',
      description: 'Filtros de color para que la interfaz sea mas legible.',
      icon: <Eye size={18} />,
      content: <ColorblindPanel settings={settings} />
    },
    {
      id: 'language',
      title: t('settings.language'),
      description: 'Idioma y forma local de mostrar la tienda.',
      icon: <Globe2 size={18} />,
      content: <LanguagePanel settings={settings} />
    },
    {
      id: 'currency',
      title: 'Moneda',
      description: 'Moneda usada para convertir y mostrar precios.',
      icon: <DollarSign size={18} />,
      content: <CurrencyPanel />
    },
    {
      id: 'notifications',
      title: t('settings.notifications'),
      description: 'Avisos nativos de escritorio y prueba rapida.',
      icon: <Bell size={18} />,
      content: (
        <ActionStack>
          <SettingRow title="Notificaciones del escritorio" description={t('settings.notifications.tip')}>
            <Toggle on={settings.notifications} onChange={(v) => settings.setSetting('notifications', v)} />
          </SettingRow>
          <SettingRow title="Probar notificacion" description="Envia un aviso de prueba a Windows.">
            <button onClick={testNotification} className="btn btn-secondary text-xs">Probar</button>
          </SettingRow>
        </ActionStack>
      )
    },
    {
      id: 'sounds',
      title: t('settings.sounds'),
      description: 'Efectos de sonido al comprar, agregar al carrito y confirmar acciones.',
      icon: <Volume2 size={18} />,
      content: (
        <ActionStack>
          <SettingRow title="Sonidos sutiles" description={t('settings.sounds.tip')}>
            <Toggle on={settings.sounds} onChange={(v) => settings.setSetting('sounds', v)} />
          </SettingRow>
        </ActionStack>
      )
    },
    {
      id: 'motion',
      title: t('settings.reduce_motion'),
      description: 'Reduce transiciones y animaciones cuando cansan la vista.',
      icon: <Sparkles size={18} />,
      content: (
        <ActionStack>
          <SettingRow title="Reducir animaciones" description={t('settings.reduce_motion.tip')}>
            <Toggle on={settings.reduce_motion} onChange={(v) => settings.setSetting('reduce_motion', v)} />
          </SettingRow>
        </ActionStack>
      )
    },
    {
      id: 'system',
      title: 'Sistema',
      description: 'Arranque con Windows, bandeja del sistema y modo pantalla completa.',
      icon: <Tv size={18} />,
      content: <SystemIntegrationPanel />
    },
    {
      id: 'security',
      title: 'Seguridad',
      description: '2FA, pregunta de seguridad y recuperacion de cuenta.',
      icon: <ShieldCheck size={18} />,
      content: <SecurityCard />
    },
    {
      id: 'steam',
      title: 'Steam',
      description: 'Detecta juegos instalados desde Steam.',
      icon: <Gamepad2 size={18} />,
      content: <SteamSyncCard />
    },
    {
      id: 'wallet',
      title: 'Billetera',
      description: 'Saldo, puntos y actividad economica dentro de Dreitz.',
      icon: <Wallet size={18} />,
      content: <WalletCard />
    },
    {
      id: 'referrals',
      title: 'Referidos',
      description: 'Comparte tu codigo y revisa beneficios de invitacion.',
      icon: <Users2 size={18} />,
      content: <ReferralCard />
    },
    {
      id: 'family',
      title: 'Familia',
      description: 'Opciones de grupo familiar y beneficios compartidos.',
      icon: <Users2 size={18} />,
      content: <FamilyCard />
    },
    {
      id: 'backup',
      title: 'Backup',
      description: 'Copia y restauracion de datos locales.',
      icon: <Database size={18} />,
      content: <BackupCard />
    },
    {
      id: 'telemetry',
      title: 'Telemetria',
      description: 'Decide si quieres ayudar a mejorar Dreitz con datos anonimos.',
      icon: <BarChart3 size={18} />,
      content: <TelemetryCard />
    },
    {
      id: 'payments',
      title: 'Pagos',
      description: 'Pasarelas, llaves privadas y cuenta bancaria de destino.',
      icon: <CreditCard size={18} />,
      content: <PaymentsPanel />
    },
    {
      id: 'plugins',
      title: 'Plugins',
      description: 'Activa estilos de comunidad y abre la carpeta de plugins.',
      icon: <Puzzle size={18} />,
      content: <PluginsPanel />
    },
    {
      id: 'account',
      title: t('settings.account'),
      description: 'Resumen de usuario, rol, membresia y nivel.',
      icon: <UserCircle size={18} />,
      content: <AccountPanel level={level} />
    },
    {
      id: 'support',
      title: t('settings.support'),
      description: 'Contacto directo de soporte.',
      icon: <HelpCircle size={18} />,
      content: <SupportPanel />
    }
  ]), [settings, level, t, user?.id]);

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="h-full min-h-full flex bg-bg-base">
      <aside className="w-80 shrink-0 border-r border-border bg-bg-elev/70 overflow-y-auto">
        <div className="px-5 py-5 border-b border-border">
          <div className="text-2xl font-extrabold leading-none">Ajustes</div>
          <div className="text-xs text-fg-muted mt-2">Ventana de opciones estilo Steam.</div>
        </div>
        <nav className="p-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={`w-full min-h-[58px] rounded-md px-3 py-2.5 text-left flex items-start gap-3 transition-colors ${
                active.id === tab.id
                  ? 'bg-accent/12 text-fg border border-accent/35'
                  : 'text-fg-muted hover:bg-bg-hover hover:text-fg border border-transparent'
              }`}
            >
              <span className={`mt-0.5 ${active.id === tab.id ? 'text-accent' : 'text-fg-subtle'}`}>{tab.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">{tab.title}</span>
                <span className="block text-[11px] leading-snug text-fg-subtle mt-0.5">{tab.description}</span>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-7">
          <div className="mb-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-md border border-border bg-bg-elev flex items-center justify-center text-accent">
              {active.icon}
            </div>
            <div>
              <h2 className="text-3xl font-extrabold leading-tight">{active.title}</h2>
              <p className="text-sm text-fg-muted mt-1 max-w-2xl">{active.description}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-bg-elev p-5 shadow-lg">
            {active.content}
          </div>
        </div>
      </main>
    </div>
  );
}

function AppearancePanel({ settings, level, isAccentUnlocked }: { settings: ReturnType<typeof useSettings>; level: string; isAccentUnlocked: (min?: string) => boolean }) {
  const { t } = useI18n();
  return (
    <ActionStack>
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-fg-subtle">Tema</div>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: 'dark', icon: Moon, label: t('settings.theme.dark'), detail: 'Interfaz oscura.' },
            { value: 'light', icon: Sun, label: t('settings.theme.light'), detail: 'Interfaz clara.' },
            { value: 'system', icon: Monitor, label: t('settings.theme.system'), detail: settings.systemDark ? 'Hoy: oscuro' : 'Hoy: claro' }
          ] as const).map(({ value, icon: Icon, label, detail }) => (
            <button
              key={value}
              onClick={() => settings.setSetting('theme', value)}
              className={`p-4 rounded-md border transition-all text-left ${settings.theme === value ? 'border-accent bg-accent/10' : 'border-border hover:bg-bg-hover'}`}
            >
              <Icon className="mb-3 text-accent" size={22} />
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-[11px] text-fg-subtle mt-1">{detail}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-fg-subtle">
          <span>{t('settings.accent')}</span>
          <span>Tu nivel: <span className="text-fg">{level}</span></span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {ACCENT_OPTIONS.map((a) => {
            const unlocked = isAccentUnlocked(a.minLevel);
            return (
              <button
                key={a.value}
                onClick={() => unlocked ? settings.setSetting('accent', a.value as Accent) : toast.error(`Desbloquea con nivel ${a.minLevel}`)}
                disabled={!unlocked}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all text-sm ${settings.accent === a.value ? 'border-accent bg-accent/10' : 'border-border hover:bg-bg-hover'} ${!unlocked ? 'opacity-60' : ''}`}
              >
                <span className="w-6 h-6 rounded-full shrink-0" style={{ background: a.color }} />
                <span className="flex-1 text-left">
                  <span className="block font-semibold">{a.label}</span>
                  <span className="block text-[10px] text-fg-subtle">{a.minLevel ? `Requiere ${a.minLevel}` : 'Disponible'}</span>
                </span>
                {settings.accent === a.value && <Check size={14} className="text-accent" />}
                {!unlocked && <Lock size={13} className="text-fg-subtle" />}
              </button>
            );
          })}
        </div>
      </div>
    </ActionStack>
  );
}

function ColorblindPanel({ settings }: { settings: ReturnType<typeof useSettings> }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {COLORBLIND_OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => settings.setSetting('colorblind', o.value)}
          className={`p-4 rounded-md border text-left transition-all ${settings.colorblind === o.value ? 'border-accent bg-accent/10' : 'border-border hover:bg-bg-hover'}`}
        >
          <div className="text-sm font-semibold">{o.label}</div>
          <div className="text-xs text-fg-muted mt-1">{o.tip}</div>
        </button>
      ))}
    </div>
  );
}

function LanguagePanel({ settings }: { settings: ReturnType<typeof useSettings> }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {([
        { value: 'es', label: 'Espanol (Latinoamerica)', hint: 'Carrito · S/.' },
        { value: 'es-ES', label: 'Espanol (Espana)', hint: 'Cesta · EUR' },
        { value: 'en', label: 'English', hint: 'Cart · $' },
        { value: 'pt', label: 'Portugues', hint: 'Carrinho · R$' }
      ] as const).map(({ value, label, hint }) => (
        <button
          key={value}
          onClick={() => settings.setSetting('language', value as Lang)}
          className={`p-4 rounded-md border text-sm font-semibold text-left transition-all ${settings.language === value ? 'border-accent bg-accent/10' : 'border-border hover:bg-bg-hover'}`}
        >
          {label}
          <div className="text-[11px] text-fg-subtle font-normal mt-1">{hint}</div>
        </button>
      ))}
    </div>
  );
}

function CurrencyPanel() {
  const { rates, active, setActive } = useCurrency();
  if (!rates.length) return <EmptyNote>No hay monedas cargadas todavia.</EmptyNote>;
  return (
    <div className="grid sm:grid-cols-3 gap-2">
      {rates.map((r) => (
        <button
          key={r.code}
          onClick={() => setActive(r.code)}
          className={`p-3 rounded-md border transition-all text-left ${active === r.code ? 'border-accent bg-accent/10' : 'border-border hover:bg-bg-hover'}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold">{r.symbol}</span>
            <span className="text-sm font-semibold">{r.code}</span>
          </div>
          <div className="text-[10px] text-fg-subtle mt-0.5 truncate">{r.label}</div>
        </button>
      ))}
    </div>
  );
}

function SystemIntegrationPanel() {
  const { bigPicture, toggleBigPicture } = useUi();
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [trayPrefs, setTrayPrefs] = useState({ closeToTray: true, startMinimizedToTray: false });

  useEffect(() => {
    window.api.autoLaunchGet?.().then((s: any) => setAutoLaunch(!!s?.openAtLogin));
    window.api.systemPrefsGet?.().then((s: any) => {
      if (s) setTrayPrefs({ closeToTray: !!s.closeToTray, startMinimizedToTray: !!s.startMinimizedToTray });
    });
  }, []);

  async function setAuto(on: boolean) {
    await window.api.autoLaunchSet?.(on);
    setAutoLaunch(on);
    toast.success(on ? 'Dreitz se abrira al iniciar Windows' : 'Auto-arranque desactivado');
  }

  async function setTrayPref(key: 'closeToTray' | 'startMinimizedToTray', value: boolean) {
    const next = await window.api.systemPrefsSet?.({ key, value });
    if (next) setTrayPrefs({ closeToTray: !!next.closeToTray, startMinimizedToTray: !!next.startMinimizedToTray });
    toast.success(value ? 'Preferencia de bandeja activada' : 'Preferencia de bandeja desactivada');
  }

  return (
    <ActionStack>
      <SettingRow title="Abrir con Windows" description="Inicia Dreitz automaticamente cuando entras a Windows.">
        <Toggle on={autoLaunch} onChange={setAuto} />
      </SettingRow>
      <SettingRow title="Cerrar a bandeja del sistema" description="Al pulsar cerrar, Dreitz se oculta junto al reloj y sigue activo como Steam.">
        <Toggle on={trayPrefs.closeToTray} onChange={(v) => setTrayPref('closeToTray', v)} />
      </SettingRow>
      <SettingRow title="Iniciar oculto en bandeja" description="Cuando se abra Dreitz, carga en segundo plano y se muestra desde el icono de la bandeja.">
        <Toggle on={trayPrefs.startMinimizedToTray} onChange={(v) => setTrayPref('startMinimizedToTray', v)} />
      </SettingRow>
      <SettingRow title="Modo Big Picture" description="Pantalla completa estilo sala/TV; oculta sidebar y topbar.">
        <button onClick={toggleBigPicture} className="btn btn-secondary text-xs inline-flex items-center gap-2">
          <Minimize2 size={13} />
          {bigPicture ? 'Desactivar' : 'Activar'}
        </button>
      </SettingRow>
    </ActionStack>
  );
}

function PluginsPanel() {
  const [list, setList] = useState<Plugin[]>([]);

  async function load() {
    try { setList(await window.api.pluginsList()); } catch { /* noop */ }
  }

  useEffect(() => { load(); }, []);

  async function toggle(p: Plugin) {
    await window.api.pluginsSetEnabled({ slug: p.slug, enabled: !p.enabled });
    toast.success(p.enabled ? `${p.name} desactivado` : `${p.name} activado`);
    await load();
    const css = await window.api.pluginsEnabledCss();
    let style = document.getElementById('dreitz-plugin-css') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'dreitz-plugin-css';
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  return (
    <ActionStack>
      <SettingRow title="Carpeta de plugins" description="Abre la carpeta donde van plugin.json y style.css.">
        <button onClick={() => window.api.pluginsOpenFolder()} className="btn btn-secondary text-xs">
          <FolderOpen size={13} /> Abrir
        </button>
      </SettingRow>

      {!list.length ? (
        <EmptyNote>No hay plugins instalados.</EmptyNote>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
          {list.map((p) => (
            <div key={p.slug} className="p-3 flex items-center gap-3">
              <Puzzle size={16} className="text-purple-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold flex items-center gap-2">
                  {p.name}
                  {p.version && <span className="text-[10px] text-fg-subtle font-normal">v{p.version}</span>}
                </div>
                <div className="text-[11px] text-fg-subtle">{p.author ?? 'Anonimo'} · {p.hasCss ? 'CSS' : 'sin CSS'}</div>
              </div>
              <Toggle on={p.enabled} onChange={() => toggle(p)} compact />
            </div>
          ))}
        </div>
      )}
    </ActionStack>
  );
}

function PaymentsPanel() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<any>(null);
  const [keys, setKeys] = useState({
    bank: '',
    cci: '',
    holder: '',
    doc_id: ''
  });

  async function load() {
    const c = await window.api.paymentsConfig() as any;
    setCfg(c);
    setKeys({
      bank: c.payout_account.bank ?? '',
      cci: c.payout_account.cci ?? '',
      holder: c.payout_account.holder ?? '',
      doc_id: c.payout_account.doc_id ?? ''
    });
  }

  useEffect(() => { load(); }, []);

  async function save(key: string, value: string) {
    await window.api.paymentsSetKey({ key, value: value || null });
    toast.success('Guardado');
    await load();
  }

  if (!user || user.role !== 'admin') {
    return <EmptyNote>Solo el admin puede configurar las pasarelas de pago.</EmptyNote>;
  }

  return (
    <ActionStack>
      <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
        Recomendado para Peru: Culqi con BCP, Yape/Plin/Visa/MC y deposito a banco peruano.
      </div>
      <KeyRow label="Culqi · Llave privada" placeholder="sk_live_xxxx" enabled={cfg?.enabled?.culqi} onSave={(v) => save('payments.culqi.private_key', v)} />
      <KeyRow label="Stripe · Secret key" placeholder="sk_live_xxxx" enabled={cfg?.enabled?.stripe} onSave={(v) => save('payments.stripe.secret_key', v)} />
      <KeyRow label="PayPal · Client ID" placeholder="AbCDe..." onSave={(v) => save('payments.paypal.client_id', v)} />
      <KeyRow label="PayPal · Client Secret" placeholder="EFghi..." enabled={cfg?.enabled?.paypal} onSave={(v) => save('payments.paypal.client_secret', v)} />

      <div className="border-t border-border pt-4">
        <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm"><Banknote size={14} /> Cuenta bancaria de destino</h4>
        <div className="grid grid-cols-2 gap-2">
          <input className="input text-sm" placeholder="Banco" value={keys.bank} onChange={(e) => setKeys({ ...keys, bank: e.target.value })} onBlur={() => save('payout.bank', keys.bank)} />
          <input className="input text-sm" placeholder="CCI" value={keys.cci} onChange={(e) => setKeys({ ...keys, cci: e.target.value })} onBlur={() => save('payout.cci', keys.cci)} />
          <input className="input text-sm" placeholder="Titular" value={keys.holder} onChange={(e) => setKeys({ ...keys, holder: e.target.value })} onBlur={() => save('payout.holder', keys.holder)} />
          <input className="input text-sm" placeholder="DNI / RUC" value={keys.doc_id} onChange={(e) => setKeys({ ...keys, doc_id: e.target.value })} onBlur={() => save('payout.doc_id', keys.doc_id)} />
        </div>
      </div>
    </ActionStack>
  );
}

function AccountPanel({ level }: { level: string }) {
  const { user } = useAuth();
  return (
    <div className="grid sm:grid-cols-2 gap-4 text-sm">
      <Field label="Usuario" value={user?.username} />
      <Field label="Email" value={user?.email ?? '-'} />
      <Field label="Rol" value={user?.role} />
      <Field label="Membresia" value={user?.is_pro ? 'Pro' : 'Estandar'} />
      <Field label="Codigo referido" value={user?.ref_code ?? '-'} />
      <Field label="Nivel" value={level} />
    </div>
  );
}

function SupportPanel() {
  return (
    <ActionStack>
      <SettingRow title="Soporte por WhatsApp" description="Para problemas con claves, pagos o acceso a tu cuenta.">
        <a
          href={`https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent('Hola Dreitz, necesito soporte con mi cuenta.')}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary text-sm whitespace-nowrap"
        >
          WhatsApp {WHATSAPP}
        </a>
      </SettingRow>
      <div className="text-xs text-fg-subtle">Horario: Lun - Sab · 9:00 a 21:00</div>
    </ActionStack>
  );
}

function KeyRow({ label, placeholder, enabled, onSave }: { label: string; placeholder: string; enabled?: boolean; onSave: (v: string) => void }) {
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold">{label}</span>
        {enabled !== undefined && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${enabled ? 'bg-green-500/20 text-green-300' : 'bg-fg-subtle/15 text-fg-subtle'}`}>
            {enabled ? 'CONECTADO' : 'NO CONFIGURADO'}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          className="input text-xs flex-1 font-mono"
          placeholder={placeholder}
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button onClick={() => setShow((s) => !s)} className="btn btn-secondary text-xs">{show ? 'Ocultar' : 'Ver'}</button>
        <button onClick={() => { onSave(val); setVal(''); }} disabled={!val} className="btn btn-primary text-xs">Guardar</button>
      </div>
    </div>
  );
}

function ActionStack({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-fg-muted mt-1">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, compact = false }: { on: boolean; onChange: (v: boolean) => void; compact?: boolean }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`${compact ? 'w-9 h-5' : 'w-11 h-6'} rounded-full p-0.5 transition-colors ${on ? 'bg-accent' : 'bg-bg-hover border border-border'}`}
      aria-pressed={on}
    >
      <span className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} block bg-white rounded-full transition-transform ${on ? (compact ? 'translate-x-4' : 'translate-x-5') : ''}`} />
    </button>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-fg-subtle text-xs">{label}</div>
      <div className="font-medium mt-1">{value ?? '-'}</div>
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-border bg-bg-card/60 p-4 text-sm text-fg-muted">{children}</div>;
}
