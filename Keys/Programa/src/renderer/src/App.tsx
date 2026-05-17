import { useState, type ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CreditCard, Cloud, ShieldCheck, Globe2, FileText, ScrollText, UploadCloud, Gift } from 'lucide-react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Catalog from './pages/Catalog';
import AddGame from './pages/AddGame';
import Licenses from './pages/Licenses';
import Sales from './pages/Sales';
import AuditLog from './pages/AuditLog';
import Promotions from './pages/Promotions';
import FlashSales from './pages/FlashSales';
import GiftCardsAdmin from './pages/GiftCards';
import RefundsAdmin from './pages/Refunds';
import CollectionsAdmin from './pages/Collections';
import CurrencyAdmin from './pages/Currency';
// La página `Supabase.tsx` está rebrandeada como InsForge; mantenemos el archivo
// para minimizar churn pero el componente exportado se llama `InsForgePage`.
import InsForgePage from './pages/Supabase';
import PaymentsAdmin from './pages/Payments';
import BulkImport from './pages/BulkImport';
import AdminSecurity from './pages/AdminSecurity';
import Templates from './pages/Templates';
import FreeGameAdmin from './pages/FreeGame';

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <TitleBar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth();
  if (loading) return <div className="h-full flex items-center justify-center text-fg-muted">Cargando...</div>;
  if (!admin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SettingsWindowFrame() {
  const options = [
    {
      id: 'payments',
      title: 'Pagos',
      desc: 'Pasarelas, Yape, PayPal, Culqi y credenciales de cobro.',
      icon: CreditCard,
      content: <PaymentsAdmin />
    },
    {
      id: 'insforge',
      title: 'InsForge',
      desc: 'Conexion remota, credenciales y sincronizacion del catalogo.',
      icon: Cloud,
      content: <InsForgePage />
    },
    {
      id: 'security',
      title: 'Seguridad 2FA',
      desc: 'Activacion, verificacion y apagado del segundo factor admin.',
      icon: ShieldCheck,
      content: <AdminSecurity />
    },
    {
      id: 'currency',
      title: 'Moneda',
      desc: 'Tipos de cambio usados por la tienda y comparativas.',
      icon: Globe2,
      content: <CurrencyAdmin />
    },
    {
      id: 'templates',
      title: 'Plantillas',
      desc: 'Mensajes reutilizables para licencias, correos y soporte.',
      icon: FileText,
      content: <Templates />
    },
    {
      id: 'audit',
      title: 'Auditoria',
      desc: 'Historial de acciones administrativas y filtros de revision.',
      icon: ScrollText,
      content: <AuditLog />
    },
    {
      id: 'bulk',
      title: 'Importacion',
      desc: 'Carga masiva de juegos y datos desde Steam.',
      icon: UploadCloud,
      content: <BulkImport />
    },
    {
      id: 'free-game',
      title: 'Juego gratis',
      desc: 'Seleccion semanal, duracion activa y limpieza de beneficio.',
      icon: Gift,
      content: <FreeGameAdmin />
    }
  ];
  const [activeId, setActiveId] = useState(options[0].id);
  const active = options.find((item) => item.id === activeId) ?? options[0];

  return (
    <div className="h-screen flex flex-col bg-bg-base text-fg">
      <div
        className="h-9 bg-bg-base border-b border-border flex items-center justify-between px-4"
        style={{ ['-webkit-app-region' as any]: 'drag' }}
      >
        <span className="text-xs font-semibold tracking-wide text-fg-muted">DREITZ KEYS - OPCIONES</span>
        <button
          onClick={() => (window.api as any).settingsClose?.()}
          className="text-xs font-semibold text-fg-muted hover:text-fg"
          style={{ ['-webkit-app-region' as any]: 'no-drag' }}
        >
          Cerrar
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 shrink-0 border-r border-border bg-bg-elev/70 overflow-y-auto">
          <div className="px-5 py-5 border-b border-border">
            <div className="text-2xl font-extrabold leading-none">Opciones</div>
            <div className="mt-2 text-xs text-fg-muted leading-relaxed">
              Acciones verticales con su funcion visible antes de abrir cada panel.
            </div>
          </div>
          <nav className="p-3 space-y-1">
            {options.map((item) => {
              const Icon = item.icon;
              const activeRow = active.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  className={[
                    'w-full text-left rounded-md px-3 py-3 flex gap-3 transition-colors',
                    activeRow ? 'bg-accent/20 text-fg' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
                  ].join(' ')}
                >
                  <Icon size={18} className={activeRow ? 'text-accent' : 'text-fg-subtle'} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{item.title}</span>
                    <span className="block mt-1 text-[11px] leading-snug text-fg-subtle">{item.desc}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="px-8 py-7 border-b border-border bg-bg-base/70">
            <h1 className="text-3xl font-extrabold leading-tight">{active.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-fg-muted">{active.desc}</p>
          </div>
          <div className="p-1">{active.content}</div>
        </main>
      </div>
    </div>
  );
}

function Inner() {
  const { theme } = useTheme();
  return (
    <>
      <Toaster position="bottom-right" theme={theme as 'dark' | 'light'} richColors closeButton toastOptions={{ duration: 2400 }} />
      <HashRouter>
        <Routes>
          <Route path="/login" element={<AuthShell><Login /></AuthShell>} />
          <Route path="/settings-window" element={<Protected><SettingsWindowFrame /></Protected>} />
          <Route
            path="/*"
            element={
              <Protected>
                <Shell>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/catalog" element={<Catalog />} />
                      <Route path="/add-game" element={<AddGame />} />
                      <Route path="/licenses" element={<Licenses />} />
                      <Route path="/sales" element={<Sales />} />
                      <Route path="/audit" element={<AuditLog />} />
                      <Route path="/promotions" element={<Promotions />} />
                      <Route path="/flash-sales" element={<FlashSales />} />
                      <Route path="/gift-cards" element={<GiftCardsAdmin />} />
                      <Route path="/refunds" element={<RefundsAdmin />} />
                      <Route path="/collections" element={<CollectionsAdmin />} />
                      <Route path="/currency" element={<CurrencyAdmin />} />
                      {/* Ruta nueva + legacy — ambas apuntan a la pantalla de admin de InsForge */}
                      <Route path="/insforge" element={<InsForgePage />} />
                      <Route path="/supabase" element={<InsForgePage />} />
                      <Route path="/payments" element={<PaymentsAdmin />} />
                      <Route path="/bulk-import" element={<BulkImport />} />
                      <Route path="/security" element={<AdminSecurity />} />
                      <Route path="/templates" element={<Templates />} />
                      <Route path="/free-game" element={<FreeGameAdmin />} />
                    </Routes>
                  </ErrorBoundary>
                </Shell>
              </Protected>
            }
          />
        </Routes>
      </HashRouter>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Inner />
      </AuthProvider>
    </ThemeProvider>
  );
}
