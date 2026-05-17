import { useEffect } from 'react';

/**
 * Vibrant accent — extrae el color dominante saturado de una imagen y lo aplica
 * como `--accent` global mientras el componente está montado. Al desmontar,
 * restaura el acento original del usuario.
 *
 * Esto es lo que Steam hace con sus library hero images. Cada juego "tiñe"
 * la UI mientras lo ves.
 *
 * Implementación: dibuja la imagen en un canvas, samplea 1 pixel cada 10,
 * descarta los muy oscuros/claros/desaturados, y se queda con el más vibrante
 * (saturación * value máxima).
 *
 * Es CPU-free después del primer paint (canvas no se re-evalúa).
 */
export function useVibrantAccent(imageUrl: string | null | undefined) {
  useEffect(() => {
    if (!imageUrl) return;
    const root = document.documentElement;
    const original = root.style.getPropertyValue('--accent');
    const originalHover = root.style.getPropertyValue('--accent-hover');

    let cancelled = false;

    extractVibrantColor(imageUrl).then((rgb) => {
      if (cancelled || !rgb) return;
      const [r, g, b] = rgb;
      // Ajuste de luminancia: si el color es muy oscuro, lo aclaramos.
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const boost = lum < 80 ? 1.5 : 1.0;
      const finalRgb = `${Math.min(255, Math.round(r * boost))}, ${Math.min(255, Math.round(g * boost))}, ${Math.min(255, Math.round(b * boost))}`;
      // Hover variant: 12% más oscuro
      const hoverRgb = `${Math.round(r * 0.85)}, ${Math.round(g * 0.85)}, ${Math.round(b * 0.85)}`;

      root.style.setProperty('--accent', `rgb(${finalRgb})`);
      root.style.setProperty('--accent-hover', `rgb(${hoverRgb})`);
      // Marca para CSS condicional si alguien quiere
      root.setAttribute('data-vibrant', '1');
    }).catch(() => { /* swallow — color extraction is best-effort */ });

    return () => {
      cancelled = true;
      // Restaura el acento original
      if (original) root.style.setProperty('--accent', original);
      else root.style.removeProperty('--accent');
      if (originalHover) root.style.setProperty('--accent-hover', originalHover);
      else root.style.removeProperty('--accent-hover');
      root.removeAttribute('data-vibrant');
    };
  }, [imageUrl]);
}

async function extractVibrantColor(url: string): Promise<[number, number, number] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        // Reducimos a 100px de ancho para velocidad
        const w = 100;
        const h = Math.round((img.height / img.width) * 100);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;

        // Buscar el pixel más vibrante: max(saturation * value)
        let best = { r: 0, g: 0, b: 0, score: -1 };
        // Histograma de buckets para promediar (más estable que un solo pixel)
        const buckets = new Map<string, { r: number; g: number; b: number; count: number; score: number }>();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const val = max / 255;
          // Descartar grises, muy oscuros, muy claros
          if (sat < 0.35 || val < 0.25 || val > 0.95) continue;
          const score = sat * val;
          // Bucket por color (8x8x8 cuantización)
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const bucket = buckets.get(key);
          if (bucket) {
            bucket.r += r; bucket.g += g; bucket.b += b;
            bucket.count += 1;
            bucket.score += score;
          } else {
            buckets.set(key, { r, g, b, count: 1, score });
          }
        }

        // Promediar el bucket con score total más alto
        let topBucket = null as null | { r: number; g: number; b: number; count: number; score: number };
        for (const b of buckets.values()) {
          if (!topBucket || b.score > topBucket.score) topBucket = b;
        }
        if (topBucket && topBucket.count > 0) {
          best = {
            r: Math.round(topBucket.r / topBucket.count),
            g: Math.round(topBucket.g / topBucket.count),
            b: Math.round(topBucket.b / topBucket.count),
            score: topBucket.score
          };
        }
        if (best.score < 0) return resolve(null);
        resolve([best.r, best.g, best.b]);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
