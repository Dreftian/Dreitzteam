import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CurrencyRate } from '../lib/types';
import { useSettings } from './SettingsContext';
import { convertPrice, formatPrice as basicFormatPrice } from '../lib/format';

interface CurrencyCtx {
  rates: CurrencyRate[];
  format: (penValue: number) => string;
  convert: (penValue: number) => { value: number; symbol: string; code: string };
  active: string;
  setActive: (code: string) => void;
}

const Ctx = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { currency, setSetting } = useSettings();
  const [rates, setRates] = useState<CurrencyRate[]>([]);

  useEffect(() => {
    let alive = true;
    window.api.currencyRates().then((r: CurrencyRate[]) => { if (alive) setRates(r); });
    const id = setInterval(() => window.api.currencyRates().then((r) => alive && setRates(r)), 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const value = useMemo<CurrencyCtx>(() => {
    const active = currency || 'PEN';
    return {
      rates,
      active,
      setActive: (c: string) => setSetting('currency', c),
      convert: (pen) => convertPrice(pen, active, rates),
      format: (pen) => {
        if (!pen) return 'Gratis';
        if (active === 'PEN' || !rates.length) return basicFormatPrice(pen, 'PEN');
        const c = convertPrice(pen, active, rates);
        return `${c.symbol} ${c.value.toFixed(2)}`;
      }
    };
  }, [rates, currency, setSetting]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCurrency(): CurrencyCtx {
  const c = useContext(Ctx);
  if (!c) {
    return {
      rates: [],
      active: 'PEN',
      setActive: () => {},
      convert: (v) => ({ value: v, symbol: 'S/.', code: 'PEN' }),
      format: (v) => basicFormatPrice(v, 'PEN')
    };
  }
  return c;
}
