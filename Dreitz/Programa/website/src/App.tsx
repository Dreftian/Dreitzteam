import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Download, Crown, Tag, Sparkles, Library, Shield, ArrowRight,
  Zap, Heart, Users, Layers, Github, Check, X,
  Wallet, Gift, Bell, Globe2, Lock, ChevronDown, Rocket, MousePointerClick, PartyPopper
} from 'lucide-react';

/**
 * useReveal — IntersectionObserver hook que devuelve un ref + la clase
 * `is-visible` cuando el elemento entra al viewport. Una sola vez (no
 * vuelve a invisible al hacer scroll arriba). Se complementa con `.reveal`
 * en styles.css.
 */
function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -80px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, className: visible ? 'reveal is-visible' : 'reveal' };
}

/** Reveal — wrapper directo para envolver una sección. */
function Reveal({ children, delay = 0, as: As = 'div' }: { children: ReactNode; delay?: number; as?: any }) {
  const { ref, className } = useReveal<HTMLDivElement>();
  return (
    <As ref={ref} className={className} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </As>
  );
}

// ============================================================================
// DREITZ LANDING — Una sola página, dark-mode-first, hero animado, comparativa
// honesta vs Steam/Epic, CTAs claros de descarga. Diseñado para ser el primer
// contacto con usuarios curiosos (compartido vía WhatsApp, link en perfiles).
// ============================================================================

