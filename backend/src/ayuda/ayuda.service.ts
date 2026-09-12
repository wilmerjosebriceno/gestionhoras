import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface AyudaSeccion {
  titulo: string;
  texto: string;
}

export interface AyudaContenido {
  sistema: string;
  pagina: string;
  titulo: string;
  secciones: AyudaSeccion[];
}

export interface AyudaIndice {
  sistema: string;
  pagina: string;
  titulo: string;
}

/**
 * Ayuda en linea contextual (por pantalla).
 * El contenido vive en backend/ayuda/ayuda.json (clave "SISTEMA/pagina").
 * Se resuelve de forma portable (src y dist), igual que los arboles XML de
 * permisos. El archivo es la fuente de verdad: se agrega/edita contenido sin
 * tocar codigo.
 */
@Injectable()
export class AyudaService {
  private readonly archivo = this.resolverArchivo();
  private cache: Record<string, AyudaContenido> | null = null;

  private resolverArchivo(): string {
    const candidatos = [
      path.join(process.cwd(), 'ayuda', 'ayuda.json'),
      path.join(__dirname, '..', '..', 'ayuda', 'ayuda.json'),
      path.join(__dirname, 'ayuda', 'ayuda.json'),
      'C:\\xampp7\\htdocs\\gestionhoras\\backend\\ayuda\\ayuda.json', // fallback
    ];
    for (const archivo of candidatos) {
      try {
        if (fs.existsSync(archivo)) return archivo;
      } catch {
        /* continuar */
      }
    }
    return candidatos[0];
  }

  private cargar(): Record<string, AyudaContenido> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(fs.readFileSync(this.archivo, 'utf8')) as Record<string, AyudaContenido>;
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  getAyuda(sistema: string, pagina: string): AyudaContenido {
    const data = this.cargar();
    const key = `${sistema}/${pagina}`;
    const item = data[key];
    if (!item) {
      throw new NotFoundException(`No hay ayuda registrada para ${key}`);
    }
    return item;
  }

  getIndice(): AyudaIndice[] {
    const data = this.cargar();
    return Object.values(data)
      .map(({ sistema, pagina, titulo }) => ({ sistema, pagina, titulo }))
      .sort(
        (a, b) =>
          a.sistema.localeCompare(b.sistema) ||
          a.pagina.localeCompare(b.pagina),
      );
  }
}
