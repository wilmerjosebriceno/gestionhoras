import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomBytes } from 'crypto';
import { Actividad } from './entities/actividad.entity';
import { ActivityAttachment } from './entities/activity-attachment.entity';
import { UsuarioSgh } from './entities/usuario-sgh.entity';

export interface AdjuntoDto {
  id: number;
  idActivity: number;
  filename: string;
  mimetype: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy?: number | null;
}

/**
 * Gestiona los documentos adjuntos (PDF/JPG/PNG) de las actividades de horas.
 *
 * Los archivos se guardan en disco bajo una raiz configurable, organizados por
 * anio y numero de documento de la actividad:
 *   <SGH_ACTIVIDADES_STORAGE_ROOT | backend/storage/actividades>/{yyyy}/{numdoc}/
 * y su metadata se registra en `sgh_activity_attachment`.
 */
@Injectable()
export class ActivityAttachmentsService {
  private readonly logger = new Logger(ActivityAttachmentsService.name);

  /** MIMEs permitidos para adjuntos de actividad. */
  private readonly mimesPermitidos = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
  ]);

  constructor(
    @InjectRepository(Actividad)
    private readonly actividadRepo: Repository<Actividad>,
    @InjectRepository(ActivityAttachment)
    private readonly adjuntoRepo: Repository<ActivityAttachment>,
    @InjectRepository(UsuarioSgh)
    private readonly usuarioSghRepo: Repository<UsuarioSgh>,
  ) {}

  /** Raiz fisica donde se guardan los adjuntos (configurable por entorno). */
  get storageRoot(): string {
    const env = (process.env.SGH_ACTIVIDADES_STORAGE_ROOT || '').trim();
    return env || path.resolve(process.cwd(), 'storage', 'actividades');
  }

  /** Lista los adjuntos vigentes de una actividad. */
  async listar(idActivity: number): Promise<AdjuntoDto[]> {
    const filas = await this.adjuntoRepo.find({
      where: { idActivity, deletedAt: IsNull() },
      order: { id: 'DESC' },
    });
    return filas.map((f) => this.aDto(f));
  }

  /** Sube uno o varios archivos a la actividad indicada. */
  async agregar(
    idActivity: number,
    archivos: Express.Multer.File[],
    login?: string,
  ): Promise<AdjuntoDto[]> {
    if (!archivos || !archivos.length) {
      throw new BadRequestException('Sube al menos un archivo');
    }

    const actividad = await this.actividadRepo.findOne({
      where: { idActivity },
    });
    if (!actividad) {
      throw new NotFoundException(`Actividad ${idActivity} no encontrada`);
    }

    const carpeta = this.carpetaActividad(actividad);
    const dirAbsoluto = path.join(this.storageRoot, carpeta);
    await fs.promises.mkdir(dirAbsoluto, { recursive: true });

    const uploadedBy = await this.resolverUsuarioId(login);
    const registrados: AdjuntoDto[] = [];

    for (const file of archivos) {
      if (!this.mimesPermitidos.has(file.mimetype)) {
        throw new BadRequestException(
          `Tipo no permitido en "${file.originalname}": solo PDF, JPG/JPEG o PNG`,
        );
      }
      if (!file.buffer || file.buffer.length === 0) {
        throw new BadRequestException(`El archivo "${file.originalname}" está vacío`);
      }

      const extension =
        path.extname(file.originalname).toLowerCase().slice(0, 10) ||
        this.extensionPara(file.mimetype);
      const nombreFisico = `${Date.now().toString(36)}${randomBytes(6).toString('hex')}${extension}`;
      const storedName = `${carpeta}/${nombreFisico}`;

      await fs.promises.writeFile(path.join(dirAbsoluto, nombreFisico), file.buffer);

      const guardado = await this.adjuntoRepo.save(
        this.adjuntoRepo.create({
          idActivity,
          filename: (file.originalname || 'archivo').slice(0, 255),
          storedName,
          carpeta,
          mimetype: file.mimetype,
          sizeBytes: file.buffer.length,
          hashSha256: createHash('sha256').update(file.buffer).digest('hex'),
          uploadedBy,
          createdAt: new Date(),
          deletedAt: null,
        }),
      );
      registrados.push(this.aDto(guardado));
    }

    this.logger.log(
      `Adjuntos: ${registrados.length} archivo(s) a la actividad ${actividad.numdoc}`,
    );
    return registrados;
  }

  /** Datos para descargar un adjunto (ruta absoluta + nombre original). */
  async rutaDescarga(idActivity: number, adjuntoId: number) {
    const adjunto = await this.adjuntoRepo.findOne({
      where: { id: adjuntoId, idActivity, deletedAt: IsNull() },
    });
    if (!adjunto) throw new NotFoundException('Adjunto no encontrado');

    const ruta = path.join(this.storageRoot, adjunto.storedName);
    try {
      await fs.promises.access(ruta);
    } catch {
      throw new NotFoundException('El archivo no existe en el servidor');
    }

    return { ruta, nombre: adjunto.filename, mimetype: adjunto.mimetype };
  }

  /** Baja logica + borrado fisico de un adjunto puntual. */
  async eliminar(idActivity: number, adjuntoId: number) {
    const adjunto = await this.adjuntoRepo.findOne({
      where: { id: adjuntoId, idActivity, deletedAt: IsNull() },
    });
    if (!adjunto) throw new NotFoundException('Adjunto no encontrado');

    await this.borrarArchivo(adjunto.storedName);
    adjunto.deletedAt = new Date();
    await this.adjuntoRepo.save(adjunto);
    return { eliminado: true, id: adjunto.id };
  }

  /**
   * Al anular la actividad: borra fisicamente los archivos y marca los
   * registros como eliminados (libera espacio sin perder la trazabilidad).
   */
  async eliminarFisicosDeActividad(idActivity: number): Promise<void> {
    const adjuntos = await this.adjuntoRepo.find({
      where: { idActivity, deletedAt: IsNull() },
    });
    if (!adjuntos.length) return;

    for (const adjunto of adjuntos) {
      await this.borrarArchivo(adjunto.storedName);
      adjunto.deletedAt = new Date();
      await this.adjuntoRepo.save(adjunto);
    }
    this.logger.log(
      `Adjuntos: ${adjuntos.length} archivo(s) eliminados de la actividad ${idActivity} (anulada)`,
    );
  }

  /** Al eliminar la actividad: borra archivos y registros. */
  async eliminarTodosDeActividad(idActivity: number): Promise<void> {
    const adjuntos = await this.adjuntoRepo.find({ where: { idActivity } });
    if (!adjuntos.length) return;

    for (const adjunto of adjuntos) {
      await this.borrarArchivo(adjunto.storedName);
    }
    await this.adjuntoRepo.delete({ idActivity });
    await this.borrarCarpetaDeActividad(idActivity);
  }

  /* ==================== Helpers ==================== */

  private aDto(f: ActivityAttachment): AdjuntoDto {
    return {
      id: f.id,
      idActivity: f.idActivity,
      filename: f.filename,
      mimetype: f.mimetype,
      sizeBytes: Number(f.sizeBytes),
      createdAt: f.createdAt,
      uploadedBy: f.uploadedBy ?? null,
    };
  }

  /** Carpeta `{yyyy}/{numdoc}` de una actividad. */
  private carpetaActividad(actividad: Actividad): string {
    const anio =
      this.anioDesdeNumdoc(actividad.numdoc) ??
      (actividad.dateDocument
        ? String(actividad.dateDocument).slice(0, 4)
        : String(new Date().getFullYear()));
    const numdoc = this.sanearSegmento(actividad.numdoc || String(actividad.idActivity));
    return `${anio}/${numdoc}`;
  }

  private anioDesdeNumdoc(numdoc?: string): string | null {
    const m = /^(\d{4})-/.exec(numdoc || '');
    return m ? m[1] : null;
  }

  /** Evita caracteres de ruta en un segmento de carpeta. */
  private sanearSegmento(valor: string): string {
    return valor.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
  }

  private async borrarArchivo(storedName: string): Promise<void> {
    try {
      await fs.promises.unlink(path.join(this.storageRoot, storedName));
    } catch {
      // El archivo fisico pudo no existir: se continua con la baja logica.
    }
  }

  private async borrarCarpetaDeActividad(idActivity: number): Promise<void> {
    try {
      const actividad = await this.actividadRepo.findOne({ where: { idActivity } });
      if (!actividad) return;
      const dir = path.join(this.storageRoot, this.carpetaActividad(actividad));
      await fs.promises.rm(dir, { recursive: true, force: true });
    } catch {
      // La carpeta pudo no existir.
    }
  }

  private async resolverUsuarioId(login?: string): Promise<number | null> {
    if (!login) return null;
    try {
      const usuario = await this.usuarioSghRepo.findOne({ where: { login } });
      return usuario?.idUser ?? null;
    } catch {
      return null;
    }
  }

  private extensionPara(mimetype: string): string {
    return (
      {
        'application/pdf': '.pdf',
        'image/jpeg': '.jpg',
        'image/png': '.png',
      } as Record<string, string>
    )[mimetype] || '.bin';
  }
}
