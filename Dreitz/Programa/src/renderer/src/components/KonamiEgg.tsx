import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export default function KonamiEgg() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let buffer: string[] = [];
    function onKey(e: KeyboardEvent) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      buffer.push(k);
      if (buffer.length > SEQ.length) buffer.shift();
      if (buffer.length === SEQ.length && buffer.every((b, i) => b === SEQ[i])) {
        buffer = [];
        setOpen(true);
        toast.success('🎮 Easter egg desbloqueado');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] bg-black/85 flex items-center justify-center p-6">
      <button onClick={() => setOpen(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center">
        <X size={20} />
      </button>
      <div className="text-center text-white max-w-lg">
        <Sparkles className="mx-auto mb-4 text-yellow-300" size={48} />
        <h1 className="text-5xl font-extrabold mb-3 shimmer-text">Konami Activated</h1>
        <p className="text-white/80 mb-6">Has descubierto un secreto. Aquí tienes 100 puntos cortesía de Dreitzteam — ya están en tu cuenta. 🎁</p>
        <button onClick={() => setOpen(false)} className="btn btn-primary">Continuar</button>
      </div>
      <style>{`
        @keyframes konamiBg { 0% { background-position: 0 0 } 100% { background-position: 100% 100% } }
      `}</style>
    </div>
  );
}
