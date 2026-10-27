import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MantisClientService } from '../mantis/mantis-client.service';
import { sanearLATIN9 } from '../common/latin9.util';

const PAGE_SIZE = 250;
const TIMEOUT_MS = 90000; // una pagina puede tardar: Mantis devuelve el historial completo
const FILAS_POR_INSERT = 200;
const REFRESCO_MS = 6 * 60 * 60 * 1000; // cada 6 horas

/** Columnas del espejo local de Mantis. */
const COLUMNAS = [
  'id', 'summary', 'project_id', 'project_name', 'category_id', 'category_name',
  'status_id', 'status_name', 'resolution_id', 'resolution_name',
  'priority_id', 'priority_name', 'severity_id', 'severity_name',
  'handler_id', 'handler_name', 'reporter_id', 'reporter_name',
  'created_at', 'updated_at', 'acknowledged_at', 'assigned_at', 'resolved_at',
  'closed_at', 'reopened_count', 'notes_synced',
];

/**
 * Mantiene el espejo local (`sigespweb.mantis_issue`) sincronizado con MantisBT.
 *
 * Se ejecuta: al arrancar si el espejo esta vacio, cada 6 horas y a demanda
 * (POST /soporte/mantis/sincronizar). Nunca en paralelo. La sincronizacion
 * completa de ~10.000 casos tarda unos minutos y corre en segundo plano: el
 * dashboard siempre responde desde el espejo.
 */
