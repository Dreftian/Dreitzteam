import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Check, Sparkles, Tag, Bell, Layers, AlertCircle } from 'lucide-react';
import { detectCardBrand, luhnValid, maskCard, formatDate } from '../lib/format';

const benefits = [
  { icon: Tag, title: '15% de descuento permanente', text: 'En todo el catálogo, todo el año.' },
  { icon: Sparkles, title: 'Tema glass / mica blur', text: 'Apariencia premium desbloqueada.' },
  { icon: Layers, title: 'Acceso anticipado', text: 'Compra antes que el público general.' },
  { icon: Bell, title: 'Wishlist con alertas', text: 'Te avisamos cuando bajen de precio.' },
  { icon: Crown, title: 'Soporte prioritario', text: 'Atención preferencial vía WhatsApp.' }
];

export default function Pro() {
  const { user, refresh } = useAuth();
  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual');
  const [showCheckout, setShowCheckout] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [exp, setExp] = useState('');
  const [cvv, setCvv] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function format(v: string) {
    return v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
  }
  function formatExp(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    if (!luhnValid(cardNumber)) return setError('Número de tarjeta inválido');
    if (!/^\d{2}\/\d{2}$/.test(exp)) return setError('Vencimiento MM/YY');
    if (!/^\d{3,4}$/.test(cvv)) return setError('CVV inválido');
    setSubmitting(true);
    try {
      const brand = detectCardBrand(cardNumber);
      await window.api.proSubscribe({
        userId: user.id,
        plan,
        cardLast4: maskCard(cardNumber),
        cardBrand: `${brand} ${type === 'credit' ? 'Crédito' : 'Débito'}`
      });
      await refresh();
      setShowCheckout(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    if (!user) return;
    if (!confirm('¿Cancelar tu suscripción Pro?')) return;
    await window.api.proCancel(user.id);
    await refresh();
  }

  if (user?.is_pro) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="card pro-glass p-8 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-yellow-500/20 blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <Crown size={36} className="text-yellow-400 mb-3" />
          <h2 className="text-3xl font-bold mb-1">Eres miembro Pro</h2>
          <p className="text-fg-muted mb-4">
            Plan {user.pro_plan === 'monthly' ? 'mensual' : 'anual'} · vence el {user.pro_expires_at ? formatDate(user.pro_expires_at) : '—'}
          </p>
          <button onClick={cancel} className="btn btn-secondary text-sm">Cancelar suscripción</button>
        </div>

        <h3 className="font-bold mb-3">Tus beneficios activos</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {benefits.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-4 flex gap-3">
              <Icon className="text-yellow-400 shrink-0" size={20} />
              <div>
                <div className="font-semibold text-sm">{title}</div>
                <div className="text-xs text-fg-muted">{text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-400 text-xs font-bold tracking-widest mb-4">
          <Crown size={13} /> DREITZ PRO
        </div>
        <h2 className="text-4xl font-extrabold mb-2">Lleva tu experiencia al siguiente nivel</h2>
        <p className="text-fg-muted">Beneficios exclusivos, descuentos permanentes y un launcher mucho más bonito.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <button
          onClick={() => setPlan('monthly')}
          className={`card p-6 text-left transition-all ${plan === 'monthly' ? 'ring-2 ring-accent' : 'hover:border-accent/40'}`}
        >
          <div className="text-xs uppercase tracking-widest text-fg-subtle mb-2">Mensual</div>
          <div className="text-4xl font-extrabold mb-1">$15<span className="text-base text-fg-muted">/mes</span></div>
          <div className="text-xs text-fg-muted">Cancela cuando quieras</div>
        </button>
        <button
          onClick={() => setPlan('annual')}
          className={`card p-6 text-left transition-all relative ${plan === 'annual' ? 'ring-2 ring-yellow-400' : 'hover:border-yellow-400/40'}`}
        >
          <span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">AHORRA 33%</span>
          <div className="text-xs uppercase tracking-widest text-yellow-400 mb-2">Anual</div>
          <div className="text-4xl font-extrabold mb-1">$120<span className="text-base text-fg-muted">/año</span></div>
          <div className="text-xs text-fg-muted">Equivale a $10/mes</div>
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {benefits.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-4 flex gap-3">
            <Icon className="text-yellow-400 shrink-0" size={18} />
            <div>
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <Check size={12} className="text-green-400" />
                {title}
              </div>
              <div className="text-xs text-fg-muted mt-0.5">{text}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <button onClick={() => setShowCheckout(true)} className="btn btn-primary px-8 py-3 text-base">
          <Crown size={18} /> Activar Dreitz Pro {plan === 'monthly' ? '$15/mes' : '$120/año'}
        </button>
      </div>

      {showCheckout && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={subscribe} className="card max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-1">Activar Pro</h3>
            <p className="text-sm text-fg-muted mb-4">
              Plan {plan === 'monthly' ? 'mensual ($15)' : 'anual ($120)'} · cargo único de prueba
            </p>

            {error && (
              <div className="mb-3 px-3 py-2 rounded bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button type="button" onClick={() => setType('credit')} className={`px-3 py-2 rounded text-xs font-semibold border ${type === 'credit' ? 'border-accent bg-accent/10' : 'border-border'}`}>Crédito</button>
              <button type="button" onClick={() => setType('debit')} className={`px-3 py-2 rounded text-xs font-semibold border ${type === 'debit' ? 'border-accent bg-accent/10' : 'border-border'}`}>Débito</button>
            </div>

            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(format(e.target.value))}
              placeholder="0000 0000 0000 0000"
              className="input mb-3"
            />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <input value={exp} onChange={(e) => setExp(formatExp(e.target.value))} placeholder="MM/YY" className="input" />
              <input value={cvv} type="password" onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="CVV" className="input" />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCheckout(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={submitting} className="btn btn-primary flex-1">{submitting ? 'Activando...' : 'Activar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
