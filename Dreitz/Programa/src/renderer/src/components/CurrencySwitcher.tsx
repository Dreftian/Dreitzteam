import { useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';

export default function CurrencySwitcher() {
  const { rates, active, setActive } = useCurrency();
  const [open, setOpen] = useState(false);
  const cur = rates.find((r) => r.code === active);

  if (!rates.length) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-bg-hover text-fg-muted text-xs font-semibold"
      >
        <Globe size={13} />
        {cur?.code ?? 'PEN'}
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 card shadow-xl p-1 w-48 z-50">
            {rates.map((r) => (
              <button
                key={r.code}
                onClick={() => { setActive(r.code); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-bg-hover ${active === r.code ? 'text-accent' : 'text-fg-muted'}`}
              >
                <span className="font-mono w-7">{r.code}</span>
                <span className="font-bold">{r.symbol}</span>
                <span className="text-xs text-fg-subtle truncate">{r.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
