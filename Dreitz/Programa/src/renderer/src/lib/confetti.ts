/**
 * Wrapper sobre canvas-confetti con presets para los momentos "wow":
 *  - purchase  → compra grande exitosa
 *  - levelup   → subida de nivel/cashback
 *  - legendary → desbloqueó sticker legendary o achievement raro
 *  - gift      → recibió un regalo
 *
 * Respeta `prefers-reduced-motion` si el usuario lo tiene activo.
 */

import confetti from 'canvas-confetti';

function reduce(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('reduce-motion');
}

export function fire(preset: 'purchase' | 'levelup' | 'legendary' | 'gift' = 'purchase') {
  if (reduce()) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00d4ff';

  switch (preset) {
    case 'purchase': {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 }, colors: [accent, '#ffd700', '#ffffff'] });
      setTimeout(() => confetti({ particleCount: 50, spread: 100, origin: { y: 0.7, x: 0.2 } }), 200);
      setTimeout(() => confetti({ particleCount: 50, spread: 100, origin: { y: 0.7, x: 0.8 } }), 400);
      break;
    }
    case 'levelup': {
      confetti({ particleCount: 150, spread: 160, origin: { y: 0.5 }, colors: ['#ffd700', '#ffa500', accent], gravity: 0.4 });
      break;
    }
    case 'legendary': {
      // Fuego de artificio en 3 explosiones
      const burst = (x: number) => confetti({ particleCount: 120, spread: 360, startVelocity: 30, origin: { x, y: 0.4 }, colors: ['#ff0080', '#ffd700', '#00d4ff', '#a855ff'] });
      burst(0.2); setTimeout(() => burst(0.5), 250); setTimeout(() => burst(0.8), 500);
      break;
    }
    case 'gift': {
      confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: ['#ec4899', '#ffd700'] });
      confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: ['#ec4899', '#ffd700'] });
      break;
    }
  }
}
