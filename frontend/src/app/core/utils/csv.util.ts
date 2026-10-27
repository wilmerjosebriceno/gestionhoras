/**
 * Descarga filas como CSV compatible con Excel.
 * - Usa `;` como separador (locale es-VE/Excel).
 * - Antepone BOM UTF-8 para que Excel respete acentos.
 */
export function descargarCsv(
  nombre: string,
  columnas: string[],
  filas: (string | number | null | undefined)[][],
): void {
  const escapar = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [
    columnas.map(escapar).join(';'),
    ...filas.map((f) => f.map(escapar).join(';')),
  ];
  // BOM al inicio (Excel) + saltos CRLF.
  const contenido = '\uFEFF' + lineas.join('\r\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre.toLowerCase().endsWith('.csv') ? nombre : `${nombre}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
