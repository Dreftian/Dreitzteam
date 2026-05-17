/**
 * Culqi.js v4 loader + tokenizer.
 *
 * El renderer carga el script oficial (no podemos hacerlo en el main porque PCI-DSS
 * exige que la tarjeta cruda nunca pase por nuestro backend). Una vez cargado:
 *
 *   const token = await tokenizeWithCulqi({
 *     publicKey: cfg.public_keys.culqi,
 *     card_number, cvv, expiration_month, expiration_year, email
 *   });
 *
 * Si el script no carga (offline, dominio bloqueado) se rechaza la promesa y
 * el caller debe pedir al usuario que reintente o cambie de método.
 *
 * El token es `tkn_test_*` con pk_test_ y `tkn_live_*` con pk_live_. Se envía al
 * main process vía `paymentsCharge({provider:'culqi', token, ...})` que cobra
 * con la private key correspondiente.
 */

declare global {
  interface Window {
    Culqi?: {
      publicKey: string;
      // v4 callback API
      createToken?: (data: any) => void;
      token?: { id: string };
      error?: { user_message?: string; merchant_message?: string };
      // Newer promise-style API exposed by checkout.culqi.com v4
      tokenize?: (data: CulqiTokenizeInput) => Promise<{ id: string }>;
    };
  }
}

interface CulqiTokenizeInput {
  card_number: string;
  cvv: string;
  expiration_month: string;       // "MM"
  expiration_year: string;        // "YYYY"
  email: string;
}

const SCRIPT_URL = 'https://checkout.culqi.com/js/v4';
let loadPromise: Promise<void> | null = null;

function loadCulqiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No DOM'));
  if (window.Culqi) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loadPromise = null;
      reject(new Error('No se pudo cargar Culqi.js (¿sin internet?)'));
    };
    document.head.appendChild(s);
  });
  return loadPromise;
}

export async function tokenizeWithCulqi(
  input: CulqiTokenizeInput & { publicKey: string }
): Promise<string> {
  if (!input.publicKey) throw new Error('Culqi: falta public_key. Configúrala en Keys → Ajustes de pago.');
  await loadCulqiScript();
  const Culqi = window.Culqi!;
  Culqi.publicKey = input.publicKey;

  const data: CulqiTokenizeInput = {
    card_number: input.card_number.replace(/\s+/g, ''),
    cvv: input.cvv,
    expiration_month: input.expiration_month.padStart(2, '0'),
    expiration_year: input.expiration_year.length === 2 ? `20${input.expiration_year}` : input.expiration_year,
    email: input.email
  };

  // Prefer the promise-style API if the loaded version exposes it; fall back
  // to the v4 callback API otherwise.
  if (typeof Culqi.tokenize === 'function') {
    const r = await Culqi.tokenize(data);
    return r.id;
  }

  return new Promise((resolve, reject) => {
    (window as any).culqi = function () {
      if (Culqi.token?.id) resolve(Culqi.token.id);
      else reject(new Error(Culqi.error?.user_message || 'No se pudo tokenizar la tarjeta'));
    };
    Culqi.createToken!(data);
  });
}
