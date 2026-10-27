import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Auto-reparacion del esquema que necesita el detalle de actividades.
 *
 * El detalle (`sgh_dt_activity`) usa el campo `online` (1 = online,
 * 0 = presencial) para el filtro de Modalidad del Generador de Reportes.
 * Si la columna no existe, el backend falla al leer o guardar el detalle.
 *
 * Para no depender de que alguien recuerde aplicar el .sql, al arrancar se
 * verifica y, si falta, se agrega sola. Replica el paso de
 * 1800000000000-sgh-dt-activity-online.sql (idempotente).
 */
@Injectable()
export class ActividadesSchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ActividadesSchemaService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.asegurarColumnaOnline();
    } catch (e: any) {
      this.logger.error(
        `No se pudo verificar/crear la columna sgh_dt_activity.online: ${e?.message ?? e}`,
      );
    }

    try {
      await this.asegurarTablaAdjuntos();
    } catch (e: any) {
      this.logger.error(
        `No se pudo verificar/crear la tabla sgh_activity_attachment: ${e?.message ?? e}`,
      );
    }
  }

  /**
   * Crea la tabla de adjuntos de actividad si no existe (replica
   * 1870000000000-sgh-activity-attachment.sql, idempotente).
   */
  private async asegurarTablaAdjuntos(): Promise<void> {
    const [tabla] = await this.dataSource.query(
      `SELECT to_regclass('sgh_activity_attachment') AS tabla`,
    );
    if (tabla?.tabla) return;

    this.logger.warn('Falta la tabla sgh_activity_attachment. Creandola...');
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS sgh_activity_attachment (
        id             SERIAL PRIMARY KEY,
        id_activity    INTEGER NOT NULL,
        filename       VARCHAR(255) NOT NULL,
        stored_name    VARCHAR(500) NOT NULL,
        carpeta        VARCHAR(255) NOT NULL,
        mimetype       VARCHAR(150) NOT NULL,
        size_bytes     BIGINT NOT NULL,
        hash_sha256    CHAR(64) NULL,
        uploaded_by    INTEGER NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at     TIMESTAMPTZ NULL
      )
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_sgh_attach_activity
        ON sgh_activity_attachment (id_activity)
        WHERE deleted_at IS NULL
    `);
    this.logger.log('Tabla sgh_activity_attachment asegurada.');
  }

  private async asegurarColumnaOnline(): Promise<void> {
    const [tabla] = await this.dataSource.query(
      `SELECT to_regclass('sgh_dt_activity') AS tabla`,
    );
    if (!tabla?.tabla) {
      this.logger.warn(
        'La tabla sgh_dt_activity no existe: no se puede verificar la columna online.',
      );
      return;
    }

    const filas: Array<{ existe: boolean }> = await this.dataSource.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'sgh_dt_activity'
            AND column_name = 'online'
       ) AS existe`,
    );
    if (filas[0]?.existe) return;

    this.logger.warn('Falta la columna sgh_dt_activity.online. Agregandola...');
    await this.dataSource.query(
      `ALTER TABLE sgh_dt_activity ADD COLUMN IF NOT EXISTS online INT2 NULL DEFAULT 0`,
    );
    this.logger.log(
      'Columna sgh_dt_activity.online asegurada (1 = online, 0 = presencial).',
    );
  }
}
