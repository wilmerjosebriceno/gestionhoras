/**
 * Copia recursos que NO son TypeScript y que el backend lee en tiempo de
 * ejecucion (ayuda en linea, arboles XML de permisos) hacia la carpeta dist,
 * para que un despliegue basado solo en dist tambien los incluya.
 *
 * Se ejecuta automaticamente con `npm run build` (script postbuild).
 */
const fs = require('fs');
const path = require('path');

const COPIAS = [
  { origen: path.join('ayuda'), destino: path.join('dist', 'ayuda') },
  { origen: path.join('permisos', 'xml'), destino: path.join('dist', 'permisos', 'xml') },
];

let copiados = 0;
for (const { origen, destino } of COPIAS) {
  if (!fs.existsSync(origen)) continue;
  fs.cpSync(origen, destino, { recursive: true });
  copiados++;
  console.log(`[copiar-recursos] ${origen} -> ${destino}`);
}
if (!copiados) {
  console.log('[copiar-recursos] Nada que copiar (no se encontraron los recursos).');
}
