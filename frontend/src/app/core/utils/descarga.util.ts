/**
 * Fuerza la descarga de un blob con el nombre indicado.
 *
 * Se agrega el enlace al DOM y se libera el objeto URL DESPUÉS de que el
 * navegador inicie la descarga (liberarlo de inmediato puede cancelarla).
 */
export function descargarBlob(blob: Blob, nombre = 'archivo'): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
