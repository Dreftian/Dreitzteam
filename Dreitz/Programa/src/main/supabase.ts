/**
 * Capa de compatibilidad — Supabase → InsForge.
 *
 * Este archivo existe solo para no tener que tocar los importadores
 * (`ipc.ts`, `index.ts`) que llaman a `tryEnableSupabaseSync`, `isEnabled`, etc.
 * La lógica real vive en `./insforge.ts`. Cuando se modernicen los importadores
 * a usar nombres en español, se puede borrar este archivo.
 */

import {
  intentarHabilitar,
  deshabilitar,
  estaHabilitado,
  sincronizarCatalogoCompleto,
  subirPedido
} from './insforge';

// Re-exports con los nombres legacy (en inglés) que esperaban los importadores.
export const tryEnableSupabaseSync = intentarHabilitar;
export const disableSupabaseSync = deshabilitar;
export const isEnabled = estaHabilitado;
export const pullAllCatalog = sincronizarCatalogoCompleto;
export const pushOrder = subirPedido;
