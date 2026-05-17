/**
 * TOTP 2FA en Keys — segundo factor para login admin.
 *
 * Reusa las columnas `totp_secret`, `totp_enabled` de la tabla `users` (compartida con Dreitz).
 * Después de validar contraseña en `admin:login`, si `totp_enabled = 1` el cliente debe
 * enviar `admin:loginVerifyTotp` con el código de 6 dígitos.
 */

import { authenticator } from 'otplib';
import { getDb } from './db';
import { log } from './logger';

authenticator.options = { window: 1 };

export function generateSecret(userId: number): { secret: string; uri: string } {
  const row = getDb().prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
  if (!row) throw new Error('Usuario no encontrado');
  const secret = authenticator.generateSecret();
  const uri = authenticator.keyuri(row.username, 'Dreitzteam Keys', secret);
  getDb().prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(secret, userId);
  return { secret, uri };
}

export function verifyAndEnable(userId: number, token: string): boolean {
  const row = getDb().prepare('SELECT totp_secret FROM users WHERE id = ?').get(userId) as any;
  if (!row?.totp_secret) throw new Error('Primero genera un secreto 2FA');
  const ok = authenticator.verify({ token: token.replace(/\s/g, ''), secret: row.totp_secret });
  if (ok) {
    getDb().prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(userId);
    log.info(`Admin 2FA enabled for user_id=${userId}`);
  }
  return ok;
}

export function verifyToken(userId: number, token: string): boolean {
  const row = getDb().prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?').get(userId) as any;
  if (!row?.totp_enabled || !row?.totp_secret) return true;
  return authenticator.verify({ token: token.replace(/\s/g, ''), secret: row.totp_secret });
}

export function isEnabled(userId: number): boolean {
  const row = getDb().prepare('SELECT totp_enabled FROM users WHERE id = ?').get(userId) as any;
  return !!row?.totp_enabled;
}

export function disable(userId: number) {
  getDb().prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(userId);
  log.info(`Admin 2FA disabled for user_id=${userId}`);
  return { success: true };
}