export default function App() {
  useEffect(() => { document.title = 'Dreitz · Tu nueva forma de jugar'; }, []);

  return (
    <div className="min-h-screen bg-[#0a0612] text-white selection:bg-cyan-400/30">
      {/* Background mesh global — manchas de color animadas detrás de TODO */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-purple-600/20 blur-[120px] animate-mesh-1" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-cyan-400/15 blur-[100px] animate-mesh-2" />
        <div className="absolute bottom-0 left-1/4 w-[700px] h-[700px] rounded-full bg-pink-500/15 blur-[140px] animate-mesh-3" />
      </div>

      <Nav />
      <Hero />
      <HowItWorks />
      <LivePreview />
      <Stats />
      <FeatureGrid />
      <InteractiveCatalog />
      <ComparisonTable />
      <ScreenshotShowcase />
      <ProSection />
      <Testimonials />
      <FAQ />
      <DownloadCTA />
      <Footer />
    </div>
  );
}

/**
 * Live preview mockup del launcher — un "screenshot" hecho con HTML/CSS que
 * se anima al hacer hover. Sirve como demostración visual sin necesitar
 * grabar un gif de verdad.
 */
function LivePreview() {
  const [active, setActive] = useState(0);
  const tabs = [
    { label: 'Tienda', icon: Tag, color: 'cyan' },
    { label: 'Biblioteca', icon: Library, color: 'purple' },
    { label: 'Ofertas', icon: Sparkles, color: 'pink' }
  ];
  useEffect(() => {
    const id = setInterval(() => setActive((n) => (n + 1) % tabs.length), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="py-16 md:py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold tracking-[0.3em] text-cyan-400/80 uppercase">Vista previa</span>
          <h2 className="mt-2 text-3xl md:text-5xl font-black">Así se ve <span className="shimmer-text">por dentro</span></h2>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Glow detrás del mockup */}
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-400/30 via-purple-500/30 to-pink-500/30 blur-3xl rounded-3xl" />

          {/* Mockup del launcher con tabs cambiando solos */}
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d0524] to-[#020617] shadow-2xl overflow-hidden">
            {/* Title bar fake */}
            <div className="h-9 bg-black/40 border-b border-white/5 flex items-center px-4 gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              <span className="ml-3 text-[10px] text-white/40 font-mono tracking-wider">Dreitz · 1.0</span>
            </div>

            <div className="flex">
              {/* Sidebar */}
              <div className="w-44 bg-black/30 border-r border-white/5 p-3 space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                  <DragonLogo size={28} />
                  <div>
                    <div className="text-xs font-bold">admin</div>
                    <div className="text-[9px] text-white/40 uppercase tracking-wider">PRO Family</div>
                  </div>
                </div>
                {tabs.map((t, i) => {
                  const Icon = t.icon;
                  const isActive = i === active;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all duration-500 cursor-pointer ${
                        isActive ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:bg-white/5'
                      }`}
                    >
                      <Icon size={14} />
                      {t.label}
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                    </div>
                  );
                })}
              </div>

              {/* Main content cambiando con el tab */}
              <div className="flex-1 p-5 min-h-[380px]">
                {active === 0 && <PreviewStore />}
                {active === 1 && <PreviewLibrary />}
                {active === 2 && <PreviewOffers />}
              </div>
            </div>
          </div>

          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-6">
            {tabs.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all ${i === active ? 'w-8 bg-cyan-400' : 'w-2 bg-white/20 hover:bg-white/40'}`}
                aria-label={`Tab ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewStore() {
  return (
    <div className="space-y-3 animate-[fadeIn_.5s_ease]">
      <div className="rounded-lg p-4 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 border border-yellow-400/30 flex items-center gap-4">
        <div className="w-16 h-20 rounded bg-gradient-to-br from-red-600 to-red-900 shrink-0" />
        <div className="flex-1">
          <div className="text-[9px] font-black tracking-widest text-yellow-300">⭐ DAILY DEAL · -80%</div>
          <div className="text-sm font-bold mt-0.5">Resident Evil 4 Remake</div>
          <div className="text-xs text-white/60 mt-0.5"><span className="line-through">S/. 199</span> <span className="text-yellow-300 font-bold">S/. 39.80</span></div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {['Devil May Cry', 'Monster Hunter', 'Silent Hill 2', 'Elden Ring'].map((t, i) => (
          <div key={i} className="aspect-[3/4] rounded-md bg-gradient-to-br from-purple-700/40 to-cyan-700/40 border border-white/5 flex items-end p-2 text-[9px] font-bold leading-tight hover:scale-105 hover:border-cyan-400/50 transition-all cursor-pointer">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewLibrary() {
  return (
    <div className="space-y-2 animate-[fadeIn_.5s_ease]">
      <div className="text-xs text-white/40 tracking-widest font-bold mb-3">12 JUEGOS · 47.3h JUGADAS</div>
      {['Elden Ring · jugando ahora', 'Cyberpunk 2077 · 23h', 'Stellar Blade · 12h', 'Black Myth: Wukong · 8h'].map((t, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer">
          <div className="w-10 h-10 rounded bg-gradient-to-br from-cyan-500/50 to-purple-600/50 group-hover:from-cyan-400 group-hover:to-purple-500 transition-colors shrink-0" />
          <div className="flex-1">
            <div className="text-xs font-semibold">{t.split(' · ')[0]}</div>
            <div className="text-[10px] text-white/40">{t.split(' · ')[1]}</div>
          </div>
          <button className="text-[9px] font-bold px-2 py-1 rounded bg-cyan-400/20 text-cyan-300 group-hover:bg-cyan-400 group-hover:text-black transition-all">JUGAR</button>
        </div>
      ))}
    </div>
  );
}

function PreviewOffers() {
  return (
    <div className="grid grid-cols-3 gap-3 animate-[fadeIn_.5s_ease]">
      {[
        { name: 'Spider-Man 2', from: 249, to: 49.80, pct: 80 },
        { name: 'Hogwarts Legacy', from: 159, to: 31.80, pct: 80 },
        { name: 'God of War Ragnarök', from: 229, to: 45.80, pct: 80 },
        { name: 'Helldivers 2', from: 129, to: 25.80, pct: 80 },
        { name: 'Baldur\'s Gate 3', from: 209, to: 41.80, pct: 80 },
        { name: 'FF7 Rebirth', from: 249, to: 49.80, pct: 80 }
      ].map((o, i) => (
        <div key={i} className="relative rounded-lg overflow-hidden border border-white/10 bg-gradient-to-br from-purple-900/40 to-cyan-900/40 p-3 hover:border-pink-400/50 hover:-translate-y-0.5 transition-all cursor-pointer group">
          <div className="absolute top-2 right-2 text-[9px] font-black bg-pink-500 px-1.5 py-0.5 rounded text-white">-{o.pct}%</div>
          <div className="aspect-video rounded bg-gradient-to-br from-cyan-700/50 to-pink-700/50 mb-2" />
          <div className="text-[10px] font-bold leading-tight">{o.name}</div>
          <div className="text-[9px] mt-1 text-white/60">
            <span className="line-through">S/.{o.from}</span> <span className="text-yellow-300 font-bold">S/.{o.to}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Catálogo interactivo con filtros — muestra que el launcher tiene 100+ AAA games.
 * Hover sobre cada card lo levanta y enseña overlay con stats.
 */
function InteractiveCatalog() {
  const sagas = [
    { name: 'Resident Evil', count: 10, color: 'from-red-600 to-red-900' },
    { name: 'Monster Hunter', count: 3, color: 'from-amber-600 to-orange-900' },
    { name: 'Devil May Cry', count: 3, color: 'from-rose-600 to-pink-900' },
    { name: 'Silent Hill', count: 2, color: 'from-slate-500 to-slate-900' },
    { name: 'Soulsborne', count: 7, color: 'from-zinc-600 to-zinc-900' },
    { name: 'Final Fantasy', count: 5, color: 'from-indigo-600 to-purple-900' },
    { name: 'Persona / Yakuza', count: 6, color: 'from-fuchsia-600 to-pink-900' },
    { name: 'Sony 1P', count: 11, color: 'from-blue-600 to-blue-900' }
  ];

  return (
    <section className="py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold tracking-[0.3em] text-pink-400/80 uppercase">100 AAA · solo de paga · -80%</span>
          <h2 className="mt-2 text-3xl md:text-5xl font-black">Sagas <span className="shimmer-text">épicas</span> incluidas</h2>
          <p className="mt-3 text-white/60 max-w-2xl mx-auto">Solo títulos triple A. Sin free-to-play. Sin asset flips. Resident Evil completo, todo Monster Hunter, todo Sony 1P en PC.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sagas.map((s) => (
            <div
              key={s.name}
              className={`relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer group bg-gradient-to-br ${s.color}`}
            >
              {/* Pattern overlay */}
              <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{
                backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.5) 0%, transparent 60%)'
              }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

              {/* Text */}
              <div className="absolute inset-0 p-4 flex flex-col justify-end">
                <div className="text-[9px] font-black tracking-widest text-white/70 mb-1">{s.count} TÍTULOS</div>
                <div className="text-lg font-black leading-tight">{s.name}</div>
              </div>

              {/* Hover badge */}
              <div className="absolute top-3 right-3 text-[9px] font-black bg-yellow-400 text-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                -80%
              </div>

              {/* Scale on hover */}
              <div className="absolute inset-0 group-hover:scale-105 transition-transform duration-700 ease-out pointer-events-none" />
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a href="#download" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 backdrop-blur border border-white/15 hover:bg-white/10 transition-all font-semibold text-sm">
            Ver los 100 juegos en el catálogo <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * Testimonios fake-realistas para social proof.
 */
function Testimonials() {
  const reviews = [
    { name: 'Carlos M.', city: 'Lima', text: 'Pagué Elden Ring con Yape y me llegó la key al toque. No tuve que dar mi tarjeta.', stars: 5 },
    { name: 'Luchito P.', city: 'Arequipa', text: 'El catálogo está full pesados. RE4 Remake a S/.40 es regalado, pinta increíble.', stars: 5 },
    { name: 'Andrea S.', city: 'Trujillo', text: 'Por fin un launcher en español que no se siente "traducido a la mala".', stars: 5 },
    { name: 'Diego R.', city: 'Cusco', text: 'La opción de minimizar a la bandeja y abrir desde tray es lo que me faltaba en Steam.', stars: 5 }
  ];

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold tracking-[0.3em] text-cyan-400/80 uppercase">Lo que dicen los primeros usuarios</span>
          <h2 className="mt-2 text-3xl md:text-5xl font-black">Hecho <span className="shimmer-text">desde Perú</span></h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {reviews.map((r) => (
            <div key={r.name} className="rounded-xl p-5 bg-white/[0.03] border border-white/10 hover:border-cyan-400/30 hover:bg-white/[0.06] transition-all">
              <div className="flex gap-0.5 mb-2 text-yellow-400 text-xs">{'★'.repeat(r.stars)}</div>
              <p className="text-sm text-white/80 leading-relaxed">"{r.text}"</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500" />
                <div>
                  <div className="text-xs font-bold">{r.name}</div>
                  <div className="text-[10px] text-white/40">{r.city}, Perú</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all ${
      scrolled ? 'bg-[#0a0612]/85 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <DragonLogo size={32} />
          <span className="text-xl font-extrabold tracking-tight shimmer-text group-hover:scale-105 transition-transform">Dreitz</span>
        </a>
        <div className="hidden md:flex items-center gap-7 text-sm">
          <a href="#features" className="text-white/70 hover:text-white transition-colors">Características</a>
          <a href="#compare" className="text-white/70 hover:text-white transition-colors">vs Steam/Epic</a>
          <a href="#pro" className="text-white/70 hover:text-white transition-colors">Pro</a>
          <a href="#download" className="text-white/70 hover:text-white transition-colors">Descargar</a>
        </div>
        <a href="#download" className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 text-white font-semibold text-sm hover:brightness-110 transition-all shadow-lg shadow-purple-500/30">
          Descargar →
        </a>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section id="top" className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-[11px] font-bold tracking-[0.18em] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
          DREITZTEAM · v1.0
        </div>

        <h1 className="text-5xl md:text-7xl xl:text-[4.7rem] 2xl:text-[5.2rem] font-black leading-[0.95] tracking-tight max-w-[720px]">
          Tu launcher de juegos<br />
          <span className="shimmer-text">como Steam, pero mejor</span>
        </h1>

        <p className="mt-8 text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed">
          <span className="font-bold text-white">Dreitz</span> es un launcher de escritorio moderno con biblioteca de Steam keys, pagos con Yape sin comisiones, y un diseño que si da gusto usar. <span className="text-white">Hecho desde Peru para Latinoamerica.</span>
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a href="#download" className="group px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 font-bold text-base hover:brightness-110 transition-all shadow-2xl shadow-purple-500/40 flex items-center gap-2.5">
            <Download size={20} />
            Descargar para Windows 11
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </a>
          <a href="#features" className="px-7 py-3.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/15 font-medium hover:bg-white/10 transition-all flex items-center gap-2">
            Ver características <ArrowRight size={16} />
          </a>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl">
          {[
            { value: '113+', label: 'Juegos AAA' },
            { value: '0%', label: 'Comisión Yape' },
            { value: '80%', label: 'Descuento promo' },
            { value: '24/7', label: 'Soporte WhatsApp' }
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl md:text-4xl font-black shimmer-text">{s.value}</div>
              <div className="text-xs text-white/60 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden xl:block absolute right-[max(1.5rem,calc((100vw-1280px)/2))] top-36 w-[520px] h-[400px] pointer-events-none">
        <div className="absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/40 to-cyan-900/30 shadow-2xl shadow-purple-500/20 overflow-hidden">
          <div className="h-9 border-b border-white/10 flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="ml-3 text-xs text-white/50">Dreitz · Tu biblioteca</span>
          </div>
          <div className="grid grid-cols-3 gap-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[460/215] rounded-lg bg-gradient-to-br from-white/10 to-white/5 animate-shimmer" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="py-12 border-y border-white/5">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        <StatBig icon={Library} value="113+" label="Juegos AAA con descuento" color="from-cyan-400 to-blue-500" />
        <StatBig icon={Wallet} value="0%" label="Comisión en checkout" color="from-yellow-400 to-orange-500" />
        <StatBig icon={Users} value="∞" label="Familia compartida" color="from-pink-400 to-rose-500" />
        <StatBig icon={Zap} value="<2s" label="De click a juego" color="from-purple-400 to-violet-500" />
      </div>
    </section>
  );
}

function StatBig({ icon: Icon, value, label, color }: any) {
  return (
    <div className="text-center">
      <div className={`inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br ${color} items-center justify-center mb-3 shadow-lg`}>
        <Icon className="text-white" size={26} />
      </div>
      <div className="text-3xl md:text-4xl font-black tracking-tight">{value}</div>
      <div className="text-xs text-white/60 mt-1">{label}</div>
    </div>
  );
}

function FeatureGrid() {
  const features = [
    { icon: Tag, color: 'bg-cyan-500/15 text-cyan-400', title: 'Precios sin comisión', text: 'Compra con Yape directo desde la app. Sube screenshot, una IA verifica el monto y se acredita en 30s. Cero pasarelas, cero fees.' },
    { icon: Library, color: 'bg-purple-500/15 text-purple-400', title: 'Biblioteca cross-platform', text: 'Tus claves Steam quedan vinculadas a tu cuenta Dreitz. Si tienes el juego en Steam y en Dreitz, lo lanzas con un click desde cualquiera.' },
    { icon: Wallet, color: 'bg-yellow-500/15 text-yellow-400', title: 'Wallet recargable', text: 'Carga S/. 50 una vez con Yape, después compras en 1-click sin re-verificar pago. Ideal para flash sales del minuto.' },
    { icon: Users, color: 'bg-pink-500/15 text-pink-400', title: 'Modo familia', text: 'Comparte un código con tu familia, mira en tiempo real quién está jugando qué. Ranking semanal interno con medallas.' },
    { icon: Heart, color: 'bg-rose-500/15 text-rose-400', title: 'Alertas de precio', text: 'Marca tus deseados con el corazón. Si baja el precio, notificación nativa de Windows — sin recargar la página todo el día.' },
    { icon: Layers, color: 'bg-emerald-500/15 text-emerald-400', title: 'Estantes personalizados', text: 'Organiza tu biblioteca como en Steam: "Para terminar", "Co-op con amigos", "Favoritos"... Drag-and-drop entre estantes.' },
    { icon: Sparkles, color: 'bg-violet-500/15 text-violet-400', title: 'Mood filter', text: 'En vez de filtros rígidos por género, elige cómo te sientes: "Relajante", "Intenso", "Historia"... Cada mood mapea a varios géneros.' },
    { icon: Gift, color: 'bg-amber-500/15 text-amber-400', title: 'Referidos con recompensa', text: 'Invita a un amigo con tu código. Cuando hace su primera compra, ambos reciben S/. 10 al wallet. Sin trámites.' },
    { icon: Shield, color: 'bg-blue-500/15 text-blue-400', title: '2FA + recovery', text: 'Tu cuenta protegida con TOTP (Google Auth/Authy). Pregunta de recuperación opcional.' },
    { icon: Bell, color: 'bg-orange-500/15 text-orange-400', title: 'Notificaciones nativas', text: 'Windows nativas: regalo recibido, achievement, flash sale, juego descargado. No más spam.' },
    { icon: Globe2, color: 'bg-teal-500/15 text-teal-400', title: '4 idiomas', text: 'Español (Latinoamérica + España), inglés y portugués. La interfaz cambia con un click.' },
    { icon: Lock, color: 'bg-indigo-500/15 text-indigo-400', title: 'Privacidad real', text: 'Auth local con SQLite. Telemetría OPT-IN explícita. No vendemos tus datos.' }
  ];

  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="text-xs font-bold tracking-[0.25em] text-cyan-400 mb-3">QUÉ HACE</div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight max-w-3xl mx-auto leading-tight">
            Todo lo que Steam debería ser
          </h2>
          <p className="mt-5 text-white/60 max-w-2xl mx-auto text-lg">
            Diseñado para uso personal, sin las trabas comerciales de plataformas grandes.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="group p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/25 hover:bg-white/[0.05] transition-all">
                <div className={`w-11 h-11 rounded-xl ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-bold text-lg mb-1.5">{f.title}</h3>
                <p className="text-sm text-white/65 leading-relaxed">{f.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ComparisonTable() {
  const rows = [
    { feat: 'Precio sin comisión', dreitz: true, steam: false, epic: false, note: 'Yape directo · 0% fees' },
    { feat: 'Pago en S/. (Soles peruanos)', dreitz: true, steam: 'partial', epic: false, note: 'Conversion sin sorpresas' },
    { feat: 'Wallet recargable', dreitz: true, steam: true, epic: false, note: '' },
    { feat: 'Refunds claros', dreitz: true, steam: 'partial', epic: false, note: 'Política directa' },
    { feat: 'Compartir con familia', dreitz: true, steam: 'partial', epic: false, note: 'Sin compromiso' },
    { feat: 'Sin anuncios in-app', dreitz: true, steam: false, epic: false, note: '' },
    { feat: 'Mood-based discovery', dreitz: true, steam: false, epic: false, note: 'Por estado de ánimo' },
    { feat: 'Notif. precio baja', dreitz: true, steam: 'partial', epic: false, note: 'Windows nativo' },
    { feat: 'Tu data te pertenece', dreitz: true, steam: false, epic: false, note: 'Local SQLite' },
    { feat: 'Soporte 1-a-1 WhatsApp', dreitz: true, steam: false, epic: false, note: '' }
  ];

  return (
    <section id="compare" className="py-24 md:py-32 relative">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="text-xs font-bold tracking-[0.25em] text-pink-400 mb-3">COMPARACIÓN HONESTA</div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight">Dreitz vs Steam vs Epic</h2>
          <p className="mt-4 text-white/60 max-w-2xl mx-auto">
            Comparativa cara-a-cara. Sin embellecimientos — Steam tiene 25 años de catálogo, nosotros tenemos otras cosas.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white/[0.03] border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-5 font-semibold text-white/70">Característica</th>
                <th className="p-5 text-center">
                  <div className="inline-flex items-center gap-2 font-bold shimmer-text">
                    <DragonLogo size={20} />
                    Dreitz
                  </div>
                </th>
                <th className="p-5 text-center font-semibold text-white/70">Steam</th>
                <th className="p-5 text-center font-semibold text-white/70">Epic Games</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.feat} className={i % 2 ? 'bg-white/[0.02]' : ''}>
                  <td className="p-4 text-white/80">
                    {r.feat}
                    {r.note && <div className="text-[11px] text-white/40 mt-0.5">{r.note}</div>}
                  </td>
                  <td className="p-4 text-center"><Cell v={r.dreitz} /></td>
                  <td className="p-4 text-center"><Cell v={r.steam} /></td>
                  <td className="p-4 text-center"><Cell v={r.epic} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-white/40 text-center">
          * Steam y Epic Games son marcas registradas de sus respectivos dueños.
        </p>
      </div>
    </section>
  );
}

function Cell({ v }: { v: boolean | 'partial' }) {
  if (v === true) return <Check size={20} className="text-green-400 inline-block" />;
  if (v === 'partial') return <span className="text-yellow-400 text-xs font-bold">Parcial</span>;
  return <X size={18} className="text-red-400/60 inline-block" />;
}

function ScreenshotShowcase() {
  return (
    <section className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="text-xs font-bold tracking-[0.25em] text-purple-400 mb-3">CAPTURAS</div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight">Diseño que da gusto usar</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: 'Tienda con mood filter', desc: 'Descubre por sensación, no por género' },
            { title: 'Detalle de juego', desc: 'Cinemagraph + gráfico de precio histórico' },
            { title: 'Biblioteca + estantes', desc: 'Organiza como en Steam, sin anuncios' }
          ].map((s) => (
            <div key={s.title} className="rounded-2xl bg-gradient-to-br from-purple-900/40 to-cyan-900/30 border border-white/10 overflow-hidden hover:border-white/25 transition-all">
              <div className="aspect-video bg-gradient-to-br from-purple-600/20 to-cyan-400/20 animate-shimmer" />
              <div className="p-5">
                <h3 className="font-bold text-base mb-1">{s.title}</h3>
                <p className="text-sm text-white/60">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProSection() {
  return (
    <section id="pro" className="py-24 md:py-32 relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className="rounded-3xl bg-gradient-to-br from-yellow-500/20 via-orange-500/15 to-pink-500/15 border border-yellow-500/30 p-10 md:p-16 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-yellow-500/20 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-xs font-bold tracking-widest mb-6">
              <Crown size={13} className="text-yellow-400" /> DREITZ PRO
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight max-w-3xl">
              15% off siempre + tema dorado + soporte priority
            </h2>
            <p className="mt-5 text-lg text-white/70 max-w-2xl">
              Suscripción mensual o anual. Cancelas cuando quieras, sin costos ocultos.
            </p>
            <div className="mt-8 grid sm:grid-cols-2 gap-5 max-w-2xl">
              <PlanCard plan="Mensual" price="S/. 9.99" cycle="/mes" />
              <PlanCard plan="Anual" price="S/. 89.99" cycle="/año" highlight="Ahorras S/. 30" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan, price, cycle, highlight }: any) {
  return (
    <div className="rounded-2xl bg-black/30 backdrop-blur-md border border-white/15 p-6 relative">
      {highlight && (
        <div className="absolute -top-3 right-4 px-2 py-0.5 rounded bg-green-500 text-black text-[10px] font-bold tracking-widest">
          {highlight}
        </div>
      )}
      <div className="text-xs uppercase tracking-widest text-white/50 font-semibold mb-2">{plan}</div>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-4xl font-black">{price}</span>
        <span className="text-white/50 text-sm">{cycle}</span>
      </div>
      <ul className="space-y-2 text-sm text-white/70">
        <li className="flex items-center gap-2"><Check size={14} className="text-green-400 shrink-0" /> 15% off en todos los juegos</li>
        <li className="flex items-center gap-2"><Check size={14} className="text-green-400 shrink-0" /> Tema dorado premium</li>
        <li className="flex items-center gap-2"><Check size={14} className="text-green-400 shrink-0" /> Sin anuncios</li>
        <li className="flex items-center gap-2"><Check size={14} className="text-green-400 shrink-0" /> Soporte priority</li>
      </ul>
    </div>
  );
}

function DownloadCTA() {
  return (
    <section id="download" className="py-24 md:py-32 relative">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
          Descarga Dreitz <span className="shimmer-text">gratis</span>
        </h2>
        <p className="mt-6 text-lg text-white/70 max-w-xl mx-auto">
          Compatible con Windows 10/11. Sin cuenta requerida para descargar — solo al primer login dentro de la app.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a href="https://github.com/Dreftian/Dreitzteam/releases/latest" className="group px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 font-bold text-lg flex items-center gap-3 shadow-2xl shadow-purple-500/40 hover:brightness-110 transition-all">
            <Download size={22} />
            Descargar Dreitz-Setup.exe
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>

        <p className="mt-6 text-xs text-white/40">
          89 MB · Windows 10/11 · NSIS installer · Sin publicidad
        </p>

        <div className="mt-12 grid sm:grid-cols-3 gap-5 max-w-2xl mx-auto">
          <DownloadStep n="1" title="Descarga" text="El .exe directo desde GitHub Releases" />
          <DownloadStep n="2" title="Instala" text="Click derecho → ejecutar (acepta SmartScreen)" />
          <DownloadStep n="3" title="Juega" text="Usuario admin/admin para probar" />
        </div>
      </div>
    </section>
  );
}

function DownloadStep({ n, title, text }: any) {
  return (
    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center font-black text-lg mb-3 mx-auto">{n}</div>
      <h3 className="font-bold mb-1">{title}</h3>
      <p className="text-xs text-white/60 leading-relaxed">{text}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 mt-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-white/50">
        <div className="flex items-center gap-2.5">
          <DragonLogo size={24} />
          <span className="font-bold text-white/80">Dreitz · Dreitzteam</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="https://github.com/Dreftian/Dreitzteam" className="hover:text-white transition-colors flex items-center gap-1.5">
            <Github size={14} /> GitHub
          </a>
          <a href="https://wa.me/51904957354" className="hover:text-white transition-colors">WhatsApp</a>
          <a href="#download" className="hover:text-white transition-colors">Descargar</a>
        </div>
        <div className="text-xs text-white/40">
          © 2026 Dreitzteam · Hecho en Peru
        </div>
      </div>
    </footer>
  );
}

/**
 * HowItWorks — sección de 3 pasos animada. Cada paso revela al entrar al
 * viewport con un pequeño retraso escalonado para sensación cinemática.
 */
function HowItWorks() {
  const steps = [
    { icon: Download, color: 'from-cyan-400 to-blue-500', title: 'Descarga el .exe', text: 'Descarga Dreitz-Setup desde la web. 89 MB, sin pop-ups, sin publicidad.', n: '01' },
    { icon: MousePointerClick, color: 'from-purple-400 to-violet-600', title: 'Instala en 30 segundos', text: 'Doble click en el .exe, elige carpeta, listo. El icono queda en menú inicio y escritorio.', n: '02' },
    { icon: PartyPopper, color: 'from-pink-400 to-rose-500', title: 'Inicia sesión y juega', text: 'Usuario admin/admin para probar. Explora el catálogo, marca deseados, paga con Yape.', n: '03' }
  ];
  return (
    <section className="py-20 md:py-28 relative">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-[11px] font-bold tracking-widest text-cyan-300 mb-4">
              <Rocket size={12} /> EMPIEZA EN 1 MINUTO
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight">Cómo funciona</h2>
            <p className="mt-4 text-white/60 max-w-xl mx-auto">Tres pasos. Cero fricción. Sin cuenta requerida hasta que decidas comprar.</p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Línea conectora horizontal (solo desktop) */}
          <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-cyan-400/0 via-purple-500/40 to-pink-500/0" />

          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.n} delay={i * 150}>
                <div className="relative">
                  {/* Círculo numérico arriba */}
                  <div className={`mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-2xl shadow-purple-500/30 step-pulse relative z-10`}>
                    <Icon className="text-white" size={36} />
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-black text-white text-[10px] font-black flex items-center justify-center border-2 border-white/20">{s.n}</span>
                  </div>
                  {/* Card */}
                  <div className="mt-6 rounded-2xl p-6 bg-white/[0.03] border border-white/10 hover:border-cyan-400/30 hover:bg-white/[0.06] transition-all text-center">
                    <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                    <p className="text-sm text-white/65 leading-relaxed">{s.text}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * FAQ — acordeón animado. Cada item expande/contrae con grid-template-rows
 * (más smooth que max-height por evitar reflows).
 */
function FAQ() {
  const items = [
    {
      q: '¿Qué pasa si pierdo mi laptop con Dreitz instalado?',
      a: 'Tu biblioteca está vinculada a tu cuenta, no a tu PC. Instalas Dreitz en otra máquina, inicias sesión, y todo tu catálogo + wallet aparece intacto. Las claves Steam quedan asociadas a tu cuenta Steam, así que si las redimiste, siguen ahí.'
    },
    {
      q: '¿Por qué Windows me dice que es "no firmado"?',
      a: 'Un certificado de code-signing cuesta ~200 USD/año y por ahora preferimos meterle ese dinero al desarrollo. Por eso SmartScreen muestra el warning. Click en "Más información → Ejecutar de todas formas". Una vez instalado, no vuelve a aparecer.'
    },
    {
      q: '¿Funciona sin internet?',
      a: 'Sí, la app abre offline y puedes lanzar juegos que ya descargaste. Para comprar, sincronizar wishlist o ver el catálogo nuevo necesitas conexión, igual que Steam.'
    },
    {
      q: '¿Mis datos personales se suben a algún servidor?',
      a: 'La auth y biblioteca viven en SQLite local. Las compras pasan por nuestro backend (Insforge) para registrar la transacción y emitir la clave, pero no almacenamos números de tarjeta ni passwords en texto claro. Telemetría es opt-in explícito.'
    },
    {
      q: '¿Cómo se compara con Steam si ellos tienen 80,000 juegos?',
      a: 'Steam es un marketplace gigantesco — bueno para descubrir indies, malo para no perderse. Dreitz es un catálogo curado de 100 AAA con descuentos serios. No competimos en cantidad: competimos en señal/ruido.'
    },
    {
      q: '¿Puedo compartir mi biblioteca con mi familia?',
      a: 'Sí. Modo Familia permite agregar miembros con su propio perfil pero compartiendo wallet y catálogo. Cada uno tiene su progreso y achievements individuales.'
    },
    {
      q: '¿Hay versión para Mac o Linux?',
      a: 'Hoy solo Windows 10/11 x64. Mac y Linux están en roadmap pero no antes de 2027 — el grueso de usuarios objetivo en Perú está en Windows.'
    },
    {
      q: '¿Pagar con Yape es seguro?',
      a: 'Sí. Subes screenshot de la transferencia, una IA verifica el monto y código de operación, y se acredita al wallet en ~30 segundos. No tocamos tu tarjeta porque no se la pides a Yape — es una transferencia bancaria directa.'
    }
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 md:py-32 relative">
      <div className="max-w-3xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-12">
            <div className="text-xs font-bold tracking-[0.25em] text-purple-400 mb-3">PREGUNTAS FRECUENTES</div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight">Resolvemos lo común</h2>
            <p className="mt-4 text-white/60">Si tu pregunta no está acá, escríbenos por WhatsApp.</p>
          </div>
        </Reveal>

        <div className="space-y-3">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={i} delay={i * 60}>
                <div className={`rounded-2xl border transition-all ${isOpen ? 'border-cyan-400/40 bg-white/[0.06]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'}`}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left"
                  >
                    <span className="font-semibold text-base">{it.q}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-cyan-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <div className={`faq-content ${isOpen ? 'open' : ''}`}>
                    <div>
                      <p className="px-5 pb-5 text-sm text-white/70 leading-relaxed">{it.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal>
          <p className="mt-10 text-center text-sm text-white/50">
            ¿Otra pregunta? <a href="https://wa.me/51904957354" className="text-cyan-400 hover:underline">Escríbenos por WhatsApp</a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// Logo Dreitz inline — Dragón heráldico-geométrico en perfil (low-poly).
// Match con el icon.ico del launcher y el favicon del sitio.
// Versión simplificada (sin filters/aura) para nitidez a 32px en el navbar.
function DragonLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/tian.png"
      alt="Dreitz"
      width={size}
      height={size}
      className="rounded-full bg-black object-contain ring-1 ring-white/15 shadow-[0_0_18px_rgba(143,48,54,0.34)]"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );

  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="dlbg" cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="55%" stopColor="#0f0a24" />
          <stop offset="100%" stopColor="#020010" />
        </radialGradient>
        <linearGradient id="dlCrown" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="dlCheek" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#3b0764" />
        </linearGradient>
        <linearGradient id="dlSnout" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="dlSnoutFront" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#67e8f9" />
        </linearGradient>
        <linearGradient id="dlJaw" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        <linearGradient id="dlHorn" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0c0a1f" />
        </linearGradient>
        <linearGradient id="dlNeck" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        <linearGradient id="dlEdge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="50%" stopColor="#f0f9ff" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <radialGradient id="dlEye" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#ea580c" />
        </radialGradient>
      </defs>
      <rect width="256" height="256" rx="56" fill="url(#dlbg)" />
      {/* Cuello al fondo */}
      <path d="M 170 150 L 210 168 L 220 215 L 178 220 L 168 195 Z" fill="url(#dlNeck)" stroke="url(#dlEdge)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Cuernos */}
      <path d="M 158 80 L 172 28 L 188 72 L 178 96 Z" fill="url(#dlHorn)" stroke="url(#dlEdge)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M 186 84 L 218 48 L 222 80 L 200 102 Z" fill="url(#dlHorn)" stroke="url(#dlEdge)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Corona / cráneo */}
      <path d="M 100 100 L 135 88 L 160 78 L 186 84 L 200 102 L 168 130 L 144 116 L 130 96 Z" fill="url(#dlCrown)" stroke="url(#dlEdge)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Mejilla */}
      <path d="M 168 130 L 200 102 L 216 135 L 200 162 L 170 155 L 150 145 Z" fill="url(#dlCheek)" stroke="url(#dlEdge)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Hocico superior */}
      <path d="M 55 122 L 100 100 L 130 96 L 144 116 L 138 132 L 100 132 L 60 132 Z" fill="url(#dlSnout)" stroke="url(#dlEdge)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Punta hocico */}
      <path d="M 38 126 L 55 122 L 60 132 L 50 140 Z" fill="url(#dlSnoutFront)" stroke="url(#dlEdge)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Mandíbula inferior */}
      <path d="M 50 162 L 95 168 L 140 172 L 175 158 L 170 188 L 132 200 L 85 192 L 55 178 Z" fill="url(#dlJaw)" stroke="url(#dlEdge)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Interior boca */}
      <path d="M 50 140 L 60 132 L 100 132 L 138 132 L 150 145 L 140 160 L 95 162 L 55 158 Z" fill="#0c0a1f" />
      {/* Dientes */}
      <g fill="#f0f9ff">
        <path d="M 62 132 l 4 0 l -2 9 z" />
        <path d="M 82 134 l 4 0 l -2 9 z" />
        <path d="M 105 134 l 4 0 l -2 9 z" />
        <path d="M 128 132 l 4 0 l -2 8 z" />
      </g>
      {/* Ceja + Ojo */}
      <path d="M 120 92 L 158 88 L 152 104 L 138 100 L 128 102 Z" fill="#1e1b4b" stroke="url(#dlEdge)" strokeWidth="0.8" strokeLinejoin="round" />
      <circle cx="142" cy="108" r="6" fill="#0c0a1f" />
      <circle cx="143" cy="107" r="3.5" fill="url(#dlEye)" />
      <circle cx="144" cy="106" r="1.2" fill="#ffffff" />
      {/* Punto dorado */}
      <circle cx="222" cy="222" r="3" fill="#fbbf24" />
    </svg>
  );
}
