/**
 * Splash screen cinematográfico:
 *  - SVG con "D" monograma que se dibuja stroke por stroke (~600ms)
 *  - El relleno entra con gradient shimmer
 *  - Tagline aparece word-by-word con stagger
 *  - Glow expansivo radial desde el centro
 *  - Particles flotantes sutiles (sólo si no hay reduce-motion)
 *
 * Loaded vía data: URL — no necesita asset externo.
 */

export function splashHtml(version: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; height: 100%; background: transparent; overflow: hidden;
    font-family: 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #fff; -webkit-app-region: drag; user-select: none;
  }
  .wrap {
    height: 100%; position: relative; overflow: hidden;
    background:
      radial-gradient(circle at 30% 20%, rgba(110, 0, 255, .55), transparent 60%),
      radial-gradient(circle at 70% 80%, rgba(0, 212, 255, .55), transparent 60%),
      linear-gradient(135deg, #0a0e1a 0%, #1a0e36 50%, #0a0e1a 100%);
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, .08);
    box-shadow: 0 12px 50px rgba(0, 0, 0, .55);
  }

  /* Glow expansivo radial */
  .glow {
    position: absolute; inset: 0;
    background: radial-gradient(circle at center, rgba(0,212,255,.45), transparent 50%);
    opacity: 0; animation: pulse 3s ease-out infinite;
  }
  @keyframes pulse {
    0% { transform: scale(0.6); opacity: 0; }
    40% { opacity: 0.4; }
    100% { transform: scale(1.6); opacity: 0; }
  }

  /* Centrado */
  .center {
    position: relative; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
  }

  /* Logo SVG: la "D" se traza con un path animado, luego se rellena con el gradient */
  .logo-wrap {
    position: relative;
    margin-bottom: 12px;
  }
  .logo-svg {
    width: 96px; height: 96px;
    filter: drop-shadow(0 8px 24px rgba(110, 0, 255, .35));
  }
  .logo-stroke {
    fill: none;
    stroke: url(#strokeGrad);
    stroke-width: 5;
    stroke-linecap: round;
    stroke-dasharray: 380;
    stroke-dashoffset: 380;
    animation: drawStroke 1s cubic-bezier(.6,0,.4,1) 0.1s forwards;
  }
  @keyframes drawStroke {
    to { stroke-dashoffset: 0; }
  }
  .logo-fill {
    fill: url(#fillGrad);
    opacity: 0;
    animation: fadeIn .8s ease-out 0.9s forwards;
  }
  @keyframes fadeIn { to { opacity: 1; } }

  /* Wordmark "Dreitz" con gradient + stagger */
  .word { display: inline-block; }
  .word span {
    display: inline-block;
    font-weight: 800; font-size: 44px; line-height: 1; letter-spacing: -1px;
    background: linear-gradient(90deg, #ff0080, #ff8c00, #ffd500, #00ff95, #00d4ff, #6e00ff, #ff0080);
    background-size: 200% 100%;
    -webkit-background-clip: text; background-clip: text; color: transparent;
    animation: shimmer 4s linear infinite, letterIn .55s cubic-bezier(.4,2,.6,1) backwards;
    opacity: 0;
  }
  .word span:nth-child(1) { animation-delay: 0.6s, 0s; }
  .word span:nth-child(2) { animation-delay: 0.7s, 0s; }
  .word span:nth-child(3) { animation-delay: 0.8s, 0s; }
  .word span:nth-child(4) { animation-delay: 0.9s, 0s; }
  .word span:nth-child(5) { animation-delay: 1.0s, 0s; }
  .word span:nth-child(6) { animation-delay: 1.1s, 0s; }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes letterIn {
    0%   { opacity: 0; transform: translateY(14px) scale(.85); }
    60%  { opacity: 1; transform: translateY(-2px) scale(1.05); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  .tag {
    font-size: 10px; letter-spacing: .36em;
    color: rgba(255, 255, 255, .55); margin-top: 16px;
    text-transform: uppercase;
    opacity: 0; animation: fadeIn .8s ease-out 1.3s forwards;
  }

  .bar {
    margin-top: 28px; width: 60%; height: 3px;
    background: rgba(255, 255, 255, .08);
    border-radius: 99px; overflow: hidden;
    opacity: 0; animation: fadeIn .5s ease-out 1.4s forwards;
  }
  .bar i {
    display: block; width: 35%; height: 100%;
    background: linear-gradient(90deg, #00d4ff, #6e00ff);
    border-radius: 99px;
    animation: bar 1.4s ease-in-out infinite;
  }
  @keyframes bar {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(280%); }
  }

  /* Particles flotantes */
  .particle {
    position: absolute; width: 3px; height: 3px;
    background: radial-gradient(circle, rgba(255,255,255,.8), transparent 70%);
    border-radius: 50%;
    animation: floatUp linear infinite;
  }
  @keyframes floatUp {
    0%   { transform: translateY(0) scale(0.5); opacity: 0; }
    20%  { opacity: 0.8; }
    100% { transform: translateY(-340px) scale(1.2); opacity: 0; }
  }

  .v {
    position: absolute; bottom: 16px;
    font-size: 10px; color: rgba(255, 255, 255, .35);
    letter-spacing: .15em;
  }

  @media (prefers-reduced-motion: reduce) {
    .logo-stroke, .logo-fill, .word span, .tag, .bar, .particle, .glow {
      animation: none !important; opacity: 1 !important;
    }
    .logo-stroke { stroke-dashoffset: 0; }
  }
</style></head><body>
<div class="wrap">
  <div class="glow"></div>

  <!-- particles -->
  ${Array.from({ length: 10 }).map((_, i) => {
    const left = Math.round(Math.random() * 100);
    const dur = 4 + Math.random() * 4;
    const delay = Math.random() * 4;
    return `<div class="particle" style="left:${left}%; bottom:0; animation-duration:${dur}s; animation-delay:${delay}s"></div>`;
  }).join('')}

  <div class="center">
    <div class="logo-wrap">
      <svg class="logo-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#00d4ff"/>
            <stop offset=".5" stop-color="#a855ff"/>
            <stop offset="1" stop-color="#ff3aa6"/>
          </linearGradient>
          <linearGradient id="fillGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#00d4ff" stop-opacity=".15"/>
            <stop offset="1" stop-color="#a855ff" stop-opacity=".25"/>
          </linearGradient>
        </defs>
        <!-- "D" monograma estilizada (forma de bracket curvo) -->
        <path class="logo-stroke" d="M 25 18 L 25 82 L 50 82 Q 80 82 80 50 Q 80 18 50 18 Z"/>
        <path class="logo-fill" d="M 25 18 L 25 82 L 50 82 Q 80 82 80 50 Q 80 18 50 18 Z"/>
      </svg>
    </div>

    <div class="word">
      <span>D</span><span>r</span><span>e</span><span>i</span><span>t</span><span>z</span>
    </div>

    <div class="tag">DREITZTEAM</div>
    <div class="bar"><i></i></div>
    <div class="v">v${version}</div>
  </div>
</div>
</body></html>`;
}
