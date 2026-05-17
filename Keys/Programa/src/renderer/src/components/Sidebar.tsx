import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Gamepad2, Plus, Key, ShoppingBag,
  LogOut, Sun, Moon, Activity, Megaphone, Flame, Gift, RotateCcw, Bookmark, Globe, Cloud, Wallet,
  Upload, Shield, FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import BrandMark from './BrandMark';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Usuarios', icon: Users },
  { to: '/catalog', label: 'Catálogo', icon: Gamepad2 },
  { to: '/add-game', label: 'Agregar juego', icon: Plus },
  { to: '/bulk-import', label: 'Bulk import', icon: Upload },
  { to: '/licenses', label: 'Licencias', icon: Key },
  { to: '/sales', label: 'Ventas', icon: ShoppingBag },
  { to: '/promotions', label: 'Promociones', icon: Megaphone },
  { to: '/flash-sales', label: 'Flash sales', icon: Flame },
  { to: '/free-game', label: 'Juego gratis', icon: Gift },
  { to: '/collections', label: 'Colecciones', icon: Bookmark },
  { to: '/gift-cards', label: 'Tarjetas regalo', icon: Gift },
  { to: '/refunds', label: 'Reembolsos', icon: RotateCcw },
  { to: '/currency', label: 'Tipos de cambio', icon: Globe },
  { to: '/payments', label: 'Pagos', icon: Wallet },
  { to: '/templates', label: 'Plantillas', icon: FileText },
  { to: '/insforge', label: 'InsForge', icon: Cloud },
  { to: '/security', label: 'Seguridad 2FA', icon: Shield },
  { to: '/audit', label: 'Audit log', icon: Activity }
];

export default function Sidebar() {
  const { admin, logout } = useAuth();
  const { theme, toggle } = useTheme();
  return (
    <aside className="w-60 shrink-0 bg-bg-elev border-r border-border flex flex-col">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-fg-subtle mb-1">Dreitzteam</div>
            <div className="text-2xl font-extrabold shimmer-text leading-none">Keys</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                isActive ? 'bg-bg-hover text-fg border-l-2 border-accent pl-[10px]' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
              }`
            }
          >
            <Icon size={16} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <button onClick={toggle} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-fg-muted hover:bg-bg-hover mb-2">
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          Tema {theme === 'dark' ? 'claro' : 'oscuro'}
        </button>
        {admin && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-md mb-1">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-400 to-yellow-500 flex items-center justify-center text-sm font-bold text-white">
              {admin.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{admin.username}</div>
              <div className="text-[11px] text-red-400 font-semibold">Administrador</div>
            </div>
          </div>
        )}
        <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-fg-muted hover:bg-bg-hover hover:text-fg">
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
