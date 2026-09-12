import { DetalleActividadRow, ActividadHeader } from '../models/sgh.models';

export interface ValidacionDetalle {
  valido: boolean;
  errores: string[];
}

/**
 * Validaciones de reglas de negocio del módulo Actividad/Horas.
 * Funciones puras (SRP: nunca tocan el DOM ni hacen llamadas HTTP).
 */
export function validarHeader(header: ActividadHeader): string[] {
  const errores: string[] = [];
  if (!header.idClient) errores.push('Debe seleccionar un cliente.');
  if (!header.responsible?.trim()) errores.push('El campo responsable es obligatorio.');
  if (!header.dateDocument) errores.push('La fecha del documento es obligatoria.');
  return errores;
}

/**
 * Reglas por fila del detalle, equivalentes a las validaciones del proceso
 * legado (sgh_pro_activity.js -> validaDatos):
 *  - horas vacías o en 0 se rechazan.
 *  - situación y nota con valor "0" se consideran vacías.
 */
export function validarDetalleFila(fila: DetalleActividadRow, index: number): string[] {
  const errores: string[] = [];
  const n = index + 1;

  if (!fila.idProcess || fila.idProcess === 0) {
    errores.push(`Fila ${n}: debe seleccionar el módulo/proceso asociado a la actividad.`);
  }
  if (!fila.idItemActivity) {
    errores.push(`Fila ${n}: debe seleccionar la actividad/proyecto.`);
  }
  const horas = fila.hours == null || String(fila.hours).trim() === '';
  if (horas || Number(fila.hours) === 0) {
    errores.push(`Fila ${n}: la cantidad de horas es obligatoria y debe ser mayor a 0.`);
  }
  if (!fila.situation || fila.situation.trim() === '' || fila.situation.trim() === '0') {
    errores.push(`Fila ${n}: la situación es obligatoria.`);
  }
  if (!fila.note || fila.note.trim() === '' || fila.note.trim() === '0') {
    errores.push(`Fila ${n}: la nota es obligatoria.`);
  }
  return errores;
}

export function validarDetalle(detalles: DetalleActividadRow[]): ValidacionDetalle {
  const errores: string[] = [];
  if (!detalles || detalles.length === 0) {
    errores.push('Debe agregar al menos una actividad en el detalle.');
    return { valido: false, errores };
  }
  detalles.forEach((fila, i) => errores.push(...validarDetalleFila(fila, i)));
  return { valido: errores.length === 0, errores };
}

export function validarActividad(
  header: ActividadHeader,
  detalles: DetalleActividadRow[],
): string[] {
  return [...validarHeader(header), ...validarDetalle(detalles).errores];
}
