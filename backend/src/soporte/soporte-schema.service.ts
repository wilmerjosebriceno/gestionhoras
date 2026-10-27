import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Auto-reparacion del esquema que necesita la integracion con MantisBT.
 *
 * Los tickets viven en el esquema `sigespweb` (compartido con el portal web).
 * Para vincular un ticket con su incidencia en Mantis se usa la columna
 * `sigespweb.tickets.mantis_issue_id`. Para no depender de que alguien aplique
 * el .sql a mano, al arrancar se verifica y, si falta, se agrega sola.
 * Replica 1840000000000-sigespweb-ticket-mantis-issue.sql (idempotente).
 */
@Injectable()
export class SoporteSchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SoporteSchemaService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.asegurarMantisIssueId();
    } catch (e: any) {
      this.logger.error(
        `No se pudo verificar/crear la columna sigespweb.tickets.mantis_issue_id: ${e?.message ?? e}`,
      );
    }
    try {
      await this.asegurarEspejoMantis();
    } catch (e: any) {
      this.logger.error(
        `No se pudo verificar/crear el espejo de Mantis: ${e?.message ?? e}`,
      );
    }
    try {
      await this.asegurarTablaAlertas();
    } catch (e: any) {
      this.logger.error(
        `No se pudo verificar/crear sigespweb.ticket_alertas: ${e?.message ?? e}`,
      );
    }
    try {
      await this.asegurarCodigoCategoria();
    } catch (e: any) {
      this.logger.error(
        `No se pudo verificar/crear sigespweb.ticket_categories.codigo: ${e?.message ?? e}`,
      );
    }
    try {
      await this.asegurarBorradoMensajes();
    } catch (e: any) {
      this.logger.error(
        `No se pudo verificar/crear el borrado de sigespweb.ticket_messages: ${e?.message ?? e}`,
      );
    }
  }

  /** Agrega las columnas de baja logica a los comentarios de tickets. */
  private async asegurarBorradoMensajes(): Promise<void> {
    await this.dataSource.query(
      `ALTER TABLE sigespweb.ticket_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
    );
    await this.dataSource.query(
      `ALTER TABLE sigespweb.ticket_messages ADD COLUMN IF NOT EXISTS deleted_by INTEGER`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_messages_vigentes
         ON sigespweb.ticket_messages (ticket_id) WHERE deleted_at IS NULL`,
    );
  }

  /** Agrega el codigo de modulo a las categorias y siembra los codigos ERP. */
  private async asegurarCodigoCategoria(): Promise<void> {
    await this.dataSource.query(
      `ALTER TABLE sigespweb.ticket_categories ADD COLUMN IF NOT EXISTS codigo VARCHAR(10)`,
    );
    // Codigos iniciales (no pisa valores ya definidos). Patrones ASCII.
    await this.dataSource.query(
      `UPDATE sigespweb.ticket_categories SET codigo = 'SCG' WHERE codigo IS NULL AND nombre ILIKE 'ERP Contabilidad'`,
    );
    await this.dataSource.query(
      `UPDATE sigespweb.ticket_categories SET codigo = 'SPG' WHERE codigo IS NULL AND nombre ILIKE 'ERP Presupuesto'`,
    );
    await this.dataSource.query(
      `UPDATE sigespweb.ticket_categories SET codigo = 'SCA' WHERE codigo IS NULL AND nombre ILIKE 'ERP Compras'`,
    );
    await this.dataSource.query(
      `UPDATE sigespweb.ticket_categories SET codigo = 'SIN' WHERE codigo IS NULL AND nombre ILIKE 'ERP Inventario'`,
    );
    await this.dataSource.query(
      `UPDATE sigespweb.ticket_categories SET codigo = 'SNM' WHERE codigo IS NULL AND nombre LIKE 'ERP N%mina'`,
    );
  }

  /** Crea (si falta) la tabla de alertas de casos sin atender. */
  private async asegurarTablaAlertas(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS sigespweb.ticket_alertas (
        id                  SERIAL PRIMARY KEY,
        ticket_id           INTEGER NOT NULL REFERENCES sigespweb.tickets(id) ON DELETE CASCADE,
        tipo                VARCHAR(30) NOT NULL DEFAULT 'sin_atender_24h',
        detectado_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fecha_limite        TIMESTAMPTZ,
        horas_transcurridas NUMERIC(10,2),
        correo_enviado_at   TIMESTAMPTZ,
        destinatarios       TEXT,
        UNIQUE (ticket_id, tipo)
      )`);
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_alertas_tipo ON sigespweb.ticket_alertas (tipo, correo_enviado_at)`,
    );
  }

  /** Crea (si faltan) las tablas del espejo local de Mantis y su estado de sync. */
  private async asegurarEspejoMantis(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS sigespweb.mantis_issue (
        id              INTEGER PRIMARY KEY,
        summary         VARCHAR(300),
        project_id      INTEGER, project_name    VARCHAR(250),
        category_id     INTEGER, category_name   VARCHAR(150),
        status_id       INTEGER, status_name     VARCHAR(50),
        resolution_id   INTEGER, resolution_name VARCHAR(60),
        priority_id     INTEGER, priority_name   VARCHAR(40),
        severity_id     INTEGER, severity_name   VARCHAR(40),
        handler_id      INTEGER, handler_name    VARCHAR(150),
        reporter_id     INTEGER, reporter_name   VARCHAR(150),
        created_at      TIMESTAMPTZ, updated_at      TIMESTAMPTZ,
        acknowledged_at TIMESTAMPTZ, assigned_at     TIMESTAMPTZ,
        resolved_at     TIMESTAMPTZ, closed_at       TIMESTAMPTZ,
        reopened_count  INTEGER NOT NULL DEFAULT 0,
        synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_mantis_issue_proyecto ON sigespweb.mantis_issue (project_id)`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_mantis_issue_estado ON sigespweb.mantis_issue (status_id)`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_mantis_issue_handler ON sigespweb.mantis_issue (handler_id)`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_mantis_issue_creado ON sigespweb.mantis_issue (created_at)`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_mantis_issue_resuelto ON sigespweb.mantis_issue (resolved_at)`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_mantis_issue_cerrado ON sigespweb.mantis_issue (closed_at)`,
    );
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS sigespweb.mantis_sync_state (
        id          SMALLINT PRIMARY KEY DEFAULT 1,
        ultima_sync TIMESTAMPTZ,
        en_proceso  BOOLEAN NOT NULL DEFAULT FALSE,
        total       INTEGER NOT NULL DEFAULT 0,
        detalle     TEXT
      )`);
    await this.dataSource.query(
      `INSERT INTO sigespweb.mantis_sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
    );
    // Fase 2: espejo de comentarios (notas) por caso.
    await this.dataSource.query(
      `ALTER TABLE sigespweb.mantis_issue ADD COLUMN IF NOT EXISTS notes_synced BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS sigespweb.mantis_issue_note (
        id          INTEGER PRIMARY KEY,
        issue_id    INTEGER NOT NULL,
        autor       VARCHAR(150),
        reporter_id INTEGER,
        created_at  TIMESTAMPTZ,
        texto       TEXT,
        privada     BOOLEAN NOT NULL DEFAULT FALSE,
        synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_mantis_note_issue ON sigespweb.mantis_issue_note (issue_id)`,
    );
  }

  private async asegurarMantisIssueId(): Promise<void> {
    const [tabla] = await this.dataSource.query(
      `SELECT to_regclass('sigespweb.tickets') AS tabla`,
    );
    if (!tabla?.tabla) {
      this.logger.warn(
        'La tabla sigespweb.tickets no existe: no se puede verificar la columna mantis_issue_id.',
      );
      return;
    }

    const filas: Array<{ existe: boolean }> = await this.dataSource.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'sigespweb'
            AND table_name = 'tickets'
            AND column_name = 'mantis_issue_id'
       ) AS existe`,
    );
    if (filas[0]?.existe) return;

    this.logger.warn('Falta la columna sigespweb.tickets.mantis_issue_id. Agregandola...');
    await this.dataSource.query(
      `ALTER TABLE sigespweb.tickets ADD COLUMN IF NOT EXISTS mantis_issue_id INTEGER NULL`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_tickets_mantis_issue ON sigespweb.tickets (mantis_issue_id)`,
    );
    this.logger.log('Columna sigespweb.tickets.mantis_issue_id asegurada.');
  }
}
