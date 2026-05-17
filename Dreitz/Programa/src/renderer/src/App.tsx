import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { useLiveLocation } from './lib/useLiveLocation';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { usePresence } from './lib/usePresence';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { CartProvider } from './contexts/CartContext';
import { UiProvider } from './contexts/UiContext';
import { CatalogProvider } from './contexts/CatalogContext';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ProtectedRoute from './components/ProtectedRoute';
import AuthShell from './components/AuthShell';
import ErrorBoundary from './components/ErrorBoundary';
import CommandPalette from './components/CommandPalette';
import ShortcutsOverlay from './components/ShortcutsOverlay';
import OnboardingTour from './components/OnboardingTour';
import PageTransition from './components/PageTransition';
import KonamiEgg from './components/KonamiEgg';
import FriendsRail from './components/FriendsRail';
import WhatsNew from './components/WhatsNew';
import { useGlobalShortcuts } from './lib/useGlobalShortcuts';

// Code-splitting: cada página es un chunk separado. El bundle inicial baja de
// ~785 KB → ~350 KB; las páginas se cargan on-demand cuando el usuario navega.
// Mejora TTI (time-to-interactive) drásticamente — la tienda aparece sin
// esperar a que el bundle de Settings/Profile/Pro/etc se descargue.
// Eager (cargados en bundle inicial): Login, Register, Store, GameDetail, Library
import Login from './pages/Login';
import Register from './pages/Register';
import Store from './pages/Store';
import GameDetail from './pages/GameDetail';
import Library from './pages/Library';
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'));
const Pro = lazy(() => import('./pages/Pro'));
const Settings = lazy(() => import('./pages/Settings'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const GiftCards = lazy(() => import('./pages/GiftCards'));
const Points = lazy(() => import('./pages/Points'));
const ComingSoon = lazy(() => import('./pages/ComingSoon'));
const CollectionsList = lazy(() => import('./pages/Collections'));
const CollectionDetail = lazy(() => import('./pages/CollectionDetail'));
const Refunds = lazy(() => import('./pages/Refunds'));
const Friends = lazy(() => import('./pages/Friends'));
const FriendLibrary = lazy(() => import('./pages/FriendLibrary'));
const Missions = lazy(() => import('./pages/Missions'));
const Stickers = lazy(() => import('./pages/Stickers'));
const Wrapped = lazy(() => import('./pages/Wrapped'));
const Plugins = lazy(() => import('./pages/Plugins'));
const RedeemKey = lazy(() => import('./pages/RedeemKey'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
import CartDrawer from './components/CartDrawer';
import AchievementUnlockModal from './components/AchievementUnlockModal';
import NowPlayingWidget from './components/NowPlayingWidget';
import SurpriseButton from './components/SurpriseButton';

function PresencePinger() {
  // Hook que avisa al backend cada 60s que el usuario sigue activo. Power el
  // indicador "online" en la lista de amigos.
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const ping = () => window.api.presencePing?.({ userId: user.id }).catch(() => {});
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, [user?.id]);
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Heartbeat de presencia cada 30s → permite a los amigos ver "está en línea".
  usePresence(user?.id);
  return (
    <div className={`h-screen flex flex-col ${user?.is_pro ? 'pro-active' : ''}`}>
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <FriendsRail />
      </div>
      <CartDrawer />
      <AchievementUnlockModal />
      <NowPlayingWidget />
      <SurpriseButton />
      <PresencePinger />
    </div>
  );
}

/**
 * Contenido principal cuando el usuario está autenticado. Las rutas pre-login
 * (login, register, reset) las maneja `ProtectedRoute` ahora — renderiza
 * `<Login />` directo en vez de usar `<Navigate>`, lo cual evita el bug de
 * HashRouter en Electron donde `useLocation` no se sincroniza con el hash tras
 * el primer `navigate(...)`.
 */
function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLiveLocation();
  const { refresh } = useAuth();

  useGlobalShortcuts({
    onPalette: () => setPaletteOpen(true),
    onShortcuts: () => setShortcutsOpen(true)
  });

  useEffect(() => {
    const off = window.api.onCommand?.((cmd: string) => {
      if (cmd === 'open:settings') {
        (window.api as any).settingsOpen?.();
        return;
      }
      if (cmd.startsWith('nav:')) nav(cmd.slice(4));
    });
    return () => off?.();
  }, [nav]);

  useEffect(() => {
    const off = window.api.onUserChanged?.(() => refresh());
    return () => off?.();
  }, [refresh]);

  useEffect(() => {
    const off = window.api.onPriceAlert?.((p) => {
      toast.success(`Bajada de precio: ${p.title} ahora a S/. ${p.price.toFixed(2)}`, { duration: 5000 });
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    const off = window.api.onSeedDone?.(() => toast.success('Catálogo cargado'));
    return () => off?.();
  }, []);

  useEffect(() => {
    window.api.pluginsEnabledCss?.().then((css: string) => {
      if (!css) return;
      const style = document.createElement('style');
      style.id = 'dreitz-plugin-css';
      style.textContent = css;
      document.head.appendChild(style);
    });
  }, []);

  // Discord Rich Presence: debounced 2s para no martillar el IPC en navegaciones
  // rápidas (el usuario pasa por 3 páginas en 1s buscando algo). Solo envía
  // el ÚLTIMO estado después de que se asienta.
  useEffect(() => {
    const p = loc.pathname;
    const stateMap: Record<string, string> = {
      '/store': 'Explorando la tienda',
      '/library': 'En su biblioteca',
      '/wishlist': 'Revisando deseados',
      '/cart': 'En el carrito',
      '/checkout': 'Comprando',
      '/profile': 'En su perfil',
      '/settings': 'Ajustando preferencias'
    };
    const state = stateMap[p] ?? (p.startsWith('/game/') ? 'Viendo un juego' : 'Navegando');
    const id = setTimeout(() => {
      (window.api as any).discordSetActivity?.({
        details: 'Dreitz · Launcher',
        state,
        large_image: 'dragon',
        large_text: 'Dreitz Launcher',
        start_timestamp: Math.floor(Date.now() / 1000)
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(id);
  }, [loc.pathname]);

  // Switch manual por pathname — HashRouter + Electron tiene un bug donde
  // <Routes> rinde null aunque useLocation reporte la URL correcta. Para
  // evitarlo, hacemos el matching nosotros mismos contra `loc.pathname`
  // (que useLiveLocation mantiene sincronizado con window.location.hash).
  // Soporta params dinámicos via prefix matching (`/game/123` → GameDetail).
  function renderPage(): React.ReactNode {
    const p = loc.pathname;
    if (p === '/' || p === '') return <Store />;
    if (p === '/store') return <Store />;
    if (p === '/library') return <Library />;
    if (p === '/cart') return <Cart />;
    if (p === '/checkout') return <Checkout />;
    if (p === '/profile') return <Profile />;
    if (p === '/profile/edit') return <ProfileEdit />;
    if (p === '/pro') return <Pro />;
    if (p === '/settings') return <Settings />;
    if (p === '/wishlist') return <Wishlist />;
    if (p === '/gift-cards') return <GiftCards />;
    if (p === '/points') return <Points />;
    if (p === '/coming-soon') return <ComingSoon />;
    if (p === '/collections') return <CollectionsList />;
    if (p.startsWith('/collections/')) {
      // Pasamos el ID por prop — `useParams()` está desincronizado con
      // HashRouter en Electron y devuelve {} aunque la URL sea correcta.
      const id = p.slice('/collections/'.length);
      return <CollectionDetail routeId={id} />;
    }
    if (p === '/refunds') return <Refunds />;
    if (p === '/friends') return <Friends />;
    if (p.startsWith('/friends/')) {
      const id = p.slice('/friends/'.length);
      return <FriendLibrary routeId={id} />;
    }
    if (p === '/missions') return <Missions />;
    if (p === '/stickers') return <Stickers />;
    if (p === '/wrapped') return <Wrapped />;
    if (p === '/plugins') return <Plugins />;
    if (p === '/redeem') return <RedeemKey />;
    if (p.startsWith('/game/')) {
      const id = p.slice('/game/'.length);
      return <GameDetail routeId={id} />;
    }
    // Fallback — desconocido → store
    return <Store />;
  }

  return (
    <Shell>
      <ErrorBoundary>
        <PageTransition k={loc.pathname}>
          <Suspense fallback={<div className="p-10 text-fg-muted">Cargando…</div>}>
            {renderPage()}
          </Suspense>
        </PageTransition>
      </ErrorBoundary>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <OnboardingTour />
      <KonamiEgg />
      <WhatsNew />
    </Shell>
  );
}

/**
 * Página de auth (cuando el usuario está deslogeado y va a /register o
 * /reset-password). Se monta solo en esos casos — `/login` la sirve
 * `ProtectedRoute` directamente.
 */
function AuthRoutes() {
  const loc = useLiveLocation();

  function renderAuthPage(): React.ReactNode {
    if (loc.pathname === '/register') return <Register />;
    if (loc.pathname === '/reset-password') return <ResetPassword />;
    return <Login />;
  }

  return (
    <AuthShell>
      <Suspense fallback={<div className="h-full flex items-center justify-center text-fg-muted">Cargando...</div>}>
        {renderAuthPage()}
      </Suspense>
    </AuthShell>
  );
}

/**
 * Frame minimalista de la ventana de ajustes separada (estilo Steam).
 * Reusa el componente <Settings/> pero sin Sidebar/TopBar/FriendsRail.
 * Tiene su propio header con botón cerrar.
 */
function SettingsWindowFrame() {
  return (
    <div className="h-screen flex flex-col bg-bg-base">
      {/* Drag region top bar custom */}
      <div
        className="h-9 bg-bg-surface border-b border-border flex items-center justify-between px-4"
        style={{ ['-webkit-app-region' as any]: 'drag' }}
      >
        <span className="text-sm text-fg-muted font-medium">Dreitz · Opciones</span>
        <button
          onClick={() => (window.api as any).settingsClose?.()}
          className="text-fg-muted hover:text-fg text-xs"
          style={{ ['-webkit-app-region' as any]: 'no-drag' }}
        >
          Cerrar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<div className="p-10 text-fg-muted">Cargando ajustes…</div>}>
          <Settings />
        </Suspense>
      </div>
    </div>
  );
}

function AppContent() {
  const { effectiveTheme } = useSettings();
  const { user, loading } = useAuth();

  // Avisar al main process cuando React ha terminado de hidratarse y el
  // AuthContext ya resolvió. Esto permite al splash quedarse hasta que la app
  // está lista de verdad en lugar de cortarse en `ready-to-show`.
  useEffect(() => {
    if (!loading) {
      (window.api as any).appReady?.().catch(() => {});
    }
  }, [loading]);

  // Auth determina qué árbol rinde: pre-login (Login/Register/Reset) o post-login (Shell).
  // No usamos <Navigate> porque HashRouter + Electron desincroniza useLocation.
  return (
    <>
      <Toaster
        position="bottom-right"
        theme={effectiveTheme as 'dark' | 'light'}
        richColors
        closeButton
        toastOptions={{ duration: 2400 }}
      />
      {loading ? (
        <div className="h-screen flex items-center justify-center text-fg-muted">Cargando…</div>
      ) : window.location.hash.startsWith('#/settings-window') ? (
        // Ventana separada de ajustes (estilo Steam) — no rendea Sidebar/TopBar.
        <SettingsWindowFrame />
      ) : !user ? (
        <AuthRoutes />
      ) : (
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <CurrencyProvider>
          <CartProvider>
            <UiProvider>
              <CatalogProvider>
                <HashRouter>
                  <AppContent />
                </HashRouter>
              </CatalogProvider>
            </UiProvider>
          </CartProvider>
        </CurrencyProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
