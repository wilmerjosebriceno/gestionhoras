import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Documento adjunto (PDF/JPG/PNG) de una actividad (`sgh_activity`).
 *
 * El archivo fisico vive en `<storageRoot>/{yyyy}/{numdoc}/<nombreFisico>` y
 * esta fila conserva el nombre original, metadatos y auditoria. La baja es
 * logica (`deletedAt`); al anular la actividad tambien se borra el archivo.
 */
@Entity({ name: 'sgh_activity_attachment' })
export class ActivityAttachment {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'id_activity', type: 'int' })
  idActivity: number;

  /** Nombre original del archivo (el que ve el usuario). */
  @Column({ name: 'filename', type: 'varchar', length: 255 })
  filename: string;

  /** Ruta relativa dentro de la raiz de almacenamiento: `{yyyy}/{numdoc}/{archivo}`. */
  @Column({ name: 'stored_name', type: 'varchar', length: 500 })
  storedName: string;

  /** Carpeta de la actividad: `{yyyy}/{numdoc}`. */
  @Column({ name: 'carpeta', type: 'varchar', length: 255 })
  carpeta: string;

  @Column({ name: 'mimetype', type: 'varchar', length: 150 })
  mimetype: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: number;

  @Column({ name: 'hash_sha256', type: 'char', length: 64, nullable: true })
  hashSha256?: string | null;

  @Column({ name: 'uploaded_by', type: 'int', nullable: true })
  uploadedBy?: number | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
