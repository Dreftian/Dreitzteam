import type { CurrencyRate } from './types';

export function formatPrice(value: number, currency = 'PEN'): string {
  if (value === 0) return 'Gratis';
  const symbol = currency === 'PEN' ? 'S/.' : currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency === 'EUR' ? '€' : currency === 'ARS' ? '$' : currency === 'MXN' ? '$' : currency;
  return `${symbol} ${value.toFixed(2)}`;
}

export function convertPrice(penValue: number, targetCode: string, rates: CurrencyRate[]): { value: number; symbol: string; code: string } {
  const rate = rates.find((r) => r.code === targetCode);
  if (!rate) return { value: penValue, symbol: 'S/.', code: 'PEN' };
  return { value: +(penValue * rate.rate_from_pen).toFixed(2), symbol: rate.symbol, code: rate.code };
}

export function formatPriceConverted(penValue: number, targetCode: string, rates: CurrencyRate[]): string {
  if (penValue === 0) return 'Gratis';
  const c = convertPrice(penValue, targetCode, rates);
  return `${c.symbol} ${c.value.toFixed(2)}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function detectCardBrand(number: string): string {
  const n = number.replace(/\s/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^6(?:011|5)/.test(n)) return 'Discover';
  if (/^3(?:0[0-5]|[68])/.test(n)) return 'Diners';
  return 'Tarjeta';
}

export function maskCard(number: string): string {
  const n = number.replace(/\s/g, '');
  if (n.length < 4) return n;
  return n.slice(-4);
}

export function luhnValid(number: string): boolean {
  const n = number.replace(/\s/g, '');
  if (!/^\d{12,19}$/.test(n)) return false;
  let sum = 0;
  let alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = parseInt(n[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
