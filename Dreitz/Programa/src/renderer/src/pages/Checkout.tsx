import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { detectCardBrand, luhnValid, maskCard } from '../lib/format';
import { tokenizeWithCulqi } from '../lib/culqi';
import { play as playSound } from '../lib/sounds';
import { fire } from '../lib/confetti';
import { unlockAchievement } from '../components/AchievementUnlockModal';
import PayPalCheckout from '../components/PayPalCheckout';
import { CreditCard, Lock, AlertCircle, ArrowLeft, Coins, Wallet as WalletIcon, Sparkles, Zap, Upload, ScanLine, Loader2 } from 'lucide-react';

type Provider = 'culqi' | 'paypal' | 'yape';

export default function Checkout() {
  const { items, total, clear } = useCart();
  const { user } = useAuth();
  const { format } = useCurrency();
  const nav = useNavigate();

  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [exp, setExp] = useState('');
  const [cvv, setCvv] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [redeemValue, setRedeemValue] = useState(0.05);
  const [provider, setProvider] = useState<Provider>('culqi');
  const [providerConfig, setProviderConfig] = useState<any>(null);

  // ----- Yape state -----
  const [yapeCfg, setYapeCfg] = useState<{ qr_image_data: string; recipient_name: string; recipient_phone: string; enabled: boolean } | null>(null);
  const [yapeReceiptDataUrl, setYapeReceiptDataUrl] = useState<string | null>(null);
  const [yapeVerifying, setYapeVerifying] = useState(false);

  useEffect(() => {
    setPointsToUse(parseInt(sessionStorage.getItem('dreitz.checkout.points') || '0', 10));
    setUseWallet(sessionStorage.getItem('dreitz.checkout.useWallet') === '1');
    if (user) {
      window.api.pointsBalance(user.id).then((b: any) => setRedeemValue(b.redeem_value));
      window.api.funnelEmit({ userId: user.id, event: 'checkout_view' });
    }
    window.api.paymentsConfig().then(setProviderConfig).catch(() => {});
    window.api.yapeGetConfig?.().then(setYapeCfg).catch(() => {});
  }, [user?.id]);

  /**
   * Llamado desde PayPalCheckout cuando el usuario aprueba la orden.
   * Hace el `charge` para capturar la orden y luego corre el `checkout:purchase` normal.
   */
  async function runPaypalApprove(orderId: string) {
    if (!user) return;
    setSubmitting(true);
    try {
      const r: any = await window.api.paymentsCharge({
        provider: 'paypal',
        amount: totalAfter,
        currency: 'USD',
        description: `Dreitz · ${items.length} juego(s)`,
        token: orderId,
        customer_email: user.email || undefined
      });
      if (r?.success === false) {
        setError('PayPal: ' + (r.message || 'sin detalle'));
        playSound('error');
        return;
      }
      const res = await window.api.checkoutPurchase({
        userId: user.id,
        items: items.map((i) => ({ gameId: i.gameId })),
        cardLast4: '',
        cardBrand: `paypal (${orderId.slice(0, 12)})`,
        pointsToUse,
        useWallet
      });
      clear();
      sessionStorage.removeItem('dreitz.checkout.points');
      sessionStorage.removeItem('dreitz.checkout.useWallet');
      playSound('success');
      fire('purchase');
      nav(`/library?order=${res.orderId}`);
    } catch (err) {
      playSound('error');
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onYapeReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen pesa más de 5 MB — comprímela antes de subirla.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setYapeReceiptDataUrl(reader.result as string);
    reader.onerror = () => setError('No se pudo leer la imagen.');
    reader.readAsDataURL(file);
  }

  const brand = detectCardBrand(cardNumber);

  function format4(v: string) {
    return v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
  }
  function formatExp(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  const ptsDiscount = +(pointsToUse * redeemValue).toFixed(2);
  const totalAfter = Math.max(0, total - ptsDiscount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!user) return setError('Sesión inválida');

    // Validar inputs según el proveedor elegido.
    const needsCard = totalAfter > 0 && provider === 'culqi';
    if (needsCard) {
      if (!luhnValid(cardNumber)) return setError('Número de tarjeta inválido');
      if (cardName.trim().length < 3) return setError('Nombre del titular requerido');
      if (!/^\d{2}\/\d{2}$/.test(exp)) return setError('Vencimiento debe ser MM/YY');
      if (!/^\d{3,4}$/.test(cvv)) return setError('CVV inválido');
    }
    if (totalAfter > 0 && provider === 'yape') {
      if (!yapeCfg?.enabled) return setError('Yape aún no está configurado en Keys.');
      if (!yapeReceiptDataUrl) return setError('Sube la captura de tu comprobante Yape primero.');
    }

    setSubmitting(true);
    try {
      // Yape: verificación con IA antes de procesar.
      if (totalAfter > 0 && provider === 'yape' && yapeReceiptDataUrl) {
        setYapeVerifying(true);
        try {
          const r = await window.api.yapeVerifyReceipt({
            userId: user.id,
            expectedAmount: totalAfter,
            imageDataUrl: yapeReceiptDataUrl
          });
          if (!r.valid) {
            const detail = r.issues.length ? `· ${r.issues.join(' · ')}` : '';
            setError(`No se pudo verificar el pago Yape ${detail}. Revisa el monto o vuelve a tomar la captura. (Si crees que es un error, contacta al admin — quedó guardado para revisión.)`);
            playSound('error');
            setSubmitting(false);
            setYapeVerifying(false);
            return;
          }
        } finally {
          setYapeVerifying(false);
        }
      }

      // Run charge through chosen provider (Culqi/PayPal). Yape ya quedó verificado arriba.
      if (totalAfter > 0 && provider !== 'yape') {
        try {
          let token: string | undefined;
          if (provider === 'culqi' && providerConfig?.public_keys?.culqi) {
            const [mm, yy] = exp.split('/');
            token = await tokenizeWithCulqi({
              publicKey: providerConfig.public_keys.culqi,
              card_number: cardNumber,
              cvv,
              expiration_month: mm || '',
              expiration_year: yy || '',
              email: user.email || `${user.username}@dreitzteam.local`
            });
          }

          const r: any = await window.api.paymentsCharge({
            provider,
            amount: totalAfter,
            currency: 'PEN',
            description: `Dreitz · ${items.length} juego(s)`,
            token,
            customer_email: user.email || undefined
          });
          if (r?.success === false) {
            setError('Pago rechazado: ' + (r.message || 'sin detalle'));
            setSubmitting(false);
            return;
          }
          if (r?.message) console.log('[payment]', r.message);
        } catch (e) {
          setError('Error en pasarela: ' + (e as Error).message);
          setSubmitting(false);
          return;
        }
      }
      const res: any = await window.api.checkoutPurchase({
        userId: user.id,
        items: items.map((i) => ({ gameId: i.gameId })),
        cardLast4: needsCard ? maskCard(cardNumber) : '',
        cardBrand: needsCard ? `${brand} ${type === 'credit' ? 'Crédito' : 'Débito'} (${provider})` : `${provider} wallet/puntos`,
        pointsToUse,
        useWallet
      });
      clear();
      sessionStorage.removeItem('dreitz.checkout.points');
      sessionStorage.removeItem('dreitz.checkout.useWallet');
      playSound('success');
      fire('purchase');
      // Si la compra desbloqueó algún logro, mostrar el modal cinemático (cada uno se encola).
      if (Array.isArray(res?.unlockedAchievements)) {
        for (const a of res.unlockedAchievements) {
          unlockAchievement({
            code: a.code,
            title: a.title ?? '¡Logro desbloqueado!',
            description: a.description ?? '',
            points: a.points,
            rarity: a.rarity ?? 'rare'
          });
        }
      }
      nav(`/library?order=${res.orderId}`);
    } catch (err) {
      playSound('error');
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!items.length) {
    return (
      <div className="p-10 text-center">
        <p className="mb-4 text-fg-muted">Tu carrito está vacío.</p>
        <Link to="/store" className="btn btn-primary">Ir a la tienda</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => nav(-1)} className="text-fg-muted hover:text-fg flex items-center gap-2 mb-4 text-sm">
        <ArrowLeft size={15} /> Volver
      </button>
      <h2 className="text-3xl font-bold mb-6">Pago</h2>

      <form onSubmit={submit} className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {totalAfter === 0 && (
            <div className="card p-4 bg-green-500/10 border-green-500/30 flex items-center gap-2 text-sm text-green-300">
              <Sparkles size={15} />
              ¡Tu compra está cubierta por puntos y/o billetera! No necesitas ingresar tarjeta.
            </div>
          )}

          {totalAfter > 0 && (
            <div className="card p-5">
              <div className="text-xs uppercase tracking-wider text-fg-subtle mb-3 font-semibold">Método de pago</div>
              <div className="grid grid-cols-3 gap-2 mb-5">
                <ProviderBtn label="Yape" sub="Perú · QR" tone="purple" active={provider === 'yape'} onClick={() => setProvider('yape')} live={!!yapeCfg?.enabled} />
                <ProviderBtn label="Culqi" sub="Tarjeta" tone="cyan" active={provider === 'culqi'} onClick={() => setProvider('culqi')} live={providerConfig?.enabled?.culqi} />
                <ProviderBtn label="PayPal" sub="Internacional" tone="yellow" active={provider === 'paypal'} onClick={() => setProvider('paypal')} live={providerConfig?.enabled?.paypal} />
              </div>

              {provider === 'paypal' && !providerConfig?.enabled?.paypal && (
                <div className="card p-3 mb-4 bg-yellow-500/10 border-yellow-500/30 text-xs text-yellow-200/90">
                  ⚠ PayPal no tiene API key configurada · el pago se procesará en <b>modo simulado</b>. Configúralo desde <b>Keys → Pagos</b>.
                </div>
              )}

              {provider === 'culqi' && (
                <div className="card p-3 mb-4 bg-cyan-500/10 border-cyan-500/30 text-xs text-cyan-200/90">
                  💡 <b>Culqi</b> es la pasarela peruana del BCP. Comisión 3.99% + S/.0.30, depósito a cuenta peruana en 1–2 días. Acepta Visa, Mastercard, Amex, Diners.
                </div>
              )}

              {/* ===== YAPE FLOW ===== */}
              {provider === 'yape' && (
                <YapeFlow
                  cfg={yapeCfg}
                  amount={totalAfter}
                  format={format}
                  receiptDataUrl={yapeReceiptDataUrl}
                  onPickReceipt={onYapeReceiptChange}
                  onClearReceipt={() => setYapeReceiptDataUrl(null)}
                  verifying={yapeVerifying}
                />
              )}

              {/* ===== CARD FORM (Culqi) ===== */}
              {provider === 'culqi' && (
                <>
                  <div className="text-xs uppercase tracking-wider text-fg-subtle mb-3 font-semibold">Tipo de tarjeta</div>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <button type="button" onClick={() => setType('credit')} className={`px-4 py-3 rounded-md border text-sm font-semibold ${type === 'credit' ? 'border-accent bg-accent/10 text-fg' : 'border-border text-fg-muted hover:bg-bg-hover'}`}>
                      Tarjeta de crédito
                    </button>
                    <button type="button" onClick={() => setType('debit')} className={`px-4 py-3 rounded-md border text-sm font-semibold ${type === 'debit' ? 'border-accent bg-accent/10 text-fg' : 'border-border text-fg-muted hover:bg-bg-hover'}`}>
                      Tarjeta de débito
                    </button>
                  </div>

                  <label className="block text-xs font-semibold text-fg-muted mb-1.5">Número de tarjeta</label>
                  <div className="relative mb-4">
                    <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                    <input
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(format4(e.target.value))}
                      placeholder="0000 0000 0000 0000"
                      className="input pl-10"
                    />
                    {cardNumber && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-fg-muted">{brand}</span>}
                  </div>

                  <label className="block text-xs font-semibold text-fg-muted mb-1.5">Titular</label>
                  <input
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value.toUpperCase())}
                    placeholder="NOMBRE APELLIDO"
                    className="input mb-4"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">Vencimiento</label>
                      <input
                        inputMode="numeric"
                        value={exp}
                        onChange={(e) => setExp(formatExp(e.target.value))}
                        placeholder="MM/YY"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">CVV</label>
                      <input
                        inputMode="numeric"
                        type="password"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="123"
                        className="input"
                      />
                    </div>
                  </div>
                </>
              )}

              {provider === 'paypal' && (
                <div className="py-4">
                  <PayPalCheckout
                    amount={totalAfter}
                    currency="USD"
                    clientId={providerConfig?.public_keys?.paypal ?? ''}
                    env={(providerConfig?.public_keys?.paypal_env ?? 'sandbox') as 'sandbox' | 'live'}
                    onApproved={async (orderId) => {
                      await runPaypalApprove(orderId);
                    }}
                    onError={(msg) => setError('PayPal: ' + msg)}
                  />
                  <p className="text-[11px] text-fg-subtle mt-3 text-center">
                    Nota: PayPal cobra en USD. Tu monto se convertirá automáticamente.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="card p-4 flex items-center gap-3 text-xs text-fg-muted">
            <Lock size={14} className="text-green-400" />
            {provider === 'yape'
              ? 'Tu pago Yape se verifica con IA contra el QR del administrador. El comprobante queda guardado para revisión.'
              : 'Tus datos viajan en local: este es un entorno de prueba sin pasarela real conectada (a menos que el admin haya configurado Culqi/PayPal).'}
          </div>
        </div>

        <aside className="card p-5 h-fit">
          <h3 className="font-bold mb-4">Resumen</h3>
          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {items.map((it) => (
              <div key={it.gameId} className="flex justify-between text-sm">
                <span className="truncate flex-1 mr-2">{it.title}</span>
                <span>{format(it.price)}</span>
              </div>
            ))}
          </div>

          {pointsToUse > 0 && (
            <div className="flex justify-between text-sm mb-1 text-yellow-400">
              <span className="flex items-center gap-1"><Coins size={12} /> Puntos ({pointsToUse})</span>
              <span>-{format(ptsDiscount)}</span>
            </div>
          )}
          {useWallet && (
            <div className="flex justify-between text-sm mb-1 text-cyan-400">
              <span className="flex items-center gap-1"><WalletIcon size={12} /> Billetera</span>
              <span>aplicada</span>
            </div>
          )}

          <div className="flex justify-between text-lg font-bold border-t border-border pt-3 mb-4">
            <span>Total</span>
            <span>{format(totalAfter)}</span>
          </div>
          {/* Para PayPal el CTA es el PayPalButton; ocultamos el botón regular */}
          {!(provider === 'paypal' && totalAfter > 0) && (
            <button
              disabled={submitting || (provider === 'yape' && totalAfter > 0 && !yapeReceiptDataUrl)}
              type="submit"
              className="btn btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {(submitting || yapeVerifying) && <Loader2 size={14} className="animate-spin" />}
              {yapeVerifying ? 'Verificando con IA…' : submitting ? 'Procesando…' : `Pagar ${format(totalAfter)}`}
            </button>
          )}
          <p className="text-[11px] text-fg-subtle mt-3 text-center">
            Soporte vía WhatsApp: <span className="font-semibold">+51 904 957 354</span>
          </p>
        </aside>
      </form>
    </div>
  );
}

const TONE_BG: Record<string, string> = {
  cyan: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  purple: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
  yellow: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  green: 'border-green-500/40 bg-green-500/10 text-green-300'
};

function ProviderBtn({ label, sub, tone, active, onClick, live }: { label: string; sub: string; tone: keyof typeof TONE_BG; active: boolean; onClick: () => void; live: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-3 rounded-md border text-sm font-semibold text-left transition-all ${active ? TONE_BG[tone] + ' border-2' : 'border-border text-fg-muted hover:bg-bg-hover'}`}
    >
      <div className="flex items-center justify-between">
        <span>{label}</span>
        {!live && <span className="text-[8px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-300">SIM</span>}
      </div>
      <div className="text-[10px] text-fg-subtle font-normal mt-0.5">{sub}</div>
    </button>
  );
}

interface YapeFlowProps {
  cfg: { qr_image_data: string; recipient_name: string; recipient_phone: string; enabled: boolean } | null;
  amount: number;
  format: (n: number) => string;
  receiptDataUrl: string | null;
  onPickReceipt: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearReceipt: () => void;
  verifying: boolean;
}

function YapeFlow({ cfg, amount, format, receiptDataUrl, onPickReceipt, onClearReceipt, verifying }: YapeFlowProps) {
  if (!cfg?.enabled) {
    return (
      <div className="card p-4 bg-yellow-500/10 border-yellow-500/30 text-sm text-yellow-200/90">
        ⚠ El administrador todavía no ha configurado Yape. Pídele que suba su QR en Keys → Pagos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-4 bg-bg-elev text-center">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle mb-2">Escanea este QR con Yape</div>
          {cfg.qr_image_data && (
            <img src={cfg.qr_image_data} alt="QR Yape" className="mx-auto rounded-md max-h-64 mb-2" />
          )}
          <div className="text-xs text-fg-muted">
            Destinatario: <span className="font-semibold text-fg">{cfg.recipient_name}</span>
          </div>
          {cfg.recipient_phone && (
            <div className="text-[11px] text-fg-subtle">Cel: {cfg.recipient_phone}</div>
          )}
        </div>

        <div className="card p-4 space-y-3 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <ScanLine size={16} className="text-purple-400" /> Cómo pagar
          </div>
          <ol className="text-xs text-fg-muted space-y-1.5 list-decimal pl-4">
            <li>Abre tu app Yape en el celular.</li>
            <li>Escanea el QR de la izquierda.</li>
            <li>Confirma el monto: <span className="font-bold text-fg">{format(amount)}</span></li>
            <li>Pulsa "Yapear" y guarda la captura del comprobante.</li>
            <li>Sube la captura aquí abajo. Una IA la verificará y desbloqueará tu clave.</li>
          </ol>
        </div>
      </div>

      <div className="card p-4">
        <div className="text-xs uppercase tracking-wider text-fg-subtle mb-2 font-semibold">Comprobante</div>
        {receiptDataUrl ? (
          <div className="flex items-start gap-3">
            <img src={receiptDataUrl} alt="Comprobante" className="rounded-md max-h-48" />
            <button type="button" onClick={onClearReceipt} className="text-xs text-fg-muted hover:text-red-400" disabled={verifying}>
              Quitar
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPickReceipt}
            />
            <div className="border-2 border-dashed border-border rounded-md p-6 text-center hover:bg-bg-hover transition-colors">
              <Upload size={20} className="mx-auto mb-2 text-fg-muted" />
              <div className="text-sm font-medium">Subir captura del comprobante Yape</div>
              <div className="text-[11px] text-fg-subtle mt-1">JPEG, PNG o WebP · máx 5 MB</div>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
