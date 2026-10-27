/**
 * Utilidades del cierre automático de tickets (desde Mantis).
 * Compartidas entre la bandeja y el detalle del ticket.
 */

/** Etiquetas de los códigos de resolución (iguales al backend). */
export const RESOLUCION_TICKET_ETIQUETA: Record<string, string> = {
  solucionado: 'Solucionado',
  workaround: 'Mitigación (workaround)',
  no_reproducible: 'No reproducible',
  duplicado: 'Duplicado',
  error_del_usuario: 'Error del usuario',
  cancelado_usuario: 'Cancelado por el usuario',
  requiere_cambio: 'Requiere cambio',
};

export interface DatosTextoCierre {
  solicitante: string;
  numero: string;
  asunto: string;
  fecha?: Date;
  resolucion?: string | null;
  notas?: string | null;
}

/**
 * Texto de cierre sugerido (editable en el diálogo de auto-cierre).
 * Si no hay resolución ni notas, se omite esa línea.
 */
export function construirTextoCierre(d: DatosTextoCierre): string {
  const f = d.fecha ?? new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const fecha = `${p(f.getDate())}/${p(f.getMonth() + 1)}/${f.getFullYear()}`;
  const resolucion = (d.resolucion ?? '').trim();
  const notas = (d.notas ?? '').trim();

  const lineas = [
    `Estimado(a) ${d.solicitante}:`,
    '',
    `Le informamos que su caso ${d.numero} - «${d.asunto}» ha sido atendido y cerrado por nuestro equipo de soporte el ${fecha}.`,
    '',
  ];
  if (resolucion || notas) {
    lineas.push(`Resolución: ${resolucion}${notas ? ' ' + notas : ''}`, '');
  }
  lineas.push(
    `Si requiere asistencia adicional o el caso se reabre, puede responder este correo o escribir a soporte@sigesp.com.ve indicando el número de ticket ${d.numero}.`,
    '',
    'Agradecemos su confianza en nuestro equipo.',
    '',
    'Atentamente,',
    'Mesa de Ayuda SIGESP',
    'SIGESP, C.A.',
  );
  return lineas.join('\n');
}
