/**
 * Payment provider integrations.
 *
 * RECOMENDACIÓN PARA PERÚ:
 *  - Culqi (https://culqi.com)        — pasarela peruana del BCP, comisión 3.99% + S/.0.30, depósitos a BCP/BBVA/Interbank en 1-2 días.
 *                                        Acepta Visa, Mastercard, Amex, Diners + Yape + Plin. Recomendada por simplicidad y costo.
 *  - Stripe                           — disponible en Perú desde 2024 (preview). Mejor si vendes a clientes internacionales.
 *  - PayPal                            — funciona pero el dinero queda en cuenta PayPal y la transferencia a banco peruano tarda 3–5 días.
 *
 * Las API keys se almacenan en `app_config` (clave→valor). Sólo el rol admin puede leerlas/escribirlas.
 *
 * # Modo real vs simulado
 *
 * - Si NO hay private key configurada en `app_config` para el provider, el handler
 *   devuelve `{mode:'simulated'}` con un external_id ficticio coherente. Esto deja
 *   el flujo end-to-end funcionando para tests internos sin tocar dinero real.
 * - Si SÍ hay private key, el handler hace la llamada HTTPS real al provider.
 *   Para Culqi, el renderer DEBE tokenizar la tarjeta con Culqi.js v4 antes
 *   (usando la public key) y enviar el `token` resultante en el payload.
 *
 * # Integración Culqi.js en el renderer
 *
 * En la página de Checkout, antes de invocar `payments:charge`:
 *   1. Carga el script `https://checkout.culqi.com/js/v4` una sola vez.
 *   2. `Culqi.publicKey = <tu pk_test_/pk_live_>`
 *   3. `Culqi.createToken({card_number, cvv, expiration_month, expiration_year, email})`
 *      → devuelve `tkn_test_*` o `tkn_live_*`.
 *   4. Llama a `paymentsCharge({ provider: 'culqi', token, amount, currency, description, customer_email })`.
 *
 * La tokenización NUNCA debe pasar por el main process: si la tarjeta cruda llegara
 * acá violaríamos PCI-DSS.
 */

import { getDb } from './db';
import log from './logger';

export type Provider = 'card' | 'stripe' | 'paypal' | 'culqi';

export interface ChargePayload {
  amount: number;            // En la unidad mayor de la moneda (p. ej. soles, no céntimos)
  currency: string;          // 'PEN', 'USD', ...
  description: string;
  customer_email?: string;
  token?: string;            // Culqi: tkn_*, Stripe: tok_* o pm_* (PaymentMethod), PayPal: order id
  // Legacy field used by el flujo de tarjeta simulada (Luhn local). NUNCA enviar a un provider real.
  card?: { number: string; exp_month: number; exp_year: number; cvv: string };
}

export interface ChargeResult {
  success: boolean;
  provider: Provider;
  external_id: string;
  mode: 'live' | 'simulated';
  message?: string;
}

function getKey(key: string): string | null {
  const r = getDb().prepare('SELECT value FROM app_config WHERE key = ?').get(key) as any;
  return r?.value ?? null;
}

