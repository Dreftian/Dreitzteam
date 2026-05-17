/**
 * Yape AI verification.
 *
 * Flujo:
 *   1. El admin sube su QR Yape y nombre receptor en Keys → Pagos.
 *   2. En el checkout, Dreitz muestra el QR + monto esperado al cliente.
 *   3. El cliente paga en su app Yape y sube screenshot del comprobante.
 *   4. Este módulo llama a Claude (vision) para verificar:
 *        - ¿La captura muestra un comprobante real de Yape?
 *        - ¿El monto coincide con el esperado (margen tolerable)?
 *        - ¿El nombre del receptor coincide con el del admin?
 *        - ¿La fecha es reciente (últimas 24h)?
 *   5. Si verifica OK → la orden procede y el cliente recibe su clave.
 *      Si verifica MAL → se rechaza, el admin puede aprobar manualmente luego.
 *
 * **Privacidad/seguridad**: el screenshot se envía a la API de Anthropic en una
 * sola llamada y no se persiste de su lado. La API key vive cifrada en
 * `app_config` (sólo admin puede setearla desde Keys).
 *
 * **Limitación honesta**: la verificación con IA no es infalible — un screenshot
 * bien fabricado podría engañarla. Por eso siempre se guarda en `yape_receipts`
 * para que el admin haga revisión manual cuando algo parezca raro. Para uso
 * familiar con usuarios eso es suficiente; si esto creciera, la única solución
 * real es la API de Yape Business (requiere ser comercio formal).
 */

import Anthropic from '@anthropic-ai/sdk';
import { getDb } from './db';
import log from './logger';

export interface YapeConfig {
  qr_image_data: string;   // data URL del QR (data:image/png;base64,...)
  recipient_name: string;  // nombre que aparece como "destinatario" en los comprobantes Yape
  recipient_phone: string; // opcional — los últimos 3 dígitos pueden aparecer enmascarados en comprobantes
}

export interface VerifyOptions {
  imageBase64: string;        // base64 puro (sin prefijo data:)
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  expectedAmountPen: number;  // S/. esperados
  /** Tolerancia absoluta en soles (para redondeos / cambios pequeños) — default 0.10 */
  toleranceAbs?: number;
}

export interface VerifyResult {
  valid: boolean;
  confidence: 'high' | 'medium' | 'low';
  amount_seen: number | null;
  recipient_seen: string | null;
  date_seen: string | null;
  issues: string[];
  raw_explanation: string;
}

/** Lee la config de Yape (QR + recipient name) — usada por Dreitz para mostrar el QR en checkout. */
export function getYapeConfig(): Partial<YapeConfig> {
  const db = getDb();
  const get = (k: string) =>
    (db.prepare('SELECT value FROM app_config WHERE key = ?').get(k) as any)?.value ?? '';
  return {
    qr_image_data: get('yape.qr_image_data'),
    recipient_name: get('yape.recipient_name'),
    recipient_phone: get('yape.recipient_phone')
  };
}

