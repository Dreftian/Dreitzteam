import { Share2, Copy, Gift, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

/**
 * Tarjeta de "invita y gana" — muestra el `ref_code` del usuario con botones
 * para copiar al portapapeles y compartir vía WhatsApp/sistema. Ambos (el
 * invitador y el invitado) reciben S/. 10 cuando el invitado hace su primera
 * compra (lógica en `referrals:claimFirstPurchase`).
 */
export default function ReferralCard() {
  const { user } = useAuth();
  if (!user || !user.ref_code) return null;
  const url = `https://dreitz.app?ref=${user.ref_code}`;
  const msg = `¡Únete a Dreitz! Usa mi código ${user.ref_code} al registrarte y ambos ganamos S/. 10 cuando hagas tu primera compra. ${url}`;

  function copyCode() {
    navigator.clipboard.writeText(user.ref_code!).then(
      () => toast.success('Código copiado'),
      () => toast.error('No se pudo copiar')
    );
  }

  function shareWhatsApp() {
    const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(wa, '_blank');
  }

  function share() {
    if ((navigator as any).share) {
      (navigator as any).share({ title: 'Únete a Dreitz', text: msg, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(msg).then(() => toast.success('Mensaje copiado'));
    }
  }

  return (
    <section className="card p-5 border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-pink-500/5">
      <div className="flex items-center gap-2 mb-1">
        <Gift size={17} className="text-yellow-400" />
        <h3 className="font-bold">Invita y ambos ganan S/. 10</h3>
      </div>
      <p className="text-xs text-fg-muted mb-4">
        Comparte tu código con amigos. Cuando se registren y hagan su primera compra,
        ambos reciben S/. 10 en su wallet — automático, sin trámites.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 p-3 rounded-md bg-bg-elev border border-border font-mono font-bold text-lg tracking-widest text-center text-accent">
          {user.ref_code}
        </div>
        <button onClick={copyCode} className="btn text-sm flex items-center gap-1.5">
          <Copy size={13} /> Copiar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={shareWhatsApp} className="btn text-sm flex items-center justify-center gap-1.5 hover:text-green-400">
          <Users size={13} /> WhatsApp
        </button>
        <button onClick={share} className="btn text-sm flex items-center justify-center gap-1.5">
          <Share2 size={13} /> Compartir
        </button>
      </div>
    </section>
  );
}
