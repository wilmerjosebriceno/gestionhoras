/**
 * Saneo de texto para la codificación LATIN9 (ISO-8859-15).
 *
 * La base de datos `db_gestionhoras_sigesp` es un sistema heredado codificado en
 * LATIN9, mientras que la aplicación trabaja en UTF-8. Todo texto que se escriba
 * debe poder representarse en LATIN9 o PostgreSQL rechaza la operación completa.
 *
 * Reemplaza los signos tipográficos por su equivalente sencillo y descarta
 * cualquier carácter que LATIN9 no pueda guardar. Así ninguna escritura falla
 * por codificación, sin importar lo que venga de Mantis, Word o un correo.
 */

/** Reemplazos con equivalente legible (tipografía que LATIN9 no soporta) */
const REEMPLAZOS: ReadonlyArray<readonly [RegExp, string]> = [
  // Comillas simples y primas
  [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
  // Comillas dobles y dobles primas
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  // Guiones y rayas
  [/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-'],
  // Puntos suspensivos
  [/[\u2026]/g, '...'],
  // Viñetas y puntos medios
  [/[\u2022\u25CF\u25AA\u25AB\u00B7\u2043]/g, '-'],
  // Espacios especiales que no son el espacio normal
  [/[\u00A0\u2007\u202F\u2009\u200A]/g, ' '],
  // Marcas invisibles (espacio de ancho cero, BOM, guion suave)
  [/[\u200B\u200C\u200D\uFEFF\u00AD]/g, ''],
  // Marca de verificación
  [/[\u2713\u2714]/g, 'OK'],
  // Flechas
  [/[\u2190\u2192]/g, '->'],
  // --- Posiciones de Latin-1 que ISO-8859-15 NO representa ---
  // (el acento agudo ´ era la causa del fallo de sincronización de Mantis:
  //  «character with byte sequence 0xc2 0xb4 ... has no equivalent in LATIN9»)
  [/[\u00B4]/g, "'"], // ´ acento agudo
  [/[\u00A8]/g, '"'], // ¨ diéresis
  [/[\u00A6]/g, '|'], // ¦ barra partida
  [/[\u00A4]/g, 'EUR'], // ¤ signo monetario
  [/[\u00B8]/g, ','], // ¸ cedilla
  [/[\u00BC]/g, '1/4'], // ¼
  [/[\u00BD]/g, '1/2'], // ½
  [/[\u00BE]/g, '3/4'], // ¾
];

/**
 * Caracteres que ISO-8859-15 (LATIN9) sí puede almacenar.
 *
 * OJO: NO es todo Latin-1. ISO-8859-15 reasignó 8 posiciones a los caracteres
 * € Š š Ž ž Œ œ Ÿ, por lo que U+00A4, U+00A6, U+00A8, U+00B4, U+00B8, U+00BC,
 * U+00BD y U+00BE dejaron de ser representables. El rango de abajo es Latin-1
 * menos esas 8 posiciones, más los 8 caracteres nuevos.
 */
const RANGO_VALIDO =
  '\u0000-\u00A3\u00A5\u00A7\u00A9-\u00B3\u00B5-\u00B7\u00B9-\u00BB\u00BF-\u00FF' +
  '\u20AC\u0160\u0161\u017D\u017E\u0152\u0153\u0178';

const CARACTER_VALIDO = new RegExp(`[${RANGO_VALIDO}]`);
const SOLO_VALIDOS = new RegExp(`^[${RANGO_VALIDO}]*$`);
const INVALIDOS = new RegExp(`[^${RANGO_VALIDO}]`, 'g');

/** ¿El carácter se puede guardar tal cual en la base? */
export function esRepresentableEnLATIN9(caracter: string): boolean {
  return CARACTER_VALIDO.test(caracter);
}

/**
 * Convierte un texto al subconjunto representable en LATIN9.
 * Ruta rápida: si el texto ya es válido (lo habitual), se devuelve sin tocar.
 */
export function sanearLATIN9(texto: string): string {
  if (SOLO_VALIDOS.test(texto)) return texto;
  let salida = texto;
  for (const [patron, reemplazo] of REEMPLAZOS) {
    salida = salida.replace(patron, reemplazo);
  }
  return salida.replace(INVALIDOS, '');
}

/** Aplica el saneo a todos los parámetros de texto de una consulta */
export function sanearParametros(params: readonly unknown[]): unknown[] {
  return params.map((p) => (typeof p === 'string' ? sanearLATIN9(p) : p));
}
