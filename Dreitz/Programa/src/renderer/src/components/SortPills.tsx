import { ChevronDown, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export type SortKey = 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'discount' | 'name';

const SORT_OPTIONS: { value: SortKey; key: string }[] = [
  { value: 'featured', key: 'store.sort.featured' },
  { value: 'newest', key: 'store.sort.newest' },
  { value: 'price_asc', key: 'store.sort.price_asc' },
  { value: 'price_desc', key: 'store.sort.price_desc' },
  { value: 'discount', key: 'store.sort.discount' },
  { value: 'name', key: 'store.sort.name' }
];

export default function SortPills({
  sort,
  setSort,
  genres,
  selectedGenres,
  toggleGenre,
  onSale,
  toggleOnSale,
  resetAll
}: {
  sort: SortKey;
  setSort: (s: SortKey) => void;
  genres: string[];
  selectedGenres: string[];
  toggleGenre: (g: string) => void;
  onSale: boolean;
  toggleOnSale: () => void;
  resetAll: () => void;
}) {
  const { t } = useI18n();
  const anyFilter = selectedGenres.length > 0 || onSale || sort !== 'featured';

  return (
    <div className="flex items-center flex-wrap gap-2 mb-6">
      <div className="relative">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="appearance-none pl-3 pr-7 py-1.5 rounded-full bg-bg-card border border-border text-xs font-medium hover:bg-bg-hover transition-colors cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{t(o.key)}</option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-fg-muted" />
      </div>

      <button
        onClick={toggleOnSale}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${onSale ? 'bg-accent/15 text-accent border-accent/40' : 'bg-bg-card border-border text-fg-muted hover:bg-bg-hover'}`}
      >
        {t('store.filter.on_sale')}
      </button>

      {genres.slice(0, 12).map((g) => {
        const active = selectedGenres.includes(g);
        return (
          <button
            key={g}
            onClick={() => toggleGenre(g)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${active ? 'bg-accent/15 text-accent border-accent/40' : 'bg-bg-card border-border text-fg-muted hover:bg-bg-hover'}`}
          >
            {g}
          </button>
        );
      })}

      {anyFilter && (
        <button onClick={resetAll} className="px-3 py-1.5 rounded-full text-xs font-medium text-fg-muted hover:bg-bg-hover flex items-center gap-1.5">
          <X size={12} /> Limpiar
        </button>
      )}
    </div>
  );
}