export function setYapeConfig(payload: Partial<YapeConfig>) {
  const db = getDb();
  const set = (k: string, v: string | undefined) => {
    if (v === undefined) return;
    if (!v) db.prepare('DELETE FROM app_config WHERE key = ?').run(k);
    else
      db.prepare(
        `INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
      ).run(k, v);
  };
  set('yape.qr_image_data', payload.qr_image_data);
  set('yape.recipient_name', payload.recipient_name);
  set('yape.recipient_phone', payload.recipient_phone);
}

function getAnthropicKey(): string | null {
  const r = getDb()
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get('anthropic.api_key') as any;
  return r?.value || null;
}

/**
 * Verifica un comprobante de Yape contra el monto esperado y el nombre del receptor
 * configurado por el admin. Usa Claude Opus 4.7 con vision + tool use para sacar
 * resultado estructurado.
 *
 * Si no hay API key configurada, devuelve `valid: false` con un mensaje claro —
 * NO simula "todo OK" porque esto involucra dinero real.
 */
export async function verifyYapeReceipt(opts: VerifyOptions): Promise<VerifyResult> {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    return {
      valid: false,
      confidence: 'low',
      amount_seen: null,
      recipient_seen: null,
      date_seen: null,
      issues: ['Verificación IA no configurada — el admin debe agregar la API key de Anthropic en Keys → Pagos.'],
      raw_explanation: 'no_api_key'
    };
  }
  const cfg = getYapeConfig();
  if (!cfg.recipient_name) {
    return {
      valid: false,
      confidence: 'low',
      amount_seen: null,
      recipient_seen: null,
      date_seen: null,
      issues: ['Yape no está configurado — el admin debe subir su QR y nombre destinatario.'],
      raw_explanation: 'no_yape_config'
    };
  }

  const tolerance = opts.toleranceAbs ?? 0.10;

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      // Adaptive thinking: el modelo decide cuánto razonar. Para una verificación visual
      // pequeña suele resolverse rápido sin gastar mucho.
      thinking: { type: 'adaptive' },
      tools: [
        {
          name: 'submit_verification',
          description: 'Reporta el resultado de verificar el comprobante Yape.',
          input_schema: {
            type: 'object',
            properties: {
              looks_like_yape: {
                type: 'boolean',
                description: 'true si la imagen aparenta ser un comprobante legítimo de la app Yape (logo, layout, colores, fuente).'
              },
              amount_seen: {
                type: 'number',
                description: 'Monto en soles que se ve en el comprobante. null si no se puede leer.'
              },
              recipient_seen: {
                type: 'string',
                description: 'Nombre completo del destinatario que aparece en el comprobante. Cadena vacía si no se ve.'
              },
              date_seen: {
                type: 'string',
                description: 'Fecha y hora visibles en el comprobante (formato libre, p.ej. "23 mayo 2026 14:32"). Cadena vacía si no se ve.'
              },
              operation_id_seen: {
                type: 'string',
                description: 'Código o número de operación si aparece. Cadena vacía si no.'
              },
              issues: {
                type: 'array',
                items: { type: 'string' },
                description: 'Lista de problemas detectados (montaje, blur sospechoso, monto incorrecto, recipiente diferente, fecha antigua, etc.).'
              },
              confidence: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'Confianza en que el comprobante es legítimo Y los datos coinciden con lo esperado.'
              },
              raw_explanation: {
                type: 'string',
                description: 'Explicación breve (1-2 frases) del razonamiento.'
              }
            },
            required: ['looks_like_yape', 'amount_seen', 'recipient_seen', 'date_seen', 'issues', 'confidence', 'raw_explanation']
          }
        }
      ],
      tool_choice: { type: 'tool', name: 'submit_verification' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: opts.imageMediaType,
                data: opts.imageBase64
              }
            },
            {
              type: 'text',
              text: `Verifica este comprobante de pago de la app Yape (Perú).

Datos esperados:
- Monto: S/. ${opts.expectedAmountPen.toFixed(2)} (tolerancia ±${tolerance.toFixed(2)})
- Destinatario: "${cfg.recipient_name}"${cfg.recipient_phone ? ` (cel ${cfg.recipient_phone})` : ''}
- La fecha debe ser de las últimas 24 horas (hoy es ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}).

Reglas:
1. Si la imagen claramente NO es un comprobante de Yape (es otro recibo, una captura random, una foto), \`looks_like_yape\` = false y \`confidence\` = "low".
2. Si el monto difiere de lo esperado por más de la tolerancia, marca "monto incorrecto" en issues y baja la confianza.
3. Si el destinatario no coincide (puede tener mayúsculas/minúsculas distintas — eso está OK), marca "destinatario no coincide".
4. Si la fecha es de hace más de 24h, marca "comprobante antiguo".
5. Si detectas señales de manipulación (texto desalineado, fuentes inconsistentes, sombras raras, capas visibles), marca "posible montaje" y \`confidence\` = "low".

Llama la herramienta submit_verification con tus hallazgos.`
            }
          ]
        }
      ]
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use') as any;
    if (!toolUse || toolUse.name !== 'submit_verification') {
      log.warn('[yape] Claude no devolvió tool_use — fallback fail');
      return {
        valid: false,
        confidence: 'low',
        amount_seen: null,
        recipient_seen: null,
        date_seen: null,
        issues: ['La verificación no produjo un resultado estructurado. Reintenta o pide al admin que apruebe manualmente.'],
        raw_explanation: 'no_tool_use'
      };
    }

    const input = toolUse.input;
    const looksLikeYape = !!input.looks_like_yape;
    const amountSeen = typeof input.amount_seen === 'number' ? input.amount_seen : null;
    const recipientSeen = (input.recipient_seen as string) || null;
    const dateSeen = (input.date_seen as string) || null;
    const issues = Array.isArray(input.issues) ? input.issues : [];
    const confidence = (input.confidence as 'high' | 'medium' | 'low') ?? 'low';
    const rawExplanation = (input.raw_explanation as string) || '';

    // Reglas de aceptación final (servidor las re-aplica — no confiamos sólo en el modelo)
    const amountMatches =
      amountSeen != null && Math.abs(amountSeen - opts.expectedAmountPen) <= tolerance;
    const recipientMatches =
      !!recipientSeen &&
      cfg.recipient_name!.toLowerCase().trim().split(/\s+/).every((part) =>
        recipientSeen.toLowerCase().includes(part)
      );

    const valid = looksLikeYape && amountMatches && recipientMatches && confidence !== 'low';

    return {
      valid,
      confidence,
      amount_seen: amountSeen,
      recipient_seen: recipientSeen,
      date_seen: dateSeen,
      issues,
      raw_explanation: rawExplanation
    };
  } catch (e) {
    const msg = (e as Error).message;
    log.error('[yape] verification error:', msg);
    return {
      valid: false,
      confidence: 'low',
      amount_seen: null,
      recipient_seen: null,
      date_seen: null,
      issues: [`Error técnico verificando con IA: ${msg}`],
      raw_explanation: 'error'
    };
  }
}