export function setKey(key: string, value: string | null) {
  if (value === null || value === '') {
    getDb().prepare('DELETE FROM app_config WHERE key = ?').run(key);
  } else {
    getDb().prepare(
      `INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
    ).run(key, value);
  }
}

export function getProviderConfig() {
  return {
    enabled: {
      stripe: !!getKey('payments.stripe.secret_key'),
      paypal: !!getKey('payments.paypal.client_id') && !!getKey('payments.paypal.client_secret'),
      culqi: !!getKey('payments.culqi.private_key')
    },
    public_keys: {
      // El renderer las necesita para inicializar las JS SDK; se mandan al frontend.
      culqi: getKey('payments.culqi.public_key') ?? '',
      stripe: getKey('payments.stripe.public_key') ?? '',
      paypal: getKey('payments.paypal.client_id') ?? '',
      paypal_env: (getKey('payments.paypal.env') ?? 'sandbox') as 'sandbox' | 'live'
    },
    payout_account: {
      bank: getKey('payout.bank') ?? '',
      cci: getKey('payout.cci') ?? '',
      holder: getKey('payout.holder') ?? '',
      doc_id: getKey('payout.doc_id') ?? ''
    },
    fees_pct: {
      stripe: 4.4,    // ~4.4% + $0.30 USD international card avg
      paypal: 5.4,    // ~5.4% + $0.30 cross-border
      culqi: 3.99,    // 3.99% + S/.0.30
      card: 0
    }
  };
}

export async function charge(provider: Provider, payload: ChargePayload): Promise<ChargeResult> {
  switch (provider) {
    case 'card':
      // Mock direct card (current Luhn-only flow). No external call.
      return {
        success: true,
        provider: 'card',
        external_id: `LOC-${Date.now()}`,
        mode: 'simulated',
        message: 'Cargo local (sin pasarela)'
      };

    case 'culqi': return chargeCulqi(payload);
    case 'stripe': return chargeStripe(payload);
    case 'paypal': return chargePaypal(payload);

    default:
      throw new Error('Proveedor de pago desconocido: ' + provider);
  }
}

// ============================== CULQI ==============================

async function chargeCulqi(payload: ChargePayload): Promise<ChargeResult> {
  const key = getKey('payments.culqi.private_key');
  if (!key) return simulated('culqi', 'Culqi no configurado · usando simulación');
  if (!payload.token) {
    return {
      success: false,
      provider: 'culqi',
      external_id: '',
      mode: 'live',
      message: 'Falta token Culqi: tokeniza la tarjeta en el renderer con Culqi.js v4 antes de cobrar.'
    };
  }

  // Culqi expects amounts in the minor unit (céntimos for PEN, cents for USD)
  const amountMinor = Math.round(payload.amount * 100);
  const currency = (payload.currency || 'PEN').toUpperCase();

  try {
    const res = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency_code: currency,
        email: payload.customer_email || 'cliente@dreitzteam.local',
        source_id: payload.token,
        description: payload.description.slice(0, 80) // Culqi caps at 80 chars
      })
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = body?.user_message || body?.merchant_message || body?.message || `HTTP ${res.status}`;
      log.warn('[payments] Culqi reject:', msg, body);
      return {
        success: false,
        provider: 'culqi',
        external_id: body?.object_id ?? '',
        mode: 'live',
        message: msg
      };
    }

    log.info('[payments] Culqi charge OK', { id: body.id, amount: amountMinor });
    return {
      success: true,
      provider: 'culqi',
      external_id: body.id,
      mode: 'live'
    };
  } catch (e) {
    log.error('[payments] Culqi network error:', (e as Error).message);
    return {
      success: false,
      provider: 'culqi',
      external_id: '',
      mode: 'live',
      message: 'Error de red contactando Culqi. Reintenta.'
    };
  }
}

// ============================== STRIPE ==============================

async function chargeStripe(payload: ChargePayload): Promise<ChargeResult> {
  const key = getKey('payments.stripe.secret_key');
  if (!key) return simulated('stripe', 'Stripe no configurado · usando simulación');
  if (!payload.token) {
    return {
      success: false,
      provider: 'stripe',
      external_id: '',
      mode: 'live',
      message: 'Falta payment method de Stripe: usa Stripe Elements en el renderer y manda el pm_/tok_.'
    };
  }

  const amountMinor = Math.round(payload.amount * 100);
  const currency = (payload.currency || 'PEN').toLowerCase();

  try {
    // PaymentIntent con confirm=true para cargo inmediato.
    const body = new URLSearchParams({
      amount: String(amountMinor),
      currency,
      'payment_method': payload.token,
      'confirm': 'true',
      'description': payload.description.slice(0, 350),
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]': 'never'
    });
    if (payload.customer_email) body.append('receipt_email', payload.customer_email);

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || `HTTP ${res.status}`;
      log.warn('[payments] Stripe reject:', msg);
      return { success: false, provider: 'stripe', external_id: json?.id ?? '', mode: 'live', message: msg };
    }
    return {
      success: json.status === 'succeeded',
      provider: 'stripe',
      external_id: json.id,
      mode: 'live',
      message: json.status === 'succeeded' ? undefined : `Stripe status: ${json.status}`
    };
  } catch (e) {
    log.error('[payments] Stripe network error:', (e as Error).message);
    return { success: false, provider: 'stripe', external_id: '', mode: 'live', message: 'Error de red contactando Stripe.' };
  }
}

// ============================== PAYPAL ==============================

async function chargePaypal(payload: ChargePayload): Promise<ChargeResult> {
  const cid = getKey('payments.paypal.client_id');
  const cs = getKey('payments.paypal.client_secret');
  if (!cid || !cs) return simulated('paypal', 'PayPal no configurado · usando simulación');
  if (!payload.token) {
    return {
      success: false,
      provider: 'paypal',
      external_id: '',
      mode: 'live',
      message: 'Falta order_id de PayPal: crea la orden con el SDK del renderer y pasa el order_id como token.'
    };
  }

  const base = getKey('payments.paypal.env') === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  try {
    // OAuth token (PayPal client_credentials)
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${cid}:${cs}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) {
      return { success: false, provider: 'paypal', external_id: '', mode: 'live', message: 'No se pudo autenticar con PayPal.' };
    }

    // Capture la orden ya creada por el SDK del cliente.
    const capRes = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(payload.token)}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenJson.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    const capJson = await capRes.json().catch(() => ({}));
    if (!capRes.ok) {
      return { success: false, provider: 'paypal', external_id: payload.token, mode: 'live', message: capJson?.message || `HTTP ${capRes.status}` };
    }
    return {
      success: capJson.status === 'COMPLETED',
      provider: 'paypal',
      external_id: capJson.id,
      mode: 'live',
      message: capJson.status === 'COMPLETED' ? undefined : `PayPal status: ${capJson.status}`
    };
  } catch (e) {
    log.error('[payments] PayPal network error:', (e as Error).message);
    return { success: false, provider: 'paypal', external_id: '', mode: 'live', message: 'Error de red contactando PayPal.' };
  }
}

// ============================== UTILS ==============================

function simulated(provider: Provider, message: string): ChargeResult {
  return {
    success: true,
    provider,
    external_id: `sim_${provider}_${Date.now()}`,
    mode: 'simulated',
    message
  };
}
