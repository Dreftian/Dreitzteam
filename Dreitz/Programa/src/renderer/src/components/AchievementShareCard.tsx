import { useEffect, useRef, useState } from 'react';
import { Award, Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  title: string;
  description: string;
  username: string;
  unlockedAt: string;
  onClose: () => void;
}

export default function AchievementShareCard({ title, description, username, unlockedAt, onClose }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = 1200, H = 630;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0a0e1a');
    g.addColorStop(0.5, '#1a0e36');
    g.addColorStop(1, '#0a1430');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Glow blobs
    const grad1 = ctx.createRadialGradient(W * 0.25, H * 0.3, 0, W * 0.25, H * 0.3, 600);
    grad1.addColorStop(0, 'rgba(110,0,255,0.5)');
    grad1.addColorStop(1, 'rgba(110,0,255,0)');
    ctx.fillStyle = grad1; ctx.fillRect(0, 0, W, H);
    const grad2 = ctx.createRadialGradient(W * 0.75, H * 0.7, 0, W * 0.75, H * 0.7, 600);
    grad2.addColorStop(0, 'rgba(0,212,255,0.45)');
    grad2.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.fillStyle = grad2; ctx.fillRect(0, 0, W, H);

    // Trophy emoji circle
    ctx.beginPath();
    ctx.arc(170, H / 2, 90, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.18)';
    ctx.fill();
    ctx.font = 'bold 96px "Segoe UI Emoji", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', 170, H / 2 + 5);

    // Texts
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a5f3fc';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('LOGRO DESBLOQUEADO · DREITZ', 290, 200);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px system-ui';
    ctx.fillText(title, 290, 270);

    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '28px system-ui';
    wrapText(ctx, description, 290, 330, W - 320, 38);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '20px system-ui';
    ctx.fillText(`@${username} · ${new Date(unlockedAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 290, H - 90);

    // Brand logo bottom-right
    ctx.textAlign = 'right';
    ctx.font = 'bold 36px system-ui';
    const grd = ctx.createLinearGradient(W - 250, 0, W - 30, 0);
    grd.addColorStop(0, '#00d4ff');
    grd.addColorStop(0.5, '#a855ff');
    grd.addColorStop(1, '#ff3aa6');
    ctx.fillStyle = grd;
    ctx.fillText('Dreitz', W - 50, H - 60);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '16px system-ui';
    ctx.fillText('dreitzteam', W - 50, H - 35);

    setUrl(canvas.toDataURL('image/png'));
  }, [title, description, username, unlockedAt]);

  function download() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `dreitz-achievement-${Date.now()}.png`;
    a.click();
    toast.success('Imagen descargada');
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card max-w-3xl w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center"><X size={15} /></button>
        <h3 className="text-lg font-bold mb-1 flex items-center gap-2"><Award className="text-yellow-400" size={18} /> Compartir logro</h3>
        <p className="text-xs text-fg-muted mb-4">Imagen lista para compartir en redes (1200×630).</p>
        <div className="rounded-xl overflow-hidden border border-border">
          <canvas ref={ref} className="w-full h-auto block" style={{ aspectRatio: '1200/630' }} />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cerrar</button>
          <button onClick={download} className="btn btn-primary flex-1"><Download size={14} /> Descargar PNG</button>
        </div>
      </div>
    </div>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = w + ' ';
      y += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, y);
}
