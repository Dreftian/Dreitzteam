export function formatPrice(value: number, currency = 'PEN'): string {
  if (!value) return 'Gratis';
  const symbol = currency === 'PEN' ? 'S/.' : currency === 'USD' ? '$' : currency;
  return `${symbol} ${value.toFixed(2)}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