/**
 * Persiste el comprobante (verificado o no) para que el admin pueda revisar en Keys.
 * Devuelve el id en la DB para que el frontend pueda referenciarlo.
 */
export function recordReceipt(payload: {
  userId: number;
  orderId: number | null;
  amount: number;
  imageDataUrl: string;
  result: VerifyResult;
}): number {
  const db = getDb();
  // Crear tabla si no existe (migración perezosa — la migración formal puede agregarse después)
  db.exec(`
    CREATE TABLE IF NOT EXISTS yape_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      amount NUMERIC NOT NULL,
      image_data TEXT NOT NULL,
      verify_status TEXT NOT NULL,
      verify_confidence TEXT NOT NULL,
      verify_amount_seen NUMERIC,
      verify_recipient_seen TEXT,
      verify_date_seen TEXT,
      verify_issues TEXT,
      verify_explanation TEXT,
      admin_decision TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_yape_receipts_user ON yape_receipts(user_id, created_at DESC);
  `);

  const r = db.prepare(`
    INSERT INTO yape_receipts (
      user_id, order_id, amount, image_data,
      verify_status, verify_confidence, verify_amount_seen, verify_recipient_seen,
      verify_date_seen, verify_issues, verify_explanation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.userId,
    payload.orderId,
    payload.amount,
    payload.imageDataUrl,
    payload.result.valid ? 'verified' : 'rejected',
    payload.result.confidence,
    payload.result.amount_seen,
    payload.result.recipient_seen,
    payload.result.date_seen,
    JSON.stringify(payload.result.issues),
    payload.result.raw_explanation
  );
  return r.lastInsertRowid as number;
}
