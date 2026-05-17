/**
 * Capa de compatibilidad — Supabase → InsForge.
 *
 * Este archivo existe solo para no tocar los importadores (`ipc.ts`,
 * `index.ts`, etc.) que esperan los nombres legacy. La lógica real vive en
 * `./insforge.ts`.
 */

import {
  intentarHabilitar,
  deshabilitar,
  estaHabilitado,
  obtenerEstado,
  fijarCredenciales,
  subirJuego,
  borrarJuego,
  subirLicencias,
  actualizarEstadoLicencia,
  subirPromocion,
  subirOfertaFlash,
  subirBundle,
  subirColeccion,
  subirHistorialPrecios,
  subirCatalogoCompleto
} from './insforge';

// Re-exports con los nombres legacy (en inglés).
export const tryEnable = intentarHabilitar;
export const disable = deshabilitar;
export const isEnabled = estaHabilitado;
export const getStatus = obtenerEstado;
export const setCreds = fijarCredenciales;
export const pushGame = subirJuego;
export const pushGameDelete = borrarJuego;
export const pushLicenses = subirLicencias;
export const pushLicenseStatus = actualizarEstadoLicencia;
export const pushPromotion = subirPromocion;
export const pushFlashSale = subirOfertaFlash;
export const pushBundle = subirBundle;
export const pushCollection = subirColeccion;
export const pushPriceHistory = subirHistorialPrecios;
export const pushFullCatalog = subirCatalogoCompleto;
