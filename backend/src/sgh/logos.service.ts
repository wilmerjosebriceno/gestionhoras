import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type LogoSrc = {
  dataUri: string;
  nombre: string;
  mime: string;
  existe: boolean;
};

/** Relación enterprise (nro) -> clave empresa. 0=SIGESP, 1=IEAGER, 2=CHINCHIN, resto=OTROS */
export function empresaKey(enterprise?: number | null): string {
  const e = Number(enterprise);
  if (e === 0) return 'SIGESP';
  if (e === 1) return 'IEAGER';
  if (e === 2) return 'CHINCHIN';
  return 'OTROS';
}

export const EMPRESAS: string[] = ['SIGESP', 'IEAGER', 'CHINCHIN', 'OTROS'];

/**
 * Directorio fijo para guardar los logos por empresa (ruta fija asociada a la
 * empresa del proyecto). Si no hay logo subido para una empresa, se usa como
 * respaldo el logo legacy de la empresa (kernel/images).
 */
@Injectable()
export class LogosService {
  // directorio fijo donde se guardan los logos por empresa
  private readonly storageDir = path.resolve(process.cwd(), 'storage', 'logos');
  // logos legacy de respaldo (portable dentro del proyecto backend)
  private readonly legacyDir = this.resolverLegacyDir();

  private resolverLegacyDir(): string {
    const candidatos = [
      path.resolve(process.cwd(), 'storage', 'logos-legacy'),
      path.resolve(__dirname, '..', '..', 'storage', 'logos-legacy'),
      path.resolve(__dirname, 'storage', 'logos-legacy'),
      'C:\\xampp7\\htdocs\\gestionhoras\\kernel\\images', // fallback legacy
    ];
    for (const dir of candidatos) {
      try {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
      } catch {
        /* continuar */
      }
    }
    return candidatos[0];
  }

  private readonly defaults: Record<string, string> = {
    SIGESP: 'logo.jpg',
    IEAGER: 'logo_ieager.jpg',
    CHINCHIN: 'logo_chinchin.jpg',
    OTROS: 'logo.jpg',
  };

  private readonly mimes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
  };

  private dirEmpresa(key: string): string {
    return path.join(this.storageDir, key.toUpperCase());
  }

  /** Busca el archivo de logo subido dentro de la empresa (cualquier extensión). */
  private customLogoPath(key: string): string | null {
    const dir = this.dirEmpresa(key);
    if (!fs.existsSync(dir)) return null;
    const archivos = fs.readdirSync(dir).filter((f) => this.mimes[path.extname(f).toLowerCase()]);
    if (!archivos.length) return null;
    return path.join(dir, archivos[0]);
  }

  /** Lee las imágenes y devuelve dataURI (jpg/gif/png). */
  private leerComoDataUri(filePath: string): { dataUri: string; nombre: string; mime: string } {
    const ext = path.extname(filePath).toLowerCase();
    const mime = this.mimes[ext] ?? 'image/jpeg';
    const buf = fs.readFileSync(filePath);
    return { dataUri: `data:${mime};base64,${buf.toString('base64')}`, nombre: path.basename(filePath), mime };
  }

  /** DataUri del logo dado el código enterprise numérico del proyecto. */
  getLogoDataUri(enterprise?: number | null): LogoSrc {
    return this.getLogoDataUriForEmpresaKey(empresaKey(enterprise));
  }

  /** DataUri del logo dado el nombre de la empresa (SIGESP/IEAGER/CHINCHIN/OTROS). */
  getLogoDataUriForEmpresaKey(key: string): LogoSrc {
    return this.getLogoDataUriImpl(key);
  }

  private getLogoDataUriImpl(key: string): LogoSrc {
    const custom = this.customLogoPath(key);
    if (custom) {
      const { dataUri, nombre, mime } = this.leerComoDataUri(custom);
      return { dataUri, nombre, mime, existe: true };
    }
    // respaldo legacy
    const def = this.defaults[key] ?? 'logo.jpg';
    const legacyPath = path.join(this.legacyDir, def);
    if (fs.existsSync(legacyPath)) {
      const { dataUri, nombre } = this.leerComoDataUri(legacyPath);
      return { dataUri, nombre, mime: this.mimes[path.extname(legacyPath).toLowerCase()] ?? 'image/jpeg', existe: true };
    }
    return { dataUri: '', nombre: '', mime: '', existe: false };
  }

  /** Guarda un logo subido (jpg/gif/png) en la ruta fija de la empresa. */
  upload(key: string, file: any): LogoSrc {
    const k = key.toUpperCase();
    if (!EMPRESAS.includes(k)) throw new BadRequestException(`Empresa inválida: ${key}`);
    if (!file) throw new BadRequestException('Debe seleccionar un archivo de imagen');

    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!this.mimes[ext]) {
      throw new BadRequestException('Solo se permiten imágenes .jpg, .jpeg, .png o .gif');
    }

    const dir = this.dirEmpresa(k);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // eliminar logos previos de la misma empresa (distintas extensiones)
    fs.readdirSync(dir).forEach((f) => {
      if (this.mimes[path.extname(f).toLowerCase()]) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {
          /* ignore */
        }
      }
    });

    const destino = path.join(dir, `logo${ext}`);
    fs.writeFileSync(destino, file.buffer);

    const { dataUri, nombre, mime } = this.leerComoDataUri(destino);
    return { dataUri, nombre, mime, existe: true };
  }

  /** Ruta física actual del logo de la empresa (para servirlo / descargarlo). */
  getLogoPath(enterprise?: number | null): string | null {
    return this.getLogoPathForEmpresaKey(empresaKey(enterprise));
  }

  getLogoPathForEmpresaKey(key: string): string | null {
    return this.customLogoPath(key.toUpperCase());
  }

  getStorageDir(): string {
    return this.storageDir;
  }
}
