import { NavLink } from 'react-router-dom';
import { Store, Library, Key, ChevronLeft, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useUi } from '../contexts/UiContext';
import SidebarUserMenu from './SidebarUserMenu';
import { LogoMark } from './Logo';

/**
 * Sidebar — el header ahora muestra el perfil del usuario (avatar + nombre +
 * dropdown con todas las opciones de cuenta). El branding "Dreitz" se moví
 * al TopBar para liberar este espacio prominente para la identidad del usuario.
 */
export default function Sidebar() {
  const { t } = useI18n();
  const { sidebarCollapsed, toggleSidebar } = useUi();

  const items = [
    { to: '/store', label: t('nav.store'), icon: Store },
    { to: '/library', label: t('nav.library'), icon: Library },
    { to: '/redeem', label: 'Activar clave', icon: Key }
  ];

  const w = sidebarCollapsed ? 'w-[60px]' : 'w-56';

  return (
    <aside className={`${w} shrink-0 bg-bg-elev border-r border-border flex flex-col transition-[width] duration-200`}>
      {/* Header: perfil + botón colapsar */}
      <div className="p-2 border-b border-border flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <SidebarUserMenu collapsed={sidebarCollapsed} />
        </div>
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="w-7 h-7 rounded-md hover:bg-bg-hover flex items-center justify-center text-fg-subtle hover:text-fg transition-colors shrink-0"
            title="Colapsar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>
      {sidebarCollapsed && (
        <div className="border-b border-border p-1 flex justify-center">
          <button
            onClick={toggleSidebar}
            className="w-7 h-7 rounded-md hover:bg-bg-hover flex items-center justify-center text-fg-subtle hover:text-fg transition-colors"
            title="Expandir"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      <nav className={`flex-1 ${sidebarCollapsed ? 'p-2' : 'p-3'} overflow-y-auto thin-scrollbar`}>
        <div className="space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                `relative flex items-center ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-md text-sm font-medium transition-all ${
                  isActive ? 'bg-bg-hover text-fg' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
                }`
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  {isActive && !sidebarCollapsed && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-accent" />
                  )}
                  <Icon size={sidebarCollapsed ? 18 : 16} className={isActive ? 'text-accent' : ''} />
                  {!sidebarCollapsed && <span className="flex-1 truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className={`${sidebarCollapsed ? 'p-2' : 'p-3'} border-t border-border`}>
        {sidebarCollapsed ? (
          <div className="flex items-center justify-center gap-1">
            <LogoMark size="xs" />
            <button
              onClick={() => (window.api as any).settingsOpen?.()}
              className="w-7 h-7 rounded-md hover:bg-bg-hover flex items-center justify-center text-fg-subtle hover:text-accent transition-colors"
              title="Ajustes y plugins"
            >
              <SettingsIcon size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center min-w-0 gap-1.5 text-[9px] text-fg-subtle">
              <LogoMark size="xs" />
              <span className="truncate">Dreitz v1.0</span>
            </div>
            <button
              onClick={() => (window.api as any).settingsOpen?.()}
              className="w-8 h-8 rounded-md hover:bg-bg-hover flex items-center justify-center text-fg-subtle hover:text-accent transition-colors"
              title="Ajustes y plugins"
            >
              <SettingsIcon size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
