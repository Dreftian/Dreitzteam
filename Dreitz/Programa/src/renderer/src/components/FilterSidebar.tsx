import { useMemo } from 'react';
import type { Game } from '../lib/types';
import type { SortKey } from './SortPills';
import { ChevronDown, X } from 'lucide-react';

interface Props {
  games: Game[];
  sort: SortKey;
  setSort: (s: SortKey) => void;
  selectedGenres: string[];
  toggleGenre: (g: string) => void;
  selectedDrm: string[];
  toggleDrm: (d: string) => void;
  selectedLanguages: string[];
  toggleLanguage: (l: string) => void;
  onSale: boolean;
  toggleOnSale: () => void;
  freeOnly: boolean;
  toggleFree: () => void;
  preorderOnly: boolean;
  togglePreorder: () => void;
  priceMin: number;
  priceMax: number;
  setPriceMax: (v: number) => void;
  resetAll: () => void;
}

const DRM_OPTIONS = [
  { value: 'steam', label: 'Steam Key' },
  { value: 'epic', label: 'Epic Key' },
  { value: 'gog', label: 'GOG Key' },
  { value: 'standalone', label: 'Standalone' }
];

export default function FilterSidebar(p: Props) {
  const genreCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of p.games) for (const x of g.genres ?? []) m.set(x, (m.get(x) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [p.games]);

  const langCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of p.games) {
      const langs = (g.languages ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      for (const l of langs) m.set(l, (m.get(l) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [p.games]);

  const drmCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of p.games) m.set(g.drm_platform, (m.get(g.drm_platform) ?? 0) + 1);
    return m;
  }, [p.games]);

  const anyFilter = p.selectedGenres.length > 0 || p.selectedDrm.length > 0 || p.selectedLanguages.length > 0
    || p.onSale || p.freeOnly || p.preorderOnly || p.priceMax < 999 || p.sort !== 'featured';

  return (
    <aside className="w-64 shrink-0 space-y-5">
      <div className="card p-4">
        <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold mb-2">Ordenar por</div>
        <div className="relative">
          <select
            value={p.sort}
            onChange={(e) => p.setSort(e.target.value as SortKey)}
            className="appearance-none w-full pl-3 pr-8 py-2 rounded-md bg-bg-hover border border-border text-sm cursor-pointer"
          >
            <option value="featured">Destacados</option>
            <option value="newest">Más nuevos</option>
            <option value="discount">Mejor descuento</option>
            <option value="price_asc">Precio: menor a mayor</option>
            <option value="price_desc">Precio: mayor a menor</option>
            <option value="name">Nombre A–Z</option>
            <option value="release_soon">Próximos a lanzar</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-fg-muted" />
        </div>
      </div>

      <div className="card p-4">
        <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold mb-3">Disponibilidad</div>
        <Toggle on={p.onSale} onChange={p.toggleOnSale} label="En oferta" />
        <Toggle on={p.freeOnly} onChange={p.toggleFree} label="Gratis" />
        <Toggle on={p.preorderOnly} onChange={p.togglePreorder} label="Pre-órdenes" />
      </div>

      <div className="card p-4">
        <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold mb-3">Precio máximo</div>
        <input
          type="range"
          min={0}
          max={500}
          step={10}
          value={p.priceMax}
          onChange={(e) => p.setPriceMax(parseInt(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[11px] text-fg-muted mt-1">
          <span>S/. 0</span>
          <span className="font-semibold text-fg">{p.priceMax >= 500 ? 'sin tope' : `S/. ${p.priceMax}`}</span>
        </div>
      </div>

      <div className="card p-4">
        <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold mb-3">DRM / Plataforma</div>
        {DRM_OPTIONS.map((d) => {
          const c = drmCount.get(d.value) ?? 0;
          if (c === 0) return null;
          return (
            <Check
              key={d.value}
              checked={p.selectedDrm.includes(d.value)}
              onChange={() => p.toggleDrm(d.value)}
              label={d.label}
              count={c}
            />
          );
        })}
      </div>

      {genreCount.length > 0 && (
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold mb-3">Géneros</div>
          <div className="max-h-60 overflow-y-auto pr-1">
            {genreCount.slice(0, 18).map(([g, n]) => (
              <Check
                key={g}
                checked={p.selectedGenres.includes(g)}
                onChange={() => p.toggleGenre(g)}
                label={g}
                count={n}
              />
            ))}
          </div>
        </div>
      )}

      {langCount.length > 0 && (
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold mb-3">Idiomas</div>
          {langCount.map(([l, n]) => (
            <Check
              key={l}
              checked={p.selectedLanguages.includes(l)}
              onChange={() => p.toggleLanguage(l)}
              label={l}
              count={n}
            />
          ))}
        </div>
      )}

      {anyFilter && (
        <button onClick={p.resetAll} className="btn btn-secondary w-full text-sm">
          <X size={14} /> Limpiar filtros
        </button>
      )}
    </aside>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-3 w-full text-left p-1.5 rounded-md hover:bg-bg-hover transition-colors -mx-1.5"
    >
      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${on ? 'bg-accent' : 'bg-bg-hover border border-border'}`}>
        <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${on ? 'translate-x-4' : ''}`} />
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function Check({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer hover:bg-bg-hover rounded px-1.5 -mx-1.5">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-accent" />
      <span className="text-sm flex-1">{label}</span>
      {typeof count === 'number' && <span className="text-[11px] text-fg-subtle">{count}</span>}
    </label>
  );
}
