import { useEffect, useState } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { LogoMark, LogoWordmark } from './Logo';

/**
 * TitleBar de la ventana (Electron frame:false). Antes mostraba un mini
 * cuadrado "D" + "DREITZ" gris. Ahora rinde el branding completo: dragón
 * (LogoMark) + wordmark "Dreitz" con shimmer arcoíris. El TopBar quitó su
 * propia copia del logo para evitar duplicarlo.
 */
export default function TitleBar() {
  const [maxed, setMaxed] = useState(false);

  useEffect(() => {
    window.api.windowIsMaximized().then(setMaxed);
    const id = setInterval(() => window.api.windowIsMaximized().then(setMaxed), 800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="titlebar-drag h-9 flex items-center justify-between bg-bg-base border-b border-border z-50 relative">
      <div className="flex items-center gap-2 px-3 select-none">
        <LogoMark size="xs" animated />
        <LogoWordmark size="xs" />
      </div>
      <div className="titlebar-no-drag flex items-stretch h-full">
        <button onClick={() => window.api.windowMinimize()} className="px-4 hover:bg-bg-hover transition-colors">
          <Minus size={14} />
        </button>
        <button onClick={() => window.api.windowMaximize()} className="px-4 hover:bg-bg-hover transition-colors">
          {maxed ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button onClick={() => window.api.windowClose()} className="px-4 hover:bg-red-600 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
