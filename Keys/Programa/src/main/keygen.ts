export function generateKey(prefix = 'DRZ'): string {
  const seg = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };
  return `${prefix}-${seg()}-${seg()}-${seg()}-${seg()}`;
}
