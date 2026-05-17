/**
 * TOTP 2FA — second factor de autenticación con app authenticator (Google Authenticator,
 * Authy, 1Password, Microsoft Authenticator, etc.).
 *
 * Flujo:
 *   1. Usuario va a Ajustes → Seguridad → "Activar 2FA"
 *   2. Generamos un secreto compartido (Base32), construimos URI otpauth://
 *   3. Frontend muestra QR (generado en client) + la clave manual
 *   4. Usuario escanea con su app, ingresa el código de 6 dígitos
 *   5. Verificamos el código contra el secreto; si OK, marcamos totp_enabled=1
 *   6. En cada login posterior, después de validar contraseña, pedimos código TOTP
 */

import { authenticator } from 'otplib';
import { getDb } from './db';
import log from './logger';

// Configuración: 30s window, ±1 step de tolerancia (chambea bien con relojes desincronizados)
authenticator.options = { window: 1 };

export function generateSecret(userId: number): { secret: string; uri: string } {
  const row = getDb().prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
  if (!row) throw new Error('Usuario no encontrado');
  const secret = authenticator.generateSecret();
  const uri = authenticator.keyuri(row.username, 'Dreitzteam', secret);
  // Guardamos el secret tentativo pero NO activamos 2FA hasta que el usuario verifique un código.
  getDb().prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(secret, userId);
  return { secret, uri };
}

export function verifyAndEnable(userId: number, token: string): boolean {
  const row = getDb().prepare('SELECT totp_secret FROM users WHERE id = ?').get(userId) as any;
  if (!row?.totp_secret) throw new Error('Primero genera un secreto 2FA');
  const ok = authenticator.verify({ token: token.replace(/\s/g, ''), secret: row.totp_secret });
  if (ok) {
    getDb().prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(userId);
    log.info(`2FA enabled for user_id=${userId}`);
  }
  return ok;
}

export function verifyToken(userId: number, token: string): boolean {
  const row = getDb().prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?').get(userId) as any;
  if (!row?.totp_enabled || !row?.totp_secret) return true; // 2FA off para este user
  return authenticator.verify({ token: token.replace(/\s/g, ''), secret: row.totp_secret });
}

export function isEnabled(userId: number): boolean {
  const row = getDb().prepare('SELECT totp_enabled FROM users WHERE id = ?').get(userId) as any;
  return !!row?.totp_enabled;
}

export function disable(userId: number) {
  getDb().prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(userId);
  log.info(`2FA disabled for user_id=${userId}`);
  return { success: true };
}
