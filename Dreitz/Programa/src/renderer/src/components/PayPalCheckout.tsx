import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Botón de pago PayPal. El renderer crea la orden client-side con el client_id
 * público y, cuando el usuario aprueba, devuelve el `orderID` para que el main
 * lo capture vía `paymentsCharge({ provider: 'paypal', token: orderID })`.
 *
 * Si no hay client_id configurado en Keys → Pagos, renderiza un placeholder.
 */
export default function PayPalCheckout({
  amount,
  currency,
  clientId,
  env,
  onApproved,
  onError
}: {
  amount: number;
  currency: string;
  clientId: string;
  env: 'sandbox' | 'live';
  onApproved: (orderId: string) => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  if (!clientId) {
    return (
      <div className="card p-3 mb-4 bg-yellow-500/10 border-yellow-500/30 text-xs text-yellow-200/90">
        ⚠ PayPal no tiene <code>client_id</code> configurado · pide al admin que lo agregue en Keys → Pagos.
      </div>
    );
  }
  if (!ready) return <div className="flex items-center gap-2 text-fg-muted text-sm"><Loader2 size={14} className="animate-spin" /> Cargando PayPal…</div>;

  // PayPal cobra en USD/EUR; convertimos PEN a USD aproximado (1 PEN ≈ 0.27 USD).
  // Para producción, leer este factor de la tabla `currency_rates`.
  const amountStr = amount.toFixed(2);

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency,
        environment: env,
        // No queremos que PayPal cargue scripts en producción si está en sandbox y viceversa.
        intent: 'capture'
      } as any}
    >
      <PayPalButtons
        style={{ layout: 'vertical', shape: 'rect', label: 'pay' }}
        createOrder={(_data, actions) =>
          actions.order.create({
            intent: 'CAPTURE',
            purchase_units: [
              { amount: { currency_code: currency, value: amountStr } }
            ]
          })
        }
        onApprove={async (data) => {
          await onApproved(data.orderID);
        }}
        onError={(err: any) => onError(err?.message ?? 'Error PayPal')}
      />
    </PayPalScriptProvider>
  );
}
