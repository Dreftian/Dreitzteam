import { useEffect, useState } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import BrandMark from './BrandMark';

export default function TitleBar() {
  const [maxed, setMaxed] = useState(false);
  useEffect(() => {
    window.api.windowIsMaximized().then(setMaxed);
    const id = setInterval(() => window.api.windowIsMaximized().then(setMaxed), 800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="titlebar-drag h-9 flex items-center justify-between bg-bg-base border-b border-border z-50 relative">
      <div className="flex items-center gap-3 px-4">
        <BrandMark size={22} />
        <span className="text-xs font-semibold tracking-wide text-fg-muted">DREITZ KEYS · PANEL ADMIN</span>
      </div>
      <div className="titlebar-no-drag flex items-stretch h-full">
        <button onClick={() => window.api.windowMinimize()} className="px-4 hover:bg-bg-hover"><Minus size={14} /></button>
        <button onClick={() => window.api.windowMaximize()} className="px-4 hover:bg-bg-hover">{maxed ? <Copy size={12} /> : <Square size={12} />}</button>
        <button onClick={() => window.api.windowClose()} className="px-4 hover:bg-red-600 hover:text-white"><X size={14} /></button>
      </div>
    </div>
  );
}
