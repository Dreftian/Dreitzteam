import { useState } from 'react';
import { Gift, Copy, Check, X, MessageCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { fire } from '../lib/confetti';
import { play } from '../lib/sounds';

/**
 * Convierte un juego de la biblioteca en una clave-regalo P2P.
 *
 * Genera una nueva clave DRZ tipo "gift" en el servidor (no consume el slot del usuario,
 * sólo crea una licencia adicional asociada al mismo game_id). El usuario puede
 * copiarla o enviarla por WhatsApp.
 */
export default function GiftButton({ gameId, gameTitle }: { gameId: number; gameTitle: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  async function generate() {
    setBusy(true);
    try {
      const r = await window.api.giftCreate({ fromUserId: user!.id, gameId, message: message.trim() || undefined });
      setCode(r.code);
      fire('gift');
      play('gift_received');
      toast.success('Clave regalo generada');
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  function copy() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    play('copy');
    setTimeout(() => setCopied(false), 1500);
  }

  function sendWhatsApp() {
    if (!code) return;
    const text = `¡Sorpresa! 🎁 Te regalé *${gameTitle}* en Dreitz.\n\nTu clave: *${code}*\n\nActívala en el launcher → Activar clave.${message ? `\n\n${message}` : ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function close() {
    setOpen(false);
    setCode(null);
    setMessage('');
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-secondary text-xs flex items-center gap-1" title="Regalar este juego a un amigo">
        <Gift size={12} /> Regalar
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }}
            className="card p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Gift className="text-pink-400" size={22} /> Regalar {gameTitle}
              </h3>
              <button onClick={close} className="text-fg-muted hover:text-fg"><X size={18} /></button>
            </div>

            {!code ? (
              <>
                <p className="text-sm text-fg-muted mb-4">
                  Generamos una clave DRZ que tu amigo puede activar en su Dreitz. Tu copia del juego sigue intacta — esto es una clave adicional.
                </p>
                <label className="block">
                  <span className="text-xs font-semibold text-fg-muted mb-1.5 block">Mensaje para tu amigo (opcional)</span>
                  <textarea
                    className="input mb-4 min-h-[80px]"
                    placeholder="¡Feliz cumple bro! Espero te encante este juego..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={300}
                  />
                </label>
                <button onClick={generate} disabled={busy} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  Generar clave de regalo
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-fg-muted mb-3">¡Lista! Comparte esta clave con tu amigo:</p>
                <div className="card p-4 bg-bg-elev text-center mb-4">
                  <code className="text-base font-mono tracking-widest text-accent break-all">{code}</code>
                </div>
                <div className="flex gap-2 mb-2">
                  <button onClick={copy} className="btn flex-1 text-sm">
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                  <button onClick={sendWhatsApp} className="btn btn-primary flex-1 text-sm flex items-center justify-center gap-1.5" style={{ background: '#25D366' }}>
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                </div>
                <p className="text-[11px] text-fg-subtle text-center">
                  Puedes generar varias claves del mismo juego. Cada una se canjea sólo una vez.
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
