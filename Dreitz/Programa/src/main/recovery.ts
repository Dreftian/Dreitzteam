/**
 * Password recovery via security question.
 *
 * Sin SMTP (no enviamos email), la única forma offline de recuperar contraseña
 * es pregunta-respuesta. Se setea al registrarse o desde Ajustes. La respuesta
 * se guarda hasheada con bcrypt — nunca en texto claro.
 *
 * Flujo:
 *   1. Usuario clickea "olvidé mi contraseña" → pone su username.
 *   2. Si tiene `recovery_question` configurada, mostramos la pregunta.
 *   3. Usuario responde + nueva contraseña.
 *   4. bcrypt.compare contra `recovery_answer_hash`; si match, cambiamos la
 *      contraseña y guardamos.
 *   5. Si el usuario nunca configuró pregunta, devolvemos error con instrucción
 *      de pedirle al admin que le reset desde Keys.
 */

import bcrypt from 'bcryptjs';
import { getDb } from './db';
import log from './logger';

export function setRecoveryQuestion(userId: number, question: string, answer: string) {
  if (!question.trim() || !answer.trim()) throw new Error('Pregunta y respuesta requeridas');
  if (question.length > 200) throw new Error('Pregunta muy larga (máx 200)');
  if (answer.length < 3) throw new Error('La respuesta debe tener al menos 3 caracteres');
  const normalized = answer.toLowerCase().trim();
  const hash = bcrypt.hashSync(normalized, 10);
  getDb()
    .prepare('UPDATE users SET recovery_question = ?, recovery_answer_hash = ? WHERE id = ?')
    .run(question.trim(), hash, userId);
  return { success: true };
}

export function getRecoveryQuestion(username: string): string | null {
  const r = getDb()
    .prepare('SELECT recovery_question FROM users WHERE username = ?')
    .get(username) as any;
  return r?.recovery_question ?? null;
}

export function resetPasswordWithAnswer(payload: { username: string; answer: string; newPassword: string }) {
  if (!payload.newPassword || payload.newPassword.length < 4) {
    throw new Error('La nueva contraseña debe tener al menos 4 caracteres');
  }
  const row = getDb()
    .prepare('SELECT id, recovery_answer_hash FROM users WHERE username = ?')
    .get(payload.username) as any;
  if (!row) throw new Error('Usuario no encontrado');
  if (!row.recovery_answer_hash) {
    throw new Error('Este usuario no tiene pregunta de seguridad configurada. Pide al admin (WhatsApp +51 904 957 354) que te resetee la contraseña.');
  }
  const normalized = payload.answer.toLowerCase().trim();
  const ok = bcrypt.compareSync(normalized, row.recovery_answer_hash);
  if (!ok) throw new Error('Respuesta incorrecta');

  const newHash = bcrypt.hashSync(payload.newPassword, 10);
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, row.id);
  log.info(`Password reset via security question for user_id=${row.id}`);
  return { success: true };
}