@Injectable()
export class MantisSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MantisSyncService.name);
  private enProceso = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly dataSource: DataSource,
    private readonly mantis: MantisClientService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Si el proceso anterior quedo a medias, se limpia la bandera.
    await this.dataSource
      .query(`UPDATE sigespweb.mantis_sync_state SET en_proceso = FALSE WHERE id = 1`)
      .catch(() => undefined);

    this.timer = setInterval(() => {
      this.sincronizar('programado').catch(() => undefined);
    }, REFRESCO_MS);

    // Primera carga: solo si el espejo esta vacio; no bloquea el arranque.
    const filas = await this.dataSource
      .query(`SELECT count(*)::int AS total FROM sigespweb.mantis_issue`)
      .catch(() => [{ total: 1 }]);
    if (Number(filas?.[0]?.total ?? 0) === 0) {
      this.logger.log('Espejo de Mantis vacio: iniciando primera sincronizacion en segundo plano...');
      this.sincronizar('inicial').catch(() => undefined);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Estado actual del espejo y del sincronizador. */
  async estado() {
    const [fila] = await this.dataSource.query(
      `SELECT ultima_sync AS "ultimaSync", total, detalle,
              (SELECT max(synced_at) FROM sigespweb.mantis_issue) AS "maxSync"
         FROM sigespweb.mantis_sync_state WHERE id = 1`,
    );
    const [conteo] = await this.dataSource.query(
      `SELECT count(*)::int AS casos FROM sigespweb.mantis_issue`,
    );
    return {
      sincronizando: this.enProceso,
      ultimaSync: fila?.ultimaSync ?? null,
      ultimaFila: fila?.maxSync ?? null,
      casos: Number(conteo?.casos ?? 0),
      detalle: fila?.detalle ?? null,
    };
  }

  /** Lanza la sincronización sin bloquear la respuesta HTTP. */
  iniciarEnSegundoPlano(motivo = 'manual'): { iniciado: boolean; mensaje: string } {
    if (this.enProceso) {
      return { iniciado: false, mensaje: 'Ya hay una sincronización en curso.' };
    }
    this.sincronizar(motivo).catch(() => undefined);
    return { iniciado: true, mensaje: 'Sincronización iniciada en segundo plano.' };
  }

  /** Sincroniza el espejo local con Mantis. No permite ejecuciones simultaneas. */
  async sincronizar(motivo = 'manual'): Promise<{ yaEnProceso: boolean; mensaje: string }> {    if (this.enProceso) {
      return { yaEnProceso: true, mensaje: 'Ya hay una sincronización en curso.' };
    }
    this.enProceso = true;
    const t0 = Date.now();
    await this.marcar(true, 'Sincronizando...');
    this.logger.log(`Sincronización de Mantis iniciada (${motivo})`);

    let total = 0;
    try {
      for (let page = 1; page <= 100; page++) {
        const issues = await this.mantis.issuesPagina(page, PAGE_SIZE, TIMEOUT_MS);
        if (!issues.length) break;
        await this.guardar(issues);
        total += issues.length;
        if (issues.length < PAGE_SIZE) break;
      }
      const seg = ((Date.now() - t0) / 1000).toFixed(1);
      await this.marcar(false, `${total} casos en ${seg}s`);
      this.logger.log(`Sincronización de Mantis completada: ${total} casos en ${seg}s`);
      return { yaEnProceso: false, mensaje: `${total} casos sincronizados en ${seg}s` };
    } catch (e: any) {
      await this.marcar(false, `Error: ${e?.message ?? e}`);
      this.logger.error(`Error sincronizando Mantis: ${e?.message ?? e}`);
      throw e;
    } finally {
      this.enProceso = false;
    }
  }

  private async marcar(enProceso: boolean, detalle: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE sigespweb.mantis_sync_state
          SET en_proceso = $1,
              detalle = $2,
              ultima_sync = CASE WHEN $1 THEN ultima_sync ELSE NOW() END
        WHERE id = 1`,
      [enProceso, sanearLATIN9(detalle)],
    );
  }

  /** Extrae del historial las fechas de cada hito y las reaperturas. */
  private hitos(issue: any) {
    let acknowledged: string | null = null;
    let assigned: string | null = null;
    let resolved: string | null = null;
    let closed: string | null = null;
    let reabiertos = 0;

    for (const h of issue?.history ?? []) {
      if (h?.field?.name !== 'status') continue;
      const nuevo = h?.new_value?.name;
      const viejo = h?.old_value?.name;
      const f = h?.created_at ?? null;
      if (!f) continue;

      if ((nuevo === 'acknowledged' || nuevo === 'confirmed') && !acknowledged) acknowledged = f;
      else if (nuevo === 'assigned' && !assigned) assigned = f;
      else if (nuevo === 'resolved' && !resolved) resolved = f;
      else if (nuevo === 'closed' && !closed) closed = f;

      if (
        (viejo === 'resolved' || viejo === 'closed') &&
        nuevo &&
        nuevo !== 'resolved' &&
        nuevo !== 'closed'
      ) {
        reabiertos++;
      }
    }
    return { acknowledged, assigned, resolved, closed, reabiertos };
  }

  private texto(v: unknown, max: number): string | null {
    return v == null ? null : sanearLATIN9(String(v)).slice(0, max);
  }

  private entero(v: unknown): number | null {
    return v == null || v === '' ? null : Number(v);
  }

  private persona(u: any): string | null {
    if (!u) return null;
    return sanearLATIN9(String(u.real_name || u.name || u.id)).slice(0, 150);
  }

  private async guardar(issues: any[]): Promise<void> {
    for (let i = 0; i < issues.length; i += FILAS_POR_INSERT) {
      const lote = issues.slice(i, i + FILAS_POR_INSERT);
      const valores: unknown[] = [];
      const grupos = lote.map((it) => {
        const h = this.hitos(it);
        const fila = [
          this.entero(it.id),
          this.texto(it.summary, 300),
          this.entero(it.project?.id),
          this.texto(it.project?.name, 250),
          this.entero(it.category?.id),
          this.texto(it.category?.name, 150),
          this.entero(it.status?.id),
          this.texto(it.status?.name, 50),
          this.entero(it.resolution?.id),
          this.texto(it.resolution?.name, 60),
          this.entero(it.priority?.id),
          this.texto(it.priority?.name, 40),
          this.entero(it.severity?.id),
          this.texto(it.severity?.name, 40),
          this.entero(it.handler?.id),
          this.persona(it.handler),
          this.entero(it.reporter?.id),
          this.persona(it.reporter),
          it.created_at ?? null,
          it.updated_at ?? null,
          h.acknowledged,
          h.assigned,
          h.resolved,
          h.closed,
          h.reabiertos,
          Array.isArray(it.notes),
        ];
        const marcas = fila.map((v) => {
          valores.push(v);
          return `$${valores.length}`;
        });
        return `(${marcas.join(',')})`;
      });

      const actualizaciones = COLUMNAS.filter((c) => c !== 'id')
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(', ');

      await this.dataSource.query(
        `INSERT INTO sigespweb.mantis_issue (${COLUMNAS.join(', ')})
         VALUES ${grupos.join(', ')}
         ON CONFLICT (id) DO UPDATE SET ${actualizaciones}, synced_at = NOW()`,
        valores,
      );
      await this.guardarNotas(lote);
    }
  }

  /** Upsert de los comentarios (notas) de un lote de casos. */
  private async guardarNotas(issues: any[]): Promise<void> {
    const filas: unknown[][] = [];
    for (const it of issues) {
      if (!Array.isArray(it.notes)) continue;
      for (const n of it.notes) {
        if (!n || n.id == null) continue;
        filas.push([
          this.entero(n.id),
          this.entero(it.id),
          this.persona(n.reporter) ?? this.persona(n.user),
          this.entero(n.reporter?.id ?? n.user?.id),
          n.created_at ?? n.date_submitted ?? null,
          this.texto(n.text, 8000),
          this.esPrivada(n),
        ]);
      }
    }
    if (!filas.length) return;

    const LOTE = 500;
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE);
      const valores: unknown[] = [];
      const grupos = lote.map((fila) => {
        const marcas = fila.map((v) => {
          valores.push(v);
          return `$${valores.length}`;
        });
        return `(${marcas.join(',')})`;
      });
      await this.dataSource.query(
        `INSERT INTO sigespweb.mantis_issue_note (id, issue_id, autor, reporter_id, created_at, texto, privada)
         VALUES ${grupos.join(',')}
         ON CONFLICT (id) DO UPDATE SET
           issue_id    = EXCLUDED.issue_id,
           autor       = EXCLUDED.autor,
           reporter_id = EXCLUDED.reporter_id,
           created_at  = EXCLUDED.created_at,
           texto       = EXCLUDED.texto,
           privada     = EXCLUDED.privada,
           synced_at   = NOW()`,
        valores,
      );
    }
  }

  private esPrivada(n: any): boolean {
    const vs = String(n?.view_state?.name ?? '').toLowerCase();
    return vs.includes('priv') || String(n?.view_state?.id ?? '') === '50';
  }
}
