import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Globe, Save } from 'lucide-react';
import { formatDateTime } from '../lib/format';
import { toast } from 'sonner';

interface Rate { code: string; rate_from_pen: number; symbol: string; label: string; updated_at: string }

export default function CurrencyAdmin() {
  const { admin } = useAuth();
  const [rates, setRates] = useState<Rate[]>([]);
  const [edit, setEdit] = useState<Record<string, number>>({});

  async function load() {
    const r = await window.api.currencyList();
    setRates(r);
    const e: Record<string, number> = {};
    for (const x of r) e[x.code] = x.rate_from_pen;
    setEdit(e);
  }
  useEffect(() => { load(); }, []);

  async function save(code: string) {
    await window.api.currencyUpdate({ code, rate_from_pen: edit[code], adminId: admin?.id });
    toast.success(`${code} actualizada`);
    await load();
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-1 flex items-center gap-3"><Globe className="text-cyan-400" /> Tipos de cambio</h2>
      <p className="text-fg-muted text-sm mb-6">Tasas usadas en el switcher de moneda y la comparativa con Steam. <span className="text-fg">PEN = 1.00</span> es la base.</p>

      <div className="card divide-y divide-border">
        {rates.map((r) => (
          <div key={r.code} className="p-4 flex items-center gap-4">
            <div className="w-12 text-center">
              <div className="text-2xl font-extrabold">{r.symbol}</div>
              <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-bold">{r.code}</div>
            </div>
            <div className="flex-1">
              <div className="font-semibold">{r.label}</div>
              <div className="text-[11px] text-fg-subtle">Actualizada: {formatDateTime(r.updated_at)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-fg-muted">1 PEN =</span>
              <input
                type="number"
                step="0.0001"
                value={edit[r.code] ?? r.rate_from_pen}
                onChange={(e) => setEdit({ ...edit, [r.code]: parseFloat(e.target.value) || 0 })}
                className="input max-w-[140px] text-right font-mono"
                disabled={r.code === 'PEN'}
              />
              <span className="text-sm text-fg-muted w-10">{r.code}</span>
              {r.code !== 'PEN' && (
                <button onClick={() => save(r.code)} className="btn btn-primary text-xs"><Save size={12} /> Guardar</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4 mt-5 text-xs text-fg-muted">
        Tip: actualiza estas tasas semanalmente o engánchalas a una API real (ej. <span className="font-mono">exchangerate.host</span>) en futuras versiones.
      </div>
    </div>
  );
}
