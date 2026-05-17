import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, Library, Store as StoreIcon, ShoppingCart, Settings as SettingsIcon, Crown, User, Heart, Sun, Moon } from 'lucide-react';
import type { Game } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { useSettings } from '../contexts/SettingsContext';

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { t } = useI18n();
  const { effectiveTheme, setSetting, theme } = useSettings();

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    setLoading(true);
    window.api.gamesList()
      .then((g: Game[]) => setGames(g))
      .finally(() => setLoading(false));
  }, [open]);

  function go(path: string) {
    onClose();
    setTimeout(() => nav(path), 30);
  }

  function openSettings() {
    onClose();
    (window.api as any).settingsOpen?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl card overflow-hidden shadow-2xl border-accent/20" onClick={(e) => e.stopPropagation()}>
        <Command shouldFilter loop>
          <div className="flex items-center gap-2 px-4 border-b border-border">
            <Search size={16} className="text-fg-subtle" />
            <Command.Input
              autoFocus
              placeholder={t('palette.placeholder')}
              value={query}
              onValueChange={setQuery}
              className="flex-1 bg-transparent outline-none py-3.5 text-sm placeholder:text-fg-subtle"
            />
            <kbd className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-fg-subtle">Esc</kbd>
          </div>
          <Command.List className="max-h-[58vh] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-10 text-center text-sm text-fg-muted">
              {loading ? t('common.loading') : t('palette.no_results')}
            </Command.Empty>

            <Command.Group heading={t('palette.section.navigate')} className="px-2 text-[10px] uppercase tracking-wider text-fg-subtle [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2">
              <PItem onSelect={() => go('/store')} icon={<StoreIcon size={15} />} label={t('nav.store')} hint="Ctrl+S" />
              <PItem onSelect={() => go('/library')} icon={<Library size={15} />} label={t('nav.library')} hint="Ctrl+L" />
              <PItem onSelect={() => go('/cart')} icon={<ShoppingCart size={15} />} label={t('nav.cart')} hint="Ctrl+B" />
              <PItem onSelect={() => go('/wishlist')} icon={<Heart size={15} />} label={t('nav.wishlist')} />
              <PItem onSelect={() => go('/pro')} icon={<Crown size={15} />} label={t('nav.pro')} />
              <PItem onSelect={() => go('/profile')} icon={<User size={15} />} label={t('nav.profile')} />
              <PItem onSelect={openSettings} icon={<SettingsIcon size={15} />} label={t('nav.settings')} hint="Ctrl+," />
            </Command.Group>

            <Command.Group heading={t('palette.section.actions')} className="px-2 text-[10px] uppercase tracking-wider text-fg-subtle [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2">
              <PItem
                onSelect={() => { setSetting('theme', theme === 'light' ? 'dark' : 'light'); onClose(); }}
                icon={effectiveTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                label={effectiveTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              />
              <PItem
                onSelect={() => { setSetting('theme', 'system'); onClose(); }}
                icon={<SettingsIcon size={15} />}
                label="Tema según el sistema"
              />
            </Command.Group>

            <Command.Group heading={t('palette.section.games')} className="px-2 text-[10px] uppercase tracking-wider text-fg-subtle [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2">
              {games.slice(0, 50).map((g) => (
                <PItem
                  key={g.id}
                  onSelect={() => go(`/game/${g.id}`)}
                  icon={
                    <div className="w-7 h-4 rounded overflow-hidden bg-bg-hover shrink-0">
                      {g.capsule_image && <img src={g.capsule_image} alt="" className="w-full h-full object-cover" />}
                    </div>
                  }
                  label={g.title}
                  sub={g.developer || g.genres?.slice(0, 2).join(' · ')}
                  value={`${g.title} ${g.developer} ${g.genres?.join(' ')}`}
                />
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function PItem({ onSelect, icon, label, sub, hint, value }: {
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  hint?: string;
  value?: string;
}) {
  return (
    <Command.Item
      value={value ?? label}
      onSelect={onSelect}
      className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm aria-selected:bg-bg-hover aria-selected:text-fg text-fg-muted hover:bg-bg-hover/60 transition-colors"
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {sub && <span className="text-[11px] text-fg-subtle truncate max-w-[12rem]">{sub}</span>}
      {hint && <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-fg-subtle">{hint}</kbd>}
    </Command.Item>
  );
}
