/**
 * Constantes del módulo de tickets de soporte.
 * Réplica del modelo ITIL usado en el portal web (sigespweb).
 */

export type TicketType = 'incidente' | 'requerimiento' | 'problema' | 'cambio';
export type TicketState =
  | 'nuevo'
  | 'asignado'
  | 'en_progreso'
  | 'en_espera'
  | 'resuelto'
  | 'cerrado'
  | 'cancelado';
export type TicketImpact = 'extenso' | 'significativo' | 'moderado' | 'menor';
export type TicketUrgency = 'critica' | 'alta' | 'media' | 'baja';
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';

/** Matriz de prioridad ITIL: impacto × urgencia */
export const MATRIZ_PRIORIDAD: Record<TicketImpact, Record<TicketUrgency, TicketPriority>> = {
  extenso: { critica: 'P1', alta: 'P1', media: 'P2', baja: 'P3' },
  significativo: { critica: 'P1', alta: 'P2', media: 'P3', baja: 'P4' },
  moderado: { critica: 'P2', alta: 'P3', media: 'P4', baja: 'P4' },
  menor: { critica: 'P3', alta: 'P4', media: 'P4', baja: 'P4' },
};

/** Transiciones de estado permitidas (máquina de estados) */
export const TRANSICIONES: Record<TicketState, TicketState[]> = {
  nuevo: ['asignado', 'en_progreso', 'cancelado'],
  asignado: ['en_progreso', 'en_espera', 'cancelado'],
  en_progreso: ['en_espera', 'resuelto', 'cancelado'],
  en_espera: ['en_progreso', 'resuelto'],
  resuelto: ['cerrado', 'en_progreso'],
  cerrado: ['en_progreso'],
  cancelado: [],
};

/** Prefijo del número de ticket según el tipo */
export const PREFIJO_TIPO: Record<TicketType, string> = {
  incidente: 'INC',
  requerimiento: 'REQ',
  problema: 'PRB',
  cambio: 'CHG',
};

/** Días para permitir la reapertura de un ticket cerrado */
export const DIAS_REAPERTURA = 7;

/** Estados en los que el ticket ya no está "abierto" */
export const ESTADOS_FINALES: TicketState[] = ['resuelto', 'cerrado', 'cancelado'];

/** Catálogos de los select de estado (solo las transiciones válidas dependen del ticket) */
export const ETIQUETA_ESTADO: Record<string, string> = {
  nuevo: 'Nuevo',
  asignado: 'Asignado',
  en_progreso: 'En progreso',
  en_espera: 'En espera',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};