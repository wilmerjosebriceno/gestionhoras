import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Auto-reparacion del esquema que necesita el resumen del Monitor de Horas.
 *
 * El resumen se agrupa por PROYECTO + NOTA, asi que `buildSummary` hace UPSERT:
 *
 *   ON CONFLICT (id_user, scrin_project_id, date_from, date_to,
 *                md5(btrim(coalesce(note, ''))))
 *
 * Si ese indice unico no existe (o quedo con la definicion antigua, sin la nota),
 * la pantalla falla con:
 *
 *   "no hay restriccion unica o de exclusion que coincida con la
 *    especificacion ON CONFLICT"
 *
 * Para no depender de que alguien recuerde aplicar el .sql, al arrancar se
 * verifica la definicion del indice y, si no es la correcta, se recrea solo.
 * La operacion es idempotente y no borra resumenes (salvo duplicados exactos
 * de la clave, conservando el procesado mas reciente).
 */
@Injectable()
export class ScrinSchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScrinSchemaService.name);

  /** Lock para que varias instancias no reparen a la vez. */
  private static readonly LOCK_KEY = 918273645;

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.asegurarIndiceResumen();
    } catch (e: any) {
      this.logger.error(
        `No se pudo verificar/crear el indice uq_scrin_summary_group: ${e?.message ?? e}`,
      );
    }
  }

  private async asegurarIndiceResumen(): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SELECT pg_advisory_lock(${ScrinSchemaService.LOCK_KEY})`);

      // La tabla la crea 1780000000000-sgh-scrin-monitor.sql.
      const [tabla] = await qr.query(
        `SELECT to_regclass('sgh_scrin_summary') AS tabla`,
      );
      if (!tabla?.tabla) {
        this.logger.warn(
          'La tabla sgh_scrin_summary no existe. Aplique primero ' +
            'src/migrations/1780000000000-sgh-scrin-monitor.sql',
        );
        return;
      }

      const filas: Array<{ indexdef: string }> = await qr.query(
        `SELECT indexdef FROM pg_indexes
          WHERE indexname = 'uq_scrin_summary_group'
            AND schemaname NOT IN ('pg_catalog', 'information_schema')`,
      );
      const definicion: string | null = filas[0]?.indexdef ?? null;
      const definicionOk = !!definicion && /md5\s*\(\s*btrim/i.test(definicion);

      // Indice de apoyo del buscador de grupo (idempotente).
      const asegurarApoyo = () =>
        qr.query(
          `CREATE INDEX IF NOT EXISTS idx_scrin_summary_user_proyecto
             ON sgh_scrin_summary (id_user, scrin_project_id, date_from, date_to)`,
        );

      // Ya esta correcto: el indice incluye md5(btrim(...note...)).
      if (definicionOk) {
        await asegurarApoyo();
        return;
      }

      this.logger.warn(
        definicion
          ? 'El indice uq_scrin_summary_group no incluye la nota (definicion antigua). Recreando...'
          : 'Falta el indice uq_scrin_summary_group. Creandolo...',
      );

      // 0) Resumenes PENDIENTES del modelo anterior (agrupados solo por proyecto,
      //    con nota nula): bajo el modelo nuevo son inutiles (al procesarlos
      //    fallaria) y son regenerables desde la pantalla. Esto replica el paso 2
      //    de 1790000000000-sgh-scrin-summary-por-nota.sql.
      //    (Se usa un CTE que termina en SELECT porque `DELETE ... RETURNING`
      //    devuelve [filas, afectadas], no las filas directamente.)
      const [{ total: pendientesViejos }]: Array<{ total: number }> = await qr.query(
        `WITH borrados AS (
           DELETE FROM sgh_scrin_summary
            WHERE status = 0 AND note IS NULL
           RETURNING id_scrin_summary
         )
         SELECT count(*)::int AS total FROM borrados`,
      );
      if (pendientesViejos > 0) {
        this.logger.warn(
          `Se eliminaron ${pendientesViejos} resumen(es) pendiente(s) del modelo anterior ` +
            '(agrupados solo por proyecto).',
        );
      }

      // 1) Duplicados exactos de la nueva clave: solo pueden existir si el
      //    indice estuvo ausente, asi que hay que limpiarlos para poder crearlo.
      //    Se conserva el "mejor": procesado > con proyecto asignado > mas
      //    reciente. Los eliminados se reportan en el log.
      const [{ total: duplicados }]: Array<{ total: number }> = await qr.query(
        `WITH borrados AS (
           DELETE FROM sgh_scrin_summary s
             USING sgh_scrin_summary d
            WHERE s.id_scrin_summary <> d.id_scrin_summary
              AND s.id_user IS NOT DISTINCT FROM d.id_user
              AND s.scrin_project_id IS NOT DISTINCT FROM d.scrin_project_id
              AND s.date_from IS NOT DISTINCT FROM d.date_from
              AND s.date_to IS NOT DISTINCT FROM d.date_to
              AND md5(btrim(coalesce(s.note, ''))) = md5(btrim(coalesce(d.note, '')))
              AND (s.status, (s.id_proyect IS NOT NULL)::int, s.id_scrin_summary)
                < (d.status, (d.id_proyect IS NOT NULL)::int, d.id_scrin_summary)
           RETURNING s.id_scrin_summary
         )
         SELECT count(*)::int AS total FROM borrados`,
      );
      if (duplicados > 0) {
        this.logger.warn(
          `Se eliminaron ${duplicados} resumen(es) duplicado(s) antes de crear el indice.`,
        );
      }

      // 2) Recrear el indice unico que exige el UPSERT.
      await qr.query(`DROP INDEX IF EXISTS uq_scrin_summary_group`);
      await qr.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_scrin_summary_group
           ON sgh_scrin_summary (
             id_user, scrin_project_id, date_from, date_to,
             md5(btrim(coalesce(note, '')))
           )`,
      );

      // 3) Indice de apoyo del buscador de grupo.
      await asegurarApoyo();

      this.logger.log(
        'Indice uq_scrin_summary_group asegurado (resumen por proyecto + nota).',
      );
    } finally {
      try {
        await qr.query(`SELECT pg_advisory_unlock(${ScrinSchemaService.LOCK_KEY})`);
      } catch {
        /* la conexion se libera igual */
      }
      await qr.release();
    }
  }
}
