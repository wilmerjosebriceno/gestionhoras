/**
 * Abre un blob de tipo PDF en una ventana nueva para visualizarlo o imprimirlo.
 */
export function abrirPdf(blob: Blob, nombre = 'documento.pdf'): void {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
