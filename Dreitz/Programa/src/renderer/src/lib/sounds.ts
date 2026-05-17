/**
 * Sintetizador de feedback sonoro con Web Audio API.
 *
 * En lugar de empaquetar archivos .ogg/.mp3 (que añaden 200KB al bundle y dependen
 * de un loader), generamos los efectos en tiempo real con osciladores y envelopes.
 * Es lo que hace macOS para sus sonidos de UI más cortos y mantiene el tamaño en cero.
 *
 * Cada sonido es 60–250ms para no entorpecer la UX. El volumen máximo absoluto está
 * limitado a 0.25 para no ser agresivo en altavoces de portátil.
 *
 * Uso desde componentes:
 *
 *   import { play } from '../lib/sounds';
 *   play('add_cart');
 *
 * El hook respeta `user_settings.sounds`: si está OFF, `play()` es no-op.
 * Para activar/desactivar globalmente sin ir a settings, llamar a `setEnabled(false)`.
 */

const MAX_VOLUME = 0.25;
let enabled = true;
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!enabled) return null;
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}

export function setEnabled(v: boolean) {
  enabled = v;
  if (!v && ctx) {
    try { ctx.close(); } catch {}
    ctx = null;
  }
}

interface ToneOptions {
  freq: number;
  durationMs: number;
  type?: OscillatorType;
  volume?: number;
  attackMs?: number;
  releaseMs?: number;
  /** Pitch glide endpoint, in Hz. If absent the tone stays at `freq`. */
  glideTo?: number;
}

function tone(opts: ToneOptions, startOffsetMs = 0) {
  const audio = ac();
  if (!audio) return;
  const now = audio.currentTime + startOffsetMs / 1000;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.glideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(opts.glideTo, now + opts.durationMs / 1000);
  }

  const vol = Math.min(MAX_VOLUME, opts.volume ?? 0.18);
  const attack = (opts.attackMs ?? 8) / 1000;
  const release = (opts.releaseMs ?? 60) / 1000;
  const dur = opts.durationMs / 1000;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + attack);
  gain.gain.setValueAtTime(vol, now + Math.max(attack, dur - release));
  gain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + dur + 0.05);
}

type SoundName =
  | 'click'           // Botón genérico
  | 'add_cart'        // Producto añadido al carrito
  | 'remove_cart'     // Producto removido
  | 'success'         // Compra completada
  | 'error'           // Acción fallida
  | 'notify'          // Notificación entrante
  | 'achievement'    // Logro/sticker desbloqueado
  | 'copy'            // Clave copiada al portapapeles
  | 'level_up'        // Subida de nivel/puntos
  | 'welcome'         // Login exitoso al abrir la app
  | 'price_drop'      // Bajada de precio en wishlist
  | 'friend_added'    // Nueva amistad confirmada
  | 'gift_received'   // Recibió un regalo P2P
  | 'install_done';   // Juego terminó de instalarse

const PRESETS: Record<SoundName, () => void> = {
  click:        () => tone({ freq: 880, durationMs: 60, type: 'triangle', volume: 0.10, attackMs: 4, releaseMs: 40 }),
  copy:         () => tone({ freq: 1320, durationMs: 70, type: 'sine', volume: 0.12, attackMs: 4, releaseMs: 50 }),
  add_cart:     () => { tone({ freq: 660, durationMs: 80, type: 'triangle', volume: 0.14 }); tone({ freq: 990, durationMs: 100, type: 'triangle', volume: 0.14 }, 70); },
  remove_cart:  () => tone({ freq: 440, durationMs: 90, type: 'triangle', glideTo: 330, volume: 0.14 }),
  success:      () => { tone({ freq: 660, durationMs: 90, type: 'sine', volume: 0.18 }); tone({ freq: 880, durationMs: 110, type: 'sine', volume: 0.18 }, 80); tone({ freq: 1320, durationMs: 200, type: 'sine', volume: 0.18 }, 170); },
  error:        () => { tone({ freq: 380, durationMs: 110, type: 'sawtooth', volume: 0.15 }); tone({ freq: 260, durationMs: 180, type: 'sawtooth', volume: 0.15 }, 100); },
  notify:       () => { tone({ freq: 1320, durationMs: 80, type: 'sine', volume: 0.14 }); tone({ freq: 1760, durationMs: 100, type: 'sine', volume: 0.14 }, 70); },
  achievement:  () => { tone({ freq: 660, durationMs: 110, type: 'sine', volume: 0.20 }); tone({ freq: 990, durationMs: 110, type: 'sine', volume: 0.20 }, 80); tone({ freq: 1320, durationMs: 160, type: 'sine', volume: 0.20 }, 170); tone({ freq: 1760, durationMs: 230, type: 'sine', volume: 0.18 }, 270); },
  level_up:     () => { tone({ freq: 523, durationMs: 90, type: 'triangle', volume: 0.18 }); tone({ freq: 659, durationMs: 90, type: 'triangle', volume: 0.18 }, 70); tone({ freq: 784, durationMs: 110, type: 'triangle', volume: 0.18 }, 150); tone({ freq: 1046, durationMs: 200, type: 'triangle', volume: 0.18 }, 250); },
  welcome:      () => { tone({ freq: 523, durationMs: 110, type: 'sine', volume: 0.14 }); tone({ freq: 784, durationMs: 130, type: 'sine', volume: 0.14 }, 100); tone({ freq: 1046, durationMs: 200, type: 'sine', volume: 0.16 }, 220); },
  price_drop:   () => { tone({ freq: 880, durationMs: 80, type: 'sine', volume: 0.16, glideTo: 660 }); tone({ freq: 660, durationMs: 100, type: 'sine', volume: 0.16, glideTo: 440 }, 80); },
  friend_added: () => { tone({ freq: 587, durationMs: 90, type: 'triangle', volume: 0.16 }); tone({ freq: 880, durationMs: 110, type: 'triangle', volume: 0.16 }, 80); },
  gift_received:() => { tone({ freq: 1046, durationMs: 80, type: 'sine', volume: 0.18 }); tone({ freq: 1318, durationMs: 80, type: 'sine', volume: 0.18 }, 70); tone({ freq: 1568, durationMs: 80, type: 'sine', volume: 0.18 }, 140); tone({ freq: 2093, durationMs: 200, type: 'sine', volume: 0.18 }, 210); },
  install_done: () => { tone({ freq: 784, durationMs: 80, type: 'sine', volume: 0.16 }); tone({ freq: 1046, durationMs: 100, type: 'sine', volume: 0.16 }, 70); tone({ freq: 1568, durationMs: 160, type: 'sine', volume: 0.16 }, 160); }
};

export function play(name: SoundName) {
  if (!enabled) return;
  try { PRESETS[name](); } catch { /* swallow — sound is non-critical */ }
}

export type { SoundName };
